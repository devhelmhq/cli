import {formatOutput} from '../../../lib/output.js'
import {Flags} from '@oclif/core'
import {schemas as apiSchemas} from '../../../lib/api-zod.generated.js'
import {DevhelmCommand, commonFlags} from '../../../lib/cli/command.js'
import {publicWriteFlags} from '../../../lib/cli/public-write.js'
import {runStatusPageWrite} from '../../../lib/cli/status-page-writes.js'
import {parse} from '../../../lib/response-validation.js'
import {SP_INCIDENT_IMPACTS, SP_INCIDENT_STATUSES} from '../../../lib/spec-facts.generated.js'
import {uuidArg} from '../../../lib/validators.js'

export default class StatusPagesMaintenanceCreate extends DevhelmCommand {
  static legacyOutput = true
  static description = 'Schedule a public maintenance window on a status page (gated like incident create)'
  static examples = [
    '<%= config.bin %> status-pages maintenance create <page-id> --title "DB upgrade" --impact MINOR --body "Read-only for 30m" --scheduled-for 2026-09-01T02:00:00Z --no-notify-subscribers',
  ]
  static args = {id: uuidArg({description: 'Status page ID', required: true})}
  static flags = {
    ...commonFlags,
    ...publicWriteFlags,
    title: Flags.string({description: 'Customer-facing maintenance title', required: true}),
    impact: Flags.string({description: 'Impact level', required: true, options: [...SP_INCIDENT_IMPACTS]}),
    body: Flags.string({description: 'Initial update body in markdown', required: true}),
    'scheduled-for': Flags.string({description: 'Maintenance start time (ISO 8601)', required: true}),
    'scheduled-until': Flags.string({description: 'Maintenance end time (ISO 8601)'}),
    status: Flags.string({description: 'Initial status', options: [...SP_INCIDENT_STATUSES]}),
    'auto-resolve': Flags.boolean({description: 'Auto-resolve at scheduled-until (default: false)'}),
  }

  async run() {
    const {args, flags} = await this.parse(StatusPagesMaintenanceCreate)
    const text = {
      title: flags.title, impact: flags.impact, body: flags.body,
      scheduledFor: flags['scheduled-for'], scheduledUntil: flags['scheduled-until'] ?? null,
    }
    const data = await runStatusPageWrite(this.client(), {
      id: this.id, argv: this.argv, action: 'status_page_maintenance.create', page: args.id,
      path: `/api/v1/status-pages/${args.id}/maintenance`, text,
      notifySubscribers: flags['notify-subscribers'], confirm: flags.confirm,
      build: (notifySubscribers) => parse(apiSchemas.CreateStatusPageMaintenanceRequest, {
        title: flags.title, impact: flags.impact, body: flags.body, scheduledFor: flags['scheduled-for'],
        ...(flags.status ? {status: flags.status} : {}),
        ...(flags['scheduled-until'] ? {scheduledUntil: flags['scheduled-until']} : {}),
        ...(flags['auto-resolve'] ? {autoResolve: true} : {}),
        notifySubscribers,
      }, 'Invalid maintenance window'),
    })
    await this.finish({data, human: () => this.log(formatOutput(data, 'table'))})
  }
}
