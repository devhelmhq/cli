import {Args, Flags} from '@oclif/core'
import {apiGetSingle} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'

export default class RunsDiff extends DevhelmCommand {
  static description = 'Compare a run step by step with a baseline (default: the last passing run)'
  static examples = ['<%= config.bin %> runs diff <run-id>', '<%= config.bin %> runs diff <run-id> --baseline <other-run-id>']
  static args = {id: Args.string({description: 'Run id', required: true})}
  static flags = {...commonFlags, baseline: Flags.string({description: 'Baseline run id'})}

  async run() {
    const {args, flags} = await this.parse(RunsDiff)
    const query = flags.baseline ? {baselineRunId: flags.baseline} : {}
    const d = await apiGetSingle(this.client(), `/api/v1/runs/${args.id}/diff`, apiSchemas.RunDiffDto, {query})
    await this.finish({data: d, human: () => {
      this.log(`${d.readsAs}${d.baselineRunId ? ` · baseline ${d.baselineRunId} (${d.baselineKind})` : ''}`)
      for (const r of d.rows) {
        const delta = r.deltaMs !== null && r.deltaMs !== undefined ? ` ${r.deltaMs >= 0 ? '+' : ''}${r.deltaMs} ms` : ''
        this.log(`  ${String(r.index).padStart(3)} ${r.title} · ${r.verdict}${delta}`)
      }
    }})
  }
}
