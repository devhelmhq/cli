import {Command} from '@oclif/core'
import {buildClient, globalFlags} from '../../../lib/base-command.js'
import {bucketTotal, listTable, show} from '../../../lib/inbound.js'
import type {ColumnDef} from '../../../lib/output.js'
import {uuidMultiFlag} from '../../../lib/validators.js'

const COLUMNS: ColumnDef[] = [
  {header: 'ID', get: (row: Record<string, unknown>) => String(row.domainId ?? '')},
  {header: 'TOTAL', get: (row: Record<string, unknown>) => bucketTotal(row, 'messageCount')},
]

export default class EmailDomainsActivity extends Command {
  static description = 'Message counts for the last 24 hours'
  static examples = ['<%= config.bin %> email domains activity --id <domain-id>']
  static flags = {
    ...globalFlags,
    id: uuidMultiFlag({
      description: 'Domain id. Repeat for more than one',
      required: true,
    }),
  }

  async run() {
    const {flags} = await this.parse(EmailDomainsActivity)
    const ids = Array.isArray(flags.id) ? flags.id : [flags.id]
    const rows = await listTable(buildClient(flags), '/api/v1/email/domains/activity', {
      query: {domainIds: ids.join(',')},
    })
    show(this, rows, flags.output, COLUMNS)
  }
}
