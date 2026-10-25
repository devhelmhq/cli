/**
 * `<monitor>` resolution for every `monitors …` verb (doc 42 §6.1, W0-6).
 *
 *   - a UUID → `GET /monitors/{id}`;
 *   - otherwise an exact, case-sensitive name, optionally narrowed by
 *     `--env <slug>`, through `GET /monitors?name=&environmentId=`.
 *
 * Zero matches → exit 4 with "did you mean" suggestions (from `search`).
 * Several → exit 4 listing `id, type, environment, owner`.
 */
import type {z} from 'zod'
import {apiGet, type ApiClient} from '../api-client.js'
import {schemas as apiSchemas} from '../api-zod.generated.js'
import {NotFoundError, ValidationError} from '../errors.js'
import {parsePage, parseSingle} from '../response-validation.js'

export type MonitorDto = z.infer<typeof apiSchemas.MonitorDto>
export type EnvironmentDto = z.infer<typeof apiSchemas.EnvironmentDto>

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}

/** BROWSER and MULTI_STEP_API: the SDK's guard, the one definition the CLI uses. */
export {isCodeMonitorType as isCodeType} from '@devhelm/sdk'

/** Owner label: `GIT · acme/web`, `TERRAFORM`, `DASHBOARD`. `CLI` reads as `GIT` (R13). */
export function ownerLabel(m: Pick<MonitorDto, 'managedBy' | 'owner'>): string {
  const type = m.owner?.type ?? m.managedBy
  const shown = type === 'CLI' ? 'GIT' : type
  const project = m.owner?.project
  return project ? `${shown} · ${project}` : String(shown ?? '')
}

const envCache = new WeakMap<ApiClient, Map<string, Promise<EnvironmentDto>>>()

/** `GET /environments/{slug}`; an unknown slug is exit 4 `ENVIRONMENT_NOT_FOUND`. */
export function resolveEnvironment(client: ApiClient, slug: string): Promise<EnvironmentDto> {
  let byClient = envCache.get(client)
  if (!byClient) {
    byClient = new Map()
    envCache.set(client, byClient)
  }
  const hit = byClient.get(slug)
  if (hit) return hit
  const p = (async () => {
    try {
      return parseSingle(apiSchemas.EnvironmentDto, await apiGet(client, `/api/v1/environments/${encodeURIComponent(slug)}`), `GET /api/v1/environments/${slug}`)
    } catch (err) {
      if (err instanceof NotFoundError) {
        throw new NotFoundError(`Environment "${slug}" not found`, {
          code: 'ENVIRONMENT_NOT_FOUND',
          requestId: err.requestId,
          next: {command: 'devhelm environments list', docs: null},
        })
      }
      throw err
    }
  })()
  byClient.set(slug, p)
  return p
}

export async function getMonitor(client: ApiClient, id: string): Promise<MonitorDto> {
  try {
    return parseSingle(apiSchemas.MonitorDto, await apiGet(client, `/api/v1/monitors/${id}`), `GET /api/v1/monitors/${id}`)
  } catch (err) {
    if (err instanceof NotFoundError) {
      throw new NotFoundError(`Monitor ${id} not found`, {code: err.code ?? 'MONITOR_NOT_FOUND', requestId: err.requestId})
    }
    throw err
  }
}

/** List monitors whose name is exactly `name` (optionally in one environment). */
export async function findMonitorsByName(client: ApiClient, name: string, environmentId?: string): Promise<MonitorDto[]> {
  const out: MonitorDto[] = []
  for (let page = 0; page < 50; page++) {
    const query: Record<string, string | number> = {name, search: name, page, size: 100}
    if (environmentId) query.environmentId = environmentId
    const resp = parsePage(apiSchemas.MonitorDto, await apiGet(client, '/api/v1/monitors', {query}), 'GET /api/v1/monitors')
    for (const m of resp.data) {
      if (m.name !== name) continue
      if (environmentId && m.environment?.id !== environmentId) continue
      out.push(m)
    }
    if (!resp.hasNext) break
  }
  return out
}

async function suggestions(client: ApiClient, name: string): Promise<string[]> {
  const terms = [name, ...name.split(/[\s_-]+/).filter((t) => t.length >= 3)].slice(0, 3)
  const seen = new Set<string>()
  for (const term of terms) {
    try {
      const resp = parsePage(apiSchemas.MonitorDto, await apiGet(client, '/api/v1/monitors', {query: {search: term, page: 0, size: 10}}), 'GET /api/v1/monitors')
      for (const m of resp.data) seen.add(m.name)
    } catch {
      // suggestions are best-effort
    }
    if (seen.size >= 5) break
  }
  return [...seen].slice(0, 5)
}

export interface ResolveOptions {
  env?: string
}

/** Resolve `<monitor>` to exactly one monitor or throw an exit-4 error. */
export async function resolveMonitor(client: ApiClient, ref: string, opts: ResolveOptions = {}): Promise<MonitorDto> {
  if (isUuid(ref)) return getMonitor(client, ref)
  const env = opts.env ? await resolveEnvironment(client, opts.env) : undefined
  const matches = await findMonitorsByName(client, ref, env?.id)
  if (matches.length === 1) return matches[0]!
  if (matches.length === 0) {
    const close = await suggestions(client, ref)
    const hint = close.length > 0 ? ` Did you mean: ${close.map((n) => `"${n}"`).join(', ')}?` : ''
    throw new NotFoundError(`No monitor named "${ref}"${env ? ` in environment ${env.slug}` : ''}.${hint}`, {
      code: 'MONITOR_NOT_FOUND',
      details: {name: ref, suggestions: close},
      next: {command: 'devhelm monitors list', docs: null},
    })
  }
  const rows = matches.map((m) => ({
    id: m.id,
    type: m.type,
    environment: m.environment?.slug ?? null,
    owner: ownerLabel(m),
  }))
  const listing = rows.map((r) => `  ${r.id}  ${r.type}  ${r.environment ?? '-'}  ${r.owner}`).join('\n')
  throw new ValidationError(`${matches.length} monitors are named "${ref}". Pass an id or --env <slug>:\n${listing}`, {
    code: 'MONITOR_AMBIGUOUS',
    details: {matches: rows},
  })
}
