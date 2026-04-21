import createClient, {type Middleware} from 'openapi-fetch'
import type {PathsWithMethod} from 'openapi-typescript-helpers'
import type {ZodType} from 'zod'
import type {paths, components} from './api.generated.js'
import {AuthError, DevhelmError, EXIT_CODES} from './errors.js'
import {parseSingle, parsePage, parseCursorPage, type Page, type CursorPage as ValidatedCursorPage} from './response-validation.js'

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
 * Unwrap an openapi-fetch response: returns the raw JSON body as `unknown`
 * on success, throws a typed DevhelmError on failure (AuthError for 401/403,
 * NOT_FOUND for 404, API for others).
 *
 * Callers MUST validate the returned `unknown` through a Zod schema (use
 * `apiGetSingle` / `apiGetPage` / `apiGetCursorPage` from this module, or
 * roll their own with `parseSingle` / `parsePage` from
 * `response-validation.ts`). The previous `data as T` cast was a P5
 * violation that hid spec drift behind silent type-only assertions.
 */
export async function checkedFetch(
  promise: Promise<{data?: unknown; error?: unknown; response: Response}>,
): Promise<unknown> {
  const {data, error, response} = await promise
  if (error || !response.ok) {
    const body = typeof error === 'object' && error !== null ? JSON.stringify(error) : String(error ?? 'Unknown error')
    const apiError = new ApiRequestError(response.status, response.statusText, body)
    throw apiError.toTypedError()
  }
  return data
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

export function apiGet(client: ApiClient, path: string, params?: object): Promise<unknown> {
  return checkedFetch(client.GET(path as GETPath, (params ? {params} : {}) as never))
}

export function apiPost(client: ApiClient, path: string, body?: object): Promise<unknown> {
  return checkedFetch(client.POST(path as POSTPath, (body ? {body} : {}) as never))
}

export function apiPut(client: ApiClient, path: string, body: object): Promise<unknown> {
  return checkedFetch(client.PUT(path as PUTPath, {body} as never))
}

export function apiPatch(client: ApiClient, path: string, body: object): Promise<unknown> {
  return checkedFetch(client.PATCH(path as PATCHPath, {body} as never))
}

export function apiDelete(client: ApiClient, path: string): Promise<unknown> {
  return checkedFetch(client.DELETE(path as DELETEPath, {params: {path: {}}} as never))
}

/**
 * Best-effort `{data: ...}` envelope unwrap for callers that don't have a
 * Zod schema yet and just pass the body to `display()` (which renders any
 * shape). Returns `data` when the response is an object with that key,
 * otherwise the response itself. Use `parseSingle` from
 * `response-validation.ts` (or `apiGetSingle` here) when a schema is
 * available — that path raises on unknown fields and gives typed output.
 */
export function unwrapData(resp: unknown): unknown {
  if (resp && typeof resp === 'object' && 'data' in resp) {
    return (resp as {data?: unknown}).data ?? resp
  }
  return resp
}

// ── Validated wrappers ─────────────────────────────────────────────────
//
// These are the recommended public helpers — pass the per-resource Zod
// schema (typically `apiSchemas.<DtoName>`) and receive a typed value
// where unknown response fields raise loudly (P1) and shape mismatches
// throw a typed `ValidationError` with a path into the offending field.

export async function apiGetSingle<T>(client: ApiClient, path: string, schema: ZodType<T>, params?: object): Promise<T> {
  return parseSingle(schema, await apiGet(client, path, params), `GET ${path}`)
}

export async function apiPostSingle<T>(client: ApiClient, path: string, schema: ZodType<T>, body?: object): Promise<T> {
  return parseSingle(schema, await apiPost(client, path, body), `POST ${path}`)
}

export async function apiPutSingle<T>(client: ApiClient, path: string, schema: ZodType<T>, body: object): Promise<T> {
  return parseSingle(schema, await apiPut(client, path, body), `PUT ${path}`)
}

export async function apiPatchSingle<T>(client: ApiClient, path: string, schema: ZodType<T>, body: object): Promise<T> {
  return parseSingle(schema, await apiPatch(client, path, body), `PATCH ${path}`)
}

export async function apiGetPage<T>(
  client: ApiClient,
  path: string,
  schema: ZodType<T>,
  params?: object,
): Promise<Page<T>> {
  return parsePage(schema, await apiGet(client, path, params), `GET ${path}`)
}

export async function apiGetCursorPage<T>(
  client: ApiClient,
  path: string,
  schema: ZodType<T>,
  params?: object,
): Promise<ValidatedCursorPage<T>> {
  return parseCursorPage(schema, await apiGet(client, path, params), `GET ${path}`)
}
