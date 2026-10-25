/** `N runs billed · M remaining` from `GET /synthetics/usage` (doc 42 §6.3). */
import {apiGetSingle, type ApiClient} from '../api-client.js'
import {schemas as apiSchemas} from '../api-zod.generated.js'
import type {RunDto} from './wait.js'

export function billedCount(runs: Array<RunDto | undefined>): number {
  return runs.filter((r) => r && r.billable).length
}

export async function usageLine(client: ApiClient, billed: number, label = 'runs billed'): Promise<{line: string; remaining: number | null}> {
  try {
    const u = await apiGetSingle(client, '/api/v1/synthetics/usage', apiSchemas.SyntheticsUsagePeriodDto)
    const left = (m: {used: number; included?: number | null}) => (m.included === null || m.included === undefined ? null : Math.max(0, m.included - m.used))
    const b = left(u.browser)
    const a = left(u.api)
    const remaining = b === null && a === null ? null : (b ?? 0) + (a ?? 0)
    const parts = [`${billed} ${billed === 1 ? label.replace('runs', 'run') : label}`]
    if (b !== null || a !== null) {
      const fmt = (n: number) => n.toLocaleString('en-US')
      parts.push([b !== null ? `${fmt(b)} browser` : '', a !== null ? `${fmt(a)} API` : ''].filter(Boolean).join(' · ') + ' remaining')
    } else {
      parts.push('unlimited')
    }
    return {line: parts.join(' · '), remaining}
  } catch {
    return {line: `${billed} ${label}`, remaining: null}
  }
}
