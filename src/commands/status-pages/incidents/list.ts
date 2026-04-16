import {Command, Args, Flags} from '@oclif/core'
import {globalFlags, buildClient, display} from '../../../lib/base-command.js'
import {fetchPaginated} from '../../../lib/typed-api.js'

export default class StatusPagesIncidentsList extends Command {
  static description = 'List incidents on a status page'
  static examples = ['<%= config.bin %> status-pages incidents list <page-id>']
  static args = {id: Args.string({description: 'Status page ID', required: true})}
  static flags = {
    ...globalFlags,
    limit: Flags.integer({description: 'Maximum number of incidents to show', default: 20}),
  }

  async run() {
    const {args, flags} = await this.parse(StatusPagesIncidentsList)
    const client = buildClient(flags)
    const items = await fetchPaginated(client, `/api/v1/status-pages/${args.id}/incidents`, flags.limit)
    display(this, items, flags.output, [
      {header: 'ID', get: (r: any) => r.id ?? ''},
      {header: 'TITLE', get: (r: any) => r.title ?? ''},
      {header: 'IMPACT', get: (r: any) => r.impact ?? ''},
      {header: 'STATUS', get: (r: any) => r.status ?? ''},
      {header: 'PUBLISHED', get: (r: any) => r.publishedAt ?? ''},
    ])
  }
}
