import {Command, Args} from '@oclif/core'
import {globalFlags, buildClient, display} from '../../../lib/base-command.js'
import {fetchPaginated} from '../../../lib/typed-api.js'

export default class StatusPagesGroupsList extends Command {
  static description = 'List component groups on a status page'
  static examples = ['<%= config.bin %> status-pages groups list <page-id>']
  static args = {id: Args.string({description: 'Status page ID', required: true})}
  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(StatusPagesGroupsList)
    const client = buildClient(flags)
    const items = await fetchPaginated(client, `/api/v1/status-pages/${args.id}/groups`)
    display(this, items, flags.output, [
      {header: 'ID', get: (r: any) => r.id ?? ''},
      {header: 'NAME', get: (r: any) => r.name ?? ''},
      {header: 'ORDER', get: (r: any) => String(r.displayOrder ?? '')},
    ])
  }
}
