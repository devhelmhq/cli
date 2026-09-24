import {Command, Flags} from '@oclif/core'
import {apiGet, unwrapData} from '../../../lib/api-client.js'
import {buildClient, globalFlags} from '../../../lib/base-command.js'
import {asRecord, MESSAGE_COLUMNS, show, splitAddress} from '../../../lib/inbound.js'
import {uuidArg} from '../../../lib/validators.js'

export default class EmailMessagesGet extends Command {
  static description = 'Get one captured message'
  static args = {messageId: uuidArg({description: 'Message ID', required: true})}
  static flags = {
    ...globalFlags,
    to: Flags.string({description: 'Full mailbox address', required: true}),
  }

  async run() {
    const {args, flags} = await this.parse(EmailMessagesGet)
    const {domain} = splitAddress(flags.to)
    const message = asRecord(
      unwrapData(
        await apiGet(
          buildClient(flags),
          `/api/v1/email/domains/${encodeURIComponent(domain)}/messages/${args.messageId}`,
        ),
      ),
    )
    if (flags.output === 'table') {
      show(this, [message], flags.output, MESSAGE_COLUMNS)
      return
    }
    show(this, message, flags.output)
  }
}
