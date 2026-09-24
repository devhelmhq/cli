import {Command, Flags} from '@oclif/core'
import {buildClient, globalFlags} from '../../lib/base-command.js'
import {postRecord, show, splitAddress} from '../../lib/inbound.js'

export default class EmailReceive extends Command {
  static description = 'Accept a test message into a mailbox. Delivery is asynchronous'
  static flags = {
    ...globalFlags,
    to: Flags.string({description: 'Full mailbox address', required: true}),
    from: Flags.string({description: 'Sender mailbox', required: true}),
    subject: Flags.string({description: 'Subject'}),
    text: Flags.string({description: 'Plain-text body'}),
    html: Flags.string({description: 'HTML body'}),
  }

  async run() {
    const {flags} = await this.parse(EmailReceive)
    const {domain} = splitAddress(flags.to)
    const body: Record<string, unknown> = {to: flags.to, from: flags.from}
    if (flags.subject) body.subject = flags.subject
    if (flags.text) body.text = flags.text
    if (flags.html) body.html = flags.html
    const receipt = await postRecord(
      buildClient(flags),
      `/api/v1/email/domains/${encodeURIComponent(domain)}/messages/inject`,
      body,
    )
    if (flags.output === 'table') {
      show(
        this,
        [{eventId: receipt.eventId, inbox: receipt.inbox, receivedAt: receipt.receivedAt}],
        flags.output,
        [
          {header: 'EVENT_ID', get: (row: Record<string, unknown>) => String(row.eventId ?? '')},
          {header: 'INBOX', get: (row: Record<string, unknown>) => String(row.inbox ?? '')},
          {header: 'RECEIVED', get: (row: Record<string, unknown>) => String(row.receivedAt ?? '')},
        ],
      )
      return
    }
    show(this, receipt, flags.output)
  }
}
