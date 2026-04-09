import {Command, Args} from '@oclif/core'
import {globalFlags, buildClient, display} from '../../../lib/base-command.js'
import {SingleResponse} from '../../../lib/api-client.js'

export default class DataServicesStatus extends Command {
  static description = 'Get the current status of a service'
  static examples = ['<%= config.bin %> data services status aws-ec2']
  static args = {slug: Args.string({description: 'Service slug', required: true})}
  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(DataServicesStatus)
    const client = buildClient(flags)
    const resp = await client.get<SingleResponse<Record<string, unknown>>>(`/api/v1/services/${args.slug}`)
    display(this, resp.content, flags.output)
  }
}
