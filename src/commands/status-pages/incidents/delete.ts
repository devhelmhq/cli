import {Command} from '@oclif/core'
import {globalFlags, buildClient} from '../../../lib/base-command.js'
import {apiDelete} from '../../../lib/api-client.js'
import {uuidArg} from '../../../lib/validators.js'

export default class StatusPagesIncidentsDelete extends Command {
  static description = 'Delete a status page incident'
  static examples = ['<%= config.bin %> status-pages incidents delete <page-id> <incident-id>']
  static args = {
    id: uuidArg({description: 'Status page ID', required: true}),
    'incident-id': uuidArg({description: 'Incident ID', required: true}),
  }
  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(StatusPagesIncidentsDelete)
    const client = buildClient(flags)
    await apiDelete(client, `/api/v1/status-pages/${args.id}/incidents/${args['incident-id']}`)
    this.log(`Incident '${args['incident-id']}' deleted.`)
  }
}
