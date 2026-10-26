import {Flags} from '@oclif/core'
import {checkedFetch} from '../../lib/api-client.js'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'
import {envFlag, monitorArg, parseUntil} from '../../lib/cli/flags.js'
import {resolveMonitor} from '../../lib/monitors/resolve.js'

export default class MonitorsPause extends DevhelmCommand {
  static legacyOutput = true
  static description = 'Pause a monitor (deploy keeps it paused unless devhelm.yml sets `enabled`)'
  static examples = [
    '<%= config.bin %> monitors pause Checkout --env production --reason "provider maintenance"',
    '<%= config.bin %> monitors pause 7f3c… --until 2h',
  ]
  static args = {monitor: monitorArg}
  static flags = {
    ...commonFlags,
    env: envFlag,
    reason: Flags.string({description: 'Why the monitor is paused (max 280)'}),
    until: Flags.string({description: 'Resume automatically at this time (ISO-8601 or a duration like 2h)'}),
  }

  async run() {
    const {args, flags} = await this.parse(MonitorsPause)
    const client = this.client()
    const monitor = await resolveMonitor(client, args.monitor, {env: flags.env})
    const body: {reason?: string; expiresAt?: string} = {}
    if (flags.reason) body.reason = flags.reason
    if (flags.until) body.expiresAt = parseUntil(flags.until)
    const resp = await checkedFetch(client.POST('/api/v1/monitors/{id}/pause', {params: {path: {id: monitor.id}}, body}))
    await this.finish({
      data: resp?.data ?? null,
      human: () => this.log(`Monitor '${monitor.name}' paused${body.expiresAt ? ` until ${body.expiresAt}` : ''}.`),
    })
  }
}
