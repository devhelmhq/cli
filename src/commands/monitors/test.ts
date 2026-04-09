import {Command, Args} from '@oclif/core'
import {globalFlags, buildClient, display} from '../../lib/base-command.js'
import {checkedFetch} from '../../lib/api-client.js'

export default class MonitorsTest extends Command {
  static description = 'Run an ad-hoc test for a monitor'
  static examples = ['<%= config.bin %> monitors test 42']
  static args = {id: Args.string({description: 'Monitor ID', required: true})}
  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(MonitorsTest)
    const client = buildClient(flags)
    this.log('Running test...')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resp = await checkedFetch(client.POST(`/api/v1/monitors/${args.id}/test` as any, {} as any))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (resp as any)?.data ?? resp
    display(this, result, flags.output)
  }
}
