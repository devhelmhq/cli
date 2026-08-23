import {Command, Flags} from '@oclif/core'
import type {components} from '../../../lib/api.generated.js'
import {globalFlags, buildClient, display} from '../../../lib/base-command.js'
import {fetchPaginated} from '../../../lib/typed-api.js'
import {uuidArg} from '../../../lib/validators.js'

type StatusPageIncident = components['schemas']['StatusPageIncidentDto']

export default class StatusPagesMaintenanceList extends Command {
  static description = 'List maintenance windows on a status page'
  static examples = ['<%= config.bin %> status-pages maintenance list <page-id>']
  static args = {id: uuidArg({description: 'Status page ID', required: true})}
  static flags = {
    ...globalFlags,
    limit: Flags.integer({description: 'Maximum number of windows to show', default: 20}),
  }

  async run() {
    const {args, flags} = await this.parse(StatusPagesMaintenanceList)
    const client = buildClient(flags)
    const items = await fetchPaginated<StatusPageIncident>(
      client,
      `/api/v1/status-pages/${args.id}/maintenance`,
      flags.limit,
    )
    display(this, items, flags.output, [
      {header: 'ID', get: (r: StatusPageIncident) => r.id ?? ''},
      {header: 'TITLE', get: (r: StatusPageIncident) => r.title ?? ''},
      {header: 'IMPACT', get: (r: StatusPageIncident) => r.impact ?? ''},
      {header: 'STATUS', get: (r: StatusPageIncident) => r.status ?? ''},
      {header: 'SCHEDULED FOR', get: (r: StatusPageIncident) => r.scheduledFor ?? ''},
      {header: 'SCHEDULED UNTIL', get: (r: StatusPageIncident) => r.scheduledUntil ?? ''},
      {header: 'PUBLISHED', get: (r: StatusPageIncident) => r.publishedAt ?? ''},
    ])
  }
}
