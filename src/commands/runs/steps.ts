import {Args, Flags} from '@oclif/core'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'
import {listRunCases, stepLines} from '../../lib/runs/evidence.js'

export default class RunsSteps extends DevhelmCommand {
  static description = 'Show the cases and steps of a run'
  static examples = ['<%= config.bin %> runs steps <run-id>']
  static args = {id: Args.string({description: 'Run id', required: true})}
  static flags = {...commonFlags, attempt: Flags.integer({description: 'Attempt number (fast retries)'})}

  async run() {
    const {args, flags} = await this.parse(RunsSteps)
    const cases = await listRunCases(this.client(), args.id, flags.attempt)
    await this.finish({data: cases, human: () => {
      for (const l of stepLines(cases)) this.log(l)
    }})
  }
}
