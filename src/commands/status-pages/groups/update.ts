import {Command, Flags} from '@oclif/core'
import {globalFlags, buildClient, display} from '../../../lib/base-command.js'
import {apiPut, unwrapData} from '../../../lib/api-client.js'
import {uuidArg} from '../../../lib/validators.js'

export default class StatusPagesGroupsUpdate extends Command {
  static description = 'Update a component group on a status page'
  static examples = ['<%= config.bin %> status-pages groups update <page-id> <group-id> --name "Core"']
  static args = {
    id: uuidArg({description: 'Status page ID', required: true}),
    'group-id': uuidArg({description: 'Group ID', required: true}),
  }
  static flags = {
    ...globalFlags,
    name: Flags.string({description: 'Group name'}),
    description: Flags.string({description: 'Group description'}),
    'default-open': Flags.boolean({
      description: 'Initial expand/collapse state on first page load. Use --no-default-open to seed collapsed.',
      allowNo: true,
    }),
    'display-order': Flags.integer({description: 'Position in the group list'}),
  }

  async run() {
    const {args, flags} = await this.parse(StatusPagesGroupsUpdate)
    const client = buildClient(flags)
    const body: Record<string, unknown> = {}
    if (flags.name) body.name = flags.name
    if (flags.description !== undefined) body.description = flags.description
    if (flags['default-open'] !== undefined) body.defaultOpen = flags['default-open']
    if (flags['display-order'] !== undefined) body.displayOrder = flags['display-order']
    const resp = await apiPut(client, `/api/v1/status-pages/${args.id}/groups/${args['group-id']}`, body)
    display(this, unwrapData(resp), flags.output)
  }
}
