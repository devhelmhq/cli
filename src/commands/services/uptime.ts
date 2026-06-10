import {Command, Args, Flags} from '@oclif/core'
import type {z} from 'zod'
import {apiGet, apiGetPage, unwrapData} from '../../lib/api-client.js'
import type {components} from '../../lib/api.generated.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {globalFlags, buildClient, display} from '../../lib/base-command.js'
import type {ColumnDef} from '../../lib/output.js'
import {uuidFlag} from '../../lib/validators.js'

type ComponentUptimeDayDto = components['schemas']['ComponentUptimeDayDto']

const COMPONENT_COLUMNS: ColumnDef<ComponentUptimeDayDto>[] = [
  {header: 'DATE', get: (r) => r.date ?? ''},
  {header: 'UPTIME %', get: (r) => (r.uptimePercentage == null ? '' : String(r.uptimePercentage))},
  {header: 'DEGRADED (S)', get: (r) => String(r.degradedSeconds ?? '')},
  {header: 'PARTIAL OUTAGE (S)', get: (r) => String(r.partialOutageSeconds ?? '')},
  {header: 'MAJOR OUTAGE (S)', get: (r) => String(r.majorOutageSeconds ?? '')},
]

export default class ServicesUptime extends Command {
  static description = 'Get uptime data for a service, or for one of its components'
  static examples = [
    '<%= config.bin %> services uptime aws-ec2',
    '<%= config.bin %> services uptime aws-ec2 --period 30d',
    '<%= config.bin %> services uptime aws-ec2 --component 11111111-1111-1111-1111-111111111111',
  ]
  static args = {slug: Args.string({description: 'Service slug or ID', required: true})}
  static flags = {
    ...globalFlags,
    period: Flags.string({description: 'Time period (7d, 30d, 90d)', default: '30d'}),
    granularity: Flags.string({
      description: 'Data granularity (hourly, daily) — service-level only',
      exclusive: ['component'],
    }),
    component: uuidFlag({
      description: 'Component ID — fetch per-day uptime for a single component',
    }),
    from: Flags.string({
      description: 'ISO-8601 lower bound (component-level only)',
      dependsOn: ['component'],
    }),
    to: Flags.string({
      description: 'ISO-8601 upper bound (component-level only)',
      dependsOn: ['component'],
    }),
  }

  async run() {
    const {args, flags} = await this.parse(ServicesUptime)
    const client = buildClient(flags)

    if (flags.component) {
      const query: Record<string, string> = {period: flags.period}
      if (flags.from) query.from = flags.from
      if (flags.to) query.to = flags.to
      const result = await apiGetPage(
        client,
        `/api/v1/services/${args.slug}/components/${flags.component}/uptime`,
        apiSchemas.ComponentUptimeDayDto as z.ZodType<ComponentUptimeDayDto>,
        {query},
      )
      display(this, result.data, flags.output, COMPONENT_COLUMNS as ColumnDef[])
      return
    }

    const query: Record<string, string> = {period: flags.period}
    if (flags.granularity) query.granularity = flags.granularity
    const resp = await apiGet(client, `/api/v1/services/${args.slug}/uptime`, {query})
    display(this, unwrapData(resp), flags.output)
  }
}
