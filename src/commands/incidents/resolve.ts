import {Command, Flags} from '@oclif/core'
import {globalFlags, buildClient} from '../../lib/base-command.js'
import {checkedFetch} from '../../lib/api-client.js'
import {uuidArg} from '../../lib/validators.js'

export default class IncidentsResolve extends Command {
  static description = 'Resolve an incident'
  static examples = ['<%= config.bin %> incidents resolve 42']
  static args = {id: uuidArg({description: 'Incident ID', required: true})}
  static flags = {
    ...globalFlags,
    message: Flags.string({description: 'Resolution message'}),
  }

  async run() {
    const {args, flags} = await this.parse(IncidentsResolve)
    const client = buildClient(flags)
    const body = flags.message ? {body: flags.message} : undefined
    const resp = await checkedFetch(client.POST('/api/v1/incidents/{id}/resolve', {params: {path: {id: args.id}}, body}))
    this.log(`Incident '${resp.data?.incident?.title}' resolved.`)
  }
}
