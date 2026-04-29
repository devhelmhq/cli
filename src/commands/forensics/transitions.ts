import {Command, Flags} from '@oclif/core'
import {apiGetPage} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {buildClient, display, globalFlags} from '../../lib/base-command.js'
import type {ColumnDef} from '../../lib/output.js'

interface TransitionRow {
  occurredAt: string
  fromStatus: string
  toStatus: string
  reason: string
  incidentId?: string | null
  checkId: string
  policySnapshotHashHex: string
}

const COLUMNS: ColumnDef<TransitionRow>[] = [
  {header: 'WHEN', get: (r) => r.occurredAt},
  {header: 'FROM → TO', get: (r) => `${r.fromStatus} → ${r.toStatus}`},
  {header: 'REASON', get: (r) => r.reason},
  {header: 'INCIDENT', get: (r) => (r.incidentId ? r.incidentId.slice(0, 8) : '–')},
  {header: 'CHECK', get: (r) => r.checkId.slice(0, 8)},
  {header: 'POLICY', get: (r) => r.policySnapshotHashHex.slice(0, 12)},
]

export default class ForensicsTransitions extends Command {
  static description = 'List state transitions recorded for a monitor (paginated)'
  static examples = [
    '<%= config.bin %> forensics transitions --monitor-id 5f4…',
    '<%= config.bin %> forensics transitions --monitor-id 5f4… --from 2026-01-01T00:00:00Z',
  ]
  static flags = {
    ...globalFlags,
    'monitor-id': Flags.string({description: 'Monitor ID (UUID)', required: true}),
    from: Flags.string({description: 'ISO-8601 lower bound (occurredAt >= from)'}),
    to: Flags.string({description: 'ISO-8601 upper bound (occurredAt < to)'}),
    page: Flags.integer({description: 'Page index (0-based)', default: 0}),
    size: Flags.integer({description: 'Page size', default: 50}),
  }

  async run() {
    const {flags} = await this.parse(ForensicsTransitions)
    const client = buildClient(flags)

    const params: Record<string, unknown> = {page: flags.page, size: flags.size}
    if (flags.from) params.from = flags.from
    if (flags.to) params.to = flags.to

    const result = await apiGetPage(
      client,
      `/api/v1/forensics/monitors/${flags['monitor-id']}/transitions`,
      apiSchemas.IncidentStateTransitionDto,
      params,
    )

    display(this, result.data, flags.output, COLUMNS as ColumnDef[])
  }
}
