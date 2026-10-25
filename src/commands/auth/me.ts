import {apiGetSingle} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'
import {keyNotices} from '../../lib/key-notices.js'

export default class AuthMe extends DevhelmCommand {
  static legacyOutput = true
  static description = 'Show the current API key: scopes, id, expiry, organization, plan and rate limits'
  static examples = ['<%= config.bin %> auth me', '<%= config.bin %> auth me --output json']
  static flags = {...commonFlags}

  async run() {
    await this.parse(AuthMe)
    const client = this.client()
    const me = await apiGetSingle(client, '/api/v1/auth/me', apiSchemas.AuthMeResponse)
    const notices = keyNotices(me.key)
    for (const n of notices) this.addWarning(n)

    await this.finish({
      data: me,
      human: () => {
        const k = me.key
        const o = me.organization
        const p = me.plan
        const r = me.rateLimits
        this.log('')
        this.log('  API Key')
        this.log(`    Name: ${k.name}    ID: ${k.id}`)
        this.log(`    Scopes: ${k.scopes.join(', ') || '–'}`)
        this.log(`    Created: ${k.createdAt}    Expires: ${k.expiresAt ?? 'never'}`)
        this.log(`    Last used: ${k.lastUsedAt ?? 'never'}`)
        this.log('')
        this.log('  Organization')
        this.log(`    Name: ${o.name}    ID: ${o.id}`)
        this.log('')
        this.log('  Plan')
        this.log(`    Tier: ${p.tier}    Status: ${p.subscriptionStatus ?? '–'}    Trial: ${p.trialActive ? `active (expires ${p.trialExpiresAt})` : 'no'}`)
        this.log('')
        this.log('  Rate Limits')
        this.log(`    Limit: ${r.requestsPerMinute} req/min    Remaining: ${r.remaining}    Window: ${r.windowMs / 1000}s`)
        const usage = p.usage
        const entitlements = p.entitlements
        if (Object.keys(usage).length > 0) {
          this.log('')
          this.log('  Usage')
          for (const [key, used] of Object.entries(usage)) {
            const limit = entitlements[key]?.value
            const limitStr = limit != null && limit < Number.MAX_SAFE_INTEGER ? String(limit) : '∞'
            this.log(`    ${key.replace(/\./g, ' ').replace(/_/g, ' ')}: ${used} / ${limitStr}`)
          }
        }
        this.log('')
      },
    })
  }
}
