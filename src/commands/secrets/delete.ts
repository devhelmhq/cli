import {Args} from '@oclif/core'
import {apiDelete, apiGetSingle} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags, yesFlag} from '../../lib/cli/command.js'
import {ConflictError} from '../../lib/errors.js'

export default class SecretsDelete extends DevhelmCommand {
  static legacyOutput = true
  static description = 'Delete a secret. Refused (exit 18) while any monitor uses it; confirmation-gated (--yes)'
  static examples = ['<%= config.bin %> secrets delete OLD_TOKEN --yes']
  static args = {key: Args.string({description: 'Secret key', required: true})}
  static flags = {...commonFlags, ...yesFlag}

  async run() {
    const {args, flags} = await this.parse(SecretsDelete)
    const client = this.client()
    const path = `/api/v1/secrets/${encodeURIComponent(args.key)}`
    const usage = await apiGetSingle(client, `${path}/usage`, apiSchemas.SecretUsageDto)
    if (usage.monitors.length > 0) {
      const list = usage.monitors.map((m) => `  ${m.id}  ${m.name}  ${m.environment?.slug ?? '-'}`).join('\n')
      throw new ConflictError(`Secret ${args.key} is used by ${usage.monitors.length} monitor(s); remove it from them first:\n${list}`, {
        code: 'SECRET_IN_USE',
        details: {monitors: usage.monitors.map((m) => ({id: m.id, name: m.name, environment: m.environment?.slug ?? null}))},
        next: {command: `devhelm secrets usage ${args.key}`, docs: null},
      })
    }
    await this.confirm({
      action: 'secret.delete',
      changes: [{delete: 'secret', key: args.key}],
      confirmCommand: `devhelm secrets delete ${args.key} --yes`,
      yes: flags.yes,
      prompt: `Delete secret ${args.key} and its values in every environment?`,
    })
    await apiDelete(client, path)
    await this.finish({data: {key: args.key, deleted: true}, human: () => this.log(`Secret '${args.key}' deleted.`)})
  }
}
