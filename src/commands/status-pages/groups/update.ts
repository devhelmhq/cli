import {Command, Args, Flags} from '@oclif/core'
import {globalFlags, buildClient, display} from '../../../lib/base-command.js'
import {apiPut} from '../../../lib/api-client.js'

export default class StatusPagesGroupsUpdate extends Command {
  static description = 'Update a component group on a status page'
  static examples = ['<%= config.bin %> status-pages groups update <page-id> <group-id> --name "Core"']
  static args = {
    id: Args.string({description: 'Status page ID', required: true}),
    'group-id': Args.string({description: 'Group ID', required: true}),
  }
  static flags = {
    ...globalFlags,
    name: Flags.string({description: 'Group name'}),
  }

  async run() {
    const {args, flags} = await this.parse(StatusPagesGroupsUpdate)
    const client = buildClient(flags)
    const body: Record<string, unknown> = {}
    if (flags.name) body.name = flags.name
    const resp = await apiPut<{data?: unknown}>(client, `/api/v1/status-pages/${args.id}/groups/${args['group-id']}`, body)
    display(this, resp.data ?? resp, flags.output)
  }
}
