import {Command, Args} from '@oclif/core'
import {globalFlags, buildClient} from '../../../lib/base-command.js'
import {apiDelete} from '../../../lib/api-client.js'

export default class StatusPagesSubscribersRemove extends Command {
  static description = 'Remove a subscriber from a status page'
  static examples = ['<%= config.bin %> status-pages subscribers remove <page-id> <subscriber-id>']
  static args = {
    id: Args.string({description: 'Status page ID', required: true}),
    'subscriber-id': Args.string({description: 'Subscriber ID', required: true}),
  }
  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(StatusPagesSubscribersRemove)
    const client = buildClient(flags)
    await apiDelete(client, `/api/v1/status-pages/${args.id}/subscribers/${args['subscriber-id']}`)
    this.log(`Subscriber '${args['subscriber-id']}' removed.`)
  }
}
