import createClient, {type Middleware} from 'openapi-fetch'
import type {paths, components} from './api.generated.js'

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
 * Unwrap an openapi-fetch response: returns `data` on success, throws `ApiRequestError` on failure.
 * Every client.GET / POST / PUT / DELETE call should be wrapped with this.
 */
export async function checkedFetch<T>(promise: Promise<{data?: T; error?: unknown; response: Response}>): Promise<T> {
  const {data, error, response} = await promise
  if (error || !response.ok) {
    const body = typeof error === 'object' && error !== null ? JSON.stringify(error) : String(error ?? 'Unknown error')
    throw new ApiRequestError(response.status, response.statusText, body)
  }
  return data as T
}
