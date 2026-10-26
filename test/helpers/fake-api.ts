/**
 * A fake DevHelm API on 127.0.0.1 plus a runner that executes the built
 * CLI (`bin/dev.js` → dist) against it as a subprocess, the way users and
 * the mono surface tests do.
 */
import {execFile} from 'node:child_process'
import {createServer, type IncomingMessage, type Server, type ServerResponse} from 'node:http'
import type {AddressInfo} from 'node:net'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const repoRoot = join(__dirname, '..', '..')

export interface Captured {
  method: string
  url: string
  path: string
  query: URLSearchParams
  headers: IncomingMessage['headers']
  body: string
  json: unknown
}

export interface Reply {
  status?: number
  body?: unknown
  headers?: Record<string, string>
  /** Raw text body (e.g. an SSE stream). */
  raw?: string
}

export type Handler = (req: Captured) => Reply | undefined

export class FakeApi {
  server!: Server
  captured: Captured[] = []
  private routes: Array<{method: string; pattern: RegExp; handler: Handler}> = []

  on(method: string, path: string | RegExp, handler: Handler | Reply): this {
    const pattern = typeof path === 'string'
      ? new RegExp('^' + path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{[^}]+\\\}/g, '[^/]+') + '$')
      : path
    const fn: Handler = typeof handler === 'function' ? handler : () => handler
    this.routes.unshift({method: method.toUpperCase(), pattern, handler: fn})
    return this
  }

  async start(): Promise<this> {
    this.server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      let body = ''
      for await (const chunk of req) body += chunk
      const u = new URL(req.url ?? '/', 'http://x')
      let json: unknown
      try {
        json = body ? JSON.parse(body) : undefined
      } catch {
        json = undefined
      }
      const cap: Captured = {method: req.method ?? 'GET', url: req.url ?? '', path: u.pathname, query: u.searchParams, headers: req.headers, body, json}
      this.captured.push(cap)
      for (const r of this.routes) {
        if (r.method === cap.method && r.pattern.test(cap.path)) {
          const reply = r.handler(cap)
          if (!reply) continue
          if (reply.raw !== undefined) {
            res.writeHead(reply.status ?? 200, {'Content-Type': 'text/event-stream', ...reply.headers})
            res.end(reply.raw)
          } else {
            res.writeHead(reply.status ?? 200, {'Content-Type': 'application/json', ...reply.headers})
            res.end(reply.body === undefined ? '' : JSON.stringify(reply.body))
          }
          return
        }
      }
      res.writeHead(404, {'Content-Type': 'application/json'})
      res.end(JSON.stringify({status: 404, code: 'NOT_FOUND', category: 'not_found', retryable: false, message: `no fake route for ${cap.method} ${cap.path}`, timestamp: 0}))
    })
    await new Promise<void>((resolve) => this.server.listen(0, '127.0.0.1', resolve))
    return this
  }

  get url(): string {
    const {port} = this.server.address() as AddressInfo
    return `http://127.0.0.1:${port}`
  }

  calls(method: string, path: string | RegExp): Captured[] {
    return this.captured.filter((c) => c.method === method && (typeof path === 'string' ? c.path === path : path.test(c.path)))
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) => this.server.close(() => resolve()))
  }
}

export interface CliResult {
  code: number
  stdout: string
  stderr: string
  json: unknown
}

export function errorBody(category: string, code: string, status: number, extra: Record<string, unknown> = {}) {
  return {status, code, category, retryable: false, message: `${code} happened`, timestamp: 0, requestId: 'req_test', ...extra}
}

export async function runCli(args: string[], opts: {api?: FakeApi; env?: Record<string, string>; cwd?: string; timeoutMs?: number} = {}): Promise<CliResult> {
  const base = opts.api ? ['--api-url', opts.api.url, '--api-token', 'dh_live_test'] : []
  return new Promise((resolve) => {
    execFile(
      'node',
      [join(repoRoot, 'bin/dev.js'), ...args, ...base],
      {
        cwd: opts.cwd ?? repoRoot,
        env: {
          ...process.env,
          DEVHELM_TELEMETRY: '0',
          DEVHELM_RETRY_MAX_DELAY_MS: '1',
          DEVHELM_WAIT_POLL_MS: '20',
          DEVHELM_API_TOKEN: '',
          HOME: process.env.DEVHELM_TEST_HOME ?? join(repoRoot, 'test', '.home'),
          CI: '',
          GITHUB_RUN_ID: '',
          ...opts.env,
        },
        timeout: opts.timeoutMs ?? 60_000,
      },
      (error, stdout, stderr) => {
        const code = error ? (typeof (error as {code?: unknown}).code === 'number' ? (error as {code: number}).code : 1) : 0
        let json: unknown
        try {
          json = JSON.parse(stdout)
        } catch {
          json = undefined
        }
        resolve({code, stdout, stderr, json})
      },
    )
  })
}
