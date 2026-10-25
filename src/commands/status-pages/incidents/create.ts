import {formatOutput} from '../../../lib/output.js'
import {Flags} from '@oclif/core'
import {schemas as apiSchemas} from '../../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../../lib/cli/command.js'
import {publicWriteFlags} from '../../../lib/cli/public-write.js'
import {runStatusPageWrite} from '../../../lib/cli/status-page-writes.js'
import {ValidationError} from '../../../lib/errors.js'
import {parse} from '../../../lib/response-validation.js'
import {SP_INCIDENT_IMPACTS, SP_INCIDENT_STATUSES} from '../../../lib/spec-facts.generated.js'
import {uuidArg} from '../../../lib/validators.js'

export default class StatusPagesIncidentsCreate extends DevhelmCommand {
  static legacyOutput = true
  static description =
    'Create a public incident on a status page. Without a TTY: pass --notify-subscribers or --no-notify-subscribers, then confirm with the printed --confirm token'
  static examples = [
    '<%= config.bin %> status-pages incidents create <page-id> --title "Checkout errors" --impact MAJOR --body "Investigating" --no-notify-subscribers',
  ]
  static args = {id: uuidArg({description: 'Status page ID', required: true})}
  static flags = {
    ...commonFlags,
    ...publicWriteFlags,
    title: Flags.string({description: 'Incident title', required: true}),
    impact: Flags.string({description: 'Incident impact', required: true, options: [...SP_INCIDENT_IMPACTS]}),
    body: Flags.string({description: 'Initial update body in markdown', required: true}),
    status: Flags.string({description: 'Incident status', options: [...SP_INCIDENT_STATUSES]}),
    'monitoring-incident': Flags.string({description: 'Internal incident this public incident communicates'}),
    scheduled: Flags.boolean({description: 'Removed. Use `status-pages maintenance create` instead.', hidden: true}),
  }

  async run() {
    const {args, flags} = await this.parse(StatusPagesIncidentsCreate)
    if (flags.scheduled) {
      throw new ValidationError('`--scheduled` is no longer valid on incident create. Use `devhelm status-pages maintenance create` instead.')
    }
    const text = {title: flags.title, impact: flags.impact, body: flags.body, status: flags.status ?? null}
    const data = await runStatusPageWrite(this.client(), {
      id: this.id, argv: this.argv, action: 'status_page_incident.create', page: args.id,
      path: `/api/v1/status-pages/${args.id}/incidents`, text,
      notifySubscribers: flags['notify-subscribers'], confirm: flags.confirm,
      build: (notifySubscribers) => parse(apiSchemas.CreateStatusPageIncidentRequest, {
        title: flags.title, impact: flags.impact, body: flags.body,
        ...(flags.status ? {status: flags.status} : {}),
        ...(flags['monitoring-incident'] ? {monitoringIncidentId: flags['monitoring-incident']} : {}),
        notifySubscribers,
      }, 'Invalid status page incident'),
    })
    await this.finish({data, human: () => this.log(formatOutput(data, 'table'))})
  }
}
