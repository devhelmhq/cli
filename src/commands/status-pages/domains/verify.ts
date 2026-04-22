import {Command} from '@oclif/core'
import type {components} from '../../../lib/api.generated.js'
import {globalFlags, buildClient, display} from '../../../lib/base-command.js'
import {apiPost, unwrapData} from '../../../lib/api-client.js'
import {uuidArg} from '../../../lib/validators.js'

type StatusPageCustomDomain = components['schemas']['StatusPageCustomDomainDto']

export default class StatusPagesDomainsVerify extends Command {
  static description = 'Re-check verification + SSL status for a custom domain'
  static examples = ['<%= config.bin %> status-pages domains verify <page-id> <domain-id>']
  static args = {
    id: uuidArg({description: 'Status page ID', required: true}),
    'domain-id': uuidArg({description: 'Domain ID', required: true}),
  }

  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(StatusPagesDomainsVerify)
    const client = buildClient(flags)
    const resp = await apiPost(client, `/api/v1/status-pages/${args.id}/domains/${args['domain-id']}/verify`, {})
    const domain = unwrapData(resp) as StatusPageCustomDomain

    if (flags.output === 'json' || flags.output === 'yaml') {
      display(this, domain, flags.output)
      return
    }

    this.log(`Hostname: ${domain.hostname}`)
    this.log(`Status: ${domain.status}`)
    if (domain.cfSslStatus) this.log(`SSL: ${domain.cfSslStatus}`)
    if (domain.verificationError) {
      this.log('')
      this.log(`Error: ${domain.verificationError}`)
      this.log(`Expected CNAME → ${domain.verificationCnameTarget}`)
    } else if (domain.status !== 'ACTIVE') {
      this.log('')
      this.log(`Expected CNAME → ${domain.verificationCnameTarget}`)
    }
  }
}
