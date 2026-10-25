import {Args} from '@oclif/core'
import {apiGetSingle} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'

export default class RunsTrace extends DevhelmCommand {
  static description = 'Summarize the Playwright trace of a run: failed actions, failed requests, console errors'
  static examples = ['<%= config.bin %> runs trace <run-id>']
  static args = {id: Args.string({description: 'Run id', required: true})}
  static flags = {...commonFlags}

  async run() {
    const {args} = await this.parse(RunsTrace)
    const t = await apiGetSingle(this.client(), `/api/v1/runs/${args.id}/trace-summary`, apiSchemas.RunTraceSummaryDto)
    await this.finish({data: t, human: () => {
      this.log(t.text)
      if (t.truncated) this.log('(truncated)')
    }})
  }
}
