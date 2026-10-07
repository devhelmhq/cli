import {Command, Flags} from '@oclif/core'
import {buildClient, globalFlags} from '../../../lib/base-command.js'
import {EVENT_COLUMNS, listTable, show} from '../../../lib/inbound.js'
import {uuidArg} from '../../../lib/validators.js'

export default class InboxesEventsList extends Command {
  static description = 'List captured requests for an inbox'
  static args = {id: uuidArg({description: 'Inbox ID', required: true})}
  static flags = {
    ...globalFlags,
    limit: Flags.integer({description: 'Page size'}),
    cursor: Flags.string({description: 'Cursor from a previous page'}),
    method: Flags.string({description: 'HTTP method, for example POST'}),
    path: Flags.string({description: 'Request path, for example /hooks'}),
  }

  async run() {
    const {args, flags} = await this.parse(InboxesEventsList)
    const params: Record<string, string | number> = {}
    if (flags.limit) params.limit = flags.limit
    if (flags.cursor) params.cursor = flags.cursor
    if (flags.method) params.method = flags.method
    if (flags.path) params.path = flags.path
    const rows = await listTable(buildClient(flags), `/api/v1/webhook/inboxes/${args.id}/events`, {query: params})
    show(this, rows, flags.output, EVENT_COLUMNS)
  }
}
