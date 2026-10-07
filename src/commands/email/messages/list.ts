import {Command, Flags} from '@oclif/core'
import {buildClient, globalFlags} from '../../../lib/base-command.js'
import {listTable, MESSAGE_COLUMNS, show, splitAddress} from '../../../lib/inbound.js'

export default class EmailMessagesList extends Command {
  static description = 'List captured messages for one mailbox'
  static flags = {
    ...globalFlags,
    to: Flags.string({description: 'Full mailbox address', required: true}),
    limit: Flags.integer({description: 'Page size'}),
    cursor: Flags.string({description: 'Cursor from a previous page'}),
    query: Flags.string({description: 'Match subject, sender, or local-part'}),
  }

  async run() {
    const {flags} = await this.parse(EmailMessagesList)
    const {localPart, domain} = splitAddress(flags.to)
    const query: Record<string, string | number> = {inbox: localPart}
    if (flags.limit) query.limit = flags.limit
    if (flags.cursor) query.cursor = flags.cursor
    if (flags.query) query.q = flags.query
    const rows = await listTable(
      buildClient(flags),
      `/api/v1/email/domains/${encodeURIComponent(domain)}/messages`,
      {query},
    )
    show(this, rows, flags.output, MESSAGE_COLUMNS)
  }
}
