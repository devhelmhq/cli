import {Command, Args} from '@oclif/core'
import {globalFlags, buildClient} from '../../lib/base-command.js'
import {typedPost} from '../../lib/typed-api.js'

export default class MonitorsPause extends Command {
  static description = 'Pause a monitor'
  static examples = ['<%= config.bin %> monitors pause 42']
  static args = {id: Args.string({description: 'Monitor ID', required: true})}
  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(MonitorsPause)
    const client = buildClient(flags)
    const resp = await typedPost<{data?: {name?: string}}>(client, `/api/v1/monitors/${args.id}/pause`)
    this.log(`Monitor '${resp.data?.name}' paused.`)
  }
}
