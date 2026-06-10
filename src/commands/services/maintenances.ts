import {Command, Args} from '@oclif/core'
import type {z} from 'zod'
import {apiGetPage} from '../../lib/api-client.js'
import type {components} from '../../lib/api.generated.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {globalFlags, buildClient, display} from '../../lib/base-command.js'
import type {ColumnDef} from '../../lib/output.js'

type ScheduledMaintenanceDto = components['schemas']['ScheduledMaintenanceDto']

const COLUMNS: ColumnDef<ScheduledMaintenanceDto>[] = [
  {header: 'ID', get: (r) => r.id ?? ''},
  {header: 'TITLE', get: (r) => r.title ?? ''},
  {header: 'IMPACT', get: (r) => r.impact ?? ''},
  {header: 'STATUS', get: (r) => r.status ?? ''},
  {header: 'SCHEDULED FOR', get: (r) => r.scheduledFor ?? ''},
  {header: 'SCHEDULED UNTIL', get: (r) => r.scheduledUntil ?? ''},
]

export default class ServicesMaintenances extends Command {
  static description = 'List scheduled maintenances for a service'
  static examples = ['<%= config.bin %> services maintenances aws-ec2']
  static args = {slug: Args.string({description: 'Service slug or ID', required: true})}
  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(ServicesMaintenances)
    const client = buildClient(flags)
    const result = await apiGetPage(
      client,
      `/api/v1/services/${args.slug}/maintenances`,
      apiSchemas.ScheduledMaintenanceDto as z.ZodType<ScheduledMaintenanceDto>,
    )
    display(this, result.data, flags.output, COLUMNS as ColumnDef[])
  }
}
