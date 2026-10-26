import {Args} from '@oclif/core'
import {apiGet, unwrapData} from '../../../lib/api-client.js'
import {DevhelmCommand, commonFlags} from '../../../lib/cli/command.js'
import {envFlag, monitorArg} from '../../../lib/cli/flags.js'
import {table} from '../../../lib/monitors/columns.js'
import {resolveMonitor} from '../../../lib/monitors/resolve.js'

export default class MonitorsVersionsGet extends DevhelmCommand {
  static legacyOutput = true
  static description = 'Get a specific settings version snapshot for a monitor'
  static examples = [
    '<%= config.bin %> monitors versions get <id> 3',
    '<%= config.bin %> monitors versions get Checkout 3 --env production -o json',
  ]

  static args = {
    id: monitorArg,
    version: Args.integer({description: 'Version number', required: true}),
  }

  static flags = {...commonFlags, env: envFlag}

  async run() {
    const {args, flags} = await this.parse(MonitorsVersionsGet)
    const client = this.client()
    const monitor = await resolveMonitor(client, args.id, {env: flags.env})
    // Snapshots embed a full MonitorDto; printed as returned.
    const data = unwrapData(await apiGet(client, `/api/v1/monitors/${monitor.id}/versions/${args.version}`))
    await this.finish({data, human: () => this.log(table(data as Record<string, unknown>))})
  }
}
