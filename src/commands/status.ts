import {Command} from '@oclif/core'
import {globalFlags, buildClient} from '../lib/base-command.js'
import {checkedFetch} from '../lib/api-client.js'
import {formatOutput, OutputFormat} from '../lib/output.js'

export default class Status extends Command {
  static description = 'Show dashboard overview'
  static examples = ['<%= config.bin %> status']
  static flags = {...globalFlags}

  async run() {
    const {flags} = await this.parse(Status)
    const client = buildClient(flags)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resp = await checkedFetch(client.GET('/api/v1/dashboard/overview' as any, {} as any))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const overview = (resp as any)?.data ?? resp

    const format = flags.output as OutputFormat
    if (format === 'json' || format === 'yaml') {
      this.log(formatOutput(overview, format))
      return
    }

    const m = overview.monitors ?? {}
    const i = overview.incidents ?? {}
    this.log('')
    this.log('  Monitors')
    this.log(`    Total: ${m.total ?? 0}    Up: ${m.up ?? 0}    Down: ${m.down ?? 0}    Degraded: ${m.degraded ?? 0}    Paused: ${m.paused ?? 0}`)
    const u24 = m.avgUptime24h != null ? Number(m.avgUptime24h).toFixed(2) : '–'
    const u30 = m.avgUptime30d != null ? Number(m.avgUptime30d).toFixed(2) : '–'
    this.log(`    Uptime (24h): ${u24}%    Uptime (30d): ${u30}%`)
    this.log('')
    this.log('  Incidents')
    this.log(`    Active: ${i.active ?? 0}    Resolved today: ${i.resolvedToday ?? 0}    MTTR (30d): ${i.mttr30d != null ? `${Math.round(i.mttr30d / 60)}m` : '–'}`)
    this.log('')
  }
}
