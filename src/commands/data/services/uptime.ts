import {Command, Args, Flags} from '@oclif/core'
import {globalFlags, buildClient, display} from '../../../lib/base-command.js'
import {checkedFetch, unwrap} from '../../../lib/api-client.js'

export default class DataServicesUptime extends Command {
  static description = 'Get uptime data for a service'
  static examples = [
    '<%= config.bin %> data services uptime aws-ec2',
    '<%= config.bin %> data services uptime aws-ec2 --period 30d',
  ]
  static args = {slug: Args.string({description: 'Service slug', required: true})}
  static flags = {
    ...globalFlags,
    period: Flags.string({description: 'Time period', default: '30d', options: ['24h', '7d', '30d', '90d', '1y', '2y', 'all']}),
    granularity: Flags.string({description: 'Data granularity', options: ['hourly', 'daily', 'monthly']}),
  }

  async run() {
    const {args, flags} = await this.parse(DataServicesUptime)
    const client = buildClient(flags)
    const resp = await checkedFetch(client.GET('/api/v1/services/{slugOrId}/uptime', {
      params: {
        path: {slugOrId: args.slug},
        query: {
          period: flags.period as '24h' | '7d' | '30d' | '90d' | '1y' | '2y' | 'all',
          ...(flags.granularity ? {granularity: flags.granularity as 'hourly' | 'daily' | 'monthly'} : {}),
        },
      },
    }))
    display(this, unwrap(resp), flags.output)
  }
}
