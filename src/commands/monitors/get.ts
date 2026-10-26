import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'
import {envFlag, monitorArg} from '../../lib/cli/flags.js'
import {table} from '../../lib/monitors/columns.js'
import {resolveMonitor} from '../../lib/monitors/resolve.js'

export default class MonitorsGet extends DevhelmCommand {
  static legacyOutput = true
  static description = 'Get a monitor by id or exact name'
  static examples = ['<%= config.bin %> monitors get <id>', '<%= config.bin %> monitors get Checkout --env production -o json']
  static args = {id: monitorArg}
  static flags = {...commonFlags, env: envFlag}

  async run() {
    const {args, flags} = await this.parse(MonitorsGet)
    const monitor = await resolveMonitor(this.client(), args.id, {env: flags.env})
    await this.finish({data: monitor, human: () => this.log(table(monitor))})
  }
}
