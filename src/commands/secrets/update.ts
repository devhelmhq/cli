import {Args, Flags} from '@oclif/core'
import {apiPutSingle} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'
import {DEPRECATED_VALUE_FLAG, secretValueFlags} from '../../lib/cli/secret-flags.js'
import {requireSecretValue} from '../../lib/cli/secret-value.js'
import {parse} from '../../lib/response-validation.js'

export default class SecretsUpdate extends DevhelmCommand {
  static legacyOutput = true
  static description =
    'Replace a secret\'s workspace value (from stdin or an environment variable). Per-environment values: `secrets values set`'
  static examples = ['printf %s "$CARD_TOKEN" | <%= config.bin %> secrets update CARD_TOKEN --value-stdin']
  static args = {key: Args.string({description: 'Secret key', required: true})}
  static flags = {
    ...commonFlags,
    ...secretValueFlags,
    value: Flags.string({description: 'Deprecated (removed 2027-01-31): use --value-stdin or --from-env', hidden: true}),
  }

  async run() {
    const {args, flags} = await this.parse(SecretsUpdate)
    let value: string
    if (flags.value !== undefined) {
      this.warn(DEPRECATED_VALUE_FLAG)
      value = flags.value
    } else {
      value = await requireSecretValue(flags, args.key)
    }
    const body = parse(apiSchemas.UpdateSecretRequest, {value}, 'Invalid secret update')
    const secret = await apiPutSingle(this.client(), `/api/v1/secrets/${encodeURIComponent(args.key)}`, apiSchemas.SecretDto, body)
    await this.finish({data: secret, human: () => this.log(`Secret ${secret.key} updated.`)})
  }
}
