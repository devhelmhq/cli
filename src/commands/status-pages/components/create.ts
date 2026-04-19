import {Command, Args, Flags} from '@oclif/core'
import {globalFlags, buildClient, display} from '../../../lib/base-command.js'
import {apiPost} from '../../../lib/api-client.js'
import {STATUS_PAGE_COMPONENT_TYPES} from '../../../lib/spec-facts.generated.js'

export default class StatusPagesComponentsCreate extends Command {
  static description = 'Add a component to a status page'
  static examples = ['<%= config.bin %> status-pages components create <page-id> --name "API" --type STATIC']
  static args = {id: Args.string({description: 'Status page ID', required: true})}
  static flags = {
    ...globalFlags,
    name: Flags.string({description: 'Component name', required: true}),
    type: Flags.string({description: 'Component type', required: true, options: [...STATUS_PAGE_COMPONENT_TYPES]}),
    'monitor-id': Flags.string({description: 'Monitor ID (required when type=MONITOR)'}),
    'resource-group-id': Flags.string({description: 'Resource group ID (required when type=GROUP)'}),
    'group-id': Flags.string({description: 'Component group ID for visual grouping'}),
    description: Flags.string({description: 'Component description'}),
    'display-order': Flags.integer({description: 'Position in the component list'}),
    'exclude-from-overall': Flags.boolean({description: 'Exclude from overall status calculation'}),
    'show-uptime': Flags.boolean({description: 'Whether to show the uptime bar', allowNo: true}),
    'start-date': Flags.string({description: 'Date (YYYY-MM-DD) from which to start showing uptime data'}),
  }

  async run() {
    const {args, flags} = await this.parse(StatusPagesComponentsCreate)
    const client = buildClient(flags)
    const body: Record<string, unknown> = {name: flags.name, type: flags.type}
    if (flags['monitor-id']) body.monitorId = flags['monitor-id']
    if (flags['resource-group-id']) body.resourceGroupId = flags['resource-group-id']
    if (flags['group-id']) body.groupId = flags['group-id']
    if (flags.description) body.description = flags.description
    if (flags['display-order'] !== undefined) body.displayOrder = flags['display-order']
    if (flags['exclude-from-overall'] !== undefined) body.excludeFromOverall = flags['exclude-from-overall']
    if (flags['show-uptime'] !== undefined) body.showUptime = flags['show-uptime']
    if (flags['start-date'] !== undefined) body.startDate = flags['start-date']
    const resp = await apiPost<{data?: unknown}>(client, `/api/v1/status-pages/${args.id}/components`, body)
    display(this, resp.data ?? resp, flags.output)
  }
}
