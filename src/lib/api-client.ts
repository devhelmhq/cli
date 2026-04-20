import createClient, {type Middleware} from 'openapi-fetch'
import type {PathsWithMethod} from 'openapi-typescript-helpers'
import type {paths, components} from './api.generated.js'
import {AuthError, DevhelmError, EXIT_CODES} from './errors.js'

export type {paths, components}

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body: string,
  ) {
    const parsed = ApiRequestError.parseBody(body)
    super(parsed)
    this.name = 'ApiRequestError'
  }

  private static parseBody(body: string): string {
    try {
      const json = JSON.parse(body) as Record<string, unknown>
      const msg = json.message ?? json.error
      return typeof msg === 'string' ? msg : body
    } catch {
      return body || 'Unknown API error'
    }
  }

  toTypedError(): DevhelmError {
    if (this.status === 401 || this.status === 403) {
      return new AuthError(`Authentication failed: ${this.message}`)
    }

    if (this.status === 404) {
      return new DevhelmError(this.message, EXIT_CODES.NOT_FOUND)
    }

    return new DevhelmError(this.message, EXIT_CODES.API)
  }
}

// Backward-compatible wrapper types matching the API response shapes
export interface TableResponse<T> {
  data: T[]
  hasNext?: boolean
  hasPrev?: boolean
}

export interface CursorPage<T> {
  data: T[]
  nextCursor?: string | null
  hasMore?: boolean
}

export interface SingleResponse<T> {
  data: T
}

export function createApiClient(opts: {
  baseUrl: string
  token: string
  orgId?: string
  workspaceId?: string
  verbose?: boolean
}) {
  const client = createClient<paths>({
    baseUrl: opts.baseUrl.replace(/\/$/, ''),
    headers: {
      Authorization: `Bearer ${opts.token}`,
      'Content-Type': 'application/json',
      'x-phelm-org-id': opts.orgId ?? process.env.DEVHELM_ORG_ID ?? '1',
      'x-phelm-workspace-id': opts.workspaceId ?? process.env.DEVHELM_WORKSPACE_ID ?? '1',
    },
  })

  if (opts.verbose) {
    const logger: Middleware = {
      async onRequest({request}) {
        process.stderr.write(`${request.method} ${request.url}\n`)
        return request
      },
    }
    client.use(logger)
  }

  return client
}

export type ApiClient = ReturnType<typeof createApiClient>

/**
 * Unwrap an openapi-fetch response: returns `data` on success, throws a typed
 * DevhelmError on failure (AuthError for 401/403, NOT_FOUND for 404, API for others).
 * Every client.GET / POST / PUT / DELETE call should be wrapped with this.
 *
 * Trade-off: the returned `data` is cast as `T` with no runtime validation.
 * This avoids the cost of parsing every response through Zod, which matters
 * for high-frequency paths (list/get). The type safety relies on the OpenAPI
 * spec staying in sync with the server — compile-time only.
 *
 * For critical paths where a shape mismatch could cause silent misbehavior
 * (e.g. entitlement checks gating deploy), callers should add explicit Zod
 * validation after this call. See `response-schemas.ts` for those schemas.
 */
export async function checkedFetch<T>(promise: Promise<{data?: T; error?: unknown; response: Response}>): Promise<T> {
  const {data, error, response} = await promise
  if (error || !response.ok) {
    const body = typeof error === 'object' && error !== null ? JSON.stringify(error) : String(error ?? 'Unknown error')
    const apiError = new ApiRequestError(response.status, response.statusText, body)
    throw apiError.toTypedError()
  }
  return data as T
}

// ── Dynamic-path helpers ────────────────────────────────────────────────
//
// openapi-fetch requires literal path strings for compile-time type
// inference.  When paths are built at runtime (CRUD factory, YAML
// applier), the literal inference breaks.  These helpers centralize
// the assertion: the path is cast to the correct per-method path union
// (e.g. GETPath), and the options object is cast to `never` — the
// bottom type that satisfies any parameter shape without opening the
// door to unrelated type leaks the way `as any` would.

type GETPath = PathsWithMethod<paths, 'get'>
type POSTPath = PathsWithMethod<paths, 'post'>
type PUTPath = PathsWithMethod<paths, 'put'>
type PATCHPath = PathsWithMethod<paths, 'patch'>
type DELETEPath = PathsWithMethod<paths, 'delete'>

export function apiGet<T>(client: ApiClient, path: string, params?: object): Promise<T> {
  return checkedFetch<T>(client.GET(path as GETPath, (params ? {params} : {}) as never))
}

export function apiPost<T>(client: ApiClient, path: string, body: object): Promise<T> {
  return checkedFetch<T>(client.POST(path as POSTPath, {body} as never))
}

export function apiPut<T>(client: ApiClient, path: string, body: object): Promise<T> {
  return checkedFetch<T>(client.PUT(path as PUTPath, {body} as never))
}

export function apiPatch<T>(client: ApiClient, path: string, body: object): Promise<T> {
  return checkedFetch<T>(client.PATCH(path as PATCHPath, {body} as never))
}

export function apiDelete(client: ApiClient, path: string): Promise<unknown> {
  return checkedFetch(client.DELETE(path as DELETEPath, {params: {path: {}}} as never))
}
