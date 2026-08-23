import {Command, Flags} from '@oclif/core'
import {globalFlags, buildClient, display} from '../../../lib/base-command.js'
import {apiPut, unwrapData} from '../../../lib/api-client.js'
import {SP_INCIDENT_IMPACTS, SP_INCIDENT_STATUSES} from '../../../lib/spec-facts.generated.js'
import {uuidArg} from '../../../lib/validators.js'

export default class StatusPagesMaintenanceUpdate extends Command {
  static description = 'Update a status page maintenance window'
  static examples = [
    '<%= config.bin %> status-pages maintenance update <page-id> <window-id> --scheduled-until 2026-09-01T04:00:00Z',
  ]
  static args = {
    id: uuidArg({description: 'Status page ID', required: true}),
    'window-id': uuidArg({description: 'Maintenance window ID', required: true}),
  }
  static flags = {
    ...globalFlags,
    title: Flags.string({description: 'Maintenance title'}),
    impact: Flags.string({description: 'Impact level', options: [...SP_INCIDENT_IMPACTS]}),
    status: Flags.string({description: 'Status', options: [...SP_INCIDENT_STATUSES]}),
    'scheduled-for': Flags.string({description: 'New start time (ISO 8601)'}),
    'scheduled-until': Flags.string({description: 'New end time (ISO 8601)'}),
    'auto-resolve': Flags.boolean({description: 'Auto-resolve at scheduled-until', allowNo: true}),
  }

  async run() {
    const {args, flags} = await this.parse(StatusPagesMaintenanceUpdate)
    const client = buildClient(flags)
    const body: Record<string, unknown> = {}
    if (flags.title) body.title = flags.title
    if (flags.impact) body.impact = flags.impact
    if (flags.status) body.status = flags.status
    if (flags['scheduled-for']) body.scheduledFor = flags['scheduled-for']
    if (flags['scheduled-until']) body.scheduledUntil = flags['scheduled-until']
    if (flags['auto-resolve'] !== undefined) body.autoResolve = flags['auto-resolve']
    const resp = await apiPut(client, `/api/v1/status-pages/${args.id}/maintenance/${args['window-id']}`, body)
    display(this, unwrapData(resp), flags.output)
  }
}
