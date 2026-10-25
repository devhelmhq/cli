import {Args, Flags} from '@oclif/core'
import {apiGet} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'
import {incidentLine} from '../../lib/cli/incident-format.js'
import {parse} from '../../lib/response-validation.js'

export default class IncidentsRelated extends DevhelmCommand {
  static description = 'List incidents related to this one (same monitor, overlapping window)'
  static examples = ['<%= config.bin %> incidents related <incident-id> --window-days 7']
  static args = {id: Args.string({description: 'Incident id', required: true})}
  static flags = {
    ...commonFlags,
    'window-days': Flags.integer({description: 'Days around the incident to search'}),
    limit: Flags.integer({description: 'Maximum incidents'}),
  }

  async run() {
    const {args, flags} = await this.parse(IncidentsRelated)
    const query: Record<string, number> = {}
    if (flags['window-days'] !== undefined) query.windowDays = flags['window-days']
    if (flags.limit !== undefined) query.limit = flags.limit
    const resp = parse(apiSchemas.RelatedIncidentsResponse, await apiGet(this.client(), `/api/v1/incidents/${args.id}/related`, {query}), `GET /api/v1/incidents/${args.id}/related`)
    await this.finish({data: resp, human: () => {
      this.log(`${resp.total} related incident(s)`)
      for (const i of resp.data) this.log(`  ${incidentLine(i)}`)
    }})
  }
}
