import {Command, Flags} from '@oclif/core'
import {buildClient, globalFlags} from '../../../lib/base-command.js'
import {dnsLines, postRecord, show} from '../../../lib/inbound.js'

export default class EmailDomainsCreate extends Command {
  static description = 'Create a custom mail domain and print the DNS records to publish'
  static flags = {
    ...globalFlags,
    name: Flags.string({description: 'Custom mail domain', required: true}),
  }

  async run() {
    const {flags} = await this.parse(EmailDomainsCreate)
    const domain = await postRecord(buildClient(flags), '/api/v1/email/domains', {
      kind: 'custom',
      name: flags.name,
    })
    if (flags.output === 'table') {
      this.log(dnsLines(domain))
      return
    }
    show(this, domain, flags.output)
  }
}
