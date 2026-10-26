/**
 * Waiting for runs (doc 42 §5.4): the SDK's `waitForRun` (SSE first, then
 * polling with Retry-After/backoff; returns the finished run whatever its
 * outcome; throws only `WaitTimeoutError`; never cancels the run). This
 * module adapts it to the CLI: the CLI's client, its generated `RunDto`
 * schema, and the registry SIGINT uses to cancel queued runs.
 */
import type {z} from 'zod'
import {waitForRun as sdkWaitForRun, DEFAULT_WAIT_TIMEOUT_MS} from '@devhelm/sdk'
import {apiGet, sdkClientFor, type ApiClient} from '../api-client.js'
import {schemas as apiSchemas} from '../api-zod.generated.js'
import {parse, parseSingle} from '../response-validation.js'
import {updateRunPhase} from './registry.js'

export type RunDto = z.infer<typeof apiSchemas.RunDto>
export type RunEventDto = z.infer<typeof apiSchemas.RunEventDto>

export interface WaitOptions {
  timeoutMs?: number
  signal?: AbortSignal
  /** Called for every streamed event (steps, phase changes). */
  onEvent?: (event: RunEventDto) => void
}

export async function getRun(client: ApiClient, runId: string): Promise<RunDto> {
  return parseSingle(apiSchemas.RunDto, await apiGet(client, `/api/v1/runs/${runId}`), `GET /api/v1/runs/${runId}`)
}

export async function waitForRun(client: ApiClient, runId: string, opts: WaitOptions = {}): Promise<RunDto> {
  const run = await sdkWaitForRun(sdkClientFor(client), runId, {
    timeoutMs: opts.timeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS,
    signal: opts.signal,
    onEvent: (event) => {
      const parsed = apiSchemas.RunEventDto.safeParse(event)
      if (!parsed.success) return
      const phase = parsed.data.payload.phase
      if (parsed.data.type === 'phase' && typeof phase === 'string') updateRunPhase(runId, phase)
      opts.onEvent?.(parsed.data)
    },
  })
  updateRunPhase(runId, run.phase)
  return parse(apiSchemas.RunDto, run, `GET /api/v1/runs/${runId}`)
}

/** Wait for several runs concurrently; each settles to a Run or the timeout error. */
export async function waitForRuns(
  client: ApiClient,
  runIds: string[],
  opts: WaitOptions = {},
): Promise<Array<{runId: string; run?: RunDto; error?: Error}>> {
  return Promise.all(runIds.map(async (runId) => {
    try {
      return {runId, run: await waitForRun(client, runId, opts)}
    } catch (error) {
      return {runId, error: error instanceof Error ? error : new Error(String(error))}
    }
  }))
}
