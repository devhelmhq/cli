/** `GET /monitors/{id}/history` (CursorPage MonitorHistoryEntryDto) with client-side filters. */
import type {z} from 'zod'
import {apiGetCursorPage, type ApiClient} from '../api-client.js'
import {schemas as apiSchemas} from '../api-zod.generated.js'
import type {ColumnDef} from '../output.js'

export type MonitorHistoryEntryDto = z.infer<typeof apiSchemas.MonitorHistoryEntryDto>

export interface HistoryFilter {
  failed?: boolean
  region?: string
  since?: string
  limit: number
}

/** Whether a row records a failure or a tick that did not run. */
export function isFailureRow(row: MonitorHistoryEntryDto): boolean {
  const r = row as {outcome?: unknown; passed?: unknown}
  if (typeof r.passed === 'boolean') return !r.passed
  if (typeof r.outcome === 'string') return r.outcome !== 'passed' && r.outcome !== 'passed_on_retry'
  return row.kind !== 'passed'
}

export async function fetchHistory(client: ApiClient, monitorId: string, filter: HistoryFilter): Promise<MonitorHistoryEntryDto[]> {
  const out: MonitorHistoryEntryDto[] = []
  const sinceMs = filter.since ? Date.parse(filter.since) : undefined
  let cursor: string | undefined
  for (let i = 0; i < 100 && out.length < filter.limit; i++) {
    const query: Record<string, string | number> = {limit: Math.min(100, Math.max(1, filter.limit))}
    if (cursor) query.cursor = cursor
    const page = await apiGetCursorPage(client, `/api/v1/monitors/${monitorId}/history`, apiSchemas.MonitorHistoryEntryDto, {query})
    let older = false
    for (const row of page.data) {
      if (sinceMs !== undefined && Date.parse(row.to) < sinceMs) {
        older = true
        continue
      }
      if (filter.region && row.region && row.region !== filter.region) continue
      if (filter.failed && !isFailureRow(row)) continue
      out.push(row)
    }
    if (older || !page.hasMore || !page.nextCursor) break
    cursor = page.nextCursor
  }
  return out.slice(0, filter.limit)
}

export const HISTORY_COLUMNS: ColumnDef<MonitorHistoryEntryDto>[] = [
  {header: 'KIND', get: (r) => r.kind},
  {header: 'REASON', get: (r) => r.reason},
  {header: 'REGION', get: (r) => r.region ?? ''},
  {header: 'FROM', get: (r) => r.from},
  {header: 'TO', get: (r) => r.to},
  {header: 'COUNT', get: (r) => String(r.count)},
  {header: 'MISSING KEYS', get: (r) => (r.missingKeys ?? []).join(', ')},
]
