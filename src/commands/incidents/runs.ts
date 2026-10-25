import {Args, Flags} from '@oclif/core'
import {apiGetCursorPage} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'
import {failureLines, runLine} from '../../lib/runs/outcome.js'
import type {RunDto} from '../../lib/runs/wait.js'

export default class IncidentsRuns extends DevhelmCommand {
  static description = 'List the runs that caused or contributed to an incident'
  static examples = ['<%= config.bin %> incidents runs <incident-id>']
  static args = {id: Args.string({description: 'Incident id', required: true})}
  static flags = {...commonFlags, limit: Flags.integer({description: 'Maximum runs', default: 25, min: 1, max: 500})}

  async run() {
    const {args, flags} = await this.parse(IncidentsRuns)
    const runs: RunDto[] = []
    let cursor: string | undefined
    while (runs.length < flags.limit) {
      const page = await apiGetCursorPage(this.client(), `/api/v1/incidents/${args.id}/runs`, apiSchemas.RunDto, {
        query: {limit: Math.min(100, flags.limit - runs.length), ...(cursor ? {cursor} : {})},
      })
      runs.push(...page.data)
      if (!page.hasMore || !page.nextCursor) break
      cursor = page.nextCursor
    }
    await this.finish({data: runs, human: () => {
      if (runs.length === 0) this.log('No runs linked to this incident.')
      for (const r of runs) {
        this.log(runLine(r))
        for (const l of failureLines(r)) this.log(`    ${l}`)
      }
    }})
  }
}
