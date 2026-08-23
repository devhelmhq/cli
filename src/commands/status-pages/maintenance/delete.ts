import {Command} from '@oclif/core'
import {globalFlags, buildClient} from '../../../lib/base-command.js'
import {apiDelete} from '../../../lib/api-client.js'
import {uuidArg} from '../../../lib/validators.js'

export default class StatusPagesMaintenanceDelete extends Command {
  static description = 'Delete a status page maintenance window'
  static examples = ['<%= config.bin %> status-pages maintenance delete <page-id> <window-id>']
  static args = {
    id: uuidArg({description: 'Status page ID', required: true}),
    'window-id': uuidArg({description: 'Maintenance window ID', required: true}),
  }
  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(StatusPagesMaintenanceDelete)
    const client = buildClient(flags)
    await apiDelete(client, `/api/v1/status-pages/${args.id}/maintenance/${args['window-id']}`)
    this.log(`Maintenance window '${args['window-id']}' deleted.`)
  }
}
