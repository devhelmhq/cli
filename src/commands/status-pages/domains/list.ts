import {Command, Args} from '@oclif/core'
import {globalFlags, buildClient, display} from '../../../lib/base-command.js'
import {fetchPaginated} from '../../../lib/typed-api.js'

export default class StatusPagesDomainsList extends Command {
  static description = 'List custom domains on a status page'
  static examples = ['<%= config.bin %> status-pages domains list <page-id>']
  static args = {id: Args.string({description: 'Status page ID', required: true})}
  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(StatusPagesDomainsList)
    const client = buildClient(flags)
    const items = await fetchPaginated(client, `/api/v1/status-pages/${args.id}/domains`)
    display(this, items, flags.output, [
      {header: 'ID', get: (r: any) => r.id ?? ''},
      {header: 'HOSTNAME', get: (r: any) => r.hostname ?? ''},
      {header: 'VERIFIED', get: (r: any) => String(r.verified ?? '')},
      {header: 'STATUS', get: (r: any) => r.verificationStatus ?? ''},
    ])
  }
}
