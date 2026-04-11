import {Command, Args, Flags} from '@oclif/core'
import {globalFlags, buildClient, display} from '../../lib/base-command.js'
import {apiGet} from '../../lib/api-client.js'
import type {components} from '../../lib/api.generated.js'

type CheckResultDto = components['schemas']['CheckResultDto']

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
    const resp = await apiGet<{data?: CheckResultDto[]}>(
      client,
      `/api/v1/monitors/${args.id}/results`,
      {query: {limit: flags.limit}},
    )
    display(this, resp.data ?? [], flags.output, [
      {header: 'ID', get: (r) => String(r.id ?? '')},
      {header: 'PASSED', get: (r) => (r.passed == null ? '' : r.passed ? 'Pass' : 'Fail')},
      {header: 'RESPONSE TIME', get: (r) => (r.responseTimeMs != null ? `${r.responseTimeMs}ms` : '')},
      {header: 'CODE', get: (r) => String(r.details?.statusCode ?? '')},
      {header: 'REGION', get: (r) => String(r.region ?? '')},
      {header: 'TIMESTAMP', get: (r) => String(r.timestamp ?? '')},
    ])
  }
}
