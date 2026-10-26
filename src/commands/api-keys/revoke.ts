import {Args} from '@oclif/core'
import {apiPostSingle} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'
import {ValidationError} from '../../lib/errors.js'

export default class ApiKeysRevoke extends DevhelmCommand {
  static legacyOutput = true
  static description = 'Revoke an API key (takes effect within a minute on every surface)'
  static examples = ['<%= config.bin %> api-keys revoke <id>']
  static args = {id: Args.string({description: 'API key ID', required: true})}
  static flags = {...commonFlags}

  async run() {
    const {args} = await this.parse(ApiKeysRevoke)
    if (!/^\d+$/.test(args.id)) throw new ValidationError(`API key id must be numeric (got "${args.id}")`, {code: 'FIELD_INVALID_FORMAT'})
    const key = await apiPostSingle(this.client(), `/api/v1/api-keys/${args.id}/revoke`, apiSchemas.ApiKeyDto)
    await this.finish({data: key, human: () => this.log(`API key '${args.id}' revoked.`)})
  }
}
