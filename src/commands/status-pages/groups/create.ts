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
    description: Flags.string({description: 'Optional group description'}),
    collapsed: Flags.boolean({description: 'Whether the group is collapsed by default', allowNo: true}),
    'display-order': Flags.integer({description: 'Position in the group list'}),
  }

  async run() {
    const {args, flags} = await this.parse(StatusPagesGroupsCreate)
    const client = buildClient(flags)
    const body: Record<string, unknown> = {name: flags.name}
    if (flags.description) body.description = flags.description
    if (flags.collapsed !== undefined) body.collapsed = flags.collapsed
    if (flags['display-order'] !== undefined) body.displayOrder = flags['display-order']
    const resp = await apiPost<{data?: unknown}>(client, `/api/v1/status-pages/${args.id}/groups`, body)
    display(this, resp.data ?? resp, flags.output)
  }
}
