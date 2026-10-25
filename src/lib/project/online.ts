/**
 * The online half of project commands: resolve references against the
 * API, upload code closures (content-addressed, no revision is created),
 * and run the server dry run `POST /monitors/validate`.
 */
import type {z} from 'zod'
import {checkedFetch, type ApiClient} from '../api-client.js'
import {schemas as apiSchemas} from '../api-zod.generated.js'
import {uploadCode, checkCodeOnline} from '../code/bundle.js'
import {DevhelmError} from '../errors.js'
import {parse, parseSingle} from '../response-validation.js'
import {fetchAllRefs, registerYamlPendingRefs, type ResolvedRefs, type DevhelmConfig, type DeployState} from '../yaml/index.js'
import {projectContext} from '../yaml/project-context.js'
import {toCreateMonitorRequest} from '../yaml/transform.js'
import type {Issue} from './project.js'

export type ValidationFinding = z.infer<typeof apiSchemas.MonitorValidationFindingDto>
export type Projection = z.infer<typeof apiSchemas.MonitorValidationProjectionDto>

export async function fetchRefs(client: ApiClient, config: DevhelmConfig, state?: DeployState): Promise<ResolvedRefs> {
  const refs = await fetchAllRefs(client, state)
  registerYamlPendingRefs(refs, config)
  return refs
}

/** Upload every prepared closure (or the named ones). Failures become issues. */
export async function uploadPrepared(client: ApiClient, only?: Set<string>): Promise<Issue[]> {
  const issues: Issue[] = []
  const ctx = projectContext()
  const tasks = [...ctx.code.entries()].filter(([name, s]) => s.prepared && (!only || only.has(name))).map(async ([name, state]) => {
    try {
      const {bundle, code} = await uploadCode(client, state.prepared!, {runtimeId: state.runtimeId})
      state.bundle = bundle
      state.code = code
    } catch (err) {
      if (!(err instanceof DevhelmError)) throw err
      if (err.category === 'validation' || err.category === 'blocked') {
        state.blocked = {category: err.category, code: err.code ?? 'BUNDLE_REFUSED', message: err.message}
        const entries = err.errors.length > 0 ? err.errors : [{code: err.code ?? 'BUNDLE_REFUSED', field: null, message: err.message}]
        for (const e of entries) issues.push({severity: 'error', path: name, message: e.message, code: e.code, file: e.field ?? undefined})
        return
      }
      throw err
    }
  })
  await Promise.all(tasks)
  return issues
}

/** `POST /bundles/check` per prepared closure: every server-side finding. */
export async function checkBundlesOnline(client: ApiClient): Promise<Issue[]> {
  const issues: Issue[] = []
  for (const [name, state] of projectContext().code.entries()) {
    if (!state.prepared) continue
    const findings = await checkCodeOnline(client, state.prepared, state.runtimeId)
    for (const f of findings) issues.push({severity: 'error', path: name, message: f.message, code: f.code, file: f.file ?? undefined, line: f.line ?? undefined})
  }
  return issues
}

const PLAN_CODES = new Set([
  'MONITOR_FREQUENCY_BELOW_PLAN_MIN', 'MONITOR_LIMIT_REACHED', 'MONITOR_CODE_CHECK_NOT_AVAILABLE',
  'MONITOR_CODE_CHECK_LIMIT_REACHED', 'ENVIRONMENT_LIMIT_REACHED', 'MONITOR_BROWSER_CHECKS_DISABLED',
  'SYNTHETICS_USAGE_CAPPED',
])

export function isPlanFinding(f: Pick<ValidationFinding, 'code' | 'upgradeUrl' | 'plan'>): boolean {
  return PLAN_CODES.has(f.code) || f.code.startsWith('PLAN_LIMIT') || Boolean(f.upgradeUrl)
}

const COUNT_CODES = new Set(['MONITOR_LIMIT_REACHED', 'MONITOR_CODE_CHECK_LIMIT_REACHED'])

export interface DryRun {
  findings: Array<ValidationFinding & {monitor?: string}>
  projections: Array<Projection & {monitor?: string}>
}

/**
 * `POST /monitors/validate` for the YAML monitors, as create payloads.
 * Monitors that already exist are sent too (secrets, runtime, frequency
 * apply to them) but count findings on them are dropped: they already
 * hold their seat.
 */
export async function dryRunMonitors(client: ApiClient, config: DevhelmConfig, refs: ResolvedRefs): Promise<DryRun> {
  const monitors = config.monitors ?? []
  if (monitors.length === 0) return {findings: [], projections: []}
  const bodies = monitors.map((m) => toCreateMonitorRequest(m, refs))
  const existing = monitors.map((m) => {
    const e = refs.get('monitors', m.name)
    return Boolean(e && !e.isPending)
  })
  const out: DryRun = {findings: [], projections: []}
  for (let start = 0; start < bodies.length; start += 100) {
    const chunk = bodies.slice(start, start + 100).map((b) => stripPending(b))
    const body = parse(apiSchemas.ValidateMonitorsRequest, {monitors: chunk}, 'Invalid validate request')
    const resp = await checkedFetch(client.POST('/api/v1/monitors/validate', {body}))
    const result = parseSingle(apiSchemas.MonitorValidationResultDto, resp, 'POST /api/v1/monitors/validate')
    for (const f of result.findings) {
      const idx = start + (findingIndex(f) ?? -1)
      if (idx >= start && existing[idx] && COUNT_CODES.has(f.code)) continue
      out.findings.push({...f, monitor: idx >= start ? monitors[idx]?.name : undefined})
    }
    for (const p of result.projections) {
      out.projections.push({...p, monitor: monitors[start + p.monitorIndex]?.name})
    }
  }
  return out
}

function findingIndex(f: ValidationFinding): number | undefined {
  return f.monitorIndex ?? undefined
}

/** Pending (not yet created) references cannot go to the server; drop them. */
function stripPending<T extends Record<string, unknown>>(body: T): T {
  const out = {...body} as Record<string, unknown>
  const pending = (v: unknown) => typeof v === 'string' && v.startsWith('__pending__:')
  if (pending(out.environmentId)) delete out.environmentId
  if (Array.isArray(out.alertChannelIds)) out.alertChannelIds = (out.alertChannelIds as unknown[]).filter((v) => !pending(v))
  return out as T
}

export function findingsToIssues(dry: DryRun, opts: {strict?: boolean; eolSoon?: (runtimeId: string) => boolean} = {}): Issue[] {
  const issues: Issue[] = []
  for (const f of dry.findings) {
    const path = f.monitor ?? f.field ?? ''
    if (f.code === 'RUN_KEYS_MISSING') {
      const env = f.environment ?? '<env>'
      const key = f.secretKey ?? '<KEY>'
      issues.push({
        severity: 'error',
        path,
        code: 'RUN_KEYS_MISSING',
        message: `${f.message}. Fix: printf %s "$${key}" | devhelm secrets values set ${key} --env ${env} --value-stdin`,
      })
      continue
    }
    if (f.code === 'RUNTIME_EOL') {
      const soon = opts.strict && f.runtimeId && opts.eolSoon?.(f.runtimeId)
      issues.push({severity: soon ? 'error' : 'warning', path, code: 'RUNTIME_EOL', message: f.message})
      continue
    }
    issues.push({severity: f.severity === 'ERROR' ? 'error' : 'warning', path, code: f.code, message: f.message})
  }
  return issues
}
