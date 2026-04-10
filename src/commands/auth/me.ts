import {Command} from '@oclif/core'
import {globalFlags, buildClient} from '../../lib/base-command.js'
import {typedGet} from '../../lib/typed-api.js'
import {formatOutput, OutputFormat} from '../../lib/output.js'

interface AuthMeResponse {
  data?: {
    key?: {id?: string; name?: string; createdAt?: string; expiresAt?: string; lastUsedAt?: string}
    organization?: {id?: number; name?: string}
    plan?: {
      tier?: string
      subscriptionStatus?: string
      trialActive?: boolean
      trialExpiresAt?: string
      usage?: Record<string, number>
      entitlements?: Record<string, {value: number}>
    }
    rateLimits?: {requestsPerMinute?: number; remaining?: number; windowMs?: number}
  }
}

export default class AuthMe extends Command {
  static description = 'Show current API key identity, organization, plan, and rate limits'
  static examples = ['<%= config.bin %> auth me', '<%= config.bin %> auth me --output json']
  static flags = {...globalFlags}

  async run() {
    const {flags} = await this.parse(AuthMe)
    const client = buildClient(flags)
    const resp = await typedGet<AuthMeResponse>(client, '/api/v1/auth/me')
    const me = resp.data

    const format = flags.output as OutputFormat
    if (format === 'json' || format === 'yaml') {
      this.log(formatOutput(me, format))
      return
    }

    const k = me?.key ?? {}
    const o = me?.organization ?? {}
    const p = me?.plan ?? {}
    const r = me?.rateLimits ?? {}

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

    const usage = p.usage
    const entitlements = p.entitlements
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
