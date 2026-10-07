import {Command} from '@oclif/core'
import {buildClient, globalFlags} from '../../lib/base-command.js'
import {bucketTotal, listTable, show} from '../../lib/inbound.js'
import type {ColumnDef} from '../../lib/output.js'
import {uuidMultiFlag} from '../../lib/validators.js'

const COLUMNS: ColumnDef[] = [
  {header: 'ID', get: (row: Record<string, unknown>) => String(row.inboxId ?? '')},
  {header: 'TOTAL', get: (row: Record<string, unknown>) => bucketTotal(row, 'eventCount')},
]

export default class InboxesActivity extends Command {
  static description = 'Request counts for the last 24 hours'
  static examples = ['<%= config.bin %> inboxes activity --id <inbox-id>']
  static flags = {
    ...globalFlags,
    id: uuidMultiFlag({
      description: 'Inbox id. Repeat for more than one',
      required: true,
    }),
  }

  async run() {
    const {flags} = await this.parse(InboxesActivity)
    const ids = Array.isArray(flags.id) ? flags.id : [flags.id]
    const rows = await listTable(buildClient(flags), '/api/v1/webhook/inboxes/activity', {
      query: {inboxIds: ids.join(',')},
    })
    show(this, rows, flags.output, COLUMNS)
  }
}
