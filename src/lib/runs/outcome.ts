/**
 * Outcome → exit code and one-line run rendering (doc 32 D-3).
 *
 *   passed (incl. flaky)                       → 0
 *   failed, timed_out                          → 14
 *   execution_error, inconclusive, cancelled,
 *   not finished before --timeout              → 19
 *
 * Mixed results take the precedence 14 > 19 > 0. `--fail-on-infra-error=false`
 * downgrades 19 to a warning. Clients branch on `flaky`, never on the
 * string `passed_on_retry` (R6); until the server sends `flaky`, a
 * `passed_on_retry` outcome is read as a flaky pass.
 */
import {EXIT_CODES} from '../errors.js'
import type {RunDto} from './wait.js'

export type Verdict = 'passed' | 'failed' | 'no_verdict' | 'pending'

export function isFlaky(run: RunDto): boolean {
  const flaky = (run as {flaky?: unknown}).flaky
  if (typeof flaky === 'boolean') return flaky
  return run.outcome === 'passed_on_retry'
}

export function verdictOf(run: RunDto | undefined): Verdict {
  if (!run || run.phase !== 'finished') return run ? 'pending' : 'no_verdict'
  switch (run.outcome) {
    case 'passed':
    case 'passed_on_retry':
      return 'passed'
    case 'failed':
    case 'timed_out':
      return 'failed'
    default:
      return 'no_verdict'
  }
}

export function exitForVerdicts(verdicts: Verdict[], opts: {failOnInfraError?: boolean} = {}): number {
  if (verdicts.includes('failed')) return EXIT_CODES.CHECK_FAILED
  const noVerdict = verdicts.some((v) => v === 'no_verdict' || v === 'pending')
  if (noVerdict && opts.failOnInfraError !== false) return EXIT_CODES.NO_VERDICT
  return EXIT_CODES.SUCCESS
}

export function runSymbol(run: RunDto | undefined): string {
  const v = verdictOf(run)
  if (v === 'passed') return run && isFlaky(run) ? '~' : '✓'
  if (v === 'failed') return '✗'
  return '?'
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return ''
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(1)} s`
}

/** `queued (position 4) · starts by 19:21` (D-8). */
export function queueLine(run: RunDto): string {
  const parts = [run.phase]
  if (run.queuePosition !== null && run.queuePosition !== undefined) parts[0] = `${run.phase} (position ${run.queuePosition})`
  if (run.startDeadlineAt) {
    const d = new Date(run.startDeadlineAt)
    parts.push(`starts by ${d.toISOString().slice(11, 16)}`)
  }
  return parts.join(' · ')
}

/** One human line for a run: `✓ us-east · 4.6 s · run_7c1e · <url>`. */
export function runLine(run: RunDto): string {
  const sym = runSymbol(run)
  const state = run.phase === 'finished'
    ? `${run.outcome ?? 'finished'}${isFlaky(run) ? ' (flaky)' : ''}`
    : queueLine(run)
  const bits = [`${sym} ${run.region}`, state, formatDuration(run.durationMs), run.id, run.url ?? ''].filter(Boolean)
  return bits.join(' · ')
}

/** Failure detail lines: message and the user's own file:line. */
export function failureLines(run: RunDto): string[] {
  const out: string[] = []
  const f = run.failure
  if (f) {
    const where = f.file ? ` · ${f.file}${f.line ? `:${f.line}` : ''}` : ''
    out.push(`${f.message ?? f.kind}${where}`)
  } else if (run.headline && verdictOf(run) !== 'passed') {
    out.push(run.headline)
  }
  if (verdictOf(run) === 'no_verdict' && run.billable === false) out.push('not billed')
  if (verdictOf(run) !== 'passed') out.push(`next: devhelm runs get ${run.id} --steps`)
  return out
}
