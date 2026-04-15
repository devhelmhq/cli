import {Command, Args, Flags} from '@oclif/core'
import {globalFlags, buildClient, display} from '../../../lib/base-command.js'
import {apiPost} from '../../../lib/api-client.js'

export default class StatusPagesSubscribersAdd extends Command {
  static description = 'Add a subscriber to a status page'
  static examples = ['<%= config.bin %> status-pages subscribers add <page-id> --email user@example.com']
  static args = {id: Args.string({description: 'Status page ID', required: true})}
  static flags = {
    ...globalFlags,
    email: Flags.string({description: 'Subscriber email address', required: true}),
  }

  async run() {
    const {args, flags} = await this.parse(StatusPagesSubscribersAdd)
    const client = buildClient(flags)
    const resp = await apiPost<{data?: unknown}>(client, `/api/v1/status-pages/${args.id}/subscribers`, {email: flags.email})
    display(this, resp.data ?? resp, flags.output)
  }
}
