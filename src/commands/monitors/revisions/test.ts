import {Args, Flags} from '@oclif/core'
import {apiPostSingle} from '../../../lib/api-client.js'
import {schemas as apiSchemas} from '../../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../../lib/cli/command.js'
import {envFlag, monitorArg, parseDurationMs} from '../../../lib/cli/flags.js'
import {resolveMonitor} from '../../../lib/monitors/resolve.js'
import {parse} from '../../../lib/response-validation.js'
import {verdictOf} from '../../../lib/runs/outcome.js'
import {followRuns} from '../../../lib/runs/follow.js'
import {sessionContext} from '../../../lib/runs/session.js'

export default class MonitorsRevisionsTest extends DevhelmCommand {
  static description = "Test a revision in the monitor's environment (a validation run: billed, never alerts). Exit 14 failed, 19 no verdict"
  static examples = [
    '<%= config.bin %> monitors revisions test Checkout <revision-id>',
    '<%= config.bin %> monitors revisions test <id> <revision-id> --region eu-west --no-wait',
  ]
  static args = {monitor: monitorArg, revision: Args.string({description: 'Revision id', required: true})}
  static flags = {
    ...commonFlags,
    env: envFlag,
    region: Flags.string({description: "Region for the run (default: the monitor's first region)"}),
    session: Flags.string({description: 'Group this run under a test session id (default: the CI run)'}),
    wait: Flags.boolean({description: 'Wait for the run to finish (default true)', default: true, allowNo: true}),
    timeout: Flags.string({description: 'How long to wait (default 5m); the run keeps going after it', default: '5m'}),
  }

  async run() {
    const {args, flags} = await this.parse(MonitorsRevisionsTest)
    const client = this.client()
    const monitor = await resolveMonitor(client, args.monitor, {env: flags.env})
    const body: Record<string, unknown> = {}
    if (flags.region) body.region = flags.region
    const session = sessionContext(flags.session)
    if (session) body.session = session
    const run = await apiPostSingle(client, `/api/v1/monitors/${monitor.id}/revisions/${args.revision}/test`, apiSchemas.RunDto,
      parse(apiSchemas.CodeTestTargetRequest, body, 'test target invalid'))
    this.human(`${monitor.name}: testing revision ${args.revision}`)
    const followed = await followRuns(client, [run], {
      wait: flags.wait,
      timeoutMs: parseDurationMs(flags.timeout, 'timeout'),
      log: this.structured ? undefined : (l) => this.log(l),
    })
    for (const w of followed.warnings) this.addWarning(w)
    const final = followed.runs[0]
    if (flags.wait && final && verdictOf(final) === 'passed') this.human(`  next: devhelm monitors publish ${monitor.id} --revision ${args.revision} --require-tested`)
    await this.finish({exit: followed.exit, data: final})
  }
}
