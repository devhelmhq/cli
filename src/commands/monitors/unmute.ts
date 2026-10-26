import {checkedFetch} from '../../lib/api-client.js'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'
import {envFlag, monitorArg} from '../../lib/cli/flags.js'
import {resolveMonitor} from '../../lib/monitors/resolve.js'

export default class MonitorsUnmute extends DevhelmCommand {
  static description = 'Unmute alert delivery for a monitor'
  static examples = ['<%= config.bin %> monitors unmute Checkout --env production']
  static args = {monitor: monitorArg}
  static flags = {...commonFlags, env: envFlag}

  async run() {
    const {args, flags} = await this.parse(MonitorsUnmute)
    const client = this.client()
    const monitor = await resolveMonitor(client, args.monitor, {env: flags.env})
    const resp = await checkedFetch(client.POST('/api/v1/monitors/{id}/unmute', {params: {path: {id: monitor.id}}}))
    await this.finish({data: resp?.data ?? null, human: () => this.log(`Monitor '${monitor.name}' unmuted.`)})
  }
}
