import {Command, Args, Flags} from '@oclif/core'
import {globalFlags, buildClient, display} from '../../../lib/base-command.js'
import {apiPost} from '../../../lib/api-client.js'

export default class StatusPagesIncidentsPostUpdate extends Command {
  static description = 'Post a timeline update on a status page incident'
  static examples = ['<%= config.bin %> status-pages incidents post-update <page-id> <incident-id> --body "Fix deployed" --status MONITORING']
  static args = {
    id: Args.string({description: 'Status page ID', required: true}),
    'incident-id': Args.string({description: 'Incident ID', required: true}),
  }
  static flags = {
    ...globalFlags,
    body: Flags.string({description: 'Update message', required: true}),
    status: Flags.string({description: 'New status', required: true, options: ['INVESTIGATING', 'IDENTIFIED', 'MONITORING', 'RESOLVED']}),
  }

  async run() {
    const {args, flags} = await this.parse(StatusPagesIncidentsPostUpdate)
    const client = buildClient(flags)
    const resp = await apiPost<{data?: unknown}>(
      client,
      `/api/v1/status-pages/${args.id}/incidents/${args['incident-id']}/updates`,
      {body: flags.body, status: flags.status},
    )
    display(this, resp.data ?? resp, flags.output)
  }
}
