import {formatOutput} from '../../../lib/output.js'
import {Flags} from '@oclif/core'
import {schemas as apiSchemas} from '../../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../../lib/cli/command.js'
import {publicWriteFlags} from '../../../lib/cli/public-write.js'
import {runStatusPageWrite} from '../../../lib/cli/status-page-writes.js'
import {parse} from '../../../lib/response-validation.js'
import {SP_INCIDENT_STATUSES} from '../../../lib/spec-facts.generated.js'
import {uuidArg} from '../../../lib/validators.js'

export default class StatusPagesIncidentsPostUpdate extends DevhelmCommand {
  static legacyOutput = true
  static description = 'Post a public timeline update on a status page incident (gated like create)'
  static examples = [
    '<%= config.bin %> status-pages incidents post-update <page-id> <incident-id> --body "Fix deployed" --status MONITORING --no-notify-subscribers',
  ]
  static args = {
    id: uuidArg({description: 'Status page ID', required: true}),
    'incident-id': uuidArg({description: 'Incident ID', required: true}),
  }
  static flags = {
    ...commonFlags,
    ...publicWriteFlags,
    body: Flags.string({description: 'Update message', required: true}),
    status: Flags.string({description: 'New status', required: true, options: [...SP_INCIDENT_STATUSES]}),
  }

  async run() {
    const {args, flags} = await this.parse(StatusPagesIncidentsPostUpdate)
    const data = await runStatusPageWrite(this.client(), {
      id: this.id, argv: this.argv, action: 'status_page_incident.update', page: args.id, target: args['incident-id'],
      path: `/api/v1/status-pages/${args.id}/incidents/${args['incident-id']}/updates`,
      text: {body: flags.body, status: flags.status},
      notifySubscribers: flags['notify-subscribers'], confirm: flags.confirm,
      build: (notifySubscribers) => parse(apiSchemas.CreateStatusPageIncidentUpdateRequest, {body: flags.body, status: flags.status, notifySubscribers}, 'Invalid status page update'),
    })
    await this.finish({data, human: () => this.log(formatOutput(data, 'table'))})
  }
}
