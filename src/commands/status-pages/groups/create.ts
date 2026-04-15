import {Command, Args, Flags} from '@oclif/core'
import {globalFlags, buildClient, display} from '../../../lib/base-command.js'
import {apiPost} from '../../../lib/api-client.js'

export default class StatusPagesGroupsCreate extends Command {
  static description = 'Create a component group on a status page'
  static examples = ['<%= config.bin %> status-pages groups create <page-id> --name "Infrastructure"']
  static args = {id: Args.string({description: 'Status page ID', required: true})}
  static flags = {
    ...globalFlags,
    name: Flags.string({description: 'Group name', required: true}),
  }

  async run() {
    const {args, flags} = await this.parse(StatusPagesGroupsCreate)
    const client = buildClient(flags)
    const resp = await apiPost<{data?: unknown}>(client, `/api/v1/status-pages/${args.id}/groups`, {name: flags.name})
    display(this, resp.data ?? resp, flags.output)
  }
}
