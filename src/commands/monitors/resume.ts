import {checkedFetch} from '../../lib/api-client.js'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'
import {envFlag, monitorArg} from '../../lib/cli/flags.js'
import {resolveMonitor} from '../../lib/monitors/resolve.js'

export default class MonitorsResume extends DevhelmCommand {
  static legacyOutput = true
  static description = 'Resume a paused monitor'
  static examples = ['<%= config.bin %> monitors resume Checkout --env production']
  static args = {id: monitorArg}
  static flags = {...commonFlags, env: envFlag}

  async run() {
    const {args, flags} = await this.parse(MonitorsResume)
    const client = this.client()
    const monitor = await resolveMonitor(client, args.id, {env: flags.env})
    const resp = await checkedFetch(client.POST('/api/v1/monitors/{id}/resume', {params: {path: {id: monitor.id}}}))
    await this.finish({data: resp?.data ?? null, human: () => this.log(`Monitor '${monitor.name}' resumed.`)})
  }
}
