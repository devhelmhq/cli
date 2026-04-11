import {Command, Args} from '@oclif/core'
import {globalFlags, buildClient, display} from '../../../lib/base-command.js'
import {checkedFetch} from '../../../lib/api-client.js'

export default class DataServicesStatus extends Command {
  static description = 'Get the current status of a service'
  static examples = ['<%= config.bin %> data services status aws-ec2']
  static args = {slug: Args.string({description: 'Service slug', required: true})}
  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(DataServicesStatus)
    const client = buildClient(flags)
    const resp = await checkedFetch(client.GET('/api/v1/services/{slugOrId}', {params: {path: {slugOrId: args.slug}}}))
    display(this, resp.data ?? resp, flags.output)
  }
}
