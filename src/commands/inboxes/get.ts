import {Command} from '@oclif/core'
import {apiGet, unwrapData} from '../../lib/api-client.js'
import {buildClient, globalFlags} from '../../lib/base-command.js'
import {asRecord, show} from '../../lib/inbound.js'
import {uuidArg} from '../../lib/validators.js'

export default class InboxesGet extends Command {
  static description = 'Get one inbound HTTP capture URL'
  static args = {id: uuidArg({description: 'Inbox ID', required: true})}
  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(InboxesGet)
    const inbox = asRecord(unwrapData(await apiGet(buildClient(flags), `/api/v1/webhook/inboxes/${args.id}`)))
    show(this, inbox, flags.output)
  }
}
