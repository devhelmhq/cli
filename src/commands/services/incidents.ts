import {Command, Args, Flags} from '@oclif/core'
import type {z} from 'zod'
import {apiGetPage, checkedFetch, unwrapData} from '../../lib/api-client.js'
import type {components} from '../../lib/api.generated.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {globalFlags, buildClient, display} from '../../lib/base-command.js'
import type {ColumnDef} from '../../lib/output.js'

type ServiceIncidentDto = components['schemas']['ServiceIncidentDto']

const COLUMNS: ColumnDef<ServiceIncidentDto>[] = [
  {header: 'ID', get: (r) => r.id ?? ''},
  {header: 'TITLE', get: (r) => r.title ?? ''},
  {header: 'IMPACT', get: (r) => r.impact ?? ''},
  {header: 'STATUS', get: (r) => r.status ?? ''},
  {header: 'STARTED', get: (r) => r.startedAt ?? ''},
  {header: 'RESOLVED', get: (r) => r.resolvedAt ?? ''},
]

export default class ServicesIncidents extends Command {
  static description =
    'List incidents for a service (or across all services), or show one incident in full detail'
  static examples = [
    '<%= config.bin %> services incidents stripe',
    '<%= config.bin %> services incidents stripe --status active',
    '<%= config.bin %> services incidents --from 2026-06-01T00:00:00Z',
    '<%= config.bin %> services incidents stripe 22222222-2222-2222-2222-222222222222',
  ]
  static args = {
    slug: Args.string({description: 'Service slug or ID (omit to list incidents across all services)'}),
    incidentId: Args.string({description: 'Incident ID — show full detail for this incident'}),
  }
  static flags = {
    ...globalFlags,
    status: Flags.string({description: 'Filter by incident status', options: ['active', 'resolved']}),
    from: Flags.string({description: 'ISO-8601 lower bound on incident start time'}),
  }

  async run() {
    const {args, flags} = await this.parse(ServicesIncidents)
    const client = buildClient(flags)

    if (args.slug && args.incidentId) {
      const resp = await checkedFetch(
        client.GET('/api/v1/services/{slugOrId}/incidents/{incidentId}', {
          params: {path: {slugOrId: args.slug, incidentId: args.incidentId}},
        }),
      )
      display(this, unwrapData(resp), flags.output)
      return
    }

    const path = args.slug
      ? `/api/v1/services/${args.slug}/incidents`
      : '/api/v1/services/incidents'
    const query: Record<string, unknown> = {}
    if (flags.status) query.status = flags.status
    if (flags.from) query.from = flags.from
    const result = await apiGetPage(
      client,
      path,
      apiSchemas.ServiceIncidentDto as z.ZodType<ServiceIncidentDto>,
      {query},
    )
    display(this, result.data, flags.output, COLUMNS as ColumnDef[])
  }
}
