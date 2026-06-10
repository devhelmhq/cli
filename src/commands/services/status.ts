import {Command, Args} from '@oclif/core'
import {globalFlags, buildClient, display} from '../../lib/base-command.js'
import {checkedFetch, unwrapData} from '../../lib/api-client.js'

export default class ServicesStatus extends Command {
  static description = 'Get the current live status of a service (lightweight snapshot)'
  static examples = ['<%= config.bin %> services status aws-ec2']
  static args = {slug: Args.string({description: 'Service slug or ID', required: true})}
  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(ServicesStatus)
    const client = buildClient(flags)
    const resp = await checkedFetch(
      client.GET('/api/v1/services/{slugOrId}/live-status', {params: {path: {slugOrId: args.slug}}}),
    )
    display(this, unwrapData(resp), flags.output)
  }
}
