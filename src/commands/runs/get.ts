import {Args, Flags} from '@oclif/core'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'
import {listRunCases, stepLines} from '../../lib/runs/evidence.js'
import {failureLines, runLine} from '../../lib/runs/outcome.js'
import {getRun} from '../../lib/runs/wait.js'

export default class RunsGet extends DevhelmCommand {
  static description = 'Show one run: outcome, failure (file:line) and URL; --steps adds every case and step'
  static examples = ['<%= config.bin %> runs get <run-id>', '<%= config.bin %> runs get <run-id> --steps']
  static args = {id: Args.string({description: 'Run id', required: true})}
  static flags = {...commonFlags, steps: Flags.boolean({description: 'Include cases and steps', default: false})}

  async run() {
    const {args, flags} = await this.parse(RunsGet)
    const client = this.client()
    const run = await getRun(client, args.id)
    const cases = flags.steps ? await listRunCases(client, args.id) : undefined
    await this.finish({
      data: cases ? {...run, cases} : run,
      human: () => {
        this.log(`${run.monitorName ?? run.monitorId ?? 'ad-hoc'} · ${run.source}`)
        this.log(runLine(run))
        for (const l of failureLines(run)) this.log(`    ${l}`)
        if (cases) for (const l of stepLines(cases)) this.log(l)
      },
    })
  }
}
