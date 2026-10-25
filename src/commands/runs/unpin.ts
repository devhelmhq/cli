import {Args} from '@oclif/core'
import {checkedFetch} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'
import {parseSingle} from '../../lib/response-validation.js'

export default class RunsUnpin extends DevhelmCommand {
  static description = 'Unpin a run; its evidence follows the plan retention again'
  static examples = ['<%= config.bin %> runs unpin <run-id>']
  static args = {id: Args.string({description: 'Run id', required: true})}
  static flags = {...commonFlags}

  async run() {
    const {args} = await this.parse(RunsUnpin)
    const resp = await checkedFetch(this.client().DELETE('/api/v1/runs/{id}/pin', {params: {path: {id: args.id}}}))
    const run = parseSingle(apiSchemas.RunDto, resp, `DELETE /api/v1/runs/${args.id}/pin`)
    await this.finish({data: run, human: () => this.log(`Unpinned run ${run.id}.`)})
  }
}
