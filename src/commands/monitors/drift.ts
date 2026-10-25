import {apiGetSingle} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'
import {envFlag, monitorArg} from '../../lib/cli/flags.js'
import {resolveMonitor} from '../../lib/monitors/resolve.js'

export default class MonitorsDrift extends DevhelmCommand {
  static description = 'Show how a monitor differs from what was last applied from code (overlays, settings, live code)'
  static examples = ['<%= config.bin %> monitors drift Checkout --env production']
  static args = {monitor: monitorArg}
  static flags = {...commonFlags, env: envFlag}

  async run() {
    const {args, flags} = await this.parse(MonitorsDrift)
    const client = this.client()
    const monitor = await resolveMonitor(client, args.monitor, {env: flags.env})
    const drift = await apiGetSingle(client, `/api/v1/monitors/${monitor.id}/drift`, apiSchemas.MonitorDriftDto)
    await this.finish({
      data: drift,
      human: () => {
        const none = drift.fields.length === 0 && !drift.code?.drifted && (drift.settings ?? []).length === 0
        if (none) {
          this.log(`${monitor.name}: no drift`)
          return
        }
        this.log(`${monitor.name}:`)
        for (const f of drift.fields) this.log(`  overlay ${f.field}: live ${f.live} · declared ${f.declared}`)
        for (const s of drift.settings ?? []) {
          const who = s.changedBy?.email ? ` by ${s.changedBy.email}` : ''
          this.log(`  setting ${s.field}: live ${s.live} · git ${s.git}${who}${s.reason ? ` (${s.reason})` : ''}`)
        }
        if (drift.code?.drifted) this.log(`  live code ${drift.code.liveDigest} differs from git ${drift.code.gitDigest}`)
      },
    })
  }
}
