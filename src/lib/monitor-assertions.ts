/**
 * Helpers for the `--assertion` flag on `devhelm monitors create`
 * (DevEx P1.Bug2). Two input forms are accepted:
 *
 *   1. JSON form — full passthrough so any of the ~40 assertion types in
 *      the spec can be expressed:
 *        --assertion '{"severity":"fail","config":{"type":"status_code",
 *                      "expected":"200","operator":"equals"}}'
 *
 *   2. Shorthand DSL — the three most common assertions, written
 *      operator-style. Implemented as a tiny ad-hoc parser (no
 *      tokenizer, no schema) because the surface is intentionally
 *      narrow. Anything more elaborate should use the JSON form.
 *        status_code=200       → fail / status_code equals 200
 *        response_time<5000    → warn / response_time thresholdMs 5000
 *        ssl_expiry>=14        → warn / ssl_expiry minDaysRemaining 14
 *
 * After the monitor is created the CLI POSTs each parsed assertion to
 * `/api/v1/monitors/{id}/assertions`. If any POST fails the monitor is
 * deleted to avoid a half-configured state — see `applyAssertions`.
 */
import type {ApiClient} from './api-client.js'
import {apiPost, apiDelete} from './api-client.js'

export interface ParsedAssertion {
  severity: 'fail' | 'warn'
  config: Record<string, unknown>
}

const DSL_RE = /^([a-z_]+)\s*(>=|<=|<|>|=)\s*(.+?)\s*$/i

export function parseAssertionFlag(raw: string): ParsedAssertion {
  const trimmed = raw.trim()
  if (trimmed.length === 0) {
    throw new Error('--assertion: empty value')
  }
  // `{` and `[` both look like JSON to the user — route them through the
  // JSON parser so the error message is structural ("must be an object")
  // instead of the generic "cannot parse" from the DSL fallback.
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return parseJsonForm(trimmed)
  }
  return parseDslForm(trimmed)
}

function parseJsonForm(raw: string): ParsedAssertion {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`--assertion: invalid JSON — ${msg}`)
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('--assertion JSON must be an object with {severity, config}')
  }
  const obj = parsed as Record<string, unknown>
  const severity = obj.severity ?? 'fail'
  if (severity !== 'fail' && severity !== 'warn') {
    throw new Error(`--assertion JSON: severity must be "fail" or "warn", got ${JSON.stringify(severity)}`)
  }
  if (!obj.config || typeof obj.config !== 'object' || Array.isArray(obj.config)) {
    throw new Error('--assertion JSON: missing or invalid `config` object')
  }
  const config = obj.config as Record<string, unknown>
  if (typeof config.type !== 'string' || config.type.length === 0) {
    throw new Error('--assertion JSON: config.type is required (e.g. "status_code", "response_time")')
  }
  return {severity, config}
}

function parseDslForm(raw: string): ParsedAssertion {
  const match = raw.match(DSL_RE)
  if (!match) {
    throw new Error(
      `--assertion: cannot parse "${raw}" — expected JSON object or DSL like ` +
      `"status_code=200", "response_time<5000", "ssl_expiry>=14"`,
    )
  }
  const [, type, op, value] = match
  switch (type) {
    case 'status_code':
      if (op !== '=') {
        throw new Error(`--assertion status_code only supports "=" (got "${op}")`)
      }
      return {
        severity: 'fail',
        config: {type: 'status_code', expected: value, operator: 'equals'},
      }
    case 'response_time': {
      if (op !== '<') {
        throw new Error(`--assertion response_time only supports "<" (got "${op}")`)
      }
      const ms = Number(value)
      if (!Number.isFinite(ms) || ms <= 0 || !Number.isInteger(ms)) {
        throw new Error(
          `--assertion response_time threshold must be a positive integer (got "${value}")`,
        )
      }
      return {severity: 'warn', config: {type: 'response_time', thresholdMs: ms}}
    }
    case 'ssl_expiry': {
      if (op !== '>=') {
        throw new Error(`--assertion ssl_expiry only supports ">=" (got "${op}")`)
      }
      const days = Number(value)
      if (!Number.isFinite(days) || days <= 0 || !Number.isInteger(days)) {
        throw new Error(
          `--assertion ssl_expiry days must be a positive integer (got "${value}")`,
        )
      }
      return {
        severity: 'warn',
        config: {type: 'ssl_expiry', minDaysRemaining: days},
      }
    }
    default:
      throw new Error(
        `--assertion DSL only supports status_code, response_time, ssl_expiry. ` +
        `Use the JSON form for "${type}", e.g. ` +
        `--assertion '{"severity":"fail","config":{"type":"${type}",...}}'`,
      )
  }
}

/**
 * POST each assertion to `/api/v1/monitors/{id}/assertions`. If any
 * call fails, delete the monitor so the user isn't left with a partial
 * setup — better to fail loudly and re-run than to ship a monitor with
 * a different alert profile than what the YAML/CLI invocation requested.
 *
 * The cleanup is best-effort: if the rollback DELETE itself fails (rare,
 * usually a transient API hiccup) we surface the original assertion
 * error and append a hint about the orphaned monitor so the operator can
 * clean it up by hand.
 */
export async function applyAssertions(
  monitorId: string,
  assertions: readonly ParsedAssertion[],
  client: ApiClient,
  monitorPath: string = '/api/v1/monitors',
): Promise<void> {
  const path = `${monitorPath}/${monitorId}/assertions`
  for (const [idx, a] of assertions.entries()) {
    try {
      await apiPost(client, path, a)
    } catch (err) {
      const cleanup = await rollbackMonitor(monitorId, monitorPath, client)
      const original = err instanceof Error ? err.message : String(err)
      const tail = cleanup
        ? 'Monitor was rolled back.'
        : `Monitor ${monitorId} could NOT be rolled back automatically — delete it manually if it still exists.`
      const assertionType =
        typeof a.config.type === 'string' ? a.config.type : 'unknown'
      throw new Error(
        `Failed to apply --assertion #${idx + 1} (${assertionType}): ${original}. ${tail}`,
      )
    }
  }
}

async function rollbackMonitor(
  monitorId: string,
  monitorPath: string,
  client: ApiClient,
): Promise<boolean> {
  try {
    await apiDelete(client, `${monitorPath}/${monitorId}`)
    return true
  } catch {
    return false
  }
}
