import {formatOutput} from '../../../lib/output.js'
import {Flags} from '@oclif/core'
import {schemas as apiSchemas} from '../../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../../lib/cli/command.js'
import {publicWriteFlags} from '../../../lib/cli/public-write.js'
import {runStatusPageWrite} from '../../../lib/cli/status-page-writes.js'
import {parse} from '../../../lib/response-validation.js'
import {SP_INCIDENT_IMPACTS, SP_INCIDENT_STATUSES} from '../../../lib/spec-facts.generated.js'
import {uuidArg} from '../../../lib/validators.js'

export default class StatusPagesIncidentsPublish extends DevhelmCommand {
  static legacyOutput = true
  static description = 'Publish a draft status page incident (gated like create); flags override the draft text'
  static examples = ['<%= config.bin %> status-pages incidents publish <page-id> <incident-id> --no-notify-subscribers']
  static args = {
    id: uuidArg({description: 'Status page ID', required: true}),
    'incident-id': uuidArg({description: 'Incident ID', required: true}),
  }
  static flags = {
    ...commonFlags,
    ...publicWriteFlags,
    title: Flags.string({description: 'Title to publish (default: the draft title)'}),
    impact: Flags.string({description: 'Impact to publish', options: [...SP_INCIDENT_IMPACTS]}),
    status: Flags.string({description: 'Status to publish', options: [...SP_INCIDENT_STATUSES]}),
    body: Flags.string({description: 'Body to publish (default: the draft body)'}),
  }

  async run() {
    const {args, flags} = await this.parse(StatusPagesIncidentsPublish)
    const text = {title: flags.title ?? null, impact: flags.impact ?? null, status: flags.status ?? null, body: flags.body ?? null}
    const data = await runStatusPageWrite(this.client(), {
      id: this.id, argv: this.argv, action: 'status_page_incident.publish', page: args.id, target: args['incident-id'],
      path: `/api/v1/status-pages/${args.id}/incidents/${args['incident-id']}/publish`, text,
      notifySubscribers: flags['notify-subscribers'], confirm: flags.confirm,
      build: (notifySubscribers) => parse(apiSchemas.PublishStatusPageIncidentRequest, {
        ...(flags.title ? {title: flags.title} : {}), ...(flags.impact ? {impact: flags.impact} : {}),
        ...(flags.status ? {status: flags.status} : {}), ...(flags.body ? {body: flags.body} : {}),
        notifySubscribers,
      }, 'Invalid publish request'),
    })
    await this.finish({data, human: () => this.log(formatOutput(data, 'table'))})
  }
}
