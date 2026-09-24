import {Command} from '@oclif/core'
import {Args} from '@oclif/core'
import {buildClient, globalFlags} from '../../../lib/base-command.js'
import {dnsLines, postRecord} from '../../../lib/inbound.js'

export default class EmailDomainsVerify extends Command {
  static description = 'Check custom-domain DNS and print any record still missing'
  static args = {name: Args.string({description: 'Domain name', required: true})}
  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(EmailDomainsVerify)
    const domain = await postRecord(
      buildClient(flags),
      `/api/v1/email/domains/${encodeURIComponent(args.name)}/verify`,
    )
    this.log(`${domain.name} ${domain.status}`)
    if (domain.status !== 'active') this.log(dnsLines(domain))
  }
}
