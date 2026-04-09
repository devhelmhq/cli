import {Command, Args, Flags} from '@oclif/core'
import {globalFlags, buildClient, display} from '../../lib/base-command.js'
import {checkedFetch} from '../../lib/api-client.js'

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resp = await checkedFetch(client.GET(`/api/v1/monitors/${args.id}/results?limit=${flags.limit}` as any, {} as any))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = (resp as any)?.data ?? resp
    display(this, items, flags.output, [
      {key: 'id', header: 'ID'},
      {key: 'status', header: 'STATUS'},
      {key: 'responseTime', header: 'RESPONSE TIME'},
      {key: 'statusCode', header: 'CODE'},
      {key: 'region', header: 'REGION'},
      {key: 'checkedAt', header: 'CHECKED AT'},
    ])
  }
}
