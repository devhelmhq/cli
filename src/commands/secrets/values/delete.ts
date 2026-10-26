import {Args} from '@oclif/core'
import {apiDelete} from '../../../lib/api-client.js'
import {DevhelmCommand, commonFlags} from '../../../lib/cli/command.js'
import {envFlag} from '../../../lib/cli/flags.js'
import {ValidationError} from '../../../lib/errors.js'
import {resolveEnvironment} from '../../../lib/monitors/resolve.js'

export default class SecretsValuesDelete extends DevhelmCommand {
  static description = 'Delete a secret\'s value for one environment (monitors there become blocked until it is set again)'
  static examples = ['<%= config.bin %> secrets values delete LOGIN_PASSWORD --env staging']
  static args = {key: Args.string({description: 'Secret key', required: true})}
  static flags = {...commonFlags, env: {...envFlag, required: true}}

  async run() {
    const {args, flags} = await this.parse(SecretsValuesDelete)
    if (!flags.env) throw new ValidationError('--env <slug> is required', {code: 'FIELD_REQUIRED'})
    const client = this.client()
    const env = await resolveEnvironment(client, flags.env)
    await apiDelete(client, `/api/v1/secrets/${encodeURIComponent(args.key)}/environments/${env.id}`)
    await this.finish({data: {key: args.key, environment: env.slug, deleted: true}, human: () => this.log(`Deleted the ${env.slug} value of ${args.key}.`)})
  }
}
