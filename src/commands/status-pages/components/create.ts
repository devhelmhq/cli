import {Command, Args, Flags} from '@oclif/core'
import {globalFlags, buildClient, display} from '../../../lib/base-command.js'
import {apiPost} from '../../../lib/api-client.js'

export default class StatusPagesComponentsCreate extends Command {
  static description = 'Add a component to a status page'
  static examples = ['<%= config.bin %> status-pages components create <page-id> --name "API" --type STATIC']
  static args = {id: Args.string({description: 'Status page ID', required: true})}
  static flags = {
    ...globalFlags,
    name: Flags.string({description: 'Component name', required: true}),
    type: Flags.string({description: 'Component type', required: true, options: ['STATIC', 'MONITOR']}),
    'monitor-id': Flags.string({description: 'Monitor ID (for MONITOR type)'}),
    'group-id': Flags.string({description: 'Component group ID'}),
  }

  async run() {
    const {args, flags} = await this.parse(StatusPagesComponentsCreate)
    const client = buildClient(flags)
    const body: Record<string, unknown> = {name: flags.name, type: flags.type}
    if (flags['monitor-id']) body.monitorId = flags['monitor-id']
    if (flags['group-id']) body.groupId = flags['group-id']
    const resp = await apiPost<{data?: unknown}>(client, `/api/v1/status-pages/${args.id}/components`, body)
    display(this, resp.data ?? resp, flags.output)
  }
}
