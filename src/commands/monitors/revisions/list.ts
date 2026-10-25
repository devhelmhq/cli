import {Flags} from '@oclif/core'
import {DevhelmCommand, commonFlags} from '../../../lib/cli/command.js'
import {envFlag, monitorArg} from '../../../lib/cli/flags.js'
import {table} from '../../../lib/monitors/columns.js'
import {resolveMonitor} from '../../../lib/monitors/resolve.js'
import {REVISION_COLUMNS, listRevisions} from '../../../lib/monitors/revisions.js'

export default class MonitorsRevisionsList extends DevhelmCommand {
  static description = 'List code revisions of a monitor (default: live and previous)'
  static examples = [
    '<%= config.bin %> monitors revisions list Checkout --env production',
    '<%= config.bin %> monitors revisions list <id> --state draft,tested_passed',
    '<%= config.bin %> monitors revisions list <id> --state all -o json',
  ]
  static args = {monitor: monitorArg}
  static flags = {
    ...commonFlags,
    env: envFlag,
    state: Flags.string({description: 'Comma list of draft, tested_passed, tested_failed, live, previous, discarded, or all'}),
  }

  async run() {
    const {args, flags} = await this.parse(MonitorsRevisionsList)
    const client = this.client()
    const monitor = await resolveMonitor(client, args.monitor, {env: flags.env})
    const rows = await listRevisions(client, monitor.id, flags.state)
    await this.finish({data: rows, human: () => this.log(table(rows, REVISION_COLUMNS))})
  }
}
