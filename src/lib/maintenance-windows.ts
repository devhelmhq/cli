/**
 * Shared body builder for `maintenance-windows create` / `update`.
 *
 * Both commands map identical flags onto `CreateMaintenanceWindowRequest`
 * / `UpdateMaintenanceWindowRequest`. The two request DTOs have the
 * same field set today (server requires `startsAt` / `endsAt` on
 * update too), so a single builder keeps the flag → body mapping
 * in one place.
 */

export interface MaintenanceWindowFlags {
  start?: string
  end?: string
  reason?: string
  monitor?: string
  orgWide?: boolean
  repeatRule?: string
  suppressAlerts?: boolean
  /**
   * `update` mode also accepts an explicit "clear" intent, e.g. when
   * the user passes `--reason ""` to wipe a previous value. Today
   * we surface that via empty string only — keeping the API's nullish
   * semantics (`null` clears the field, omission preserves it).
   */
}

type Mode = 'create' | 'update'

/**
 * Returns a plain `Record<string, unknown>` ready to be parsed against
 * the matching Zod schema. Empty `--reason ""` is normalised to `null`
 * so the user can explicitly clear the field on update; on create the
 * server treats `null` and omission identically.
 */
export function buildMaintenanceWindowBody(
  flags: MaintenanceWindowFlags,
  _mode: Mode,
): Record<string, unknown> {
  const body: Record<string, unknown> = {}

  if (flags.start !== undefined) body.startsAt = flags.start
  if (flags.end !== undefined) body.endsAt = flags.end

  // `--monitor` and `--org-wide` are mutually exclusive at the flag
  // layer (the create command also runs an explicit guard); here we
  // just translate one or the other into the wire field.
  if (flags.orgWide) {
    body.monitorId = null
  } else if (flags.monitor !== undefined) {
    body.monitorId = flags.monitor
  }

  if (flags.reason !== undefined) {
    body.reason = flags.reason === '' ? null : flags.reason
  }

  if (flags.repeatRule !== undefined) {
    body.repeatRule = flags.repeatRule === '' ? null : flags.repeatRule
  }

  if (flags.suppressAlerts !== undefined) {
    body.suppressAlerts = flags.suppressAlerts
  }

  return body
}
