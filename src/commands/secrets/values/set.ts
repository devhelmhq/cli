import {Args} from '@oclif/core'
import {apiPut} from '../../../lib/api-client.js'
import {schemas as apiSchemas} from '../../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../../lib/cli/command.js'
import {envFlag} from '../../../lib/cli/flags.js'
import {secretValueFlags} from '../../../lib/cli/secret-flags.js'
import {requireSecretValue} from '../../../lib/cli/secret-value.js'
import {ValidationError} from '../../../lib/errors.js'
import {resolveEnvironment} from '../../../lib/monitors/resolve.js'
import {parse} from '../../../lib/response-validation.js'

export default class SecretsValuesSet extends DevhelmCommand {
  static description =
    'Set a secret\'s value for one environment. The value comes from stdin or an environment variable, never an argument'
  static examples = [
    'printf %s "$LOGIN_PASSWORD" | <%= config.bin %> secrets values set LOGIN_PASSWORD --env staging --value-stdin',
    '<%= config.bin %> secrets values set LOGIN_EMAIL --env staging --from-env LOGIN_EMAIL',
  ]
  static args = {key: Args.string({description: 'Secret key', required: true})}
  static flags = {...commonFlags, ...secretValueFlags, env: {...envFlag, required: true}}

  async run() {
    const {args, flags} = await this.parse(SecretsValuesSet)
    if (!flags.env) throw new ValidationError('--env <slug> is required', {code: 'FIELD_REQUIRED'})
    const value = await requireSecretValue(flags, args.key, flags.env)
    const client = this.client()
    const env = await resolveEnvironment(client, flags.env)
    const body = parse(apiSchemas.WriteSecretEnvironmentValueRequest, {value}, 'Invalid secret value')
    await apiPut(client, `/api/v1/secrets/${encodeURIComponent(args.key)}/environments/${env.id}`, body)
    await this.finish({data: {key: args.key, environment: env.slug, set: true}, human: () => this.log(`Set ${args.key} for ${env.slug}.`)})
  }
}
