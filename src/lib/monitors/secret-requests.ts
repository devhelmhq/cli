import type {z} from 'zod'
import type {schemas as apiSchemas} from '../api-zod.generated.js'
import type {ColumnDef} from '../output.js'

export type MonitorSecretRequestsDto = z.infer<typeof apiSchemas.MonitorSecretRequestsDto>
type SecretRequestDto = MonitorSecretRequestsDto['requests'][number]

export const SECRET_REQUEST_COLUMNS: ColumnDef<SecretRequestDto>[] = [
  {header: 'KEY', get: (r) => r.key},
  {header: 'READINESS', get: (r) => r.readiness},
  {header: 'SECRET', get: (r) => r.secret?.key ?? ''},
  {header: 'DEMANDED', get: (r) => (r.demanded === null || r.demanded === undefined ? '' : String(r.demanded))},
  {header: 'ATTACHED', get: (r) => (r.attached === null || r.attached === undefined ? '' : String(r.attached))},
  {header: 'DECLARED IN', get: (r) => [r.declaringFile, r.declaringLocation].filter(Boolean).join(':')},
]

/** The exact command that fills a missing value (never the value itself). */
export function fixCommand(key: string, envSlug: string): string {
  return `devhelm secrets values set ${key} --env ${envSlug} --value-stdin`
}
