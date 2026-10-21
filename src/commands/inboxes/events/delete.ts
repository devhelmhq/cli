import {Command, Flags} from '@oclif/core'
import {buildClient, globalFlags} from '../../../lib/base-command.js'
import {deletePath, requireYes} from '../../../lib/inbound.js'
import {uuidArg} from '../../../lib/validators.js'

export default class InboxesEventsDelete extends Command {
  static description = 'Delete one captured request'
  static args = {
    id: uuidArg({description: 'Inbox ID', required: true}),
    eventId: uuidArg({description: 'Event ID', required: true}),
  }
  static flags = {...globalFlags, yes: Flags.boolean({char: 'y', description: 'Skip confirmation', default: false})}

  async run() {
    const {args, flags} = await this.parse(InboxesEventsDelete)
    await requireYes(this, flags.yes, `Delete event '${args.eventId}' on inbox '${args.id}'?`)
    await deletePath(buildClient(flags), `/api/v1/webhook/inboxes/${args.id}/events/${args.eventId}`)
    this.log(`Deleted event ${args.eventId}`)
  }
}
