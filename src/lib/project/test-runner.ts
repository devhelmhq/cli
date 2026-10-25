/**
 * `devhelm test`: validation runs from local files (doc 42 §6.3).
 *
 *   code monitor in this project (state or ownerProject) → `POST /monitors/{id}/test`
 *                                                          with the local `code`
 *   new code monitor                                     → `POST /monitors/test` (W0-3)
 *                                                          in its declared environment
 *   uptime monitor                                       → sync probe `POST /monitors/test`
 *   heartbeat                                            → not applicable
 *
 * Runs wait by default (SSE), then report steps, the failure (`file:line`)
 * and `run.url`. Exit precedence 14 > 19 > 0.
 */
import {isAbsolute, relative, resolve} from 'node:path'
import type {z} from 'zod'
import {checkedFetchWithStatus, type ApiClient} from '../api-client.js'
import {schemas as apiSchemas} from '../api-zod.generated.js'
import type {MonitorCodeSpec} from '../code/bundle.js'
import {DevhelmError, EXIT_CODES, ValidationError, WaitTimeoutError, exitCodeOf, errorForCategory, isErrorCategory} from '../errors.js'
import {findMonitorsByName, resolveEnvironment, type MonitorDto} from '../monitors/resolve.js'
import {parse, parseSingle} from '../response-validation.js'
import {runPool} from '../runs/pool.js'
import {registerStartedRun} from '../runs/registry.js'
import {waitForRun, type RunDto, type RunEventDto} from '../runs/wait.js'
import {exitForVerdicts, verdictOf, type Verdict} from '../runs/outcome.js'
import type {RunSessionContext} from '../runs/session.js'
import type {ReportItem} from '../reporters/index.js'
import type {DeployState, YamlMonitor} from '../yaml/index.js'
import {isGitOwner, projectContext} from '../yaml/project-context.js'
import {isCodeMonitor, toCreateAssertionRequest} from '../yaml/transform.js'

export type MonitorTestResultDto = z.infer<typeof apiSchemas.MonitorTestResultDto>
type MonitorTestRequest = z.infer<typeof apiSchemas.MonitorTestRequest>
type CodeTestTargetRequest = z.infer<typeof apiSchemas.CodeTestTargetRequest>

export interface TestTarget {
  name: string
  type: string
  monitor: YamlMonitor
  envSlug?: string
  environmentId?: string
  existing?: MonitorDto
  file?: string
}

/** Pick monitors by name or by entry path. No selector = every monitor. */
export function selectTargets(monitors: YamlMonitor[], selectors: string[], opts: {env?: string; configDir: string}): {targets: YamlMonitor[]; unknown: string[]} {
  let pool = monitors
  if (opts.env) pool = pool.filter((m) => m.environment === opts.env)
  if (selectors.length === 0) return {targets: pool, unknown: []}
  const picked = new Set<YamlMonitor>()
  const unknown: string[] = []
  for (const sel of selectors) {
    const byName = pool.filter((m) => m.name === sel)
    if (byName.length > 0) {
      byName.forEach((m) => picked.add(m))
      continue
    }
    const abs = resolve(sel)
    const byPath = pool.filter((m) => {
      const entry = typeof m.code === 'string' ? m.code : m.code?.entrypoint
      return entry !== undefined && resolve(opts.configDir, entry) === abs
    })
    if (byPath.length > 0) byPath.forEach((m) => picked.add(m))
    else unknown.push(sel)
  }
  return {targets: pool.filter((m) => picked.has(m)), unknown}
}

export function entryFile(m: YamlMonitor, configDir: string): string | undefined {
  const entry = typeof m.code === 'string' ? m.code : m.code?.entrypoint
  if (!entry) return undefined
  const abs = resolve(configDir, entry)
  const rel = relative(process.cwd(), abs)
  return rel && !rel.startsWith('..') && !isAbsolute(rel) ? rel : abs
}

/** The fields ownership is decided on; satisfied by both the generated type and the parsed DTO. */
export interface OwnedMonitor {
  id: string
  managedBy?: string | null
  owner?: {type?: string | null; project?: string | null} | null
}

/** Is this API monitor the one this project manages under that name? */
export function ownedByProject(m: OwnedMonitor, project: string | undefined, state?: DeployState): boolean {
  if (state && Object.values(state.resources).some((e) => e.apiId === m.id)) return true
  const type = m.owner?.type ?? m.managedBy
  return Boolean(project) && isGitOwner(type) && m.owner?.project === project
}

export async function resolveTargets(client: ApiClient, monitors: YamlMonitor[], opts: {state?: DeployState; configDir: string}): Promise<TestTarget[]> {
  const project = projectContext().project
  return Promise.all(monitors.map(async (m) => {
    const t: TestTarget = {name: m.name, type: m.type, monitor: m, envSlug: m.environment ?? undefined, file: entryFile(m, opts.configDir)}
    if (m.environment) t.environmentId = (await resolveEnvironment(client, m.environment)).id
    if (isCodeMonitor(m)) {
      const found = await findMonitorsByName(client, m.name, t.environmentId)
      t.existing = found.find((f) => ownedByProject(f, project, opts.state))
    }
    return t
  }))
}

export interface RunOptions {
  regions?: string[]
  repeat: number
  session?: RunSessionContext
  wait: boolean
  timeoutMs: number
  concurrency: number
  onEvent?: (target: TestTarget, e: RunEventDto) => void
  onItem?: (item: ReportItem) => void
}

const MONITOR_TEST_HAS_REGION = 'region' in apiSchemas.MonitorTestRequest.shape

function errorItem(t: TestTarget, err: DevhelmError, region?: string, attempt?: number): ReportItem {
  return {
    name: t.name, type: t.type, kind: 'error', region, attempt, file: t.file,
    error: {category: err.category, code: err.code, message: err.message},
    verdict: 'no_verdict',
  }
}

async function startCodeRun(client: ApiClient, t: TestTarget, code: MonitorCodeSpec, region: string | undefined, session: RunSessionContext | undefined): Promise<RunDto> {
  if (t.existing) {
    const body: CodeTestTargetRequest = {code}
    if (region) body.region = region
    if (session) body.session = session
    const valid = parse(apiSchemas.CodeTestTargetRequest, body, 'Invalid test request')
    const {data} = await checkedFetchWithStatus(client.POST('/api/v1/monitors/{id}/test', {params: {path: {id: t.existing.id}}, body: valid}))
    return parseSingle(apiSchemas.RunDto, data, `POST /api/v1/monitors/${t.existing.id}/test`)
  }
  if (!t.environmentId) {
    throw new ValidationError(`${t.name}: "environment" is required to test a new ${t.type} monitor`, {code: 'MONITOR_ENVIRONMENT_REQUIRED'})
  }
  const body: Record<string, unknown> = {type: t.type, environmentId: t.environmentId, code, config: t.monitor.config ?? {}}
  if (region) {
    if (!MONITOR_TEST_HAS_REGION) throw new ValidationError(`${t.name}: --region needs a server that accepts a region for new monitors`, {code: 'FIELD_UNKNOWN'})
    body.region = region
  }
  if (session) body.session = session
  const valid = parse(apiSchemas.MonitorTestRequest, body, 'Invalid test request') as MonitorTestRequest
  const {data} = await checkedFetchWithStatus(client.POST('/api/v1/monitors/test', {body: valid}))
  return parseSingle(apiSchemas.RunDto, data, 'POST /api/v1/monitors/test')
}

async function probe(client: ApiClient, t: TestTarget): Promise<MonitorTestResultDto> {
  const body: Record<string, unknown> = {type: t.type, config: t.monitor.config}
  if (t.monitor.assertions) body.assertions = t.monitor.assertions.map(toCreateAssertionRequest)
  const valid = parse(apiSchemas.MonitorTestRequest, body, 'Invalid test request') as MonitorTestRequest
  const {data} = await checkedFetchWithStatus(client.POST('/api/v1/monitors/test', {body: valid}))
  return parseSingle(apiSchemas.MonitorTestResultDto, data, 'POST /api/v1/monitors/test')
}

export async function runTargets(client: ApiClient, targets: TestTarget[], opts: RunOptions): Promise<ReportItem[]> {
  const items: ReportItem[] = []
  const push = (i: ReportItem) => {
    items.push(i)
    opts.onItem?.(i)
  }
  const jobs: Array<{t: TestTarget; region?: string; attempt: number}> = []
  for (const t of targets) {
    if (t.type === 'HEARTBEAT') {
      push({name: t.name, type: t.type, kind: 'not_applicable', verdict: 'passed', file: t.file})
      continue
    }
    const regions = isCodeMonitor(t.monitor) ? (opts.regions && opts.regions.length > 0 ? opts.regions : [undefined]) : [undefined]
    for (const region of regions) for (let attempt = 1; attempt <= opts.repeat; attempt++) jobs.push({t, region, attempt})
  }

  await runPool(jobs, opts.concurrency, async ({t, region, attempt}) => {
    if (!isCodeMonitor(t.monitor)) {
      try {
        const r = await probe(client, t)
        push({
          name: t.name, type: t.type, kind: 'probe', attempt, file: t.file,
          probe: {passed: r.passed, responseTimeMs: r.responseTimeMs ?? null, error: r.error ?? null, statusCode: r.statusCode ?? null},
          verdict: r.passed ? 'passed' : 'failed',
        })
      } catch (err) {
        if (!(err instanceof DevhelmError)) throw err
        push(errorItem(t, err, region, attempt))
      }
      return
    }
    const state = projectContext().code.get(t.name)
    if (!state?.code) {
      const b = state?.blocked
      push(errorItem(t, new ValidationError(b?.message ?? `${t.name}: code was not bundled`, {code: b?.code ?? 'CODE_NOT_UPLOADED'}), region, attempt))
      return
    }
    let run: RunDto
    try {
      run = await startCodeRun(client, t, state.code, region, opts.session)
    } catch (err) {
      if (!(err instanceof DevhelmError)) throw err
      push(errorItem(t, err, region, attempt))
      return
    }
    registerStartedRun(client, run.id, run.phase)
    if (!opts.wait) {
      push({name: t.name, type: t.type, kind: 'run', region: run.region, attempt, run, verdict: 'pending', file: t.file})
      return
    }
    try {
      run = await waitForRun(client, run.id, {timeoutMs: opts.timeoutMs, onEvent: (e) => opts.onEvent?.(t, e)})
    } catch (err) {
      if (!(err instanceof WaitTimeoutError)) throw err
      push({name: t.name, type: t.type, kind: 'run', region: run.region, attempt, run: {...run, phase: err.phase}, verdict: 'pending', file: t.file})
      return
    }
    push({name: t.name, type: t.type, kind: 'run', region: run.region, attempt, run, verdict: verdictOf(run), file: t.file})
  })
  return items
}

/**
 * Exit for a set of results: 14 when any run failed; otherwise the
 * category exit of a call that ran nothing (4/16/17/18); then 19 when any
 * run has no verdict; else 0.
 */
export function exitForItems(items: ReportItem[], opts: {failOnInfraError?: boolean} = {}): number {
  const verdicts: Verdict[] = items.filter((i) => i.kind !== 'error' && i.kind !== 'not_applicable').map((i) => i.verdict)
  if (verdicts.includes('failed')) return EXIT_CODES.CHECK_FAILED
  const refused = items.filter((i) => i.kind === 'error' && i.error && !['platform', 'transport', 'rate_limit'].includes(i.error.category))
  if (refused.length > 0) {
    // The highest exit wins, so a mixed 16/17 result does not depend on order.
    return Math.max(...refused.map((i) => exitCodeOf(errorForCategory('', isErrorCategory(i.error!.category) ? i.error!.category : 'platform'))))
  }
  const infra = items.some((i) => i.kind === 'error')
  const code = exitForVerdicts(infra ? [...verdicts, 'no_verdict'] : verdicts, opts)
  return code
}
