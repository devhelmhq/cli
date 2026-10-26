/**
 * The shared front half of `plan` and `deploy`: load and validate the
 * project, prepare and upload code closures (content-addressed, no
 * revision), resolve references, bind monitors with ownership, diff, and
 * collect the code-monitor details and plan-fit findings.
 */
import {isCodeMonitorType} from '@devhelm/sdk'
import {runtimeCatalog} from '../code/bundle.js'
import type {ApiClient} from '../api-client.js'
import {ValidationError} from '../errors.js'
import {
  diff, prefetchChildSnapshots, previewMovedBlocks, readState, emptyState, validatePlanRefs, StateFileCorruptError,
  type Changeset, type DeployState, type DevhelmConfig, type ResolvedRefs,
} from '../yaml/index.js'
import {checkEntitlements, type EntitlementCheck} from '../yaml/entitlements.js'
import {bindMonitors, planCodeMonitors, type BindResult, type CodeMonitorPlan} from './code-deploy.js'
import {dryRunMonitors, fetchRefs, isPlanFinding, uploadPrepared, type ValidationFinding} from './online.js'
import {formatIssue, loadProject, prepareCodeMonitors, type LoadedProject} from './project.js'

export interface PipelineOptions {
  files: string[]
  prune: boolean
  /** `--prune-org-cli`: also delete CLI/Git-owned resources outside this config. */
  pruneOrgCli?: boolean
  /** `--prune-all`: also delete resources other tools own. */
  pruneAll?: boolean
  adopt?: string[]
  env?: string
  /** Fetch changed file names and drift (plan output). */
  details: boolean
  /** Preview moved blocks without writing state (plan) or apply them (deploy). */
  applyMoved: boolean
}

export interface PipelineResult {
  loaded: LoadedProject
  config: DevhelmConfig
  state: DeployState
  refs: ResolvedRefs
  changeset: Changeset
  codePlans: CodeMonitorPlan[]
  bind: BindResult
  planRefusals: ValidationFinding[]
  findings: ValidationFinding[]
  entitlements: EntitlementCheck | null
  warnings: string[]
}

function issuesError(label: string, lines: string[], code: string): ValidationError {
  return new ValidationError(`${label}:\n${lines.map((l) => `  ✗ ${l}`).join('\n')}`, {code})
}

export async function runPipeline(client: ApiClient, opts: PipelineOptions): Promise<PipelineResult> {
  const loaded = loadProject(opts.files)
  const errors = loaded.issues.filter((i) => i.severity === 'error')
  if (!loaded.config || errors.length > 0) {
    throw issuesError(`${opts.files.join(', ')} is not valid`, errors.map(formatIssue), 'CONFIG_INVALID')
  }
  const warnings = loaded.issues.filter((i) => i.severity === 'warning').map(formatIssue)
  const full = loaded.config
  const config: DevhelmConfig = opts.env ? {...full, monitors: (full.monitors ?? []).filter((m) => m.environment === opts.env)} : full

  const hasCode = (config.monitors ?? []).some((m) => isCodeMonitorType(m.type))
  const catalog = hasCode ? await runtimeCatalog(client) : []
  const {issues} = await prepareCodeMonitors(loaded, catalog, new Set((config.monitors ?? []).map((m) => m.name)))
  const codeErrors = issues.filter((i) => i.severity === 'error')
  if (codeErrors.length > 0) throw issuesError('Code refused', codeErrors.map(formatIssue), codeErrors[0]!.code ?? 'BUNDLE_INVALID')
  warnings.push(...issues.filter((i) => i.severity === 'warning').map(formatIssue))

  let state = readStateOrThrow()
  if (config.moved && config.moved.length > 0 && !opts.applyMoved) {
    const preview = previewMovedBlocks(state, config.moved)
    state = preview.state
    warnings.push(...preview.warnings)
  }

  const uploadIssues = await uploadPrepared(client, loaded.ctx)
  if (uploadIssues.length > 0) throw issuesError('Upload refused', uploadIssues.map(formatIssue), uploadIssues[0]!.code ?? 'BUNDLE_INVALID')

  const refs = await fetchRefs(client, config, loaded.ctx, state)
  for (const c of refs.collisions) {
    warnings.push(`Duplicate ${c.refType} reference "${c.refKey}" — ${c.apiIds.length} API resources share this name. Using ${c.winnerApiId}. Rename one or use a \`moved\` block.`)
  }
  const bind = await bindMonitors(client, config, refs, {state, adopt: opts.adopt})
  for (const name of bind.legacy) {
    warnings.push(`${name}: matched by name to a Git-owned monitor without a project; add \`project:\` to devhelm.yml so ownership is explicit`)
  }

  const planRefs = validatePlanRefs(config, refs)
  if (planRefs.errors.length > 0) throw issuesError('Validation failed', planRefs.errors.map((e) => `${e.path}: ${e.message}`), 'CONFIG_INVALID')

  const children = await prefetchChildSnapshots(config, refs, client)
  let changeset = await diff(config, refs, {prune: opts.prune, pruneOrgCli: opts.pruneOrgCli, pruneAll: opts.pruneAll}, state, children)
  if (opts.env) {
    changeset = {
      ...changeset,
      deletes: changeset.deletes.filter((d) => d.resourceType !== 'monitor' || (d.current as {environment?: {slug?: string} | null} | undefined)?.environment?.slug === opts.env),
    }
  }

  const codePlans = await planCodeMonitors(client, config, refs, changeset, {details: opts.details})
  const dry = await dryRunMonitors(client, config, refs)
  const findings = dry.findings
  const planRefusals = findings.filter((f) => f.severity === 'ERROR' && isPlanFinding(f))
  const entitlements = await checkEntitlements(client, changeset)
  return {loaded, config, state, refs, changeset, codePlans, bind, planRefusals, findings, entitlements, warnings}
}

/** `.devhelm/state.json`, empty when absent; a corrupt file is exit 4 `STATE_CORRUPT`. */
export function readStateOrThrow(): DeployState {
  try {
    return readState() ?? emptyState()
  } catch (err) {
    if (err instanceof StateFileCorruptError) throw new ValidationError(err.message, {code: 'STATE_CORRUPT'})
    throw err
  }
}

export function totalChanges(c: Changeset): number {
  return c.creates.length + c.updates.length + c.deletes.length + c.memberships.length
}

/** Validation runs deploy starts: one per new code monitor and per changed code. */
export function validationRunCount(plans: CodeMonitorPlan[]): number {
  return plans.filter((p) => (p.action === 'create' || p.action === 'update') && p.codeChanged).length
}

export function codePlanLines(plans: CodeMonitorPlan[]): string[] {
  const out: string[] = []
  for (const p of plans) {
    if (p.action === 'none' && !p.drift) continue
    const sym = p.action === 'create' ? '+' : p.action === 'update' ? '~' : ' '
    const what: string[] = []
    if (p.action === 'create') what.push('new · validation run, then create')
    if (p.action === 'update' && p.codeChanged) {
      const f = p.files
      const names = [...f.added.map((x) => `+${x}`), ...f.changed.map((x) => `~${x}`), ...f.removed.map((x) => `-${x}`)]
      what.push(`code: ${names.length > 0 ? names.join(', ') : 'changed'} · draft → test → publish`)
    }
    if (p.action === 'update' && p.settingsChanged) what.push('settings')
    if (p.owner) what.push(`owner ${p.owner}`)
    if (p.overlays.length > 0) what.push(`${p.overlays.join(', ')} (deploy leaves these unless devhelm.yml sets enabled)`)
    out.push(`  ${sym} ${p.name}  ${what.join(' · ')}`)
    if (p.drift) {
      out.push(`    ! live code ${p.drift.liveDigest.slice(0, 19)}… differs from the last Git deploy ${p.drift.gitDigest.slice(0, 19)}…${p.republishesRolledBack ? ` (rolled back); deploy refuses unless --acknowledge-rollback "${p.name}"` : ''}`)
    }
  }
  return out
}
