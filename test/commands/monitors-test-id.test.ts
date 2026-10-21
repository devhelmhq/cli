import {afterEach, beforeEach, describe, expect, test} from 'vitest'
import {execFile} from 'node:child_process'
import {createServer, type IncomingMessage, type Server} from 'node:http'
import type {AddressInfo} from 'node:net'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {promisify} from 'node:util'
import {QUEUED_RUN} from '../lib/monitor-test.test.js'
import {formatOutput} from '../../src/lib/output.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..', '..')
const execFileAsync = promisify(execFile)
const MONITOR_ID = '11111111-1111-1111-1111-111111111111'

interface Captured {
  method?: string
  url?: string
  body: string
}

async function readBody(req: IncomingMessage): Promise<string> {
  let body = ''
  for await (const chunk of req) body += chunk
  return body
}

describe('monitors test <id>', () => {
  let server: Server
  let captured: Captured[]
  let reply: {status: number; body: unknown}

  beforeEach(async () => {
    captured = []
    server = createServer(async (req, res) => {
      captured.push({method: req.method, url: req.url, body: await readBody(req)})
      res.writeHead(reply.status, {'Content-Type': 'application/json'})
      res.end(JSON.stringify(reply.body))
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  })

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  async function run(extra: string[]): Promise<{stdout: string; stderr: string}> {
    const {port} = server.address() as AddressInfo
    return execFileAsync(
      'node',
      ['bin/dev.js', 'monitors', 'test', MONITOR_ID, '--api-token', 't', '--api-url', `http://127.0.0.1:${port}`, ...extra],
      {cwd: repoRoot, env: {...process.env, DEVHELM_TELEMETRY: '0'}},
    )
  }

  test('prints the queued run for a 202 and sends the target body', async () => {
    reply = {status: 202, body: {data: QUEUED_RUN}}
    const {stdout, stderr} = await run(['--region', 'eu-west', '--output', 'json'])
    expect(captured).toHaveLength(1)
    expect(captured[0]!.method).toBe('POST')
    expect(captured[0]!.url).toBe(`/api/v1/monitors/${MONITOR_ID}/test`)
    expect(JSON.parse(captured[0]!.body)).toEqual({region: 'eu-west'})
    expect(stderr).toContain(`Queued validation run ${QUEUED_RUN.id}`)
    expect(stdout).toContain(`"id": "${QUEUED_RUN.id}"`)
  }, 60_000)

  // The 200 path must print exactly what it printed before the 202 work:
  // "Running test..." then the raw body formatted as-is (no re-parse, so
  // key order and unknown keys are untouched).
  const probe = {
    statusCode: 204,
    passed: true,
    assertionResults: [],
    responseTimeMs: 9,
    futureField: {nested: 1},
  }

  for (const format of ['json', 'yaml', 'table'] as const) {
    test(`prints a 200 probe result unchanged (${format})`, async () => {
      reply = {status: 200, body: {data: probe}}
      const {stdout, stderr} = await run(['--output', format])
      expect(captured[0]!.body).toBe('')
      expect(stdout).toBe(`Running test...\n${formatOutput(probe, format)}\n`)
      expect(stderr).not.toContain('Queued validation run')
    }, 60_000)
  }
})
