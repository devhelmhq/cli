import {Command, Flags} from '@oclif/core'
import {buildClient, globalFlags} from '../../../lib/base-command.js'
import {downloadToFile, show, splitAddress} from '../../../lib/inbound.js'
import {uuidArg} from '../../../lib/validators.js'

export default class EmailAttachmentsGet extends Command {
  static description = 'Download one attachment'
  static args = {
    messageId: uuidArg({description: 'Message ID', required: true}),
    attachmentId: uuidArg({description: 'Attachment ID', required: true}),
  }
  static flags = {
    ...globalFlags,
    to: Flags.string({description: 'Full mailbox address', required: true}),
    file: Flags.string({description: 'File or directory to write', required: true}),
  }

  async run() {
    const {args, flags} = await this.parse(EmailAttachmentsGet)
    const {domain} = splitAddress(flags.to)
    const saved = await downloadToFile(
      buildClient(flags),
      `/api/v1/email/domains/${encodeURIComponent(domain)}/messages/${args.messageId}/attachments/${args.attachmentId}`,
      flags.file,
    )
    if (flags.output === 'table') {
      this.log(saved.file)
      return
    }
    show(this, {url: saved.url, expiresAt: saved.expiresAt, file: saved.file}, flags.output)
  }
}
