import {apiGetSingle} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'

export default class AccountEntitlements extends DevhelmCommand {
  static description = 'Show the plan, its entitlements (limits) and current usage against each'
  static examples = ['<%= config.bin %> account entitlements', '<%= config.bin %> account entitlements -o json']
  static flags = {...commonFlags}

  async run() {
    await this.parse(AccountEntitlements)
    const ent = await apiGetSingle(this.client(), '/api/v1/entitlements', apiSchemas.EntitlementResponse)
    await this.finish({
      data: ent,
      human: () => {
        const trial = ent.trialActive ? ` · trial until ${ent.trialExpiresAt ?? '?'}` : ''
        this.log(`Plan ${ent.tier}${ent.subscriptionStatus ? ` (${ent.subscriptionStatus})` : ''}${trial} · period from ${ent.usagePeriodStart}`)
        for (const [key, e] of Object.entries(ent.entitlements).sort(([a], [b]) => a.localeCompare(b))) {
          const used = ent.usage[key]
          const limit = e.value >= Number.MAX_SAFE_INTEGER || e.value < 0 ? 'unlimited' : String(e.value)
          this.log(`  ${key}: ${used !== undefined ? `${used} / ` : ''}${limit}${e.overridden ? ' (override)' : ''}`)
        }
      },
    })
  }
}
