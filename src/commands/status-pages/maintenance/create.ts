import {Command, Flags} from '@oclif/core'
import {globalFlags, buildClient, display} from '../../../lib/base-command.js'
import {apiPost, unwrapData} from '../../../lib/api-client.js'
import {SP_INCIDENT_IMPACTS, SP_INCIDENT_STATUSES} from '../../../lib/spec-facts.generated.js'
import {uuidArg} from '../../../lib/validators.js'

export default class StatusPagesMaintenanceCreate extends Command {
  static description = 'Schedule a maintenance window on a status page'
  static examples = [
    '<%= config.bin %> status-pages maintenance create <page-id> --title "DB upgrade" --impact MINOR --body "Read-only for 30m" --scheduled-for 2026-09-01T02:00:00Z',
  ]
  static args = {id: uuidArg({description: 'Status page ID', required: true})}
  static flags = {
    ...globalFlags,
    title: Flags.string({description: 'Customer-facing maintenance title', required: true}),
    impact: Flags.string({description: 'Impact level', required: true, options: [...SP_INCIDENT_IMPACTS]}),
    body: Flags.string({description: 'Initial update body in markdown', required: true}),
    'scheduled-for': Flags.string({description: 'Maintenance start time (ISO 8601)', required: true}),
    'scheduled-until': Flags.string({description: 'Maintenance end time (ISO 8601)'}),
    status: Flags.string({description: 'Initial status', options: [...SP_INCIDENT_STATUSES]}),
    'auto-resolve': Flags.boolean({description: 'Auto-resolve at scheduled-until (default: false)'}),
    'notify-subscribers': Flags.boolean({description: 'Email confirmed subscribers (default: true)', allowNo: true}),
  }

  async run() {
    const {args, flags} = await this.parse(StatusPagesMaintenanceCreate)
    const client = buildClient(flags)
    const body: Record<string, unknown> = {
      title: flags.title,
      impact: flags.impact,
      body: flags.body,
      scheduledFor: flags['scheduled-for'],
    }
    if (flags.status) body.status = flags.status
    if (flags['scheduled-until']) body.scheduledUntil = flags['scheduled-until']
    if (flags['auto-resolve']) body.autoResolve = true
    if (flags['notify-subscribers'] !== undefined) body.notifySubscribers = flags['notify-subscribers']
    const resp = await apiPost(client, `/api/v1/status-pages/${args.id}/maintenance`, body)
    display(this, unwrapData(resp), flags.output)
  }
}
