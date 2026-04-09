import {Command, Args, Flags} from '@oclif/core'
import {globalFlags, buildClient} from '../../lib/base-command.js'
import {checkedFetch} from '../../lib/api-client.js'

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts = body ? {body: body as any} : {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resp = await checkedFetch(client.POST(`/api/v1/incidents/${args.id}/resolve` as any, opts as any))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const incident = (resp as any)?.data ?? resp
    this.log(`Incident '${incident.title}' resolved.`)
  }
}
