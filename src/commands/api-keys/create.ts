import {Flags} from '@oclif/core'
import {apiPostSingle} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {API_KEY_PRESETS} from '../../lib/cli/api-key-flags.js'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'
import {parseUntil} from '../../lib/cli/flags.js'
import {ValidationError} from '../../lib/errors.js'
import {formatOutput} from '../../lib/output.js'
import {parse} from '../../lib/response-validation.js'

export default class ApiKeysCreate extends DevhelmCommand {
  static legacyOutput = true
  static description =
    'Create an API key with a preset (ci-pr, ci-deploy, agent-responder, agent-author) or explicit --scope values. The secret is shown once'
  static examples = [
    '<%= config.bin %> api-keys create --name "acme/web CI deploy" --preset ci-deploy --expires 90d',
    '<%= config.bin %> api-keys create --name "pr checks" --scope workspace:read --scope runs:execute',
  ]
  static flags = {
    ...commonFlags,
    name: Flags.string({description: 'Key name', required: true}),
    preset: Flags.string({description: 'Scope preset', options: [...API_KEY_PRESETS], exclusive: ['scope']}),
    scope: Flags.string({description: 'Scope to grant (repeatable), e.g. runs:execute', multiple: true, exclusive: ['preset']}),
    expires: Flags.string({description: 'Expiry: a duration like 90d, or an ISO-8601 time', exclusive: ['expires-at']}),
    'expires-at': Flags.string({description: 'Expiry as an ISO-8601 time', exclusive: ['expires']}),
    tool: Flags.string({description: 'Tool this key acts as for monitor ownership (default GIT for --preset ci-deploy)', options: ['GIT', 'TERRAFORM', 'MCP', 'API', 'DASHBOARD']}),
  }

  async run() {
    const {flags} = await this.parse(ApiKeysCreate)
    let expiresAt: string | undefined
    if (flags.expires) expiresAt = parseUntil(flags.expires, 'expires')
    else if (flags['expires-at']) expiresAt = flags['expires-at']
    if (!flags.preset && !flags.scope) {
      this.addWarning('no --preset or --scope: this key gets every scope (full). Prefer a preset such as ci-deploy or agent-author')
    }
    if (flags.scope && flags.scope.length === 0) throw new ValidationError('--scope needs a value', {code: 'FIELD_REQUIRED'})
    const body = parse(apiSchemas.CreateApiKeyRequest, {
      name: flags.name,
      ...(expiresAt ? {expiresAt} : {}),
      ...(flags.preset ? {preset: flags.preset} : {}),
      ...(flags.scope ? {scopes: flags.scope} : {}),
      ...(flags.tool ? {tool: flags.tool} : flags.preset === 'ci-deploy' ? {tool: 'GIT'} : {}),
    }, 'Invalid API key request')
    const key = await apiPostSingle(this.client(), '/api/v1/api-keys', apiSchemas.ApiKeyCreateResponse, body)
    await this.finish({data: key, human: () => {
      this.log(formatOutput(key, 'table'))
      this.logToStderr('Store the key now: it is not shown again.')
    }})
  }
}
