/**
 * Follow runs a command started: register them for SIGINT cancel, wait
 * (SSE, then polling) unless `--no-wait`, print one line per run and
 * compute the exit code with the precedence 14 > 19 > 0.
 */
import type {ApiClient} from '../api-client.js'
import {WaitTimeoutError} from '../errors.js'
import {exitForVerdicts, failureLines, isFlaky, queueLine, runLine, verdictOf, type Verdict} from './outcome.js'
import {registerStartedRun} from './registry.js'
import {waitForRun, type RunDto} from './wait.js'

export interface FollowOptions {
  wait: boolean
  timeoutMs: number
  failOnInfraError?: boolean
  /** Human output sink (table mode); undefined in structured mode. */
  log?: (line: string) => void
}

export interface FollowResult {
  runs: RunDto[]
  exit: number
  runsContinue: boolean
  warnings: string[]
}

export async function followRuns(client: ApiClient, started: RunDto[], opts: FollowOptions): Promise<FollowResult> {
  for (const r of started) registerStartedRun(client, r.id, r.phase)
  const warnings: string[] = []
  if (!opts.wait) {
    for (const r of started) opts.log?.(`  ${r.region} · ${queueLine(r)} · ${r.id}${r.url ? ` · ${r.url}` : ''}`)
    return {runs: started, exit: 0, runsContinue: true, warnings}
  }
  let runsContinue = false
  const results = await Promise.all(started.map(async (r) => {
    try {
      return await waitForRun(client, r.id, {timeoutMs: opts.timeoutMs})
    } catch (err) {
      if (err instanceof WaitTimeoutError) {
        runsContinue = true
        warnings.push(err.message)
        return {...r, phase: err.phase}
      }
      throw err
    }
  }))
  const verdicts: Verdict[] = []
  for (const run of results) {
    const v = verdictOf(run)
    verdicts.push(v === 'pending' ? 'no_verdict' : v)
    opts.log?.(`  ${runLine(run)}`)
    if (v !== 'passed') for (const l of failureLines(run)) opts.log?.(`      ${l}`)
    if (v === 'passed' && isFlaky(run)) warnings.push(`Run ${run.id} passed after a retry (flaky)`)
  }
  let exit = exitForVerdicts(verdicts, {failOnInfraError: opts.failOnInfraError})
  if (exit === 0 && verdicts.some((v) => v === 'no_verdict') && opts.failOnInfraError === false) {
    warnings.push('Some runs reached no verdict; --fail-on-infra-error=false keeps the exit at 0')
  }
  if (runsContinue && exit === 0) exit = 19
  return {runs: results, exit, runsContinue, warnings}
}
