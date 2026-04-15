import {Command, Args} from '@oclif/core'
import {globalFlags, buildClient} from '../../../lib/base-command.js'
import {apiPost} from '../../../lib/api-client.js'

export default class StatusPagesIncidentsDismiss extends Command {
  static description = 'Dismiss a draft status page incident'
  static examples = ['<%= config.bin %> status-pages incidents dismiss <page-id> <incident-id>']
  static args = {
    id: Args.string({description: 'Status page ID', required: true}),
    'incident-id': Args.string({description: 'Incident ID', required: true}),
  }
  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(StatusPagesIncidentsDismiss)
    const client = buildClient(flags)
    await apiPost(client, `/api/v1/status-pages/${args.id}/incidents/${args['incident-id']}/dismiss`, {})
    this.log('Draft incident dismissed.')
  }
}
