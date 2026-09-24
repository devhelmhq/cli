import {Command, Flags} from '@oclif/core'
import {buildClient, globalFlags} from '../../lib/base-command.js'
import {deletePath, requireYes, splitAddress} from '../../lib/inbound.js'

export default class EmailClear extends Command {
  static description = 'Delete captured messages for one local-part'
  static flags = {
    ...globalFlags,
    to: Flags.string({description: 'Full mailbox address', required: true}),
    yes: Flags.boolean({char: 'y', description: 'Skip confirmation', default: false}),
  }

  async run() {
    const {flags} = await this.parse(EmailClear)
    const {localPart, domain} = splitAddress(flags.to)
    await requireYes(this, flags.yes, `Delete messages for '${flags.to}'?`)
    await deletePath(
      buildClient(flags),
      `/api/v1/email/domains/${encodeURIComponent(domain)}/inboxes/${encodeURIComponent(localPart)}`,
    )
    this.log(`Cleared ${flags.to}`)
  }
}
