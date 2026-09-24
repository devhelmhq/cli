import {Command, Flags} from '@oclif/core'
import {buildClient, globalFlags} from '../../../lib/base-command.js'
import {downloadToFile, show} from '../../../lib/inbound.js'
import {uuidArg} from '../../../lib/validators.js'

export default class InboxesEventsRaw extends Command {
  static description = 'Download the raw captured request'
  static args = {
    id: uuidArg({description: 'Inbox ID', required: true}),
    eventId: uuidArg({description: 'Event ID', required: true}),
  }
  static flags = {
    ...globalFlags,
    file: Flags.string({description: 'File or directory to write', required: true}),
  }

  async run() {
    const {args, flags} = await this.parse(InboxesEventsRaw)
    const saved = await downloadToFile(
      buildClient(flags),
      `/api/v1/webhook/inboxes/${args.id}/events/${args.eventId}/raw`,
      flags.file,
    )
    if (flags.output === 'table') {
      this.log(saved.file)
      return
    }
    show(this, {url: saved.url, expiresAt: saved.expiresAt, file: saved.file}, flags.output)
  }
}
