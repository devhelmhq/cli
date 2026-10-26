import {createHash, randomUUID} from 'node:crypto'
import createClient, {type Middleware} from 'openapi-fetch'
import type {PathsWithMethod} from 'openapi-typescript-helpers'
import type {ZodType} from 'zod'
import type {paths, components} from './api.generated.js'
import {Devhelm, errorFromResponse as sdkErrorFromResponse} from '@devhelm/sdk'
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
 * seed is `sha256(GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT, GITHUB_JOB,
 * GITHUB_ACTION, argv)`, elsewhere a random UUID per invocation. The argv
 * and step keep two different commands in one job apart; re-running the
 * same step of the same attempt replays. `--idempotency-key` pins the first
 * POST's key; later POSTs in the same invocation append an ordinal.
 */
interface InvocationContext {
  command: string
  seed: string
  explicitKey?: string
  counter: Map<string, number>
  posts: number
}

let invocation: InvocationContext = newInvocation('cli')

function newInvocation(command: string, explicitKey?: string, argv: readonly string[] = []): InvocationContext {
  const env = process.env
  const seed = env.GITHUB_RUN_ID
    ? createHash('sha256')
        .update(
          [env.GITHUB_RUN_ID, env.GITHUB_RUN_ATTEMPT ?? '1', env.GITHUB_JOB ?? '', env.GITHUB_ACTION ?? '', command, ...argv].join(
            '\n',
          ),
        )
        .digest('hex')
    : randomUUID()
  return {command, seed, explicitKey, counter: new Map(), posts: 0}
}

/** Called once per command invocation (from the base command's init). */
export function beginInvocation(command: string, explicitKey?: string, argv: readonly string[] = process.argv.slice(2)): void {
  invocation = newInvocation(command, explicitKey, argv)
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

/**
 * The CLI's typed client (generated from its vendored spec). Requests go
 * through the SDK transport (`Devhelm.send`): one `Idempotency-Key` per
 * logical POST from this invocation's D-7 keys, and the retry policy (429,
 * 503, retryable 409, `Retry-After`, 5 attempts with jitter). There is no
 * second transport in the CLI.
 */
export function createApiClient(opts: ApiClientOptions) {
  const sdk = new Devhelm({
    token: opts.token,
    baseUrl: opts.baseUrl,
    orgId: opts.orgId ?? process.env.DEVHELM_ORG_ID ?? '1',
    workspaceId: opts.workspaceId ?? process.env.DEVHELM_WORKSPACE_ID,
    client: CLIENT_HEADER,
    surface: 'cli',
    surfaceVersion: CLI_VERSION,
    idempotencyKey: ({method, url}) => nextIdempotencyKey(method, new URL(url).pathname),
    // DEVHELM_RETRY_MAX_DELAY_MS caps the wait between retries (tests set it low).
    ...(process.env.DEVHELM_RETRY_MAX_DELAY_MS ? {retry: {maxDelayMs: Number(process.env.DEVHELM_RETRY_MAX_DELAY_MS)}} : {}),
  })
  const client = createClient<paths>({
    baseUrl: opts.baseUrl.replace(/\/$/, ''),
    headers: {...baseHeaders(opts), 'Content-Type': 'application/json'},
    fetch: (request) => sdk.send(request),
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

  return Object.assign(client, {options: opts, sdk})
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

/** The SDK client behind this CLI client (waiting, bundles, raw sends). */
export function sdkClientFor(client: ApiClient): Devhelm {
  return client.sdk
}
