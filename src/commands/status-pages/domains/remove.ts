import {Command, Args} from '@oclif/core'
import {globalFlags, buildClient} from '../../../lib/base-command.js'
import {apiDelete} from '../../../lib/api-client.js'

export default class StatusPagesDomainsRemove extends Command {
  static description = 'Remove a custom domain from a status page'
  static examples = ['<%= config.bin %> status-pages domains remove <page-id> <domain-id>']
  static args = {
    id: Args.string({description: 'Status page ID', required: true}),
    'domain-id': Args.string({description: 'Domain ID', required: true}),
  }
  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(StatusPagesDomainsRemove)
    const client = buildClient(flags)
    await apiDelete(client, `/api/v1/status-pages/${args.id}/domains/${args['domain-id']}`)
    this.log(`Domain '${args['domain-id']}' removed.`)
  }
}
