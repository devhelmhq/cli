import {Command, Args, Flags} from '@oclif/core'
import type {components} from '../../lib/api.generated.js'
import {globalFlags, buildClient} from '../../lib/base-command.js'
import {checkedFetch} from '../../lib/api-client.js'
import {ALERT_SENSITIVITIES} from '../../lib/spec-facts.generated.js'
import {uuidFlag} from '../../lib/validators.js'

type ServiceSubscribeRequest = components['schemas']['ServiceSubscribeRequest']

export default class DependenciesTrack extends Command {
  static description = 'Start tracking a service as a dependency'
  static examples = [
    '<%= config.bin %> dependencies track aws-ec2',
    '<%= config.bin %> dependencies track stripe --alert-sensitivity INCIDENTS_ONLY',
  ]
  static args = {slug: Args.string({description: 'Service slug from the catalog', required: true})}
  static flags = {
    ...globalFlags,
    component: uuidFlag({
      description: 'Component ID to subscribe to (omit for a whole-service subscription)',
    }),
    'alert-sensitivity': Flags.string({
      description: 'Alert sensitivity (default: AWARENESS — track silently, never alert)',
      options: [...ALERT_SENSITIVITIES],
    }),
  }

  async run() {
    const {args, flags} = await this.parse(DependenciesTrack)
    const client = buildClient(flags)
    const body: ServiceSubscribeRequest = {}
    if (flags.component) body.componentId = flags.component
    if (flags['alert-sensitivity']) body.alertSensitivity = flags['alert-sensitivity']
    const resp = await checkedFetch(
      client.POST('/api/v1/service-subscriptions/{slug}', {
        params: {path: {slug: args.slug}},
        // Omit the body entirely when no flag was set, preserving the
        // pre-flag behavior of an empty POST.
        ...(Object.keys(body).length > 0 ? {body} : {}),
      }),
    )
    this.log(`Now tracking '${resp?.data?.name ?? args.slug}' as a dependency.`)
  }
}
