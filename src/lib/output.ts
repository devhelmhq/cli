import Table from 'cli-table3'
import {stringify as yamlStringify} from 'yaml'

export type OutputFormat = 'table' | 'json' | 'yaml'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- contravariant T makes unknown impractical here
export interface ColumnDef<T = any> {
  header: string
  get: (row: T) => string
  width?: number
}

export function formatOutput(
  data: unknown,
  format: OutputFormat,
  columns?: ColumnDef[],
): string {
  switch (format) {
    case 'json':
      return JSON.stringify(data, null, 2)
    case 'yaml':
      return yamlStringify(data).trimEnd()
    case 'table':
      return formatTable(data, columns)
  }
}

function formatTable(data: unknown, columns?: ColumnDef[]): string {
  if (!Array.isArray(data)) {
    return formatSingleRecord(data as Record<string, unknown>)
  }

  if (data.length === 0) {
    return 'No results found.'
  }

  if (!columns) {
    const keys = Object.keys(data[0] as object)
    columns = keys.map((key) => ({
      header: key.toUpperCase(),
      get: (row: Record<string, unknown>) => {
        const val = row[key]
        if (val === null || val === undefined) return ''
        if (Array.isArray(val)) return val.join(', ')
        return String(val)
      },
    }))
  }

  const table = new Table({
    head: columns.map((c) => c.header),
    style: {head: ['cyan']},
  })

  for (const row of data) {
    table.push(columns!.map((c) => c.get(row)))
  }

  return table.toString()
}

/**
 * Default-table render of a single record (e.g. the response body of a
 * `create` / `get` command). Nested objects are JSON-stringified and then
 * truncated so one noisy field (e.g. `incidentPolicy`, `config`, `auth`)
 * doesn't blow the value column out to several thousand characters and
 * push the rest of the record off-screen. Users who actually need the
 * full structure can re-run with `--output json` (or `yaml`).
 */
const SINGLE_RECORD_OBJECT_PREVIEW_CHARS = 80
const SINGLE_RECORD_TRUNCATION_HINT = '… (use --output json for full)'

function previewObjectValue(value: unknown): string {
  const json = JSON.stringify(value) ?? ''
  if (json.length <= SINGLE_RECORD_OBJECT_PREVIEW_CHARS) return json
  return json.slice(0, SINGLE_RECORD_OBJECT_PREVIEW_CHARS) + SINGLE_RECORD_TRUNCATION_HINT
}

function formatSingleRecord(data: Record<string, unknown>): string {
  const table = new Table({style: {head: ['cyan']}})

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue
    const display = typeof value === 'object' && value !== null ? previewObjectValue(value) : String(value ?? '')
    table.push({[key]: display})
  }

  return table.toString()
}
