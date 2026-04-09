import {Command, Args} from '@oclif/core'
import {globalFlags, buildClient} from '../../lib/base-command.js'
import {checkedFetch} from '../../lib/api-client.js'

export default class MonitorsResume extends Command {
  static description = 'Resume a paused monitor'
  static examples = ['<%= config.bin %> monitors resume 42']
  static args = {id: Args.string({description: 'Monitor ID', required: true})}
  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(MonitorsResume)
    const client = buildClient(flags)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resp = await checkedFetch(client.POST(`/api/v1/monitors/${args.id}/resume` as any, {} as any))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const monitor = (resp as any)?.data ?? resp
    this.log(`Monitor '${monitor.name}' resumed.`)
  }
}
