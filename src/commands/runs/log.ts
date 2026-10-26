import {Args} from '@oclif/core'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'
import {getRaw} from '../../lib/cli/raw.js'

export default class RunsLog extends DevhelmCommand {
  static description = 'Print the runner log of a run'
  static examples = ['<%= config.bin %> runs log <run-id>']
  static args = {id: Args.string({description: 'Run id', required: true})}
  static flags = {...commonFlags}

  async run() {
    const {args} = await this.parse(RunsLog)
    const text = await (await getRaw(this.client(), `/api/v1/runs/${args.id}/runner-log`, {accept: 'text/plain'})).text()
    await this.finish({data: {runId: args.id, log: text}, human: () => process.stdout.write(text.endsWith('\n') ? text : `${text}\n`)})
  }
}
