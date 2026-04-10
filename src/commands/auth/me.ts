import {Command} from '@oclif/core'
import {globalFlags, buildClient} from '../../lib/base-command.js'
import {checkedFetch, unwrap, type Schemas} from '../../lib/api-client.js'
import {formatOutput, type OutputFormat} from '../../lib/output.js'

type AuthMeResponse = Schemas['AuthMeResponse']

export default class AuthMe extends Command {
  static description = 'Show current API key identity, organization, plan, and rate limits'
  static examples = ['<%= config.bin %> auth me', '<%= config.bin %> auth me --output json']
  static flags = {...globalFlags}

  async run() {
    const {flags} = await this.parse(AuthMe)
    const client = buildClient(flags)
    const resp = await checkedFetch(client.GET('/api/v1/auth/me'))
    const me = unwrap<AuthMeResponse>(resp)

    const format = flags.output as OutputFormat
    if (format === 'json' || format === 'yaml') {
      this.log(formatOutput(me, format))
      return
    }

    const k = me.key ?? {}
    const o = me.organization ?? {}
    const p = me.plan ?? {}
    const r = me.rateLimits ?? {}

    this.log('')
    this.log('  API Key')
    this.log(`    Name: ${k.name ?? '–'}    ID: ${k.id ?? '–'}`)
    this.log(`    Created: ${k.createdAt ?? '–'}    Expires: ${k.expiresAt ?? 'never'}`)
    this.log(`    Last used: ${k.lastUsedAt ?? 'never'}`)
    this.log('')
    this.log('  Organization')
    this.log(`    Name: ${o.name ?? '–'}    ID: ${o.id ?? '–'}`)
    this.log('')
    this.log('  Plan')
    this.log(`    Tier: ${p.tier ?? '–'}    Status: ${p.subscriptionStatus ?? '–'}    Trial: ${p.trialActive ? `active (expires ${p.trialExpiresAt})` : 'no'}`)
    this.log('')
    this.log('  Rate Limits')
    this.log(`    Limit: ${r.requestsPerMinute ?? '–'} req/min    Remaining: ${r.remaining ?? '–'}    Window: ${r.windowMs ? `${r.windowMs / 1000}s` : '–'}`)

    const usage = p.usage as Record<string, number> | undefined
    const entitlements = p.entitlements as Record<string, {value: number}> | undefined
    if (usage && entitlements) {
      this.log('')
      this.log('  Usage')
      for (const [key, used] of Object.entries(usage)) {
        const limit = entitlements[key]?.value
        const limitStr = limit != null && limit < Number.MAX_SAFE_INTEGER ? String(limit) : '∞'
        const label = key.replace(/\./g, ' ').replace(/_/g, ' ')
        this.log(`    ${label}: ${used} / ${limitStr}`)
      }
    }

    this.log('')
  }
}
