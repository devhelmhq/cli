import {apiGetPage} from '../../../lib/api-client.js'
import {schemas as apiSchemas} from '../../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../../lib/cli/command.js'
import {envFlag, monitorArg} from '../../../lib/cli/flags.js'
import {table} from '../../../lib/monitors/columns.js'
import {resolveMonitor} from '../../../lib/monitors/resolve.js'

export default class MonitorsSessionsList extends DevhelmCommand {
  static description = 'List the signed-in sessions a browser monitor reuses (one per setup file)'
  static examples = ['<%= config.bin %> monitors sessions list Checkout --env production']
  static args = {monitor: monitorArg}
  static flags = {...commonFlags, env: envFlag}

  async run() {
    const {args, flags} = await this.parse(MonitorsSessionsList)
    const client = this.client()
    const monitor = await resolveMonitor(client, args.monitor, {env: flags.env})
    const page = await apiGetPage(client, `/api/v1/monitors/${monitor.id}/sessions`, apiSchemas.MonitorSessionDto)
    await this.finish({data: page.data, human: () => this.log(table(page.data, [
      {header: 'SETUP FILE', get: (r) => r.setupFile},
      {header: 'LIFECYCLE', get: (r) => r.lifecycle},
      {header: 'REUSE', get: (r) => r.reusePolicy},
      {header: 'SIGNS IN AS', get: (r) => r.signsInAs ?? ''},
      {header: 'EXPIRES', get: (r) => r.expiresAt ?? ''},
      {header: 'COOKIES', get: (r) => String(r.cookieNames.length)},
    ]))})
  }
}
