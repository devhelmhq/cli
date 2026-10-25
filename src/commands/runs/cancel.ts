import {Args} from '@oclif/core'
import {apiPostSingle} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'

export default class RunsCancel extends DevhelmCommand {
  static description = 'Request cancellation of a run (a run cancelled after it started is still billed)'
  static examples = ['<%= config.bin %> runs cancel <run-id>']
  static args = {id: Args.string({description: 'Run id', required: true})}
  static flags = {...commonFlags}

  async run() {
    const {args} = await this.parse(RunsCancel)
    const run = await apiPostSingle(this.client(), `/api/v1/runs/${args.id}/cancel`, apiSchemas.RunDto)
    await this.finish({data: run, human: () => this.log(`Cancellation requested for run ${run.id} (${run.phase}).`)})
  }
}
