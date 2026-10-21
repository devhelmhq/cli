import {Command, Flags} from '@oclif/core'
import {buildClient, globalFlags} from '../../../lib/base-command.js'
import {deletePath, requireYes, splitAddress} from '../../../lib/inbound.js'
import {uuidArg} from '../../../lib/validators.js'

export default class EmailMessagesDelete extends Command {
  static description = 'Delete one captured message'
  static args = {messageId: uuidArg({description: 'Message ID', required: true})}
  static flags = {
    ...globalFlags,
    to: Flags.string({description: 'Full mailbox address', required: true}),
    yes: Flags.boolean({char: 'y', description: 'Skip confirmation', default: false}),
  }

  async run() {
    const {args, flags} = await this.parse(EmailMessagesDelete)
    const {domain} = splitAddress(flags.to)
    await requireYes(this, flags.yes, `Delete message '${args.messageId}' from '${flags.to}'?`)
    await deletePath(
      buildClient(flags),
      `/api/v1/email/domains/${encodeURIComponent(domain)}/messages/${args.messageId}`,
    )
    this.log(`Deleted message ${args.messageId}`)
  }
}
