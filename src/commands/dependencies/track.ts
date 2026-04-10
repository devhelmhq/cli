import {Command, Args} from '@oclif/core'
import {globalFlags, buildClient} from '../../lib/base-command.js'
import {checkedFetch, unwrap} from '../../lib/api-client.js'

export default class DependenciesTrack extends Command {
  static description = 'Start tracking a service as a dependency'
  static examples = ['<%= config.bin %> dependencies track aws-ec2']
  static args = {slug: Args.string({description: 'Service slug from the catalog', required: true})}
  static flags = {...globalFlags}

  async run() {
    const {args, flags} = await this.parse(DependenciesTrack)
    const client = buildClient(flags)
    const resp = await checkedFetch(client.POST('/api/v1/service-subscriptions/{slug}', {params: {path: {slug: args.slug}}}))
    const sub = unwrap<{serviceName?: string}>(resp)
    this.log(`Now tracking '${sub.serviceName ?? args.slug}' as a dependency.`)
  }
}
