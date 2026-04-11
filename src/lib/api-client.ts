import createClient, {type Middleware} from 'openapi-fetch'
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
      const json = JSON.parse(body)
      return json.message || json.error || body
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
  hasNext?: boolean
  hasPrev?: boolean
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
// openapi-fetch requires literal path strings for type inference.  When
// paths are constructed at runtime (CRUD factory, YAML applier), this
// breaks.  These helpers centralize the single `as any` cast — every
// call site uses a clean, typed API.

/* eslint-disable @typescript-eslint/no-explicit-any */

export function apiGet<T>(client: ApiClient, path: string, params?: object): Promise<T> {
  return checkedFetch<T>(client.GET(path as any, (params ? {params} : {}) as any))
}

export function apiPost<T>(client: ApiClient, path: string, body: object): Promise<T> {
  return checkedFetch<T>(client.POST(path as any, {body} as any))
}

export function apiPut<T>(client: ApiClient, path: string, body: object): Promise<T> {
  return checkedFetch<T>(client.PUT(path as any, {body} as any))
}

export function apiPatch<T>(client: ApiClient, path: string, body: object): Promise<T> {
  return checkedFetch<T>(client.PATCH(path as any, {body} as any))
}

export function apiDelete(client: ApiClient, path: string): Promise<unknown> {
  return checkedFetch(client.DELETE(path as any, {params: {path: {}}} as any))
}

/* eslint-enable @typescript-eslint/no-explicit-any */
