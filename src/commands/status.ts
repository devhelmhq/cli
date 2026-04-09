import {Command} from '@oclif/core'
import {globalFlags, buildClient, display} from '../lib/base-command.js'
import {checkedFetch} from '../lib/api-client.js'

export default class Status extends Command {
  static description = 'Show dashboard overview'
  static examples = ['<%= config.bin %> status']
  static flags = {...globalFlags}

  async run() {
    const {flags} = await this.parse(Status)
    const client = buildClient(flags)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resp = await checkedFetch(client.GET('/api/v1/dashboard/overview' as any, {} as any))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const overview = (resp as any)?.data ?? resp
    display(this, overview, flags.output)
  }
}
