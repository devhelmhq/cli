import createClient, {type Middleware} from 'openapi-fetch'
import type {paths, components} from './api.generated.js'
import {handleApiError} from './errors.js'

export type {paths, components}
export type Schemas = components['schemas']

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
}

export function createApiClient(opts: {
  baseUrl: string
  token: string
  orgId?: string
  workspaceId?: string
  verbose?: boolean
}) {
  const orgId = opts.orgId ?? process.env.DEVHELM_ORG_ID
  const workspaceId = opts.workspaceId ?? process.env.DEVHELM_WORKSPACE_ID

  const headers: Record<string, string> = {
    Authorization: `Bearer ${opts.token}`,
    'Content-Type': 'application/json',
  }
  if (orgId) headers['x-phelm-org-id'] = orgId
  if (workspaceId) headers['x-phelm-workspace-id'] = workspaceId

  const client = createClient<paths>({
    baseUrl: opts.baseUrl.replace(/\/$/, ''),
    headers,
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
 * Unwrap an openapi-fetch response: returns `data` on success, throws on failure.
 * Routes API errors through handleApiError for structured exit codes.
 */
export async function checkedFetch<T>(promise: Promise<{data?: T; error?: unknown; response: Response}>): Promise<T> {
  const {data, error, response} = await promise
  if (error || !response.ok) {
    const body = typeof error === 'object' ? JSON.stringify(error) : String(error ?? 'Unknown error')
    handleApiError(new ApiRequestError(response.status, response.statusText, body))
  }
  return data as T
}

/**
 * Unwrap the `{ data: T }` envelope used by SingleValueResponse / TableValueResult.
 * Returns the inner payload when present, or the full response if not wrapped.
 */
export function unwrap<T>(resp: unknown): T {
  if (resp && typeof resp === 'object' && 'data' in resp) {
    return (resp as {data: T}).data
  }
  return resp as T
}
