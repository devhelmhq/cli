import {Command, Flags} from '@oclif/core'
import {globalFlags, buildClient, display} from '../../../lib/base-command.js'
import {fetchPaginated} from '../../../lib/typed-api.js'
import type {components} from '../../../lib/api.generated.js'
import {uuidArg} from '../../../lib/validators.js'

type MonitorVersionDto = components['schemas']['MonitorVersionDto']

export default class MonitorsVersionsList extends Command {
  static description = 'List version history for a monitor'
  static examples = [
    '<%= config.bin %> monitors versions list 42',
    '<%= config.bin %> monitors versions list 42 --limit 5',
    '<%= config.bin %> monitors versions list 42 -o json',
  ]

  static args = {id: uuidArg({description: 'Monitor ID', required: true})}
  static flags = {
    ...globalFlags,
    limit: Flags.integer({description: 'Maximum number of versions to show', default: 20}),
  }

  async run() {
    const {args, flags} = await this.parse(MonitorsVersionsList)
    const client = buildClient(flags)
    const allVersions = await fetchPaginated<MonitorVersionDto>(
      client,
      `/api/v1/monitors/${args.id}/versions`,
      flags.limit,
    )
    const items = allVersions.slice(0, flags.limit)
    display(this, items, flags.output, [
      {header: 'VERSION', get: (r: MonitorVersionDto) => String(r.version ?? '')},
      {header: 'CHANGED VIA', get: (r: MonitorVersionDto) => String(r.changedVia ?? '')},
      {header: 'SUMMARY', get: (r: MonitorVersionDto) => r.changeSummary ?? ''},
      {header: 'CREATED AT', get: (r: MonitorVersionDto) => String(r.createdAt ?? '')},
      {header: 'ID', get: (r: MonitorVersionDto) => String(r.id ?? '')},
    ])
  }
}
