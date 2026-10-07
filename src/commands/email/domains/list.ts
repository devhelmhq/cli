import {Command, Flags} from '@oclif/core'
import {buildClient, globalFlags} from '../../../lib/base-command.js'
import {DOMAIN_COLUMNS, listTable, show} from '../../../lib/inbound.js'

export default class EmailDomainsList extends Command {
  static description = 'List mail domains'
  static flags = {
    ...globalFlags,
    search: Flags.string({description: 'Match the domain name'}),
  }

  async run() {
    const {flags} = await this.parse(EmailDomainsList)
    const rows = await listTable(
      buildClient(flags),
      '/api/v1/email/domains',
      flags.search ? {query: {search: flags.search}} : undefined,
    )
    show(this, rows, flags.output, DOMAIN_COLUMNS)
  }
}
