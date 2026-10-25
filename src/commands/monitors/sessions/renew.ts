import {Flags} from '@oclif/core'
import {apiPostSingle} from '../../../lib/api-client.js'
import {schemas as apiSchemas} from '../../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../../lib/cli/command.js'
import {envFlag, monitorArg, parseDurationMs} from '../../../lib/cli/flags.js'
import {resolveMonitor} from '../../../lib/monitors/resolve.js'
import {followRuns} from '../../../lib/runs/follow.js'

export default class MonitorsSessionsRenew extends DevhelmCommand {
  static description = 'Renew a session now by running its setup file'
  static examples = ['<%= config.bin %> monitors sessions renew Checkout --setup-file auth.setup.ts']
  static args = {monitor: monitorArg}
  static flags = {
    ...commonFlags,
    env: envFlag,
    'setup-file': Flags.string({description: 'Setup file of the session (default: the default session)'}),
    wait: Flags.boolean({description: 'Wait for the renew run (default true)', default: true, allowNo: true}),
    timeout: Flags.string({description: 'How long to wait (default 5m)', default: '5m'}),
  }

  async run() {
    const {args, flags} = await this.parse(MonitorsSessionsRenew)
    const client = this.client()
    const monitor = await resolveMonitor(client, args.monitor, {env: flags.env})
    const q = flags['setup-file'] ? `?setupFile=${encodeURIComponent(flags['setup-file'])}` : ''
    const run = await apiPostSingle(client, `/api/v1/monitors/${monitor.id}/sessions/renew${q}`, apiSchemas.RunDto)
    const followed = await followRuns(client, [run], {
      wait: flags.wait, timeoutMs: parseDurationMs(flags.timeout, 'timeout'), log: this.structured ? undefined : (l) => this.log(l),
    })
    for (const w of followed.warnings) this.addWarning(w)
    await this.finish({exit: followed.exit, data: followed.runs[0]})
  }
}
