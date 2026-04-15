import {Command, Args, Flags} from '@oclif/core'
import {globalFlags, buildClient, display} from '../../../lib/base-command.js'
import {apiPut} from '../../../lib/api-client.js'

export default class StatusPagesComponentsUpdate extends Command {
  static description = 'Update a status page component'
  static examples = ['<%= config.bin %> status-pages components update <page-id> <component-id> --name "API v2"']
  static args = {
    id: Args.string({description: 'Status page ID', required: true}),
    'component-id': Args.string({description: 'Component ID', required: true}),
  }
  static flags = {
    ...globalFlags,
    name: Flags.string({description: 'Component name'}),
    'group-id': Flags.string({description: 'Component group ID'}),
  }

  async run() {
    const {args, flags} = await this.parse(StatusPagesComponentsUpdate)
    const client = buildClient(flags)
    const body: Record<string, unknown> = {}
    if (flags.name) body.name = flags.name
    if (flags['group-id'] !== undefined) body.groupId = flags['group-id']
    const resp = await apiPut<{data?: unknown}>(client, `/api/v1/status-pages/${args.id}/components/${args['component-id']}`, body)
    display(this, resp.data ?? resp, flags.output)
  }
}
