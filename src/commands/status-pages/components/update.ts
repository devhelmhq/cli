import {Command, Flags} from '@oclif/core'
import {globalFlags, buildClient, display} from '../../../lib/base-command.js'
import {apiPut, unwrapData} from '../../../lib/api-client.js'
import {uuidArg} from '../../../lib/validators.js'

export default class StatusPagesComponentsUpdate extends Command {
  static description = 'Update a status page component'
  static examples = ['<%= config.bin %> status-pages components update <page-id> <component-id> --name "API v2"']
  static args = {
    id: uuidArg({description: 'Status page ID', required: true}),
    'component-id': uuidArg({description: 'Component ID', required: true}),
  }
  static flags = {
    ...globalFlags,
    name: Flags.string({description: 'Component name'}),
    description: Flags.string({description: 'Component description'}),
    'group-id': Flags.string({description: 'Move to a different group'}),
    'remove-from-group': Flags.boolean({description: 'Remove the component from its group'}),
    'display-order': Flags.integer({description: 'Position in the component list'}),
    'exclude-from-overall': Flags.boolean({description: 'Exclude from overall status calculation', allowNo: true}),
    'show-uptime': Flags.boolean({description: 'Whether to show the uptime bar', allowNo: true}),
    'start-date': Flags.string({description: 'Date (YYYY-MM-DD) from which to start showing uptime data'}),
  }

  async run() {
    const {args, flags} = await this.parse(StatusPagesComponentsUpdate)
    const client = buildClient(flags)
    const body: Record<string, unknown> = {}
    if (flags.name) body.name = flags.name
    if (flags.description !== undefined) body.description = flags.description
    if (flags['group-id'] !== undefined) body.groupId = flags['group-id']
    if (flags['remove-from-group']) body.removeFromGroup = true
    if (flags['display-order'] !== undefined) body.displayOrder = flags['display-order']
    if (flags['exclude-from-overall'] !== undefined) body.excludeFromOverall = flags['exclude-from-overall']
    if (flags['show-uptime'] !== undefined) body.showUptime = flags['show-uptime']
    if (flags['start-date'] !== undefined) body.startDate = flags['start-date']
    const resp = await apiPut(client, `/api/v1/status-pages/${args.id}/components/${args['component-id']}`, body)
    display(this, unwrapData(resp), flags.output)
  }
}
