import {Args} from '@oclif/core'
import {apiPostSingle} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'

export default class RunsPin extends DevhelmCommand {
  static description = 'Pin a run so its evidence is kept past the plan retention'
  static examples = ['<%= config.bin %> runs pin <run-id>']
  static args = {id: Args.string({description: 'Run id', required: true})}
  static flags = {...commonFlags}

  async run() {
    const {args} = await this.parse(RunsPin)
    const run = await apiPostSingle(this.client(), `/api/v1/runs/${args.id}/pin`, apiSchemas.RunDto)
    await this.finish({data: run, human: () => this.log(`Pinned run ${run.id}.`)})
  }
}
