/**
 * `meta{org, workspace, plan}` and the human header line
 * `<org> · workspace <ws> · <plan>` (doc 42 §6.1), from `/auth/me` and
 * `/entitlements`, fetched once per invocation. Each part is best-effort:
 * a token that `/auth/me` does not describe (a dashboard session) still
 * runs the command, with the unknown parts left null.
 */
import {z} from 'zod'
import {apiGet, type ApiClient} from '../api-client.js'
import {schemas as apiSchemas} from '../api-zod.generated.js'
import {DevhelmError} from '../errors.js'
import {parseSingle, parsePage} from '../response-validation.js'

export type AuthMe = z.infer<typeof apiSchemas.AuthMeResponse>
export type Entitlements = z.infer<typeof apiSchemas.EntitlementResponse>

export interface Meta {
  org: {id: number; name: string} | null
  workspace: {id: number; name: string} | null
  plan: string | null
  key: {id: number; name: string; scopes: string[]; expiresAt: string | null} | null
}

export interface MetaSources {
  me: AuthMe | null
  entitlements: Entitlements | null
}

/**
 * `/auth/me` describes API keys only: a dashboard session or run token gets
 * a 4xx there ("requires API key authentication"), which leaves that part
 * of `meta` null. Transport and platform failures are real failures.
 */
function notDescribed(err: unknown): null {
  if (err instanceof DevhelmError && err.status !== null && err.status >= 400 && err.status < 500 && err.status !== 429) return null
  throw err
}

const cache = new WeakMap<ApiClient, Promise<MetaSources>>()

export function loadMetaSources(client: ApiClient): Promise<MetaSources> {
  const hit = cache.get(client)
  if (hit) return hit
  const p = (async (): Promise<MetaSources> => {
    const [me, entitlements] = await Promise.all([
      apiGet(client, '/api/v1/auth/me').then((r) => parseSingle(apiSchemas.AuthMeResponse, r, 'GET /api/v1/auth/me')).catch(notDescribed),
      apiGet(client, '/api/v1/entitlements').then((r) => parseSingle(apiSchemas.EntitlementResponse, r, 'GET /api/v1/entitlements')).catch(notDescribed),
    ])
    return {me, entitlements}
  })()
  cache.set(client, p)
  return p
}

export async function fetchMeta(client: ApiClient): Promise<Meta> {
  const {me, entitlements} = await loadMetaSources(client)
  const wsHeader = client.options.workspaceId ?? process.env.DEVHELM_WORKSPACE_ID
  let workspace: Meta['workspace'] = null
  try {
    const page = parsePage(apiSchemas.WorkspaceDto, await apiGet(client, '/api/v1/workspaces', {query: {page: 0, size: 100}}), 'GET /api/v1/workspaces')
    const match = wsHeader ? page.data.find((w) => String(w.id) === String(wsHeader)) : page.data[0]
    if (match) workspace = {id: Number(match.id), name: match.name}
  } catch {
    if (wsHeader) workspace = {id: Number(wsHeader), name: String(wsHeader)}
  }
  return {
    org: me ? {id: me.organization.id, name: me.organization.name} : null,
    workspace,
    plan: entitlements?.tier ?? me?.plan.tier ?? null,
    key: me ? {id: me.key.id, name: me.key.name, scopes: me.key.scopes, expiresAt: me.key.expiresAt ?? null} : null,
  }
}
