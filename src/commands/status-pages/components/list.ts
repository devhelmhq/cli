import {Command, Args} from '@oclif/core'
import type {components} from '../../../lib/api.generated.js'
import {globalFlags, buildClient, display} from '../../../lib/base-command.js'
import {fetchPaginated} from '../../../lib/typed-api.js'

type StatusPageComponent = components['schemas']['StatusPageComponentDto']

export default class StatusPagesComponentsList extends Command {
  static description = 'List components on a status page'
  static examples = ['<%= config.bin %> status-pages components list <page-id>']
  static args = {id: Args.string({description: 'Status page ID', required: true})}
  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(StatusPagesComponentsList)
    const client = buildClient(flags)
    const items = await fetchPaginated<StatusPageComponent>(client, `/api/v1/status-pages/${args.id}/components`)
    display(this, items, flags.output, [
      {header: 'ID', get: (r: StatusPageComponent) => r.id ?? ''},
      {header: 'NAME', get: (r: StatusPageComponent) => r.name ?? ''},
      {header: 'TYPE', get: (r: StatusPageComponent) => r.type ?? ''},
      {header: 'STATUS', get: (r: StatusPageComponent) => r.currentStatus ?? ''},
      {header: 'GROUP', get: (r: StatusPageComponent) => r.groupId ?? ''},
    ])
  }
}
