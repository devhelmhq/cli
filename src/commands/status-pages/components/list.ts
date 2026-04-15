import {Command, Args} from '@oclif/core'
import {globalFlags, buildClient, display} from '../../../lib/base-command.js'
import {fetchPaginated} from '../../../lib/typed-api.js'

export default class StatusPagesComponentsList extends Command {
  static description = 'List components on a status page'
  static examples = ['<%= config.bin %> status-pages components list <page-id>']
  static args = {id: Args.string({description: 'Status page ID', required: true})}
  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(StatusPagesComponentsList)
    const client = buildClient(flags)
    const items = await fetchPaginated(client, `/api/v1/status-pages/${args.id}/components`)
    display(this, items, flags.output, [
      {header: 'ID', get: (r: any) => r.id ?? ''},
      {header: 'NAME', get: (r: any) => r.name ?? ''},
      {header: 'TYPE', get: (r: any) => r.type ?? ''},
      {header: 'STATUS', get: (r: any) => r.currentStatus ?? ''},
      {header: 'GROUP', get: (r: any) => r.groupId ?? ''},
    ])
  }
}
