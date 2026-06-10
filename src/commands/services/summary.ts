import {Command} from '@oclif/core'
import {globalFlags, buildClient, display} from '../../lib/base-command.js'
import {checkedFetch, unwrapData} from '../../lib/api-client.js'

export default class ServicesSummary extends Command {
  static description = 'Show a global status summary across all catalog services'
  static examples = ['<%= config.bin %> services summary']
  static flags = {...globalFlags}

  async run() {
    const {flags} = await this.parse(ServicesSummary)
    const client = buildClient(flags)
    const resp = await checkedFetch(client.GET('/api/v1/services/summary'))
    display(this, unwrapData(resp), flags.output)
  }
}
