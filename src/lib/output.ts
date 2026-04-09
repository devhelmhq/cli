import Table from 'cli-table3'
import {stringify as yamlStringify} from 'yaml'

export type OutputFormat = 'table' | 'json' | 'yaml'

export interface ColumnDef {
  key: string
  header: string
  width?: number
  get?: (row: Record<string, unknown>) => string
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
    columns = Object.keys(data[0] as object).map((key) => ({
      key,
      header: key.toUpperCase(),
    }))
  }

  const table = new Table({
    head: columns.map((c) => c.header),
    style: {head: ['cyan']},
  })

  for (const row of data) {
    const r = row as Record<string, unknown>
    table.push(columns!.map((c) => {
      if (c.get) return c.get(r)
      const val = r[c.key]
      if (val === null || val === undefined) return ''
      return String(val)
    }))
  }

  return table.toString()
}

function formatSingleRecord(data: Record<string, unknown>): string {
  const table = new Table({style: {head: ['cyan']}})

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue
    const display = typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')
    table.push({[key]: display})
  }

  return table.toString()
}
