import {Flags} from '@oclif/core'
import {checkedFetch} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'
import {envFlag, monitorArg, parseUntil} from '../../lib/cli/flags.js'
import {resolveMonitor} from '../../lib/monitors/resolve.js'
import {parse} from '../../lib/response-validation.js'

export default class MonitorsQuarantine extends DevhelmCommand {
  static description = 'Quarantine a flaky monitor: it keeps running but stops paging until released or expired'
  static examples = ['<%= config.bin %> monitors quarantine Checkout --env production --reason "flaky selector" --until 7d']
  static args = {monitor: monitorArg}
  static flags = {
    ...commonFlags,
    env: envFlag,
    reason: Flags.string({description: 'Reason for the hold (max 280)', required: true}),
    until: Flags.string({description: 'When the hold expires (ISO-8601 or a duration; default 7d)', default: '7d'}),
    'from-run': Flags.string({description: 'Run that prompted this hold'}),
  }

  async run() {
    const {args, flags} = await this.parse(MonitorsQuarantine)
    const client = this.client()
    const monitor = await resolveMonitor(client, args.monitor, {env: flags.env})
    const body = parse(apiSchemas.QuarantineMonitorRequest, {
      reason: flags.reason,
      expiresAt: parseUntil(flags.until),
      ...(flags['from-run'] ? {fromRunId: flags['from-run']} : {}),
    }, 'quarantine body invalid')
    const resp = await checkedFetch(client.POST('/api/v1/monitors/{id}/quarantine', {params: {path: {id: monitor.id}}, body}))
    if ((monitor.boundStatusPageComponents ?? []).length > 0) {
      this.addWarning(`${monitor.name} is bound to ${monitor.boundStatusPageComponents!.length} status-page component(s); quarantine hides its failures from paging, not from the page`)
    }
    await this.finish({data: resp?.data ?? null, human: () => this.log(`Monitor '${monitor.name}' quarantined until ${body.expiresAt}.`)})
  }
}
