import {Command, Args} from '@oclif/core'
import type {z} from 'zod'
import {apiGetPage} from '../../lib/api-client.js'
import type {components} from '../../lib/api.generated.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {globalFlags, buildClient, display} from '../../lib/base-command.js'
import type {ColumnDef} from '../../lib/output.js'

type ServiceComponentDto = components['schemas']['ServiceComponentDto']

const COLUMNS: ColumnDef<ServiceComponentDto>[] = [
  {header: 'ID', get: (r) => r.id ?? ''},
  {header: 'NAME', get: (r) => r.name ?? ''},
  {header: 'STATUS', get: (r) => r.status ?? ''},
  {header: 'GROUP', get: (r) => r.groupId ?? ''},
]

export default class ServicesComponents extends Command {
  static description = 'List the components of a service'
  static examples = ['<%= config.bin %> services components aws-ec2']
  static args = {slug: Args.string({description: 'Service slug or ID', required: true})}
  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(ServicesComponents)
    const client = buildClient(flags)
    const result = await apiGetPage(
      client,
      `/api/v1/services/${args.slug}/components`,
      apiSchemas.ServiceComponentDto as z.ZodType<ServiceComponentDto>,
    )
    display(this, result.data, flags.output, COLUMNS as ColumnDef[])
  }
}
