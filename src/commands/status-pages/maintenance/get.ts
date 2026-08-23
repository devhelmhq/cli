import {Command} from '@oclif/core'
import {globalFlags, buildClient, display} from '../../../lib/base-command.js'
import {apiGet, unwrapData} from '../../../lib/api-client.js'
import {uuidArg} from '../../../lib/validators.js'

export default class StatusPagesMaintenanceGet extends Command {
  static description = 'Get a status page maintenance window with timeline'
  static examples = ['<%= config.bin %> status-pages maintenance get <page-id> <window-id>']
  static args = {
    id: uuidArg({description: 'Status page ID', required: true}),
    'window-id': uuidArg({description: 'Maintenance window ID', required: true}),
  }
  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(StatusPagesMaintenanceGet)
    const client = buildClient(flags)
    const resp = await apiGet(client, `/api/v1/status-pages/${args.id}/maintenance/${args['window-id']}`)
    display(this, unwrapData(resp), flags.output)
  }
}
