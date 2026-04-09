import {Command, Args} from '@oclif/core'
import {globalFlags, buildClient} from '../../lib/base-command.js'
import {SingleResponse} from '../../lib/api-client.js'

export default class DependenciesTrack extends Command {
  static description = 'Start tracking a service as a dependency'
  static examples = ['<%= config.bin %> dependencies track aws-ec2']
  static args = {slug: Args.string({description: 'Service slug from the catalog', required: true})}
  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(DependenciesTrack)
    const client = buildClient(flags)
    const resp = await client.post<SingleResponse<{id: number; serviceName: string}>>(`/api/v1/service-subscriptions/${args.slug}`)
    this.log(`Now tracking '${resp.content.serviceName}' as a dependency.`)
  }
}
