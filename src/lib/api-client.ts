import {createHash, randomUUID} from 'node:crypto'
import createClient, {type Middleware} from 'openapi-fetch'
import type {PathsWithMethod} from 'openapi-typescript-helpers'
import type {ZodType} from 'zod'
import type {paths, components} from './api.generated.js'
import {Devhelm, errorFromResponse as sdkErrorFromResponse, parseRetryAfter as sdkParseRetryAfter} from '@devhelm/sdk'
import {DevhelmError, TransportError} from './errors.js'
import {parseSingle, parsePage, parseCursorPage, type Page, type CursorPage as ValidatedCursorPage} from './response-validation.js'
import {buildSurfaceHeaders, CLI_VERSION} from './surface-telemetry.js'

export type {paths, components}

// ── Error envelope parsing ─────────────────────────────────────────────

/**
 * The typed error for a non-2xx response: the SDK's mapper (one class per
 * `ErrorResponse` category, every field carried; a body without a
 * category gets one from the status). `body` is the parsed JSON or text.
 */
export function errorFromResponse(body: unknown, response: Response): DevhelmError {
  const text = typeof body === 'string' ? body : body === undefined ? '' : JSON.stringify(body)
  return sdkErrorFromResponse(response.status, text, {
    requestId: response.headers.get('x-request-id') ?? undefined,
    retryAfter: response.headers.get('retry-after') ?? undefined,
  })
}

// ── Invocation context: idempotency keys and client header ─────────────

/**
 * One CLI invocation. `Idempotency-Key` values are derived from it so a
 * transport retry of the same request replays, while every logical POST
 * in the invocation gets its own key (doc 32 D-7): in GitHub Actions the
 * seed is `sha256(GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT, command)`, elsewhere a
 * random UUID per invocation. `--idempotency-key` pins the first POST's
 * key; later POSTs in the same invocation append an ordinal.
 */
interface InvocationContext {
  command: string
  seed: string
  explicitKey?: string
  counter: Map<string, number>
  posts: number
}

let invocation: InvocationContext = newInvocation('cli')

function newInvocation(command: string, explicitKey?: string): InvocationContext {
  const runId = process.env.GITHUB_RUN_ID
  const attempt = process.env.GITHUB_RUN_ATTEMPT
  const seed = runId
    ? createHash('sha256').update(`${runId}\n${attempt ?? '1'}\n${command}`).digest('hex')
    : randomUUID()
  return {command, seed, explicitKey, counter: new Map(), posts: 0}
}

/** Called once per command invocation (from the base command's init). */
export function beginInvocation(command: string, explicitKey?: string): void {
  invocation = newInvocation(command, explicitKey)
}

/** Next `Idempotency-Key` for a POST to `target` in this invocation. */
export function nextIdempotencyKey(method: string, target: string): string {
  const n = invocation.posts++
  if (invocation.explicitKey) return n === 0 ? invocation.explicitKey : `${invocation.explicitKey}-${n}`
  const k = `${method} ${target}`
  const occurrence = invocation.counter.get(k) ?? 0
  invocation.counter.set(k, occurrence + 1)
  return createHash('sha256').update(`${invocation.seed}\n${k}\n${occurrence}`).digest('hex')
}

export const CLIENT_HEADER = `cli/${CLI_VERSION}`

// ── Retries (doc 42 §5.2) ──────────────────────────────────────────────

export const MAX_ATTEMPTS = 5
const RETRY_CAP_MS = 30_000

/** Overridable sleep so tests don't wait for real backoff. */
export const retryClock = {
  sleep: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  baseMs: Number(process.env.DEVHELM_RETRY_BASE_MS ?? 500),
}

/** `Retry-After` in milliseconds (the SDK parser gives seconds). */
export function parseRetryAfter(value: string | null): number | undefined {
  const seconds = sdkParseRetryAfter(value)
  return seconds === null ? undefined : seconds * 1000
}

function backoffMs(attempt: number, retryAfterMs: number | undefined): number {
  if (retryAfterMs !== undefined) return Math.min(RETRY_CAP_MS, retryAfterMs)
  const exp = retryClock.baseMs * 2 ** (attempt - 1)
  const jitter = Math.random() * retryClock.baseMs
  return Math.min(RETRY_CAP_MS, exp + jitter)
}

const RETRYABLE_CONFLICTS = new Set(['DEPLOY_LOCKED', 'IDEMPOTENCY_KEY_IN_PROGRESS'])

async function isRetryableConflict(res: Response): Promise<boolean> {
  try {
    const body = (await res.clone().json()) as Record<string, unknown>
    return body.retryable === true || (typeof body.code === 'string' && RETRYABLE_CONFLICTS.has(body.code))
  } catch {
    return false
  }
}

/** Header that tells the retry layer to leave 409 handling to the caller. */
export const NO_CONFLICT_RETRY_HEADER = 'x-devhelm-cli-no-conflict-retry'

/**
 * `fetch` with the D-7 retry policy: 429 and 503, plus `retryable: true`
 * 409s (`DEPLOY_LOCKED`, `IDEMPOTENCY_KEY_IN_PROGRESS`), honouring
 * `Retry-After`, at most 5 attempts with jitter. A POST is retried only
 * with an idempotency key. A transport failure surfaces at once as
 * `TransportError` (exit 12).
 */
export async function fetchWithRetry(request: Request): Promise<Response> {
  const method = request.method.toUpperCase()
  const replayable = method !== 'POST' || request.headers.has('Idempotency-Key')
  const noConflictRetry = request.headers.has(NO_CONFLICT_RETRY_HEADER)
  const headers = new Headers(request.headers)
  headers.delete(NO_CONFLICT_RETRY_HEADER)
  // Buffer the body once so every attempt sends a fresh Request.
  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer()
  const build = () => new Request(request.url, {method, headers, body, signal: request.signal})
  for (let attempt = 1; ; attempt++) {
    const last = attempt >= MAX_ATTEMPTS || !replayable
    let res: Response
    try {
      res = await fetch(build())
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      throw new TransportError(`${method} ${new URL(request.url).pathname}: ${message}`, {cause: cause instanceof Error ? cause : undefined})
    }
    if (last) return res
    const retry =
      res.status === 429 || res.status === 503 ||
      (res.status === 409 && !noConflictRetry && (await isRetryableConflict(res)))
    if (!retry) return res
    await retryClock.sleep(backoffMs(attempt, parseRetryAfter(res.headers.get('retry-after'))))
  }
}

export interface ApiClientOptions {
  baseUrl: string
  token: string
  orgId?: string
  workspaceId?: string
  verbose?: boolean
}

/** Headers every call carries: auth, scope, client and telemetry. */
export function baseHeaders(opts: ApiClientOptions): Record<string, string> {
  const workspaceId = opts.workspaceId ?? process.env.DEVHELM_WORKSPACE_ID
  const headers: Record<string, string> = {
    Authorization: `Bearer ${opts.token}`,
    'x-phelm-org-id': opts.orgId ?? process.env.DEVHELM_ORG_ID ?? '1',
    'X-DevHelm-Client': CLIENT_HEADER,
    // Devtool surface telemetry — see lib/surface-telemetry.ts and
    // https://devhelm.io/telemetry. Empty object when the user has set
    // DEVHELM_TELEMETRY=0; otherwise four short identification headers.
    ...buildSurfaceHeaders(),
  }
  if (workspaceId) headers['x-phelm-workspace-id'] = workspaceId
  return headers
}

const idempotencyMiddleware: Middleware = {
  async onRequest({request}) {
    if (request.method.toUpperCase() === 'POST' && !request.headers.has('Idempotency-Key')) {
      request.headers.set('Idempotency-Key', nextIdempotencyKey('POST', new URL(request.url).pathname))
    }
    return request
  },
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

export function createApiClient(opts: ApiClientOptions) {
  const client = createClient<paths>({
    baseUrl: opts.baseUrl.replace(/\/$/, ''),
    headers: {...baseHeaders(opts), 'Content-Type': 'application/json'},
    fetch: fetchWithRetry,
  })
  client.use(idempotencyMiddleware)

  if (opts.verbose) {
    const logger: Middleware = {
      async onRequest({request}) {
        process.stderr.write(`${request.method} ${request.url}\n`)
        return request
      },
    }
    client.use(logger)
  }

  return Object.assign(client, {options: opts})
}

export type ApiClient = ReturnType<typeof createApiClient>

/**
 * Unwrap an openapi-fetch response. On a 2xx, returns whatever
 * openapi-fetch decoded into `data` — typed as `TData` because the
 * generic flows from the input promise's `data?: TData` field. On a
 * non-2xx response, throws the category error for the `ErrorResponse`
 * (`ValidationError`, `NotFoundError`, `ConflictError`, …). When the
 * request never produced a response (DNS, timeout, TLS, connection
 * reset) it throws `TransportError`.
 *
 * Why the generic matters: without it, callers — especially the YAML
 * apply handlers — were forced to wrap every result in
 * `castEnvelope<{id?: string}>(...)` to recover the typed shape that
 * openapi-fetch already inferred from the spec. Those casts were P5
 * violations that hid spec drift behind silent type-only assertions.
 * With the generic, the typed shape flows straight through and the
 * handlers can read `.data?.id` directly.
 *
 * For loosely-typed paths (the dynamic-path helpers below) the input
 * type is `unknown`, so the public surface still degrades safely to
 * `unknown` and callers can apply a Zod schema via the `apiGetSingle`
 * family of helpers.
 */
export async function checkedFetch<TData>(
  promise: Promise<{data?: TData; error?: unknown; response: Response}>,
): Promise<TData | undefined> {
  return (await checkedFetchWithStatus(promise)).data
}

/**
 * Same as {@link checkedFetch}, but also returns the 2xx status code for
 * endpoints whose success body depends on it (e.g. 200 vs 202).
 */
export async function checkedFetchWithStatus<TData>(
  promise: Promise<{data?: TData; error?: unknown; response: Response}>,
): Promise<{status: number; data: TData | undefined}> {
  let result: {data?: TData; error?: unknown; response: Response}
  try {
    result = await promise
  } catch (cause) {
    if (cause instanceof DevhelmError) throw cause
    const message = cause instanceof Error ? cause.message : String(cause)
    throw new TransportError(message, {cause: cause instanceof Error ? cause : undefined})
  }
  const {data, error, response} = result
  if (error || !response.ok) {
    throw errorFromResponse(error, response)
  }
  return {status: response.status, data}
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

const sdkClients = new WeakMap<ApiClient, Devhelm>()

/**
 * The SDK client for the same token, URL, org and workspace, for the parts
 * the CLI takes from the SDK (run waiting). Its POSTs use this
 * invocation's idempotency keys and it identifies as the CLI.
 */
export function sdkClientFor(client: ApiClient): Devhelm {
  const hit = sdkClients.get(client)
  if (hit) return hit
  const o = client.options
  const sdk = new Devhelm({
    token: o.token,
    baseUrl: o.baseUrl,
    orgId: o.orgId ?? process.env.DEVHELM_ORG_ID ?? '1',
    workspaceId: o.workspaceId ?? process.env.DEVHELM_WORKSPACE_ID,
    client: CLIENT_HEADER,
    surface: 'cli',
    surfaceVersion: CLI_VERSION,
    idempotencyKey: ({method, url}) => nextIdempotencyKey(method, new URL(url).pathname),
  })
  sdkClients.set(client, sdk)
  return sdk
}
