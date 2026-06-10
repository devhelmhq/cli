import {Command, Args} from '@oclif/core'
import {globalFlags, buildClient, display} from '../../lib/base-command.js'
import {checkedFetch, unwrapData} from '../../lib/api-client.js'

export default class ServicesGet extends Command {
  static description = 'Get full catalog details for a service'
  static examples = ['<%= config.bin %> services get stripe']
  static args = {slug: Args.string({description: 'Service slug or ID', required: true})}
  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(ServicesGet)
    const client = buildClient(flags)
    const resp = await checkedFetch(
      client.GET('/api/v1/services/{slugOrId}', {params: {path: {slugOrId: args.slug}}}),
    )
    display(this, unwrapData(resp), flags.output)
  }
}
