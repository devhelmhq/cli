/**
 * Code-monitor half of `plan` / `deploy` (doc 42 §6.3, doc 32 D-6).
 *
 *   - binding: each YAML code monitor binds to the API monitor of the same
 *     name in its declared environment; `key:` re-binds a renamed monitor
 *     by its owner address;
 *   - ownership: deploy never updates a monitor this project does not own
 *     (state, or Git-owned with `ownerProject == project`); `--adopt <name>`
 *     transfers it first;
 *   - details for plan: changed files, owner, overlays, live-code drift;
 *   - the test phase: new monitors run an ad-hoc validation run, changed
 *     code goes to a draft and its validation run; all start in parallel up
 *     to `--test-concurrency` and are waited for until `--timeout`.
 */
import type {z} from 'zod'
import {createHash} from 'node:crypto'
import {apiGetSingle, checkedFetch, type ApiClient} from '../api-client.js'
import {schemas as apiSchemas} from '../api-zod.generated.js'
import {DevhelmError, WaitTimeoutError} from '../errors.js'

/** The monitor as the YAML engine's refs hold it (generated wire type). */
type MonitorDto = components['schemas']['MonitorDto']
import {getRevisionFiles} from '../monitors/revisions.js'
import {ownerLabel} from '../monitors/resolve.js'
import {fetchPaginated} from '../typed-api.js'
import type {components} from '../api.generated.js'
import {parse, parseSingle} from '../response-validation.js'
import {runPool} from '../runs/pool.js'
import {startValidationRun} from '../runs/start.js'
import {registerStartedRun} from '../runs/registry.js'
import {isFlaky, verdictOf} from '../runs/outcome.js'
import type {RunSessionContext} from '../runs/session.js'
import {waitForRun, type RunDto} from '../runs/wait.js'
import type {Changeset, DeployState, DevhelmConfig, ResolvedRefs} from '../yaml/index.js'
import {OWNER_TOOL, isGitOwner, ownerAddress, type CodeMonitorState} from '../yaml/project-context.js'

type ScriptConfig = z.infer<typeof apiSchemas.ScriptMonitorConfig>
import {isCodeMonitor} from '../yaml/transform.js'
import {ownedByProject} from './test-runner.js'

export interface Unowned {
  name: string
  id: string
  owner: string
}

export interface BindResult {
  unowned: Unowned[]
  adopt: MonitorDto[]
  /** Monitors with no `project:` that match by name and are Git-owned without a project. */
  legacy: string[]
}

/**
 * Bind YAML monitors to API monitors and classify ownership. Mutates
 * `refs` so the differ sees the right monitor (or a create).
 */
export async function bindMonitors(
  client: ApiClient,
  config: DevhelmConfig,
  refs: ResolvedRefs,
  opts: {state?: DeployState; adopt?: string[]},
): Promise<BindResult> {
  const project = config.project
  const out: BindResult = {unowned: [], adopt: [], legacy: []}
  const adopt = new Set(opts.adopt ?? [])
  for (const m of config.monitors ?? []) {
    let entry = refs.get('monitors', m.name)
    // key: re-bind a renamed monitor by its owner address.
    if (m.key && project) {
      const address = ownerAddress(project, m.key)
      const byAddress = refs.allEntries('monitors').find((e) => !e.isPending && (e.raw as MonitorDto).owner?.address === address)
      if (byAddress && byAddress.refKey !== m.name) {
        refs.set('monitors', m.name, {...byAddress, refKey: m.name, matchSource: 'state'})
        entry = refs.get('monitors', m.name)
      }
    }
    if (!entry || entry.isPending) continue
    let api = entry.raw as MonitorDto
    // The list omits the live revision; code monitors need it for the code diff.
    if (isCodeMonitor(m) && api.liveRevisionDigest === undefined) {
      const full = await checkedFetch(client.GET('/api/v1/monitors/{id}', {params: {path: {id: api.id}}}))
      if (full?.data) {
        api = full.data
        refs.set('monitors', m.name, {...entry, raw: api})
      }
    }
    // One environment per monitor: a same-named monitor elsewhere is not this one.
    if (isCodeMonitor(m) && m.environment && api.environment?.slug !== m.environment) {
      const sameName = await fetchPaginated<MonitorDto>(client, '/api/v1/monitors', 100, {name: m.name, search: m.name})
      const envMatch = sameName.find((x) => x.name === m.name && x.environment?.slug === m.environment)
      if (envMatch) {
        refs.set('monitors', m.name, {id: envMatch.id, refKey: m.name, managedBy: envMatch.managedBy, raw: envMatch, matchSource: 'state'})
        api = envMatch
      } else {
        refs.set('monitors', m.name, {id: `__pending__:monitors:${m.name}`, refKey: m.name, raw: m as never, isPending: true})
        continue
      }
    }
    if (entry.matchSource === 'state' || ownedByProject(api, project, opts.state)) continue
    const type = api.owner?.type ?? api.managedBy
    if (!project && isGitOwner(type) && !api.owner?.project) {
      out.legacy.push(m.name)
      continue
    }
    if (adopt.has(m.name)) {
      out.adopt.push(api)
      continue
    }
    out.unowned.push({name: m.name, id: api.id, owner: ownerLabel(api)})
  }
  return out
}

/** `POST /monitors/{id}/transfer {to: GIT, project, reason}` for `--adopt`. */
export async function adoptMonitor(client: ApiClient, m: MonitorDto, project: string | undefined, reason: string): Promise<MonitorDto> {
  const body = parse(apiSchemas.TransferMonitorRequest, {
    to: OWNER_TOOL,
    reason,
    project: project ?? null,
    ownerDeclaration: project ? {address: ownerAddress(project, m.name) ?? null, label: m.name} : null,
  }, 'Invalid transfer request')
  const resp = await checkedFetch(client.POST('/api/v1/monitors/{id}/transfer', {params: {path: {id: m.id}}, body}))
  return resp?.data ?? m
}

export interface CodeMonitorPlan {
  name: string
  action: 'create' | 'update' | 'none'
  codeChanged: boolean
  settingsChanged: boolean
  owner: string | null
  overlays: string[]
  files: {added: string[]; removed: string[]; changed: string[]}
  /** Live code changed outside Git (e.g. an emergency rollback). */
  drift: {liveDigest: string; gitDigest: string} | null
  /** The local digest is the one that was rolled back: deploy refuses without --acknowledge-rollback. */
  republishesRolledBack: boolean
  localDigest: string | null
  liveDigest: string | null
}

function overlaysOf(m: MonitorDto): string[] {
  const out: string[] = []
  if (m.pausedAt || m.enabled === false) out.push(`paused${m.pauseReason ? ` (${m.pauseReason})` : ''}`)
  if (m.muted) out.push(`muted${m.mutedUntil ? ` until ${m.mutedUntil}` : ''}`)
  if (m.quarantineUntil) out.push(`quarantined until ${m.quarantineUntil}`)
  return out
}

function sha(content: string | Uint8Array): string {
  return createHash('sha256').update(content).digest('hex')
}

/** Per code monitor: what deploy would do, with changed file names and drift. */
export async function planCodeMonitors(client: ApiClient, config: DevhelmConfig, refs: ResolvedRefs, changeset: Changeset, opts: {details: boolean}): Promise<CodeMonitorPlan[]> {
  const ctx = refs.project
  const updates = new Map(changeset.updates.filter((c) => c.resourceType === 'monitor').map((c) => [c.refKey, c]))
  const creates = new Set(changeset.creates.filter((c) => c.resourceType === 'monitor').map((c) => c.refKey))
  const out: CodeMonitorPlan[] = []
  const {monitorCodeChanged, monitorSettingsChanged} = await import('../yaml/handlers.js')
  for (const m of (config.monitors ?? []).filter((x) => isCodeMonitor(x))) {
    const state = ctx.code.get(m.name)
    const local = state?.prepared?.digest ?? null
    const entry = refs.get('monitors', m.name)
    const api = entry && !entry.isPending ? (entry.raw as MonitorDto) : undefined
    const p: CodeMonitorPlan = {
      name: m.name,
      action: creates.has(m.name) ? 'create' : updates.has(m.name) ? 'update' : 'none',
      codeChanged: api ? monitorCodeChanged(m, api, refs) : true,
      settingsChanged: api ? monitorSettingsChanged(m, api, refs) : true,
      owner: api ? ownerLabel(api) : null,
      overlays: api ? overlaysOf(api) : [],
      files: {added: [], removed: [], changed: []},
      drift: null,
      republishesRolledBack: false,
      localDigest: local,
      liveDigest: api?.liveRevisionDigest ?? null,
    }
    if (!api && state?.prepared) p.files.added = [...state.prepared.fileList]
    if (api && opts.details) {
      if (p.codeChanged && api.liveRevisionId && state?.prepared) {
        const live = await getRevisionFiles(client, api.liveRevisionId)
        const localFiles = state.prepared.files
        for (const f of state.prepared.fileList) {
          const before = live.files[f]
          if (before === undefined) p.files.added.push(f)
          else if (sha(before) !== sha(localFiles[f] ?? '')) p.files.changed.push(f)
        }
        for (const f of Object.keys(live.files)) if (!(f in localFiles)) p.files.removed.push(f)
      }
      // A failed drift read fails the plan: the rollback guard depends on it.
      const drift = await apiGetSingle(client, `/api/v1/monitors/${api.id}/drift`, apiSchemas.MonitorDriftDto)
      if (drift.code?.drifted) {
        p.drift = {liveDigest: drift.code.liveDigest, gitDigest: drift.code.gitDigest}
        p.republishesRolledBack = local === drift.code.gitDigest
      }
    }
    out.push(p)
  }
  return out
}

export interface TestPhaseOptions {
  concurrency: number
  timeoutMs: number
  noTest: boolean
  session?: RunSessionContext
  acknowledgeRollback: Set<string>
  plans: CodeMonitorPlan[]
  onStart?: (name: string, run: RunDto) => void
  onDone?: (name: string, run: RunDto | undefined, flaky: boolean) => void
}

/**
 * Validation runs for the code half. Fills each monitor's state with the
 * draft id, the run, or `blocked` (the reason it cannot land).
 */
export async function runTestPhase(client: ApiClient, config: DevhelmConfig, refs: ResolvedRefs, opts: TestPhaseOptions): Promise<void> {
  const ctx = refs.project
  const jobs = opts.plans.filter((p) => (p.action === 'create' || p.action === 'update') && p.codeChanged)
  await runPool(jobs, opts.concurrency, async (p) => {
      const m = (config.monitors ?? []).find((x) => x.name === p.name)!
      const state = ctx.code.get(p.name) ?? {}
      ctx.code.set(p.name, state)
      if (!state.code) return
      if (opts.acknowledgeRollback.has(p.name) && p.drift) state.acknowledgeRollback = state.code.bundle
      if (opts.noTest) {
        state.untested = true
        return
      }
      try {
        const run = p.action === 'create'
          ? await startValidationRun(client, {kind: 'adhoc', type: m.type as 'BROWSER' | 'MULTI_STEP_API', environmentId: refs.require('environments', m.environment ?? ''), code: state.code, config: m.config as ScriptConfig | undefined}, {session: opts.session})
          : await startDraftTest(client, refs.require('monitors', p.name), state, opts.session)
        registerStartedRun(client, run.id, run.phase)
        opts.onStart?.(p.name, run)
        let finished: RunDto | undefined
        try {
          finished = await waitForRun(client, run.id, {timeoutMs: opts.timeoutMs})
        } catch (err) {
          if (!(err instanceof WaitTimeoutError)) throw err
          state.run = run
          state.blocked = {category: 'platform', code: 'TEST_TIMEOUT', message: `validation run did not finish before --timeout (run keeps going: ${run.url ?? run.id})`, runUrl: run.url}
          opts.onDone?.(p.name, undefined, false)
          return
        }
        state.run = finished
        const verdict = verdictOf(finished)
        opts.onDone?.(p.name, finished, isFlaky(finished))
        if (verdict === 'failed') {
          state.blocked = {category: 'check_failed', code: 'CHECK_FAILED', message: `validation run ${finished.outcome}${finished.failure?.message ? `: ${finished.failure.message}` : ''}`, runUrl: finished.url}
        } else if (verdict !== 'passed') {
          state.blocked = {category: 'platform', code: 'NO_VERDICT', message: `validation run ended ${finished.outcome ?? finished.phase}${finished.cause ? ` (${finished.cause})` : ''}`, runUrl: finished.url}
        }
      } catch (err) {
        if (!(err instanceof DevhelmError)) throw err
        state.blocked = {category: err.category, code: err.code ?? 'TEST_FAILED', message: err.message}
      }
  })
}

/** Draft the changed code (reusing a same-digest draft) and start its validation run. */
async function startDraftTest(client: ApiClient, monitorId: string, state: CodeMonitorState, session?: RunSessionContext): Promise<RunDto> {
  const draftBody = parse(apiSchemas.CreateDraftRevisionRequest, {code: state.code}, 'Invalid draft request')
  const draft = parseSingle(
    apiSchemas.CreateDraftRevisionResponse,
    await checkedFetch(client.POST('/api/v1/monitors/{id}/revisions', {params: {path: {id: monitorId}}, body: draftBody})),
    `POST /api/v1/monitors/${monitorId}/revisions`,
  )
  state.draftRevisionId = draft.revision.id
  return startValidationRun(client, {kind: 'revision', monitorId, revisionId: draft.revision.id}, {session})
}
