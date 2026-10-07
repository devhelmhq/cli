import {Command, Flags} from '@oclif/core'
import {apiGet, unwrapData} from '../../../lib/api-client.js'
import {buildClient, globalFlags} from '../../../lib/base-command.js'
import {asRecord, show, splitAddress} from '../../../lib/inbound.js'
import {uuidArg} from '../../../lib/validators.js'

export default class EmailMessagesSource extends Command {
  static description = 'Print the stored message as text'
  static args = {messageId: uuidArg({description: 'Message ID', required: true})}
  static flags = {
    ...globalFlags,
    to: Flags.string({description: 'Full mailbox address', required: true}),
  }

  async run() {
    const {args, flags} = await this.parse(EmailMessagesSource)
    const {domain} = splitAddress(flags.to)
    const body = asRecord(
      unwrapData(
        await apiGet(
          buildClient(flags),
          `/api/v1/email/domains/${encodeURIComponent(domain)}/messages/${args.messageId}/source`,
        ),
      ),
    )
    if (flags.output === 'table') {
      this.log(String(body.source ?? ''))
      if (body.truncated === true) this.warn('Source was cut at 256 KB.')
      return
    }
    show(this, body, flags.output)
  }
}
