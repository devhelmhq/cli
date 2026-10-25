import {Flags} from '@oclif/core'
import {apiPostSingle} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'
import {envFlag, monitorArg, parseDurationMs} from '../../lib/cli/flags.js'
import {ValidationError} from '../../lib/errors.js'
import {isCodeType, resolveMonitor} from '../../lib/monitors/resolve.js'
import {followRuns} from '../../lib/runs/follow.js'

export default class MonitorsRun extends DevhelmCommand {
  static description = 'Run a code monitor once now in its first region (recorded, billed, never alerts; works while paused)'
  static examples = ['<%= config.bin %> monitors run Checkout --env production', '<%= config.bin %> monitors run <id> --no-wait -o json']
  static args = {monitor: monitorArg}
  static flags = {
    ...commonFlags,
    env: envFlag,
    wait: Flags.boolean({description: 'Wait for the run to finish (default true)', default: true, allowNo: true}),
    timeout: Flags.string({description: 'How long to wait (default 5m); the run keeps going after it', default: '5m'}),
  }

  async run() {
    const {args, flags} = await this.parse(MonitorsRun)
    const client = this.client()
    const monitor = await resolveMonitor(client, args.monitor, {env: flags.env})
    if (!isCodeType(monitor.type)) {
      throw new ValidationError(`monitors run applies to BROWSER and MULTI_STEP_API monitors; ${monitor.name} is ${monitor.type}. Use \`devhelm monitors test\` for a probe`, {
        code: 'MONITOR_CODE_TYPE_REQUIRED',
        next: {command: `devhelm monitors test ${monitor.id}`, docs: null},
      })
    }
    const run = await apiPostSingle(client, `/api/v1/monitors/${monitor.id}/runs`, apiSchemas.RunDto)
    this.human(`${monitor.name}: run ${run.id} queued in ${run.region}`)
    const followed = await followRuns(client, [run], {
      wait: flags.wait,
      timeoutMs: parseDurationMs(flags.timeout, 'timeout'),
      log: this.structured ? undefined : (l) => this.log(l),
    })
    for (const w of followed.warnings) this.addWarning(w)
    await this.finish({exit: followed.exit, data: followed.runs[0]})
  }
}
