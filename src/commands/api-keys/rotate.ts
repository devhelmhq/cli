import {Args} from '@oclif/core'
import {apiPostSingle} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'
import {ValidationError} from '../../lib/errors.js'
import {formatOutput} from '../../lib/output.js'

export default class ApiKeysRotate extends DevhelmCommand {
  static description = 'Rotate an API key: issues a new secret (shown once). The old secret stops working at once'
  static examples = ['<%= config.bin %> api-keys rotate 42']
  static args = {id: Args.string({description: 'API key id', required: true})}
  static flags = {...commonFlags}

  async run() {
    const {args} = await this.parse(ApiKeysRotate)
    if (!/^\d+$/.test(args.id)) throw new ValidationError(`API key id must be numeric (got "${args.id}")`, {code: 'FIELD_INVALID_FORMAT'})
    const key = await apiPostSingle(this.client(), `/api/v1/api-keys/${args.id}/regenerate`, apiSchemas.ApiKeyCreateResponse)
    await this.finish({data: key, human: () => {
      this.log(formatOutput(key, 'table'))
      this.logToStderr('Store the new key now: it is not shown again.')
    }})
  }
}
