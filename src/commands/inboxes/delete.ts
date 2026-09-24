import {Command, Flags} from '@oclif/core'
import {buildClient, globalFlags} from '../../lib/base-command.js'
import {deletePath, requireYes} from '../../lib/inbound.js'
import {uuidArg} from '../../lib/validators.js'

export default class InboxesDelete extends Command {
  static description = 'Delete an inbound HTTP capture URL'
  static args = {id: uuidArg({description: 'Inbox ID', required: true})}
  static flags = {...globalFlags, yes: Flags.boolean({char: 'y', description: 'Skip confirmation', default: false})}

  async run() {
    const {args, flags} = await this.parse(InboxesDelete)
    await requireYes(this, flags.yes, `Delete inbox '${args.id}'?`)
    await deletePath(buildClient(flags), `/api/v1/webhook/inboxes/${args.id}`)
    this.log(`Deleted inbox ${args.id}`)
  }
}
