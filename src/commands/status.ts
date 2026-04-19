import {Command} from '@oclif/core'
import {globalFlags, buildClient} from '../lib/base-command.js'
import {apiGet} from '../lib/api-client.js'
import {formatOutput, OutputFormat} from '../lib/output.js'
import type {components} from '../lib/api.generated.js'
import {DashboardOverviewSchema} from '../lib/response-schemas.js'

type DashboardOverviewDto = components['schemas']['DashboardOverviewDto']

export default class Status extends Command {
  static description = 'Show dashboard overview'
  static examples = ['<%= config.bin %> status']
  static flags = {...globalFlags}

  async run() {
    const {flags} = await this.parse(Status)
    const client = buildClient(flags)
    const resp = await apiGet<{data?: DashboardOverviewDto}>(client, '/api/v1/dashboard/overview')
    if (!resp.data) {
      this.error('API returned an empty response for /api/v1/dashboard/overview')
    }

    const parsed = DashboardOverviewSchema.safeParse(resp.data)
    if (!parsed.success) {
      this.error(`Unexpected dashboard response shape: ${parsed.error.issues.map((i) => i.message).join(', ')}`)
    }

    const overview = parsed.data

    const format = flags.output as OutputFormat
    if (format === 'json' || format === 'yaml') {
      this.log(formatOutput(overview, format))
      return
    }

    const m = overview.monitors
    const i = overview.incidents
    this.log('')
    this.log('  Monitors')
    this.log(`    Total: ${m.total}    Up: ${m.up}    Down: ${m.down}    Degraded: ${m.degraded}    Paused: ${m.paused}`)
    const u24 = m.avgUptime24h != null ? Number(m.avgUptime24h).toFixed(2) : '–'
    const u30 = m.avgUptime30d != null ? Number(m.avgUptime30d).toFixed(2) : '–'
    this.log(`    Uptime (24h): ${u24}%    Uptime (30d): ${u30}%`)
    this.log('')
    this.log('  Incidents')
    this.log(`    Active: ${i.active}    Resolved today: ${i.resolvedToday}    MTTR (30d): ${i.mttr30d != null ? `${Math.round(Number(i.mttr30d) / 60)}m` : '–'}`)
    this.log('')
  }
}
