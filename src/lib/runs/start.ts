/**
 * Start one validation run (source `remote_validation`, never votes on
 * health). The single builder behind `test`, `deploy` and the monitor
 * commands:
 *
 *   saved monitor + local code → `POST /monitors/{id}/test {code}`
 *   no monitor yet             → `POST /monitors/test {type, environmentId, code, config}` (W0-3)
 *   draft revision             → `POST /monitors/{id}/revisions/{rid}/test`
 */
import type {z} from 'zod'
import {checkedFetch, type ApiClient} from '../api-client.js'
import {schemas as apiSchemas} from '../api-zod.generated.js'
import type {MonitorCodeSpec} from '../code/bundle.js'
import {parse, parseSingle} from '../response-validation.js'
import type {RunSessionContext} from './session.js'
import type {RunDto} from './wait.js'

type MonitorTestRequest = z.infer<typeof apiSchemas.MonitorTestRequest>
type ScriptConfig = z.infer<typeof apiSchemas.ScriptMonitorConfig>

export type ValidationTarget =
  | {kind: 'saved'; monitorId: string; code: MonitorCodeSpec}
  | {kind: 'adhoc'; type: 'BROWSER' | 'MULTI_STEP_API'; environmentId: string; code: MonitorCodeSpec; config?: ScriptConfig}
  | {kind: 'revision'; monitorId: string; revisionId: string}

export async function startValidationRun(
  client: ApiClient,
  target: ValidationTarget,
  opts: {region?: string; session?: RunSessionContext} = {},
): Promise<RunDto> {
  const extra = {...(opts.region ? {region: opts.region} : {}), ...(opts.session ? {session: opts.session} : {})}
  if (target.kind === 'adhoc') {
    const body: MonitorTestRequest = parse(apiSchemas.MonitorTestRequest, {
      type: target.type, environmentId: target.environmentId, code: target.code, config: target.config ?? {}, ...extra,
    }, 'Invalid test request')
    return parseSingle(apiSchemas.RunDto, await checkedFetch(client.POST('/api/v1/monitors/test', {body})), 'POST /api/v1/monitors/test')
  }
  if (target.kind === 'saved') {
    const body = parse(apiSchemas.CodeTestTargetRequest, {code: target.code, ...extra}, 'Invalid test request')
    return parseSingle(apiSchemas.RunDto, await checkedFetch(client.POST('/api/v1/monitors/{id}/test', {params: {path: {id: target.monitorId}}, body})), `POST /api/v1/monitors/${target.monitorId}/test`)
  }
  const body = parse(apiSchemas.CodeTestTargetRequest, extra, 'Invalid test request')
  return parseSingle(
    apiSchemas.RunDto,
    await checkedFetch(client.POST('/api/v1/monitors/{id}/revisions/{revisionId}/test', {params: {path: {id: target.monitorId, revisionId: target.revisionId}}, body})),
    `POST /api/v1/monitors/${target.monitorId}/revisions/${target.revisionId}/test`,
  )
}
