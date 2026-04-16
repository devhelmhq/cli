import {Command, Args, Flags} from '@oclif/core'
import {globalFlags, buildClient, display} from '../../../lib/base-command.js'
import {fetchPaginated} from '../../../lib/typed-api.js'

export default class StatusPagesSubscribersList extends Command {
  static description = 'List subscribers on a status page'
  static examples = ['<%= config.bin %> status-pages subscribers list <page-id>']
  static args = {id: Args.string({description: 'Status page ID', required: true})}
  static flags = {
    ...globalFlags,
    limit: Flags.integer({description: 'Maximum number of subscribers to show', default: 20}),
  }

  async run() {
    const {args, flags} = await this.parse(StatusPagesSubscribersList)
    const client = buildClient(flags)
    const items = await fetchPaginated(client, `/api/v1/status-pages/${args.id}/subscribers`, flags.limit)
    display(this, items, flags.output, [
      {header: 'ID', get: (r: any) => r.id ?? ''},
      {header: 'EMAIL', get: (r: any) => r.email ?? ''},
      {header: 'CONFIRMED', get: (r: any) => String(r.confirmed ?? '')},
      {header: 'CREATED', get: (r: any) => r.createdAt ?? ''},
    ])
  }
}
