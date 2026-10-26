import {Args, Flags} from '@oclif/core'
import {apiPostSingle} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../lib/cli/command.js'
import {parse} from '../../lib/response-validation.js'

export default class IncidentsAddUpdate extends DevhelmCommand {
  static description =
    'Add a timeline update to an incident. Internal by default; --notify-subscribers also notifies status page subscribers'
  static examples = [
    '<%= config.bin %> incidents add-update <incident-id> --body "Rolled back the deploy"',
    '<%= config.bin %> incidents add-update <incident-id> --body "Resolved" --status RESOLVED',
  ]
  static args = {id: Args.string({description: 'Incident id', required: true})}
  static flags = {
    ...commonFlags,
    'notify-subscribers': Flags.boolean({description: 'Also notify status page subscribers (default false)', default: false}),
    body: Flags.string({description: 'Update text (markdown)', required: true}),
    status: Flags.string({description: 'New status', options: ['WATCHING', 'TRIGGERED', 'CONFIRMED', 'RESOLVED']}),
  }

  async run() {
    const {args, flags} = await this.parse(IncidentsAddUpdate)
    const notify = flags['notify-subscribers'] === true
    const body = parse(apiSchemas.AddIncidentUpdateRequest, {
      body: flags.body,
      ...(flags.status ? {newStatus: flags.status} : {}),
      notifySubscribers: notify,
    }, 'Invalid incident update')
    const detail = await apiPostSingle(this.client(), `/api/v1/incidents/${args.id}/updates`, apiSchemas.IncidentDetailDto, body)
    await this.finish({data: detail, human: () => this.log(`Added an update to incident '${detail.incident.title ?? args.id}' (${detail.incident.status}).`)})
  }
}
