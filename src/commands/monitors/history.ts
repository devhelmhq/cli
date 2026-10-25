import {Flags} from '@oclif/core'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'
import {envFlag, monitorArg, parseSince} from '../../lib/cli/flags.js'
import {table} from '../../lib/monitors/columns.js'
import {HISTORY_COLUMNS, fetchHistory} from '../../lib/monitors/history.js'
import {resolveMonitor} from '../../lib/monitors/resolve.js'

export const historyFlags = {
  env: envFlag,
  failed: Flags.boolean({description: 'Only failures and ticks that did not run', default: false}),
  region: Flags.string({description: 'Only this region'}),
  since: Flags.string({description: 'Only rows newer than this (ISO-8601 or a duration like 24h)'}),
  limit: Flags.integer({description: 'Maximum number of rows (1–1000)', default: 20}),
}

export default class MonitorsHistory extends DevhelmCommand {
  static description = 'Show the scheduled history of a monitor (both uptime and code monitors)'
  static examples = [
    '<%= config.bin %> monitors history Checkout --env production',
    '<%= config.bin %> monitors history <id> --failed --since 24h -o json',
  ]
  static args = {monitor: monitorArg}
  static flags = {...commonFlags, ...historyFlags}

  async run() {
    const {args, flags} = await this.parse(MonitorsHistory)
    const client = this.client()
    const monitor = await resolveMonitor(client, args.monitor, {env: flags.env})
    const rows = await fetchHistory(client, monitor.id, {
      failed: flags.failed, region: flags.region, since: flags.since ? parseSince(flags.since) : undefined, limit: flags.limit,
    })
    await this.finish({data: rows, human: () => this.log(table(rows, HISTORY_COLUMNS))})
  }
}
