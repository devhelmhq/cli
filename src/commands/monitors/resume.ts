import {Command, Args} from '@oclif/core'
import {globalFlags, buildClient} from '../../lib/base-command.js'
import {checkedFetch, unwrap, type Schemas} from '../../lib/api-client.js'

export default class MonitorsResume extends Command {
  static description = 'Resume a paused monitor'
  static examples = ['<%= config.bin %> monitors resume 42']
  static args = {id: Args.string({description: 'Monitor ID', required: true})}
  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(MonitorsResume)
    const client = buildClient(flags)
    const resp = await checkedFetch(client.POST('/api/v1/monitors/{id}/resume', {params: {path: {id: args.id}}}))
    const monitor = unwrap<Schemas['MonitorDto']>(resp)
    this.log(`Monitor '${monitor.name}' resumed.`)
  }
}
