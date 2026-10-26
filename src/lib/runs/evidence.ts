/**
 * Run evidence readers shared by the `runs …` commands. Schemas are the
 * generated ones; free-form JSON maps (`RunStepDto.assertion`) are widened
 * to a recursive JSON value, since the generator renders them as maps of
 * objects and real assertion details carry numbers and strings.
 */
import {z} from 'zod'
import {apiGet, apiGetPage, type ApiClient} from '../api-client.js'
import {schemas as apiSchemas} from '../api-zod.generated.js'
import type {JsonValue} from '../errors.js'
import {parsePage} from '../response-validation.js'

export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(JsonValueSchema), z.record(JsonValueSchema)]),
)

export const RunStepSchema = apiSchemas.RunStepDto.extend({assertion: z.record(JsonValueSchema).nullish()})
export const RunCaseSchema = apiSchemas.RunCaseDto.extend({steps: z.array(RunStepSchema)})

export type RunStep = z.infer<typeof RunStepSchema>
export type RunCase = z.infer<typeof RunCaseSchema>

export async function listRunCases(client: ApiClient, runId: string, attempt?: number): Promise<RunCase[]> {
  const query: Record<string, number> = {}
  if (attempt !== undefined) query.attempt = attempt
  const resp = await apiGet(client, `/api/v1/runs/${runId}/cases`, {query})
  return parsePage(RunCaseSchema, resp, `GET /api/v1/runs/${runId}/cases`).data
}

export async function listRunArtifacts(client: ApiClient, runId: string) {
  return (await apiGetPage(client, `/api/v1/runs/${runId}/artifacts`, apiSchemas.RunArtifactDto)).data
}

const STEP_SYMBOL: Record<string, string> = {
  passed: '✓', slow: '✓', failed: '✗', timed_out: '✗', skipped: '-', suppressed: '-', never_reached: '·', pending: '·', running: '…',
}

/** `  ✓ goto /login (0.8 s)` lines for every case and step. */
export function stepLines(cases: RunCase[]): string[] {
  const out: string[] = []
  for (const c of cases) {
    out.push(`▸ ${c.title}${c.file ? ` · ${c.file}` : ''} · ${c.status}`)
    for (const s of c.steps) {
      const dur = s.durationMs !== null && s.durationMs !== undefined ? ` (${(s.durationMs / 1000).toFixed(1)} s)` : ''
      out.push(`  ${STEP_SYMBOL[s.status] ?? '?'} ${s.title}${dur}${s.status === 'slow' ? ' slow' : ''}`)
      if (s.error) out.push(`      ${s.error.split('\n')[0]}`)
    }
  }
  return out
}
