import {Command, Args} from '@oclif/core'
import {globalFlags, buildClient, display} from '../../lib/base-command.js'
import {typedPost} from '../../lib/typed-api.js'

export default class MonitorsTest extends Command {
  static description = 'Run an ad-hoc test for a monitor'
  static examples = ['<%= config.bin %> monitors test 42']
  static args = {id: Args.string({description: 'Monitor ID', required: true})}
  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(MonitorsTest)
    const client = buildClient(flags)
    this.log('Running test...')
    const resp = await typedPost<{data?: Record<string, unknown>}>(client, `/api/v1/monitors/${args.id}/test`)
    display(this, resp.data ?? resp, flags.output)
  }
}
