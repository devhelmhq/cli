/**
 * `POST /api/v1/monitors/{id}/test` answers with a body that depends on the
 * monitor type:
 *
 *   - 200 `MonitorTestResultDto` — uptime monitors (HTTP, TCP, DNS, ICMP,
 *     MCP) run once through the probe; nothing is stored. The command prints
 *     this body exactly as before.
 *   - 202 `RunDto` — browser and multi-step API monitors queue a validation
 *     run that does not vote on health.
 *
 * Optional body `CodeTestTargetRequest` picks the environment and region of
 * that run; each defaults to the monitor's own.
 */
import type {z} from 'zod'
import {schemas as apiSchemas} from './api-zod.generated.js'
import {parse, parseSingle} from './response-validation.js'

type RunDto = z.infer<typeof apiSchemas.RunDto>
export type CodeTestTargetRequest = z.infer<typeof apiSchemas.CodeTestTargetRequest>

export interface MonitorTestTargetFlags {
  'environment-id'?: string
  region?: string
}

/** Build the optional request body from flags; `undefined` sends no body. */
export function buildCodeTestTarget(flags: MonitorTestTargetFlags): CodeTestTargetRequest | undefined {
  const body: CodeTestTargetRequest = {}
  if (flags['environment-id'] !== undefined) body.environmentId = flags['environment-id']
  if (flags.region !== undefined) body.region = flags.region
  if (Object.keys(body).length === 0) return undefined
  return parse(apiSchemas.CodeTestTargetRequest, body, 'Invalid monitor test target')
}

/**
 * Validate a 202 body as the queued run. Returns `undefined` for any other
 * status, whose body the command prints unchanged.
 */
export function queuedRunFrom(status: number, body: unknown, context: string): RunDto | undefined {
  if (status !== 202) return undefined
  return parseSingle(apiSchemas.RunDto, body, context)
}
