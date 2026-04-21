import {Command, Flags} from '@oclif/core'
import {globalFlags, buildClient, display} from '../../../lib/base-command.js'
import {apiPost, unwrapData} from '../../../lib/api-client.js'
import {uuidArg} from '../../../lib/validators.js'

export default class StatusPagesDomainsAdd extends Command {
  static description = 'Add a custom domain to a status page'
  static examples = ['<%= config.bin %> status-pages domains add <page-id> --hostname status.example.com']
  static args = {id: uuidArg({description: 'Status page ID', required: true})}
  static flags = {
    ...globalFlags,
    hostname: Flags.string({description: 'Custom domain hostname', required: true}),
  }

  async run() {
    const {args, flags} = await this.parse(StatusPagesDomainsAdd)
    const client = buildClient(flags)
    const resp = await apiPost(client, `/api/v1/status-pages/${args.id}/domains`, {hostname: flags.hostname})
    display(this, unwrapData(resp), flags.output)
  }
}
