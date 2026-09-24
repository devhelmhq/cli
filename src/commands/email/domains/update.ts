import {Command, Flags} from '@oclif/core'
import {Args} from '@oclif/core'
import {buildClient, globalFlags} from '../../../lib/base-command.js'
import {patchRecord, requireYes, show} from '../../../lib/inbound.js'
import {DevhelmValidationError} from '../../../lib/errors.js'

export default class EmailDomainsUpdate extends Command {
  static description = 'Disable a custom mail domain'
  static args = {name: Args.string({description: 'Domain name', required: true})}
  static flags = {
    ...globalFlags,
    status: Flags.string({description: 'disabled', options: ['disabled'], required: true}),
    yes: Flags.boolean({char: 'y', description: 'Skip confirmation', default: false}),
  }

  async run() {
    const {args, flags} = await this.parse(EmailDomainsUpdate)
    if (flags.status !== 'disabled') {
      throw new DevhelmValidationError('Only --status disabled is supported. Custom domains become active after verify.')
    }
    await requireYes(this, flags.yes, `Disable domain '${args.name}'?`)
    const domain = await patchRecord(
      buildClient(flags),
      `/api/v1/email/domains/${encodeURIComponent(args.name)}`,
      {status: 'disabled'},
    )
    show(this, domain, flags.output)
  }
}
