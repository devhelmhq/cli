import {Command, Flags} from '@oclif/core'
import type {ColumnDef} from '../../../lib/output.js'
import {buildClient, globalFlags} from '../../../lib/base-command.js'
import {listTable, show, splitAddress} from '../../../lib/inbound.js'
import {uuidArg} from '../../../lib/validators.js'

const OTP_COLUMNS: ColumnDef[] = [
  {header: 'CODE', get: (row: Record<string, unknown>) => String(row.value ?? '')},
  {header: 'SOURCE', get: (row: Record<string, unknown>) => String(row.source ?? '')},
]

export default class EmailMessagesOtp extends Command {
  static description = 'List one-time codes extracted from a message'
  static examples = ['<%= config.bin %> email messages otp <messageId> --to signup@example.devhelmmail.com']
  static args = {messageId: uuidArg({description: 'Message ID', required: true})}
  static flags = {
    ...globalFlags,
    to: Flags.string({description: 'Full mailbox address', required: true}),
  }

  async run() {
    const {args, flags} = await this.parse(EmailMessagesOtp)
    const {domain} = splitAddress(flags.to)
    const rows = await listTable(
      buildClient(flags),
      `/api/v1/email/domains/${encodeURIComponent(domain)}/messages/${args.messageId}/otp`,
    )
    show(this, rows, flags.output, OTP_COLUMNS)
  }
}
