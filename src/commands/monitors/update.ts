import {Flags} from '@oclif/core'
import {apiPutSingle} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'
import {envFlag, monitorArg} from '../../lib/cli/flags.js'
import {ValidationError} from '../../lib/errors.js'
import {codeFromFlag} from '../../lib/monitors/code-flag.js'
import {table} from '../../lib/monitors/columns.js'
import {isCodeType, resolveEnvironment, resolveMonitor, type MonitorDto} from '../../lib/monitors/resolve.js'
import {MONITORS} from '../../lib/resources.js'
import {parse} from '../../lib/response-validation.js'

export default class MonitorsUpdate extends DevhelmCommand {
  static legacyOutput = true
  static description = 'Update a monitor. --code publishes new code at once, untested (use `monitors revisions create` + `test` + `publish` to test first)'
  static examples = [
    '<%= config.bin %> monitors update <id> --frequency 300',
    '<%= config.bin %> monitors update Checkout --env production --code synthetics/checkout.spec.ts',
  ]

  static args = {id: monitorArg}
  static flags = {
    ...commonFlags,
    ...(MONITORS.updateFlags as Record<string, never>),
    code: Flags.string({description: 'New entry file for a code monitor (bundled and published live)'}),
    env: envFlag,
    'move-to-env': Flags.string({description: 'Move the monitor to another environment (slug)'}),
    'acknowledge-rollback': Flags.string({description: 'Rolled-back digest this code publish re-applies on purpose'}),
  }

  async run() {
    const {args, flags} = await this.parse(MonitorsUpdate)
    const client = this.client()
    const monitor = await resolveMonitor(client, args.id, {env: flags.env})
    const raw = flags as unknown as Record<string, unknown>
    const updateKeys = Object.keys(MONITORS.updateFlags ?? {})
    const picked: Record<string, unknown> = {}
    for (const k of updateKeys) if (raw[k] !== undefined) picked[k] = raw[k]
    const body = (MONITORS.updateBodyBuilder ?? MONITORS.bodyBuilder)(picked) as Record<string, unknown>
    if (flags.code) {
      if (!isCodeType(monitor.type)) throw new ValidationError(`--code applies to BROWSER and MULTI_STEP_API monitors, not ${monitor.type}`, {code: 'FIELD_UNKNOWN'})
      body.code = await codeFromFlag(client, flags.code)
      if (flags['acknowledge-rollback']) body.acknowledgeRollback = flags['acknowledge-rollback']
    }
    if (flags['move-to-env']) body.environmentId = (await resolveEnvironment(client, flags['move-to-env'])).id
    const valid = parse(apiSchemas.UpdateMonitorRequest, body, 'monitor.update body invalid')
    const updated = await apiPutSingle<MonitorDto>(client, `/api/v1/monitors/${monitor.id}`, apiSchemas.MonitorDto, valid)
    if (MONITORS.afterUpdate) await MONITORS.afterUpdate(updated as never, picked, {client, command: this, apiPath: '/api/v1/monitors', id: monitor.id})
    await this.finish({data: updated, human: () => this.log(table(updated))})
  }
}
