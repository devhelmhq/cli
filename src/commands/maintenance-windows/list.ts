import {Command, Flags} from '@oclif/core'
import type {ZodType} from 'zod'
import {globalFlags, buildClient, display} from '../../lib/base-command.js'
import {apiGetPage} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import type {components} from '../../lib/api.generated.js'
import {uuidFlag} from '../../lib/validators.js'

type MaintenanceWindowDto = components['schemas']['MaintenanceWindowDto']

// API-supported filter values for `GET /api/v1/maintenance-windows?filter=...`.
// The server understands `active` (in-progress now) and `upcoming` (future).
// Past windows are not server-filterable today — pass no filter and inspect
// the timestamps locally if you need them.
const STATUS_OPTIONS = ['active', 'upcoming'] as const

export default class MaintenanceWindowsList extends Command {
  static description = 'List all maintenance windows'
  static examples = [
    '<%= config.bin %> maintenance-windows list',
    '<%= config.bin %> maintenance-windows list --status active',
    '<%= config.bin %> maintenance-windows list --monitor <uuid>',
  ]
  static flags = {
    ...globalFlags,
    'page-size': Flags.integer({description: 'Number of items per API request (1–200)', default: 200}),
    status: Flags.string({
      description: 'Filter by lifecycle state (server-supported: active, upcoming)',
      options: [...STATUS_OPTIONS],
    }),
    monitor: uuidFlag({description: 'Only show windows attached to this monitor ID'}),
  }

  async run() {
    const {flags} = await this.parse(MaintenanceWindowsList)
    const client = buildClient(flags)
    const schema = apiSchemas.MaintenanceWindowDto as ZodType<MaintenanceWindowDto>

    // Roll our own pagination loop because the shared
    // `fetchPaginatedValidated` helper accepts only page/size — this
    // endpoint also takes `monitorId` and `filter` query params, and
    // appending them to the path string would race against openapi-fetch's
    // own query serialiser.
    const items: MaintenanceWindowDto[] = []
    let page = 0
    while (true) {
      const resp = await apiGetPage<MaintenanceWindowDto>(
        client,
        '/api/v1/maintenance-windows',
        schema,
        {
          query: {
            page,
            size: flags['page-size'],
            ...(flags.status ? {filter: flags.status} : {}),
            ...(flags.monitor ? {monitorId: flags.monitor} : {}),
          },
        },
      )
      items.push(...resp.data)
      if (!resp.hasNext) break
      page++
    }

    display(this, items, flags.output, [
      {header: 'ID', get: (r: MaintenanceWindowDto) => r.id ?? ''},
      {header: 'MONITOR', get: (r: MaintenanceWindowDto) => r.monitorId ?? '(org-wide)'},
      {header: 'STARTS', get: (r: MaintenanceWindowDto) => r.startsAt ?? ''},
      {header: 'ENDS', get: (r: MaintenanceWindowDto) => r.endsAt ?? ''},
      {header: 'STATUS', get: (r: MaintenanceWindowDto) => computeStatus(r)},
      {header: 'SUPPRESS', get: (r: MaintenanceWindowDto) => String(r.suppressAlerts ?? '')},
      {header: 'REASON', get: (r: MaintenanceWindowDto) => r.reason ?? ''},
    ])
  }
}

// Best-effort lifecycle label derived from the timestamps. The server only
// distinguishes `active` and `upcoming`; we surface `past` so the table
// is still readable when no filter was applied.
function computeStatus(window: MaintenanceWindowDto): string {
  const now = Date.now()
  const start = Date.parse(window.startsAt ?? '')
  const end = Date.parse(window.endsAt ?? '')
  if (Number.isFinite(end) && end < now) return 'past'
  if (Number.isFinite(start) && start > now) return 'upcoming'
  return 'active'
}
