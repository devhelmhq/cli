import {Command, Flags} from '@oclif/core'
import {buildClient, globalFlags} from '../../lib/base-command.js'
import {patchRecord, show} from '../../lib/inbound.js'
import {uuidArg} from '../../lib/validators.js'

export default class InboxesUpdate extends Command {
  static description = 'Update an inbound HTTP capture URL'
  static args = {id: uuidArg({description: 'Inbox ID', required: true})}
  static flags = {
    ...globalFlags,
    name: Flags.string({description: 'Inbox name'}),
    status: Flags.string({description: 'active or disabled', options: ['active', 'disabled']}),
    cors: Flags.boolean({description: 'Allow browser callers from other origins', allowNo: true}),
    'retention-days': Flags.integer({description: 'Days to keep events'}),
    'max-events': Flags.integer({description: 'Max stored events'}),
  }

  async run() {
    const {args, flags} = await this.parse(InboxesUpdate)
    const body: Record<string, unknown> = {}
    if (flags.name) body.name = flags.name
    if (flags.status) body.status = flags.status
    if (flags.cors !== undefined) body.cors = flags.cors
    if (flags['retention-days'] !== undefined) body.retentionDays = flags['retention-days']
    if (flags['max-events'] !== undefined) body.maxEvents = flags['max-events']
    const inbox = await patchRecord(buildClient(flags), `/api/v1/webhook/inboxes/${args.id}`, body)
    show(this, inbox, flags.output)
  }
}
