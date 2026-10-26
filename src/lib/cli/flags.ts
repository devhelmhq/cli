/** Flags and argument helpers shared by the synthetics commands. */
import {Args, Flags} from '@oclif/core'
import {ValidationError} from '../errors.js'

export const monitorArg = Args.string({
  description: 'Monitor id, or its exact name (use --env when names repeat across environments)',
  required: true,
})

export const envFlag = Flags.string({description: 'Environment slug: narrows name resolution and selections'})

const DURATION_RE = /^(\d+)\s*(s|m|h|d|w)$/i
const UNIT_MS: Record<string, number> = {s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000}

/** `90s`, `10m`, `2h`, `14d` → milliseconds. */
export function parseDurationMs(input: string, flag = 'duration'): number {
  const m = DURATION_RE.exec(input.trim())
  if (!m) {
    const n = Number(input)
    if (Number.isFinite(n) && n >= 0) return n * 1000
    throw new ValidationError(`--${flag} must be a duration like 90s, 10m, 2h or 7d (got "${input}")`, {code: 'FIELD_INVALID_FORMAT'})
  }
  return Number(m[1]) * UNIT_MS[m[2]!.toLowerCase()]!
}

/** An ISO-8601 timestamp, or a duration from now (`2h`). Returns ISO. */
export function parseUntil(input: string, flag = 'until', now = Date.now()): string {
  if (DURATION_RE.test(input.trim())) return new Date(now + parseDurationMs(input, flag)).toISOString()
  const t = Date.parse(input)
  if (Number.isNaN(t)) {
    throw new ValidationError(`--${flag} must be an ISO-8601 time or a duration like 2h (got "${input}")`, {code: 'FIELD_INVALID_FORMAT'})
  }
  if (t <= now) throw new ValidationError(`--${flag} must be in the future (got "${input}")`, {code: 'FIELD_INVALID_FORMAT'})
  return new Date(t).toISOString()
}

/** `--since 24h` or an ISO time → ISO timestamp in the past. */
export function parseSince(input: string, now = Date.now()): string {
  if (DURATION_RE.test(input.trim())) return new Date(now - parseDurationMs(input, 'since')).toISOString()
  const t = Date.parse(input)
  if (Number.isNaN(t)) throw new ValidationError(`--since must be an ISO-8601 time or a duration like 24h (got "${input}")`, {code: 'FIELD_INVALID_FORMAT'})
  return new Date(t).toISOString()
}

export const timeoutFlag = (defaultValue: string) =>
  Flags.string({description: `How long to wait for runs to finish (default ${defaultValue}); the runs keep going after it`, default: defaultValue})
