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
   * we surface that via empty string only (`null` on the wire clears it).
   * The update API is a full-replace PUT: omission clears or resets the
   * field, so `update` overlays these flags on the existing window via
   * `buildMaintenanceWindowUpdateBody`.
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

/** The fields of an existing window that a full-replace PUT must carry over. */
export interface ExistingMaintenanceWindow {
  monitorId?: string | null
  startsAt: string
  endsAt: string
  repeatRule?: string | null
  suppressAlerts?: boolean | null
  reason?: string | null
}

/**
 * Body for `update`: the existing window overlaid with the flags given.
 * The API's PUT is full-replace, so every field the user did not pass is
 * taken from the existing window; otherwise a single-monitor window would
 * silently become org-wide and reason/repeatRule/suppressAlerts would reset.
 */
export function buildMaintenanceWindowUpdateBody(
  existing: ExistingMaintenanceWindow,
  flags: MaintenanceWindowFlags,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    startsAt: existing.startsAt,
    endsAt: existing.endsAt,
    monitorId: existing.monitorId ?? null,
  }
  if (existing.reason != null) body.reason = existing.reason
  if (existing.repeatRule != null) body.repeatRule = existing.repeatRule
  if (existing.suppressAlerts != null) body.suppressAlerts = existing.suppressAlerts
  return {...body, ...buildMaintenanceWindowBody(flags, 'update')}
}
