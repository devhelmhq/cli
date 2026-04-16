import {Command, Args} from '@oclif/core'
import {globalFlags, buildClient} from '../../../lib/base-command.js'
import {apiDelete} from '../../../lib/api-client.js'

export default class StatusPagesGroupsDelete extends Command {
  static description = 'Delete a component group from a status page'
  static examples = ['<%= config.bin %> status-pages groups delete <page-id> <group-id>']
  static args = {
    id: Args.string({description: 'Status page ID', required: true}),
    'group-id': Args.string({description: 'Group ID', required: true}),
  }
  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(StatusPagesGroupsDelete)
    const client = buildClient(flags)
    await apiDelete(client, `/api/v1/status-pages/${args.id}/groups/${args['group-id']}`)
    this.log(`Group '${args['group-id']}' deleted.`)
  }
}
