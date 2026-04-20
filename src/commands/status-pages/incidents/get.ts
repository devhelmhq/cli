import {Command} from '@oclif/core'
import {globalFlags, buildClient, display} from '../../../lib/base-command.js'
import {apiGet, unwrapData} from '../../../lib/api-client.js'
import {uuidArg} from '../../../lib/validators.js'

export default class StatusPagesIncidentsGet extends Command {
  static description = 'Get a status page incident with timeline'
  static examples = ['<%= config.bin %> status-pages incidents get <page-id> <incident-id>']
  static args = {
    id: uuidArg({description: 'Status page ID', required: true}),
    'incident-id': uuidArg({description: 'Incident ID', required: true}),
  }
  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(StatusPagesIncidentsGet)
    const client = buildClient(flags)
    const resp = await apiGet(client, `/api/v1/status-pages/${args.id}/incidents/${args['incident-id']}`)
    display(this, unwrapData(resp), flags.output)
  }
}
