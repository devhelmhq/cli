import {Command, Flags} from '@oclif/core'
import type {ZodType} from 'zod'
import {globalFlags, buildClient, display} from '../../lib/base-command.js'
import {apiPostSingle} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import type {components} from '../../lib/api.generated.js'
import {fieldDescriptions} from '../../lib/descriptions.generated.js'
import {parse as parseSchema} from '../../lib/response-validation.js'
import {uuidFlag} from '../../lib/validators.js'
import {buildMaintenanceWindowBody} from '../../lib/maintenance-windows.js'

type MaintenanceWindowDto = components['schemas']['MaintenanceWindowDto']

const desc = (field: string, fallback?: string) =>
  fieldDescriptions['CreateMaintenanceWindowRequest']?.[field] ?? fallback ?? field

export default class MaintenanceWindowsCreate extends Command {
  static description = 'Schedule a new maintenance window'
  static examples = [
    '<%= config.bin %> maintenance-windows create --start 2026-06-01T14:00:00Z --end 2026-06-01T14:30:00Z --reason "Deploy" --monitor <uuid>',
    '<%= config.bin %> maintenance-windows create --start 2026-06-01T14:00:00Z --end 2026-06-01T14:30:00Z --reason "Org-wide outage" --org-wide',
  ]
  static flags = {
    ...globalFlags,
    start: Flags.string({description: desc('startsAt'), required: true}),
    end: Flags.string({description: desc('endsAt'), required: true}),
    reason: Flags.string({description: desc('reason')}),
    monitor: uuidFlag({description: 'Monitor ID this window applies to'}),
    'org-wide': Flags.boolean({
      description: 'Apply this window to every monitor in the org (mutually exclusive with --monitor)',
      default: false,
      exclusive: ['monitor'],
    }),
    'repeat-rule': Flags.string({description: desc('repeatRule')}),
    'suppress-alerts': Flags.boolean({
      description: desc('suppressAlerts'),
      allowNo: true,
    }),
  }

  async run() {
    const {flags} = await this.parse(MaintenanceWindowsCreate)
    const client = buildClient(flags)

    if (!flags.monitor && !flags['org-wide']) {
      this.error('Pass --monitor <uuid> or --org-wide to scope the window.', {exit: 2})
    }

    const built = buildMaintenanceWindowBody({
      start: flags.start,
      end: flags.end,
      reason: flags.reason,
      monitor: flags.monitor,
      orgWide: flags['org-wide'],
      repeatRule: flags['repeat-rule'],
      suppressAlerts: flags['suppress-alerts'],
    }, 'create')

    const body = parseSchema(
      apiSchemas.CreateMaintenanceWindowRequest,
      built,
      'maintenance-window.create body invalid',
    )

    const created = await apiPostSingle<MaintenanceWindowDto>(
      client,
      '/api/v1/maintenance-windows',
      apiSchemas.MaintenanceWindowDto as ZodType<MaintenanceWindowDto>,
      body,
    )
    display(this, created, flags.output)
  }
}
