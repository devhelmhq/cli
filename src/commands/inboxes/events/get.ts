import {Command} from '@oclif/core'
import {apiGet, unwrapData} from '../../../lib/api-client.js'
import {buildClient, globalFlags} from '../../../lib/base-command.js'
import {asRecord, show} from '../../../lib/inbound.js'
import {uuidArg} from '../../../lib/validators.js'

export default class InboxesEventsGet extends Command {
  static description = 'Get one captured request'
  static args = {
    id: uuidArg({description: 'Inbox ID', required: true}),
    eventId: uuidArg({description: 'Event ID', required: true}),
  }
  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(InboxesEventsGet)
    const event = asRecord(
      unwrapData(await apiGet(buildClient(flags), `/api/v1/webhook/inboxes/${args.id}/events/${args.eventId}`)),
    )
    show(this, event, flags.output)
  }
}
