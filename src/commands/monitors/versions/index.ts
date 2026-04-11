import {Command, Args, Flags} from '@oclif/core'
import {globalFlags, buildClient, display} from '../../../lib/base-command.js'
import {apiGet} from '../../../lib/api-client.js'
import type {components} from '../../../lib/api.generated.js'

type MonitorVersionDto = components['schemas']['MonitorVersionDto']

export default class MonitorsVersionsList extends Command {
  static description = 'List version history for a monitor'
  static examples = [
    '<%= config.bin %> monitors versions 42',
    '<%= config.bin %> monitors versions 42 --limit 5',
    '<%= config.bin %> monitors versions 42 -o json',
  ]

  static args = {id: Args.string({description: 'Monitor ID', required: true})}
  static flags = {
    ...globalFlags,
    limit: Flags.integer({description: 'Number of versions to show', default: 20}),
  }

  async run() {
    const {args, flags} = await this.parse(MonitorsVersionsList)
    const client = buildClient(flags)
    const resp = await apiGet<{data?: MonitorVersionDto[]}>(
      client,
      `/api/v1/monitors/${args.id}/versions`,
      {query: {size: flags.limit}},
    )
    display(this, resp.data ?? [], flags.output, [
      {header: 'VERSION', get: (r) => String(r.version ?? '')},
      {header: 'CHANGED VIA', get: (r) => String(r.changedVia ?? '')},
      {header: 'SUMMARY', get: (r) => r.changeSummary ?? ''},
      {header: 'CREATED AT', get: (r) => String(r.createdAt ?? '')},
      {header: 'ID', get: (r) => String(r.id ?? '')},
    ])
  }
}
