import {Flags} from '@oclif/core'
import {apiGetPage} from '../../../lib/api-client.js'
import {schemas as apiSchemas} from '../../../lib/api-zod.generated.js'
import type {components} from '../../../lib/api.generated.js'
import {DevhelmCommand, commonFlags} from '../../../lib/cli/command.js'
import {envFlag, monitorArg} from '../../../lib/cli/flags.js'
import {table} from '../../../lib/monitors/columns.js'
import {resolveMonitor} from '../../../lib/monitors/resolve.js'

type MonitorVersionDto = components['schemas']['MonitorVersionDto']

export default class MonitorsVersionsList extends DevhelmCommand {
  static legacyOutput = true
  static description = 'List settings history for a monitor (code history: `monitors revisions list`)'
  static examples = [
    '<%= config.bin %> monitors versions list <id>',
    '<%= config.bin %> monitors versions list Checkout --env production --limit 5 -o json',
  ]

  static args = {id: monitorArg}
  static flags = {
    ...commonFlags,
    env: envFlag,
    limit: Flags.integer({description: 'Maximum number of versions to show', default: 20}),
  }

  async run() {
    const {args, flags} = await this.parse(MonitorsVersionsList)
    const client = this.client()
    const monitor = await resolveMonitor(client, args.id, {env: flags.env})
    const items: unknown[] = []
    for (let page = 0; items.length < flags.limit; page++) {
      const resp = await apiGetPage(client, `/api/v1/monitors/${monitor.id}/versions`, apiSchemas.MonitorVersionDto, {query: {page, size: Math.min(100, flags.limit)}})
      items.push(...resp.data)
      if (!resp.hasNext) break
    }
    const rows = items.slice(0, flags.limit) as MonitorVersionDto[]
    await this.finish({
      data: rows,
      human: () => this.log(table(rows, [
        {header: 'VERSION', get: (r: MonitorVersionDto) => String(r.version ?? '')},
        {header: 'CHANGED VIA', get: (r: MonitorVersionDto) => String(r.changedVia ?? '')},
        {header: 'SUMMARY', get: (r: MonitorVersionDto) => r.changeSummary ?? ''},
        {header: 'CREATED AT', get: (r: MonitorVersionDto) => String(r.createdAt ?? '')},
        {header: 'ID', get: (r: MonitorVersionDto) => String(r.id ?? '')},
      ])),
    })
  }
}
