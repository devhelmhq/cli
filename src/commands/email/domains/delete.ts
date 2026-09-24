import {Command, Flags} from '@oclif/core'
import {Args} from '@oclif/core'
import {buildClient, globalFlags} from '../../../lib/base-command.js'
import {deletePath, requireYes} from '../../../lib/inbound.js'

export default class EmailDomainsDelete extends Command {
  static description = 'Delete a mail domain'
  static args = {name: Args.string({description: 'Domain name', required: true})}
  static flags = {
    ...globalFlags,
    yes: Flags.boolean({char: 'y', description: 'Skip confirmation', default: false}),
  }

  async run() {
    const {args, flags} = await this.parse(EmailDomainsDelete)
    await requireYes(this, flags.yes, `Delete domain '${args.name}'?`)
    await deletePath(buildClient(flags), `/api/v1/email/domains/${encodeURIComponent(args.name)}`)
    this.log(`Deleted ${args.name}`)
  }
}
