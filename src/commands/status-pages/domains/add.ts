import {Command, Flags} from '@oclif/core'
import type {components} from '../../../lib/api.generated.js'
import {globalFlags, buildClient, display} from '../../../lib/base-command.js'
import {apiPost, unwrapData} from '../../../lib/api-client.js'
import {uuidArg} from '../../../lib/validators.js'

type StatusPageCustomDomain = components['schemas']['StatusPageCustomDomainDto']

export default class StatusPagesDomainsAdd extends Command {
  static description = 'Add a custom domain to a status page and print its verification record'
  static examples = [
    '<%= config.bin %> status-pages domains add <page-id> --hostname status.example.com',
    '<%= config.bin %> status-pages domains add <page-id> --hostname status.example.com --output json',
  ]

  static args = {id: uuidArg({description: 'Status page ID', required: true})}
  static flags = {
    ...globalFlags,
    hostname: Flags.string({description: 'Custom domain hostname', required: true}),
  }

  async run() {
    const {args, flags} = await this.parse(StatusPagesDomainsAdd)
    const client = buildClient(flags)
    const resp = await apiPost(client, `/api/v1/status-pages/${args.id}/domains`, {hostname: flags.hostname})
    const domain = unwrapData(resp) as StatusPageCustomDomain

    if (flags.output === 'json' || flags.output === 'yaml') {
      display(this, domain, flags.output)
      return
    }

    this.log(`Added '${domain.hostname}' (id ${domain.id}).`)
    this.log('')
    this.log('Verification record (create at your DNS provider):')
    if (domain.verificationMethod === 'TXT') {
      this.log(`  TXT   ${domain.hostname}  →  "${domain.verificationToken}"`)
    } else {
      this.log(`  CNAME ${domain.hostname}  →  ${domain.verificationCnameTarget}`)
    }
    this.log('')
    this.log(`Run 'devhelm status-pages domains verify ${args.id} ${domain.id}' once DNS has propagated.`)
  }
}
