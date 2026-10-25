import {Flags} from '@oclif/core'
import {apiPostSingle} from '../../../lib/api-client.js'
import {schemas as apiSchemas} from '../../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../../lib/cli/command.js'
import {envFlag, monitorArg} from '../../../lib/cli/flags.js'
import {resolveMonitor} from '../../../lib/monitors/resolve.js'

export default class MonitorsSessionsRevoke extends DevhelmCommand {
  static description = 'Revoke a stored session; the next run signs in again'
  static examples = ['<%= config.bin %> monitors sessions revoke Checkout --setup-file auth.setup.ts']
  static args = {monitor: monitorArg}
  static flags = {...commonFlags, env: envFlag, 'setup-file': Flags.string({description: 'Setup file of the session (default: the default session)'})}

  async run() {
    const {args, flags} = await this.parse(MonitorsSessionsRevoke)
    const client = this.client()
    const monitor = await resolveMonitor(client, args.monitor, {env: flags.env})
    const q = flags['setup-file'] ? `?setupFile=${encodeURIComponent(flags['setup-file'])}` : ''
    const dto = await apiPostSingle(client, `/api/v1/monitors/${monitor.id}/sessions/revoke${q}`, apiSchemas.MonitorSessionDto)
    await this.finish({data: dto, human: () => this.log(`Revoked session ${dto.setupFile} (${dto.lifecycle}).`)})
  }
}
