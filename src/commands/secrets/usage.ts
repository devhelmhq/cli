import {Args} from '@oclif/core'
import {apiGetSingle} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'
import {ownerLabel} from '../../lib/monitors/resolve.js'

export default class SecretsUsage extends DevhelmCommand {
  static description = 'List the monitors that use a secret'
  static examples = ['<%= config.bin %> secrets usage CARD_TOKEN']
  static args = {key: Args.string({description: 'Secret key', required: true})}
  static flags = {...commonFlags}

  async run() {
    const {args} = await this.parse(SecretsUsage)
    const usage = await apiGetSingle(this.client(), `/api/v1/secrets/${encodeURIComponent(args.key)}/usage`, apiSchemas.SecretUsageDto)
    await this.finish({data: usage, human: () => {
      if (usage.monitors.length === 0) this.log(`${args.key} is not used by any monitor.`)
      for (const m of usage.monitors) this.log(`  ${m.id}  ${m.name}  ${m.type}  ${m.environment?.slug ?? '-'}  ${ownerLabel(m)}`)
    }})
  }
}
