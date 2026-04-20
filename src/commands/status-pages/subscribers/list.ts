import {Command, Flags} from '@oclif/core'
import type {components} from '../../../lib/api.generated.js'
import {globalFlags, buildClient, display} from '../../../lib/base-command.js'
import {fetchPaginated} from '../../../lib/typed-api.js'
import {uuidArg} from '../../../lib/validators.js'

type StatusPageSubscriber = components['schemas']['StatusPageSubscriberDto']

export default class StatusPagesSubscribersList extends Command {
  static description = 'List subscribers on a status page'
  static examples = ['<%= config.bin %> status-pages subscribers list <page-id>']
  static args = {id: uuidArg({description: 'Status page ID', required: true})}
  static flags = {
    ...globalFlags,
    limit: Flags.integer({description: 'Maximum number of subscribers to show', default: 20}),
  }

  async run() {
    const {args, flags} = await this.parse(StatusPagesSubscribersList)
    const client = buildClient(flags)
    const items = await fetchPaginated<StatusPageSubscriber>(client, `/api/v1/status-pages/${args.id}/subscribers`, flags.limit)
    display(this, items, flags.output, [
      {header: 'ID', get: (r: StatusPageSubscriber) => r.id ?? ''},
      {header: 'EMAIL', get: (r: StatusPageSubscriber) => r.email ?? ''},
      {header: 'CONFIRMED', get: (r: StatusPageSubscriber) => String(r.confirmed ?? '')},
      {header: 'CREATED', get: (r: StatusPageSubscriber) => r.createdAt ?? ''},
    ])
  }
}
