import {Command, Flags} from '@oclif/core'
import type {z} from 'zod'
import {apiGetCursorPage} from '../../lib/api-client.js'
import type {components} from '../../lib/api.generated.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {globalFlags, buildClient, display} from '../../lib/base-command.js'
import type {ColumnDef} from '../../lib/output.js'

type ServiceCatalogDto = components['schemas']['ServiceCatalogDto']

const COLUMNS: ColumnDef<ServiceCatalogDto>[] = [
  {header: 'NAME', get: (r) => r.name ?? ''},
  {header: 'SLUG', get: (r) => r.slug ?? ''},
  {header: 'CATEGORY', get: (r) => r.category ?? ''},
  {header: 'STATUS', get: (r) => r.overallStatus ?? ''},
  {header: 'UPTIME 30D', get: (r) => (r.uptime30d == null ? '' : String(r.uptime30d))},
]

export default class ServicesList extends Command {
  static description = 'Browse the status-data service catalog (Stripe, GitHub, AWS, ...)'
  static examples = [
    '<%= config.bin %> services list',
    '<%= config.bin %> services list --category cloud --status operational',
    '<%= config.bin %> services list --search stripe',
  ]
  static flags = {
    ...globalFlags,
    category: Flags.string({description: 'Filter by category slug'}),
    search: Flags.string({description: 'Case-insensitive substring match on service name or slug'}),
    status: Flags.string({description: 'Filter by current overall status'}),
    limit: Flags.integer({description: 'Page size (1–100)', default: 20}),
    cursor: Flags.string({description: 'Opaque cursor from a previous response'}),
  }

  async run() {
    const {flags} = await this.parse(ServicesList)
    const client = buildClient(flags)
    const query: Record<string, unknown> = {limit: flags.limit}
    if (flags.category) query.category = flags.category
    if (flags.search) query.search = flags.search
    if (flags.status) query.status = flags.status
    if (flags.cursor) query.cursor = flags.cursor
    const page = await apiGetCursorPage(
      client,
      '/api/v1/services',
      apiSchemas.ServiceCatalogDto as z.ZodType<ServiceCatalogDto>,
      {query},
    )
    display(this, page.data, flags.output, COLUMNS as ColumnDef[])
    if (page.hasMore && page.nextCursor && flags.output === 'table') {
      this.log(`More results available — re-run with --cursor ${page.nextCursor}`)
    }
  }
}
