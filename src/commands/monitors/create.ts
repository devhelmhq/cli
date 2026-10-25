import {Flags} from '@oclif/core'
import {apiPostSingle} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'
import {envFlag} from '../../lib/cli/flags.js'
import {ValidationError} from '../../lib/errors.js'
import {codeFromFlag} from '../../lib/monitors/code-flag.js'
import {table} from '../../lib/monitors/columns.js'
import {isCodeType, resolveEnvironment, type MonitorDto} from '../../lib/monitors/resolve.js'
import {MONITORS} from '../../lib/resources.js'
import {parse} from '../../lib/response-validation.js'

const baseCreateFlags = Object.fromEntries(
  Object.entries(MONITORS.createFlags).filter(([k]) => k !== 'frequency'),
) as Record<string, never>

export default class MonitorsCreate extends DevhelmCommand {
  static legacyOutput = true
  static description = 'Create a monitor. Browser and multi-step API monitors take --code <file> and --env; they go live at once and run right away'
  static examples = [
    '<%= config.bin %> monitors create --name API --type HTTP --url https://api.example.com/health --regions us-east',
    '<%= config.bin %> monitors create --name Checkout --type BROWSER --env production --code synthetics/checkout.spec.ts',
  ]

  static flags = {
    ...commonFlags,
    ...baseCreateFlags,
    frequency: Flags.string({description: 'Check frequency in seconds (default: 60 for uptime monitors, the plan minimum for code monitors)'}),
    code: Flags.string({description: 'Entry file of a browser or multi-step API check (bundled with its imports)'}),
    env: envFlag,
    'runtime-id': Flags.string({description: 'Runtime pin for code monitors, e.g. 2026.11'}),
  }

  async run() {
    const {flags} = await this.parse(MonitorsCreate)
    const client = this.client()
    const raw = flags as unknown as Record<string, unknown>
    const type = flags.type as string
    let body: Record<string, unknown>
    if (isCodeType(type)) {
      if (!flags.code) throw new ValidationError(`--code <file> is required for ${type} monitors`, {code: 'FIELD_REQUIRED', errors: [{code: 'FIELD_REQUIRED', field: 'code', message: 'required for code types'}]})
      if (!flags.env) throw new ValidationError(`--env <slug> is required for ${type} monitors`, {code: 'MONITOR_ENVIRONMENT_REQUIRED'})
      if (flags.url) throw new ValidationError('--url is not used by code monitors; the target lives in the code', {code: 'FIELD_UNKNOWN'})
      const env = await resolveEnvironment(client, flags.env)
      body = {
        name: flags.name,
        type,
        environmentId: env.id,
        code: await codeFromFlag(client, flags.code, {runtimeId: flags['runtime-id']}),
        regions: flags.regions ? String(flags.regions).split(',').map((s) => s.trim()).filter(Boolean) : ['us-east'],
      }
      if (flags.frequency) body.frequencySeconds = Number(flags.frequency)
      if (flags['runtime-id']) body.config = {runtimeId: flags['runtime-id']}
    } else {
      if (flags.code) throw new ValidationError(`--code applies to BROWSER and MULTI_STEP_API monitors, not ${type}`, {code: 'FIELD_UNKNOWN'})
      body = MONITORS.bodyBuilder(raw) as Record<string, unknown>
      if (flags.env) body.environmentId = (await resolveEnvironment(client, flags.env)).id
    }
    const valid = parse(apiSchemas.CreateMonitorRequest, body, 'monitor.create body invalid')
    const created = await apiPostSingle<MonitorDto>(client, '/api/v1/monitors', apiSchemas.MonitorDto, valid)
    if (MONITORS.afterCreate) await MONITORS.afterCreate(created as never, raw, {client, command: this, apiPath: '/api/v1/monitors'})
    await this.finish({
      data: created,
      human: () => {
        this.log(table(created))
        if (isCodeType(type)) this.log('Running')
      },
    })
  }
}
