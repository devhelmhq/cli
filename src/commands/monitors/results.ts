import {Command, Args, Flags} from '@oclif/core'
import {globalFlags, buildClient, display} from '../../lib/base-command.js'
import {CursorPage} from '../../lib/api-client.js'

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
    const resp = await client.get<CursorPage<Record<string, unknown>>>(`/api/v1/monitors/${args.id}/results?limit=${flags.limit}`)
    display(this, resp.content, flags.output, [
      {key: 'id', header: 'ID'},
      {key: 'status', header: 'STATUS'},
      {key: 'responseTime', header: 'RESPONSE TIME'},
      {key: 'statusCode', header: 'CODE'},
      {key: 'region', header: 'REGION'},
      {key: 'checkedAt', header: 'CHECKED AT'},
    ])
  }
}
