import {Command, Flags} from '@oclif/core'
import type {ColumnDef} from '../../../lib/output.js'
import {buildClient, globalFlags} from '../../../lib/base-command.js'
import {listTable, show, splitAddress} from '../../../lib/inbound.js'
import {uuidArg} from '../../../lib/validators.js'

const LINK_COLUMNS: ColumnDef[] = [
  {header: 'URL', get: (row: Record<string, unknown>) => String(row.href ?? '')},
  {header: 'TEXT', get: (row: Record<string, unknown>) => String(row.text ?? '')},
]

export default class EmailMessagesLinks extends Command {
  static description = 'List links extracted from a message'
  static examples = ['<%= config.bin %> email messages links <messageId> --to signup@example.devhelmmail.com']
  static args = {messageId: uuidArg({description: 'Message ID', required: true})}
  static flags = {
    ...globalFlags,
    to: Flags.string({description: 'Full mailbox address', required: true}),
  }

  async run() {
    const {args, flags} = await this.parse(EmailMessagesLinks)
    const {domain} = splitAddress(flags.to)
    const rows = await listTable(
      buildClient(flags),
      `/api/v1/email/domains/${encodeURIComponent(domain)}/messages/${args.messageId}/links`,
    )
    show(this, rows, flags.output, LINK_COLUMNS)
  }
}
