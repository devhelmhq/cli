import {Command, Flags} from '@oclif/core'
import {globalFlags, buildClient, display} from '../../lib/base-command.js'
import {checkedFetch, unwrapData} from '../../lib/api-client.js'
import {ALERT_SENSITIVITIES} from '../../lib/spec-facts.generated.js'
import {uuidArg} from '../../lib/validators.js'

export default class DependenciesUpdate extends Command {
  static description = 'Update the alert sensitivity of a tracked dependency'
  static examples = [
    '<%= config.bin %> dependencies update <subscriptionId> --alert-sensitivity INCIDENTS_ONLY',
  ]
  static args = {
    subscriptionId: uuidArg({description: 'dependency subscriptionId', required: true}),
  }
  static flags = {
    ...globalFlags,
    'alert-sensitivity': Flags.string({
      description: 'New alert sensitivity for the subscription',
      options: [...ALERT_SENSITIVITIES],
      required: true,
    }),
  }

  async run() {
    const {args, flags} = await this.parse(DependenciesUpdate)
    const client = buildClient(flags)
    const resp = await checkedFetch(
      client.PATCH('/api/v1/service-subscriptions/{id}/alert-sensitivity', {
        params: {path: {id: args.subscriptionId}},
        body: {alertSensitivity: flags['alert-sensitivity']},
      }),
    )
    display(this, unwrapData(resp), flags.output)
  }
}
