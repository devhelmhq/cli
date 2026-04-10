import {Command, Args, Flags} from '@oclif/core'
import {globalFlags, buildClient, display} from '../../lib/base-command.js'
import {typedGet} from '../../lib/typed-api.js'

interface MonitorResult {
  id?: string
  status?: string
  responseTime?: number
  statusCode?: number
  region?: string
  checkedAt?: string
}

export default class MonitorsResults extends Command {
  static description = 'Show recent check results for a monitor'
  static examples = ['<%= config.bin %> monitors results 42']
  static args = {id: Args.string({description: 'Monitor ID', required: true})}
  static flags = {
    ...globalFlags,
    limit: Flags.integer({description: 'Number of results', default: 20}),
  }

  async run() {
    const {args, flags} = await this.parse(MonitorsResults)
    const client = buildClient(flags)
    const resp = await typedGet<{data?: MonitorResult[]}>(client, `/api/v1/monitors/${args.id}/results`, {limit: flags.limit})
    display(this, resp.data ?? [], flags.output, [
      {header: 'ID', get: (r) => String(r.id ?? '')},
      {header: 'STATUS', get: (r) => String(r.status ?? '')},
      {header: 'RESPONSE TIME', get: (r) => String(r.responseTime ?? '')},
      {header: 'CODE', get: (r) => String(r.statusCode ?? '')},
      {header: 'REGION', get: (r) => String(r.region ?? '')},
      {header: 'CHECKED AT', get: (r) => String(r.checkedAt ?? '')},
    ])
  }
}
