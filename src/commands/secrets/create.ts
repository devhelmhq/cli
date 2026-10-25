import {Args, Flags} from '@oclif/core'
import {apiPostSingle} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'
import {envFlag} from '../../lib/cli/flags.js'
import {DEPRECATED_VALUE_FLAG, secretValueFlags} from '../../lib/cli/secret-flags.js'
import {requireSecretValue} from '../../lib/cli/secret-value.js'
import {ValidationError} from '../../lib/errors.js'
import {resolveEnvironment} from '../../lib/monitors/resolve.js'
import {parse} from '../../lib/response-validation.js'

export default class SecretsCreate extends DevhelmCommand {
  static legacyOutput = true
  static description =
    'Create a secret. The first value comes from stdin or an environment variable, never an argument; --env stores it for that environment'
  static examples = [
    'printf %s "$CARD_TOKEN" | <%= config.bin %> secrets create CARD_TOKEN --env staging --value-stdin',
    '<%= config.bin %> secrets create LOGIN_EMAIL --env staging --from-env LOGIN_EMAIL',
  ]
  static args = {key: Args.string({description: 'Secret key, e.g. CARD_TOKEN'})}
  static flags = {
    ...commonFlags,
    ...secretValueFlags,
    env: envFlag,
    key: Flags.string({description: 'Secret key (same as the argument)', hidden: true}),
    value: Flags.string({description: 'Deprecated (removed 2027-01-31): use --value-stdin or --from-env', hidden: true}),
  }

  async run() {
    const {args, flags} = await this.parse(SecretsCreate)
    const key = args.key ?? flags.key
    if (!key) throw new ValidationError('Pass the secret key: devhelm secrets create <KEY>', {code: 'FIELD_REQUIRED'})
    let value: string
    if (flags.value !== undefined) {
      this.warn(DEPRECATED_VALUE_FLAG)
      value = flags.value
    } else {
      value = await requireSecretValue(flags, key, flags.env)
    }
    const client = this.client()
    const environmentId = flags.env ? (await resolveEnvironment(client, flags.env)).id : undefined
    const body = parse(apiSchemas.CreateSecretRequest, {key, value, ...(environmentId ? {environmentId} : {})}, 'Invalid secret')
    const secret = await apiPostSingle(client, '/api/v1/secrets', apiSchemas.SecretDto, body)
    await this.finish({data: secret, human: () => this.log(`Secret ${secret.key} created${flags.env ? ` with a value for ${flags.env}` : ''}.`)})
  }
}
