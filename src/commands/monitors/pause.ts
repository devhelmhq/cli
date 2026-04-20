import {Command} from '@oclif/core'
import {globalFlags, buildClient} from '../../lib/base-command.js'
import {checkedFetch} from '../../lib/api-client.js'
import {uuidArg} from '../../lib/validators.js'

export default class MonitorsPause extends Command {
  static description = 'Pause a monitor'
  static examples = ['<%= config.bin %> monitors pause 42']
  static args = {id: uuidArg({description: 'Monitor ID', required: true})}
  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(MonitorsPause)
    const client = buildClient(flags)
    const resp = await checkedFetch(client.POST('/api/v1/monitors/{id}/pause', {params: {path: {id: args.id}}}))
    this.log(`Monitor '${resp.data?.name}' paused.`)
  }
}
