/**
 * Device-code login (doc 42 R11, doc 37 C1):
 *
 *   POST /api/v1/auth/device {clientName}        → userCode + verification URL
 *   POST /api/v1/auth/device/token {deviceCode}  → polled every `interval` s
 *        authorization_pending | slow_down       → keep polling
 *        complete                                → apiKey (+ org, workspace)
 *        denied | expired                        → AuthError (exit 17)
 *
 * The human approves in the dashboard; the CLI never sees a password. Used by
 * `auth login` and `init`.
 */
import {spawn} from 'node:child_process'
import {hostname} from 'node:os'
import type {z} from 'zod'
import {CLIENT_HEADER, errorFromResponse} from './api-client.js'
import {schemas as apiSchemas} from './api-zod.generated.js'
import {AuthError, TransportError} from './errors.js'
import {parse, parseSingle} from './response-validation.js'
import {buildSurfaceHeaders} from './surface-telemetry.js'

export type DeviceAuthorizationDto = z.infer<typeof apiSchemas.DeviceAuthorizationDto>
export type DeviceTokenDto = z.infer<typeof apiSchemas.DeviceTokenDto>

export interface DeviceLoginOptions {
  clientName?: string
  /** Show the code and URL to the human. */
  onPrompt?: (authorization: DeviceAuthorizationDto) => void
  /** Try to open the verification URL in a browser (default true). */
  openBrowser?: boolean
  /** Called after each pending poll. */
  onPoll?: (status: string) => void
  /** Injectable clock for tests. */
  sleep?: (ms: number) => Promise<void>
  signal?: AbortSignal
}

export interface DeviceLoginResult {
  token: string
  orgId?: number
  workspaceId?: number
}

async function post(apiUrl: string, path: string, body: object): Promise<unknown> {
  const url = `${apiUrl.replace(/\/$/, '')}${path}`
  const req = new Request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-DevHelm-Client': CLIENT_HEADER,
      ...buildSurfaceHeaders(),
    },
    body: JSON.stringify(body),
  })
  // Unauthenticated, two calls: sent directly (the SDK transport needs a token).
  let res: Response
  try {
    res = await fetch(req)
  } catch (cause) {
    throw new TransportError(`POST ${path}: ${cause instanceof Error ? cause.message : String(cause)}`, {cause: cause instanceof Error ? cause : undefined})
  }
  let json: unknown
  try {
    json = await res.json()
  } catch {
    json = undefined
  }
  if (!res.ok) throw errorFromResponse(json, res)
  return json
}

export function startDeviceAuthorization(apiUrl: string, clientName: string): Promise<DeviceAuthorizationDto> {
  const body = parse(apiSchemas.CreateDeviceAuthorizationRequest, {clientName: clientName.slice(0, 190)}, 'Invalid device authorization request')
  return post(apiUrl, '/api/v1/auth/device', body).then((r) => parseSingle(apiSchemas.DeviceAuthorizationDto, r, 'POST /api/v1/auth/device'))
}

export function pollDeviceToken(apiUrl: string, deviceCode: string): Promise<DeviceTokenDto> {
  const body = parse(apiSchemas.DeviceTokenRequest, {deviceCode}, 'Invalid device token request')
  return post(apiUrl, '/api/v1/auth/device/token', body).then((r) => parseSingle(apiSchemas.DeviceTokenDto, r, 'POST /api/v1/auth/device/token'))
}

/** Best-effort `open` / `xdg-open` / `start`; failures are ignored (the URL is printed). */
export function openInBrowser(url: string): void {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open'
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url]
  try {
    const child = spawn(cmd, args, {stdio: 'ignore', detached: true})
    child.on('error', () => {})
    child.unref()
  } catch {
    // no browser available
  }
}

export async function deviceLogin(apiUrl: string, opts: DeviceLoginOptions = {}): Promise<DeviceLoginResult> {
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const auth = await startDeviceAuthorization(apiUrl, opts.clientName ?? defaultClientName())
  opts.onPrompt?.(auth)
  if (opts.openBrowser !== false) openInBrowser(auth.verificationUriComplete)
  const deadline = Date.now() + auth.expiresIn * 1000
  let interval = Math.max(1, auth.interval)
  while (Date.now() < deadline) {
    if (opts.signal?.aborted) break
    await sleep(interval * 1000)
    const t = await pollDeviceToken(apiUrl, auth.deviceCode)
    switch (t.status) {
      case 'complete':
        if (!t.apiKey) throw new AuthError('Login approved but no key was returned', {code: 'DEVICE_LOGIN_FAILED'})
        return {token: t.apiKey, orgId: t.organizationId ?? undefined, workspaceId: t.workspaceId ?? undefined}
      case 'denied':
        throw new AuthError('The login request was denied in the dashboard', {code: 'DEVICE_LOGIN_DENIED', next: {command: 'devhelm auth login', docs: null}})
      case 'expired':
        throw new AuthError('The login code expired before it was approved', {code: 'DEVICE_AUTHORIZATION_EXPIRED', next: {command: 'devhelm auth login', docs: null}})
      case 'slow_down':
        interval = Math.max(interval + 5, t.interval)
        break
      default:
        interval = Math.max(1, t.interval)
    }
    opts.onPoll?.(t.status)
  }
  throw new AuthError('The login code expired before it was approved', {code: 'DEVICE_AUTHORIZATION_EXPIRED', next: {command: 'devhelm auth login', docs: null}})
}

function defaultClientName(): string {
  return `devhelm CLI on ${hostname()}`
}
