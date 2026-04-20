import {Command} from '@oclif/core'
import {globalFlags, buildClient, display} from '../../../lib/base-command.js'
import {apiPost} from '../../../lib/api-client.js'
import {uuidArg} from '../../../lib/validators.js'

export default class StatusPagesDomainsVerify extends Command {
  static description = 'Verify a custom domain on a status page'
  static examples = ['<%= config.bin %> status-pages domains verify <page-id> <domain-id>']
  static args = {
    id: uuidArg({description: 'Status page ID', required: true}),
    'domain-id': uuidArg({description: 'Domain ID', required: true}),
  }
  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(StatusPagesDomainsVerify)
    const client = buildClient(flags)
    const resp = await apiPost<{data?: unknown}>(client, `/api/v1/status-pages/${args.id}/domains/${args['domain-id']}/verify`, {})
    display(this, resp.data ?? resp, flags.output)
  }
}
