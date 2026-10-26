import {Args, Flags} from '@oclif/core'
import {apiPatchSingle} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'
import {ValidationError} from '../../lib/errors.js'
import {parse} from '../../lib/response-validation.js'

export default class IncidentsUpdate extends DevhelmCommand {
  static description = 'Change an incident\'s title or severity'
  static examples = ['<%= config.bin %> incidents update <incident-id> --severity DEGRADED']
  static args = {id: Args.string({description: 'Incident id', required: true})}
  static flags = {
    ...commonFlags,
    title: Flags.string({description: 'New title'}),
    severity: Flags.string({description: 'New severity', options: ['DOWN', 'DEGRADED', 'MAINTENANCE']}),
  }

  async run() {
    const {args, flags} = await this.parse(IncidentsUpdate)
    if (flags.title === undefined && flags.severity === undefined) {
      throw new ValidationError('Pass --title and/or --severity', {code: 'FIELD_REQUIRED'})
    }
    const body = parse(apiSchemas.UpdateIncidentRequest, {
      ...(flags.title !== undefined ? {title: flags.title} : {}),
      ...(flags.severity !== undefined ? {severity: flags.severity} : {}),
    }, 'Invalid incident update')
    const detail = await apiPatchSingle(this.client(), `/api/v1/incidents/${args.id}`, apiSchemas.IncidentDetailDto, body)
    await this.finish({data: detail, human: () => this.log(`Incident '${detail.incident.title ?? args.id}' updated (${detail.incident.severity}).`)})
  }
}
