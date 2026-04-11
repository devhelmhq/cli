import {Command, Args, Flags} from '@oclif/core'
import {globalFlags, buildClient, display} from '../../../lib/base-command.js'
import {apiGet} from '../../../lib/api-client.js'

export default class DataServicesUptime extends Command {
  static description = 'Get uptime data for a service'
  static examples = [
    '<%= config.bin %> data services uptime aws-ec2',
    '<%= config.bin %> data services uptime aws-ec2 --period 30d',
  ]
  static args = {slug: Args.string({description: 'Service slug', required: true})}
  static flags = {
    ...globalFlags,
    period: Flags.string({description: 'Time period (7d, 30d, 90d)', default: '30d'}),
    granularity: Flags.string({description: 'Data granularity (hourly, daily)'}),
  }

  async run() {
    const {args, flags} = await this.parse(DataServicesUptime)
    const client = buildClient(flags)
    const query: Record<string, string> = {period: flags.period}
    if (flags.granularity) query.granularity = flags.granularity
    const resp = await apiGet<{data?: unknown}>(client, `/api/v1/services/${args.slug}/uptime`, {query})
    display(this, resp.data ?? resp, flags.output)
  }
}
