import {Command} from '@oclif/core'
import {globalFlags, buildClient} from '../../../lib/base-command.js'
import {apiPost} from '../../../lib/api-client.js'
import {uuidArg} from '../../../lib/validators.js'

export default class StatusPagesMaintenanceDismiss extends Command {
  static description = 'Dismiss a draft status page maintenance window'
  static examples = ['<%= config.bin %> status-pages maintenance dismiss <page-id> <window-id>']
  static args = {
    id: uuidArg({description: 'Status page ID', required: true}),
    'window-id': uuidArg({description: 'Maintenance window ID', required: true}),
  }
  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(StatusPagesMaintenanceDismiss)
    const client = buildClient(flags)
    await apiPost(client, `/api/v1/status-pages/${args.id}/maintenance/${args['window-id']}/dismiss`, {})
    this.log('Draft maintenance window dismissed.')
  }
}
