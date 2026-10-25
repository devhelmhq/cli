import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'
import {monitorArg, parseSince} from '../../lib/cli/flags.js'
import {table} from '../../lib/monitors/columns.js'
import {HISTORY_COLUMNS, fetchHistory} from '../../lib/monitors/history.js'
import {resolveMonitor} from '../../lib/monitors/resolve.js'
import {historyFlags} from './history.js'

/**
 * @deprecated since 1.12, removed 2027-01-31 — use `monitors history`.
 */
export default class MonitorsResults extends DevhelmCommand {
  static legacyOutput = true
  static description = 'Deprecated alias of `monitors history` (removed 2027-01-31)'
  static examples = ['<%= config.bin %> monitors history <id>']
  static args = {id: monitorArg}
  static flags = {...commonFlags, ...historyFlags}

  async run() {
    const {args, flags} = await this.parse(MonitorsResults)
    process.stderr.write('warning: `monitors results` is @deprecated since 1.12, removed 2027-01-31; use `monitors history`\n')
    const client = this.client()
    const monitor = await resolveMonitor(client, args.id, {env: flags.env})
    const rows = await fetchHistory(client, monitor.id, {
      failed: flags.failed, region: flags.region, since: flags.since ? parseSince(flags.since) : undefined, limit: flags.limit,
    })
    await this.finish({data: rows, human: () => this.log(table(rows, HISTORY_COLUMNS))})
  }
}
