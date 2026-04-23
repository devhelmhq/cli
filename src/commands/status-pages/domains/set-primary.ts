import {Command} from '@oclif/core'
import {globalFlags, buildClient, display} from '../../../lib/base-command.js'
import {apiPost, unwrapData} from '../../../lib/api-client.js'
import {uuidArg} from '../../../lib/validators.js'

export default class StatusPagesDomainsSetPrimary extends Command {
  static description = 'Mark a verified custom domain as the primary host for a status page'
  static examples = ['<%= config.bin %> status-pages domains set-primary <page-id> <domain-id>']
  static args = {
    id: uuidArg({description: 'Status page ID', required: true}),
    'domain-id': uuidArg({description: 'Domain ID', required: true}),
  }

  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(StatusPagesDomainsSetPrimary)
    const client = buildClient(flags)
    const resp = await apiPost(client, `/api/v1/status-pages/${args.id}/domains/${args['domain-id']}/primary`, {})
    display(this, unwrapData(resp), flags.output)
  }
}
