import {Args} from '@oclif/core'
import {apiPostSingle} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'

export default class IncidentsAcknowledge extends DevhelmCommand {
  static description = 'Acknowledge an incident: stops escalation of its pending notifications'
  static aliases = ['incidents:ack']
  static examples = ['<%= config.bin %> incidents acknowledge <incident-id>', '<%= config.bin %> incidents ack <incident-id>']
  static args = {id: Args.string({description: 'Incident id', required: true})}
  static flags = {...commonFlags}

  async run() {
    const {args} = await this.parse(IncidentsAcknowledge)
    const resp = await apiPostSingle(this.client(), `/api/v1/incidents/${args.id}/acknowledge`, apiSchemas.AcknowledgeAllIncidentsResponse)
    await this.finish({data: resp, human: () =>
      this.log(`Acknowledged incident ${args.id}: ${resp.acknowledged.length} notification(s) acknowledged, ${resp.skipped.length} skipped.`)})
  }
}
