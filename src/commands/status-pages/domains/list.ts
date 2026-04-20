import {Command} from '@oclif/core'
import type {components} from '../../../lib/api.generated.js'
import {globalFlags, buildClient, display} from '../../../lib/base-command.js'
import {fetchPaginated} from '../../../lib/typed-api.js'
import {uuidArg} from '../../../lib/validators.js'

type StatusPageCustomDomain = components['schemas']['StatusPageCustomDomainDto']

export default class StatusPagesDomainsList extends Command {
  static description = 'List custom domains on a status page'
  static examples = ['<%= config.bin %> status-pages domains list <page-id>']
  static args = {id: uuidArg({description: 'Status page ID', required: true})}
  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(StatusPagesDomainsList)
    const client = buildClient(flags)
    const items = await fetchPaginated<StatusPageCustomDomain>(client, `/api/v1/status-pages/${args.id}/domains`)
    display(this, items, flags.output, [
      {header: 'ID', get: (r: StatusPageCustomDomain) => r.id ?? ''},
      {header: 'HOSTNAME', get: (r: StatusPageCustomDomain) => r.hostname ?? ''},
      {header: 'VERIFIED', get: (r: StatusPageCustomDomain) => r.verifiedAt ?? ''},
      {header: 'STATUS', get: (r: StatusPageCustomDomain) => r.status ?? ''},
    ])
  }
}
