import {Command, Args, Flags} from '@oclif/core'
import {globalFlags, buildClient} from '../../lib/base-command.js'
import {SingleResponse} from '../../lib/api-client.js'

export default class IncidentsResolve extends Command {
  static description = 'Resolve an incident'
  static examples = ['<%= config.bin %> incidents resolve 42']
  static args = {id: Args.string({description: 'Incident ID', required: true})}
  static flags = {
    ...globalFlags,
    message: Flags.string({description: 'Resolution message'}),
  }

  async run() {
    const {args, flags} = await this.parse(IncidentsResolve)
    const client = buildClient(flags)
    const body = flags.message ? {message: flags.message} : undefined
    const resp = await client.post<SingleResponse<{id: number; title: string}>>(`/api/v1/incidents/${args.id}/resolve`, body)
    this.log(`Incident '${resp.content.title}' resolved.`)
  }
}
