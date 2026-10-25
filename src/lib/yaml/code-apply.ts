/**
 * Apply half of `deploy` for BROWSER / MULTI_STEP_API monitors (doc 42
 * §6.3). The test half ran before the applier (see project/code-deploy.ts):
 * each monitor's state says whether its validation run passed.
 *
 *   new monitor     → `POST /monitors` with `code` (settings and code in one call)
 *   changed code    → the settings `PUT` (guarded by `expectedUpdatedAt`), then
 *                     `POST …/publish {revisionId, requireTested: true,
 *                     expectedLiveRevisionId}`
 *   --no-test       → `PUT /monitors/{id}` with `code` (one call, untested)
 *   settings only   → `PUT /monitors/{id}` without code
 *
 * A monitor's settings and code land together or neither: a failed test
 * leaves the monitor on its live code (the draft is kept), and a publish
 * refused after the settings `PUT` is undone with one compensating `PUT`
 * guarded by `expectedUpdatedAt` (never retried). If that fails too, the
 * monitor is reported not landed with both halves described.
 */
import type {components} from '../api.generated.js'
import {checkedFetch, type ApiClient} from '../api-client.js'
import {DevhelmError, errorForCategory, isErrorCategory} from '../errors.js'
import type {ResolvedRefs} from './resolver.js'
import type {YamlMonitor} from './schema.js'
import {projectContext} from './project-context.js'
import {toCreateMonitorRequest, toUpdateMonitorRequest} from './transform.js'

type Schemas = components['schemas']

/** A monitor that did not land; `details.half` names the half that failed. */
export function notLanded(
  monitor: string,
  half: 'code' | 'settings' | 'both',
  cause: {category: string; code: string; message: string; runUrl?: string | null; requestId?: string | null},
): DevhelmError {
  const category = isErrorCategory(cause.category) ? cause.category : 'platform'
  return errorForCategory(`${monitor}: ${cause.message}`, category, {
    code: cause.code,
    requestId: cause.requestId,
    details: {monitor, half, runUrl: cause.runUrl ?? null, checkFailed: cause.category === 'check_failed'},
  })
}

function blockedError(yaml: YamlMonitor, half: 'code' | 'both'): DevhelmError | undefined {
  const state = projectContext().code.get(yaml.name)
  if (!state) return notLanded(yaml.name, half, {category: 'validation', code: 'CODE_NOT_PREPARED', message: 'code was not bundled'})
  if (state.blocked) return notLanded(yaml.name, half, state.blocked)
  if (!state.code) return notLanded(yaml.name, half, {category: 'validation', code: 'CODE_NOT_UPLOADED', message: 'code was not uploaded'})
  return undefined
}

export async function applyCodeMonitorCreate(yaml: YamlMonitor, refs: ResolvedRefs, client: ApiClient): Promise<string | undefined> {
  const blocked = blockedError(yaml, 'both')
  if (blocked) throw blocked
  const resp = await checkedFetch(client.POST('/api/v1/monitors', {body: toCreateMonitorRequest(yaml, refs)}))
  const id = resp?.data?.id
  return id === undefined || id === null ? undefined : String(id)
}

export async function applyCodeMonitorUpdate(
  yaml: YamlMonitor,
  id: string,
  refs: ResolvedRefs,
  client: ApiClient,
  opts: {settingsChanged: boolean; codeChanged: boolean; current?: Schemas['MonitorDto']},
): Promise<void> {
  const state = projectContext().code.get(yaml.name)

  if (!opts.codeChanged) {
    await checkedFetch(client.PUT('/api/v1/monitors/{id}', {params: {path: {id}}, body: toUpdateMonitorRequest(yaml, refs)}))
    return
  }

  const blocked = blockedError(yaml, opts.settingsChanged ? 'both' : 'code')
  if (blocked) throw blocked

  if (state?.untested) {
    await checkedFetch(client.PUT('/api/v1/monitors/{id}', {params: {path: {id}}, body: toUpdateMonitorRequest(yaml, refs, {withCode: true})}))
    return
  }

  const current = opts.current
  const previousLive = current?.liveRevisionId ?? undefined
  const publish: Schemas['PublishRevisionRequest'] = {
    revisionId: state!.draftRevisionId!,
    requireTested: true,
    note: 'devhelm deploy',
  }
  if (previousLive) publish.expectedLiveRevisionId = previousLive
  if (state?.acknowledgeRollback) publish.acknowledgeRollback = state.acknowledgeRollback

  // Settings first, guarded by expectedUpdatedAt, so a publish refusal can
  // be undone by one compensating PUT.
  let updatedAt: string | undefined
  if (opts.settingsChanged) {
    const forward = toUpdateMonitorRequest(yaml, refs)
    if (current?.updatedAt) forward.expectedUpdatedAt = current.updatedAt
    try {
      const resp = await checkedFetch(client.PUT('/api/v1/monitors/{id}', {params: {path: {id}}, body: forward}))
      updatedAt = resp?.data?.updatedAt
    } catch (err) {
      throw asNotLanded(yaml.name, 'both', err, 'settings update failed; nothing changed')
    }
    try {
      await checkedFetch(client.POST('/api/v1/monitors/{id}/publish', {params: {path: {id}}, body: publish}))
      return
    } catch (err) {
      const restore = current ? restoreBody(forward, current) : undefined
      if (restore && updatedAt) {
        restore.expectedUpdatedAt = updatedAt
        try {
          await checkedFetch(client.PUT('/api/v1/monitors/{id}', {params: {path: {id}}, body: restore}))
          throw asNotLanded(yaml.name, 'both', err, 'publish refused; the settings change was reverted, so neither half landed')
        } catch (compensation) {
          if (compensation instanceof DevhelmError && compensation.details?.half) throw compensation
          throw asNotLanded(yaml.name, 'settings', err,
            `publish refused (code not published) and reverting the settings failed: ${compensation instanceof Error ? compensation.message : String(compensation)}; the new settings are live on the old code`)
        }
      }
      throw asNotLanded(yaml.name, 'settings', err, 'publish refused (code not published); the new settings are live on the old code')
    }
  }

  try {
    await checkedFetch(client.POST('/api/v1/monitors/{id}/publish', {params: {path: {id}}, body: publish}))
  } catch (err) {
    throw asNotLanded(yaml.name, 'code', err, 'publish refused; the monitor keeps its live code and the draft is kept')
  }
}

/**
 * A not-landed error. `half` names what is out of step with devhelm.yml:
 * `both` = nothing changed, `code` = settings landed without the code,
 * `settings` = the settings landed but the code did not.
 */
function asNotLanded(monitor: string, half: 'code' | 'settings' | 'both', err: unknown, what: string): DevhelmError {
  const e = err instanceof DevhelmError ? err : undefined
  return notLanded(monitor, half, {
    category: e?.category ?? 'platform',
    code: e?.code ?? 'DEPLOY_FAILED',
    message: `${e?.message ?? String(err)} (${what})`,
    requestId: e?.requestId,
  })
}

/** The previous values of exactly the keys the forward PUT changed. */
function restoreBody(forward: Schemas['UpdateMonitorRequest'], m: Schemas['MonitorDto']): Schemas['UpdateMonitorRequest'] {
  const out: Schemas['UpdateMonitorRequest'] = {}
  if ('name' in forward) out.name = m.name
  if ('config' in forward) out.config = m.config as Schemas['UpdateMonitorRequest']['config']
  if ('frequencySeconds' in forward) out.frequencySeconds = m.frequencySeconds
  if ('regions' in forward) out.regions = m.regions
  if ('environmentId' in forward && m.environment?.id) out.environmentId = m.environment.id
  if ('alertChannelIds' in forward) out.alertChannelIds = (m.alertChannelIds ?? []).filter((x): x is string => x !== null)
  if ('tags' in forward) out.tags = {tagIds: (m.tags ?? []).map((t) => t.id), newTags: []}
  if ('capturePolicy' in forward && m.capturePolicy) out.capturePolicy = m.capturePolicy
  if ('fastRetryMaxAttempts' in forward) out.fastRetryMaxAttempts = m.fastRetryMaxAttempts ?? 0
  if ('runParallel' in forward && m.runParallel !== null && m.runParallel !== undefined) out.runParallel = m.runParallel
  if ('secretKeys' in forward && m.secretKeys) out.secretKeys = m.secretKeys.filter((x): x is string => x !== null)
  return out
}
