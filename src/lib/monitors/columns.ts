/** Shared table columns and small renderers for monitor commands. */
import {formatOutput, type ColumnDef} from '../output.js'
import {ownerLabel, type MonitorDto} from './resolve.js'

export const MONITOR_COLUMNS: ColumnDef<MonitorDto>[] = [
  {header: 'ID', get: (r) => r.id ?? ''},
  {header: 'NAME', get: (r) => r.name ?? ''},
  {header: 'TYPE', get: (r) => r.type ?? ''},
  {header: 'ENABLED', get: (r) => String(r.enabled ?? '')},
  {header: 'FREQ(s)', get: (r) => String(r.frequencySeconds ?? '')},
  {header: 'REGIONS', get: (r) => (r.regions ?? []).join(', ')},
  {header: 'MANAGED', get: (r) => r.managedBy ?? ''},
]

export const MONITOR_LIST_COLUMNS: ColumnDef<MonitorDto>[] = [
  ...MONITOR_COLUMNS.slice(0, 3),
  {header: 'ENV', get: (r) => r.environment?.slug ?? ''},
  {header: 'HEALTH', get: (r) => r.displayHealth ?? ''},
  ...MONITOR_COLUMNS.slice(3, 6),
  {header: 'OWNER', get: (r) => ownerLabel(r)},
]

export function table<T>(rows: T[] | T, columns?: ColumnDef<T>[]): string {
  return formatOutput(rows, 'table', columns as ColumnDef[] | undefined)
}

export function shortId(id: string | null | undefined): string {
  return id ? id.slice(0, 8) : ''
}
