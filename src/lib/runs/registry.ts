/**
 * Runs started by this invocation. On SIGINT/SIGTERM the base command
 * cancels the ones that have not started executing (D-8: "queued runs
 * started by this command are cancelled"), then exits 130.
 */
import {checkedFetch, type ApiClient} from '../api-client.js'

interface Started {
  client: ApiClient
  runId: string
  phase: string
}

const started = new Map<string, Started>()

const CANCELLABLE = new Set(['created', 'queued'])

export function registerStartedRun(client: ApiClient, runId: string, phase: string): void {
  started.set(runId, {client, runId, phase})
}

export function updateRunPhase(runId: string, phase: string): void {
  const s = started.get(runId)
  if (!s) return
  if (phase === 'finished') started.delete(runId)
  else s.phase = phase
}

export async function cancelStartedRuns(): Promise<string[]> {
  const cancelled: string[] = []
  const tasks = [...started.values()].filter((s) => CANCELLABLE.has(s.phase)).map(async (s) => {
    try {
      await checkedFetch(s.client.POST('/api/v1/runs/{id}/cancel', {params: {path: {id: s.runId}}}))
      cancelled.push(s.runId)
    } catch {
      // best effort while exiting
    }
  })
  await Promise.all(tasks)
  started.clear()
  return cancelled
}
