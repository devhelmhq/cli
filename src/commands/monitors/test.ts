import {Command, Args} from '@oclif/core'
import {globalFlags, buildClient, display} from '../../lib/base-command.js'
import {SingleResponse} from '../../lib/api-client.js'

export default class MonitorsTest extends Command {
  static description = 'Run an ad-hoc test for a monitor'
  static examples = ['<%= config.bin %> monitors test 42']
  static args = {id: Args.string({description: 'Monitor ID', required: true})}
  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(MonitorsTest)
    const client = buildClient(flags)
    this.log('Running test...')
    const resp = await client.post<SingleResponse<Record<string, unknown>>>(`/api/v1/monitors/${args.id}/test`)
    display(this, resp.content, flags.output)
  }
}
