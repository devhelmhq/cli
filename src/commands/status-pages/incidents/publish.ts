import {Command} from '@oclif/core'
import {globalFlags, buildClient, display} from '../../../lib/base-command.js'
import {apiPost, unwrapData} from '../../../lib/api-client.js'
import {uuidArg} from '../../../lib/validators.js'

export default class StatusPagesIncidentsPublish extends Command {
  static description = 'Publish a draft status page incident'
  static examples = ['<%= config.bin %> status-pages incidents publish <page-id> <incident-id>']
  static args = {
    id: uuidArg({description: 'Status page ID', required: true}),
    'incident-id': uuidArg({description: 'Incident ID', required: true}),
  }
  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(StatusPagesIncidentsPublish)
    const client = buildClient(flags)
    const resp = await apiPost(client, `/api/v1/status-pages/${args.id}/incidents/${args['incident-id']}/publish`, {})
    display(this, unwrapData(resp), flags.output)
  }
}
