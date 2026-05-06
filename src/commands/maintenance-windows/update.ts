import {Command, Flags} from '@oclif/core'
import type {ZodType} from 'zod'
import {globalFlags, buildClient, display} from '../../lib/base-command.js'
import {apiGetSingle, apiPutSingle} from '../../lib/api-client.js'
import {schemas as apiSchemas} from '../../lib/api-zod.generated.js'
import type {components} from '../../lib/api.generated.js'
import {fieldDescriptions} from '../../lib/descriptions.generated.js'
import {parse as parseSchema} from '../../lib/response-validation.js'
import {uuidArg, uuidFlag} from '../../lib/validators.js'
import {buildMaintenanceWindowBody} from '../../lib/maintenance-windows.js'

type MaintenanceWindowDto = components['schemas']['MaintenanceWindowDto']

const desc = (field: string, fallback?: string) =>
  fieldDescriptions['UpdateMaintenanceWindowRequest']?.[field] ?? fallback ?? field

export default class MaintenanceWindowsUpdate extends Command {
  static description = 'Update a maintenance window'
  static examples = [
    '<%= config.bin %> maintenance-windows update <id> --reason "Rescheduled deploy"',
    '<%= config.bin %> maintenance-windows update <id> --start 2026-06-01T15:00:00Z --end 2026-06-01T15:30:00Z',
    '<%= config.bin %> maintenance-windows update <id> --monitor <uuid>',
  ]
  static args = {id: uuidArg({description: 'Maintenance window ID', required: true})}
  static flags = {
    ...globalFlags,
    start: Flags.string({description: desc('startsAt')}),
    end: Flags.string({description: desc('endsAt')}),
    reason: Flags.string({description: desc('reason') + ' (pass an empty string to clear)'}),
    monitor: uuidFlag({description: 'Reassign the window to a different monitor'}),
    'org-wide': Flags.boolean({
      description: 'Convert the window to org-wide (mutually exclusive with --monitor)',
      default: false,
      exclusive: ['monitor'],
    }),
    'repeat-rule': Flags.string({description: desc('repeatRule') + ' (empty string clears)'}),
    'suppress-alerts': Flags.boolean({description: desc('suppressAlerts'), allowNo: true}),
  }

  async run() {
    const {args, flags} = await this.parse(MaintenanceWindowsUpdate)
    const client = buildClient(flags)
    const path = `/api/v1/maintenance-windows/${args.id}`

    // The server's update DTO requires `startsAt` and `endsAt` (they're
    // not nullish on UpdateMaintenanceWindowRequest), but partial updates
    // are still useful — e.g. `--reason "Rescheduled"` alone. Fetch the
    // current window and back-fill any timestamp the user didn't pass so
    // the round-trip stays semantically a partial update.
    const existing = await apiGetSingle<MaintenanceWindowDto>(
      client,
      path,
      apiSchemas.MaintenanceWindowDto as ZodType<MaintenanceWindowDto>,
    )

    const built = buildMaintenanceWindowBody({
      start: flags.start ?? existing.startsAt,
      end: flags.end ?? existing.endsAt,
      reason: flags.reason,
      monitor: flags.monitor,
      orgWide: flags['org-wide'],
      repeatRule: flags['repeat-rule'],
      suppressAlerts: flags['suppress-alerts'],
    }, 'update')

    const body = parseSchema(
      apiSchemas.UpdateMaintenanceWindowRequest,
      built,
      'maintenance-window.update body invalid',
    )

    const updated = await apiPutSingle<MaintenanceWindowDto>(
      client,
      path,
      apiSchemas.MaintenanceWindowDto as ZodType<MaintenanceWindowDto>,
      body,
    )
    display(this, updated, flags.output)
  }
}
