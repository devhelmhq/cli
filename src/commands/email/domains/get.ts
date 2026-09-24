import {Command} from '@oclif/core'
import {Args} from '@oclif/core'
import {apiGet, unwrapData} from '../../../lib/api-client.js'
import {buildClient, globalFlags} from '../../../lib/base-command.js'
import {asRecord, dnsLines, show} from '../../../lib/inbound.js'

export default class EmailDomainsGet extends Command {
  static description = 'Show a mail domain and its DNS records'
  static args = {name: Args.string({description: 'Domain name', required: true})}
  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(EmailDomainsGet)
    const domain = asRecord(
      unwrapData(await apiGet(buildClient(flags), `/api/v1/email/domains/${encodeURIComponent(args.name)}`)),
    )
    if (flags.output === 'table') {
      this.log(dnsLines(domain))
      return
    }
    show(this, domain, flags.output)
  }
}
