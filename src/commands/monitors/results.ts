import {Command, Args, Flags} from '@oclif/core'
import {globalFlags, buildClient, display} from '../../lib/base-command.js'
import {checkedFetch, unwrap, type Schemas} from '../../lib/api-client.js'

type CheckResult = Schemas['CheckResultDto']

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
    const resp = await checkedFetch(client.GET('/api/v1/monitors/{id}/results', {
      params: {path: {id: args.id}, query: {limit: flags.limit}},
    }))
    const items = unwrap<CheckResult[]>(resp)
    display(this, items, flags.output, [
      {header: 'ID', get: (r: CheckResult) => String(r.id ?? '')},
      {header: 'PASSED', get: (r: CheckResult) => String(r.passed ?? '')},
      {header: 'RESPONSE TIME', get: (r: CheckResult) => r.responseTimeMs != null ? `${r.responseTimeMs}ms` : ''},
      {header: 'REGION', get: (r: CheckResult) => r.region ?? ''},
      {header: 'CHECKED AT', get: (r: CheckResult) => r.timestamp ?? ''},
    ])
  }
}
