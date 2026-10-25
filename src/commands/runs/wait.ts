import {Args, Flags} from '@oclif/core'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'
import {parseDurationMs, timeoutFlag} from '../../lib/cli/flags.js'
import {WaitTimeoutError} from '../../lib/errors.js'
import {exitForVerdicts, failureLines, runLine, verdictOf, type Verdict} from '../../lib/runs/outcome.js'
import {waitForRuns} from '../../lib/runs/wait.js'

export default class RunsWait extends DevhelmCommand {
  static description = 'Wait for runs to finish. Exit 14 if any failed, 19 if any reached no verdict (or --timeout passed), else 0'
  static examples = ['<%= config.bin %> runs wait <run-id> <run-id> --timeout 10m']
  static strict = false
  static args = {id: Args.string({description: 'Run id (repeat for several)', required: true})}
  static flags = {
    ...commonFlags,
    timeout: timeoutFlag('5m'),
    'fail-on-infra-error': Flags.boolean({description: 'Exit 19 when a run reached no verdict (default true)', default: true, allowNo: true}),
  }

  async run() {
    const {argv, flags} = await this.parse(RunsWait)
    const ids = argv.map(String)
    const timeoutMs = parseDurationMs(flags.timeout, 'timeout')
    const results = await waitForRuns(this.client(), ids, {timeoutMs})
    for (const r of results) if (r.error && !(r.error instanceof WaitTimeoutError)) throw r.error
    const verdicts: Verdict[] = results.map((r) => (r.run ? verdictOf(r.run) : 'pending'))
    const exit = exitForVerdicts(verdicts, {failOnInfraError: flags['fail-on-infra-error']})
    const pending = results.filter((r) => !r.run).map((r) => r.runId)
    if (!flags['fail-on-infra-error'] && verdicts.some((v) => v === 'no_verdict' || v === 'pending')) {
      this.addWarning('some runs reached no verdict; --fail-on-infra-error=false keeps the exit code at 0')
    }
    await this.finish({
      exit,
      data: results.map((r) => r.run ?? {id: r.runId, phase: r.error instanceof WaitTimeoutError ? r.error.phase : 'unknown', finished: false}),
      extra: pending.length > 0 ? {runsContinue: true} : undefined,
      human: () => {
        for (const r of results) {
          if (r.run) {
            this.log(runLine(r.run))
            for (const l of failureLines(r.run)) this.log(`    ${l}`)
          } else {
            this.log(`? ${r.runId} · still ${r.error instanceof WaitTimeoutError ? r.error.phase : 'running'} after ${flags.timeout}; it keeps running`)
          }
        }
      },
    })
  }
}
