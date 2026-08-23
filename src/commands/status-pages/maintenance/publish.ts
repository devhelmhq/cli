import {Command} from '@oclif/core'
import {globalFlags, buildClient, display} from '../../../lib/base-command.js'
import {apiPost, unwrapData} from '../../../lib/api-client.js'
import {uuidArg} from '../../../lib/validators.js'

export default class StatusPagesMaintenancePublish extends Command {
  static description = 'Publish a draft status page maintenance window'
  static examples = ['<%= config.bin %> status-pages maintenance publish <page-id> <window-id>']
  static args = {
    id: uuidArg({description: 'Status page ID', required: true}),
    'window-id': uuidArg({description: 'Maintenance window ID', required: true}),
  }
  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(StatusPagesMaintenancePublish)
    const client = buildClient(flags)
    const resp = await apiPost(client, `/api/v1/status-pages/${args.id}/maintenance/${args['window-id']}/publish`, {})
    display(this, unwrapData(resp), flags.output)
  }
}
