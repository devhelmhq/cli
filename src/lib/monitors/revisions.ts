/** Revision helpers shared by `monitors revisions …`, publish, rollback and export. */
import {mkdirSync, writeFileSync} from 'node:fs'
import {dirname, join, resolve, sep} from 'node:path'
import type {z} from 'zod'
import {apiGetPage, apiGetSingle, type ApiClient} from '../api-client.js'
import {schemas as apiSchemas} from '../api-zod.generated.js'
import {ValidationError} from '../errors.js'
import type {ColumnDef} from '../output.js'

export type RevisionDto = z.infer<typeof apiSchemas.RevisionDto>
export type RevisionFilesDto = z.infer<typeof apiSchemas.RevisionFilesDto>

export const REVISION_STATES = ['draft', 'tested_passed', 'tested_failed', 'live', 'previous', 'discarded', 'all']

export async function listRevisions(client: ApiClient, monitorId: string, state?: string): Promise<RevisionDto[]> {
  const out: RevisionDto[] = []
  for (let page = 0; page < 50; page++) {
    const query: Record<string, string | number> = {page, size: 100}
    if (state) query.state = state
    const resp = await apiGetPage(client, `/api/v1/monitors/${monitorId}/revisions`, apiSchemas.RevisionDto, {query})
    out.push(...resp.data)
    if (!resp.hasNext) break
  }
  return out
}

export function getRevision(client: ApiClient, id: string): Promise<RevisionDto> {
  return apiGetSingle(client, `/api/v1/revisions/${id}`, apiSchemas.RevisionDto)
}

export function getRevisionFiles(client: ApiClient, id: string): Promise<RevisionFilesDto> {
  return apiGetSingle(client, `/api/v1/revisions/${id}/files`, apiSchemas.RevisionFilesDto)
}

function ago(iso: string | null | undefined): string {
  if (!iso) return ''
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  if (s < 86400) return `${Math.round(s / 3600)}h ago`
  return `${Math.round(s / 86400)}d ago`
}

export const REVISION_COLUMNS: ColumnDef<RevisionDto>[] = [
  {header: 'ID', get: (r) => r.id},
  {header: '#', get: (r) => String(r.number)},
  {header: 'STATE', get: (r) => r.state ?? ''},
  {header: 'SOURCE', get: (r) => r.createdByKind ?? ''},
  {header: 'COMMIT', get: (r) => (r.source?.commit ?? r.gitSha ?? '').slice(0, 7)},
  {header: 'WHEN', get: (r) => ago(r.createdAt)},
  {header: 'WHILE LIVE', get: (r) => (r.liveStats ? `${r.liveStats.runs - r.liveStats.failed}/${r.liveStats.runs} passed` : '')},
]

/** Write `{path: text}` under `dir`, refusing paths that escape it. */
export function writeFiles(dir: string, files: Record<string, string>): string[] {
  const root = resolve(dir)
  const written: string[] = []
  for (const [path, text] of Object.entries(files)) {
    const target = resolve(root, path)
    if (target !== root && !target.startsWith(root + sep)) throw new ValidationError(`Refusing to write ${path} outside ${dir}`, {code: 'FIELD_INVALID_FORMAT'})
    mkdirSync(dirname(target), {recursive: true})
    writeFileSync(target, text)
    written.push(join(dir, path))
  }
  return written
}

