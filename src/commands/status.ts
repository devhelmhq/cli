import {Command} from '@oclif/core'
import {globalFlags, buildClient, display} from '../lib/base-command.js'
import {SingleResponse} from '../lib/api-client.js'

export default class Status extends Command {
  static description = 'Show dashboard overview'
  static examples = ['<%= config.bin %> status']
  static flags = {...globalFlags}

  async run() {
    const {flags} = await this.parse(Status)
    const client = buildClient(flags)
    const resp = await client.get<SingleResponse<Record<string, unknown>>>('/api/v1/dashboard/overview')
    display(this, resp.content, flags.output)
  }
}
