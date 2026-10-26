import {Flags} from '@oclif/core'
import {checkedFetch} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'
import {envFlag, monitorArg, parseDurationMs, parseUntil} from '../../lib/cli/flags.js'
import {ValidationError} from '../../lib/errors.js'
import {resolveMonitor} from '../../lib/monitors/resolve.js'
import {parse} from '../../lib/response-validation.js'

export default class MonitorsMute extends DevhelmCommand {
  static description = 'Mute alert delivery for a monitor (checks keep running; deploy never clears it)'
  static examples = [
    '<%= config.bin %> monitors mute Checkout --env production --for 2h --reason "known provider outage"',
    '<%= config.bin %> monitors mute <id> --until 2026-11-01T09:00:00Z',
  ]
  static args = {monitor: monitorArg}
  static flags = {
    ...commonFlags,
    env: envFlag,
    for: Flags.string({description: 'Mute for this long (e.g. 30m, 2h, 1d)'}),
    until: Flags.string({description: 'Mute until this time (ISO-8601 or a duration)'}),
    reason: Flags.string({description: 'Why alerts are muted (max 280)'}),
  }

  async run() {
    const {args, flags} = await this.parse(MonitorsMute)
    if (flags.for && flags.until) throw new ValidationError('Pass --for or --until, not both', {code: 'FIELD_INVALID_FORMAT'})
    const client = this.client()
    const monitor = await resolveMonitor(client, args.monitor, {env: flags.env})
    const body: {reason?: string; expiresAt?: string} = {}
    if (flags.reason) body.reason = flags.reason
    if (flags.for) body.expiresAt = new Date(Date.now() + parseDurationMs(flags.for, 'for')).toISOString()
    if (flags.until) body.expiresAt = parseUntil(flags.until)
    const valid = parse(apiSchemas.MonitorOverlayRequest, body, 'mute body invalid')
    const resp = await checkedFetch(client.POST('/api/v1/monitors/{id}/mute', {params: {path: {id: monitor.id}}, body: valid}))
    await this.finish({
      data: resp?.data ?? null,
      human: () => this.log(`Monitor '${monitor.name}' muted${body.expiresAt ? ` until ${body.expiresAt}` : ''}.`),
    })
  }
}
