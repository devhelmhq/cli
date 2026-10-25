import {afterAll, afterEach, beforeAll, describe, expect, test} from 'vitest'
import {FakeApi, runCli} from '../helpers/fake-api.js'
import {ENV_ID, ENVIRONMENT, MONITOR, MONITOR_ID, RUN_ID, run} from '../helpers/other-fixtures.js'

const RUN2 = '9f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4c'
const env = {DEVHELM_WAIT_POLL_ONLY: '1'}

describe('runs commands', () => {
  let api: FakeApi
  beforeAll(async () => {
    api = await new FakeApi().start()
  })
  afterAll(() => api.stop())
  afterEach(() => {
    api.captured = []
  })

  test('runs wait: passed → exit 0 with the wrapper', async () => {
    api.on('GET', `/api/v1/runs/${RUN_ID}`, {body: {data: run()}})
    const r = await runCli(['runs', 'wait', RUN_ID, '-o', 'json'], {api, env})
    expect(r.code).toBe(0)
    const doc = r.json as {ok: boolean; exit: number; data: Array<{id: string}>}
    expect(doc.ok).toBe(true)
    expect(doc.data[0]!.id).toBe(RUN_ID)
  }, 60_000)

  test('runs wait: failed beats no verdict → exit 14', async () => {
    api.on('GET', `/api/v1/runs/${RUN_ID}`, {body: {data: run({outcome: 'failed', failure: {kind: 'assertion', message: 'expected 201', file: 'a.spec.ts', line: 9}})}})
    api.on('GET', `/api/v1/runs/${RUN2}`, {body: {data: run({id: RUN2, outcome: 'execution_error', billable: false})}})
    const r = await runCli(['runs', 'wait', RUN_ID, RUN2, '-o', 'table'], {api, env})
    expect(r.code).toBe(14)
    expect(r.stdout).toContain('expected 201 · a.spec.ts:9')
  }, 60_000)

  test('runs wait: execution_error → exit 19; --no-fail-on-infra-error → 0', async () => {
    api.on('GET', `/api/v1/runs/${RUN_ID}`, {body: {data: run({outcome: 'execution_error', billable: false})}})
    expect((await runCli(['runs', 'wait', RUN_ID, '-o', 'json'], {api, env})).code).toBe(19)
    const r = await runCli(['runs', 'wait', RUN_ID, '-o', 'json', '--no-fail-on-infra-error'], {api, env})
    expect(r.code).toBe(0)
    expect((r.json as {warnings: string[]}).warnings.length).toBe(1)
  }, 60_000)

  test('runs wait: not finished before --timeout → exit 19, runsContinue', async () => {
    api.on('GET', `/api/v1/runs/${RUN_ID}`, {body: {data: run({phase: 'queued', outcome: null})}})
    const r = await runCli(['runs', 'wait', RUN_ID, '-o', 'json', '--timeout', '1s'], {api, env})
    expect(r.code).toBe(19)
    expect((r.json as {runsContinue: boolean}).runsContinue).toBe(true)
    expect(api.calls('POST', `/api/v1/runs/${RUN_ID}/cancel`)).toHaveLength(0)
  }, 60_000)

  test('runs list sends flat filters and resolves --monitor by name', async () => {
    api.on('GET', '/api/v1/environments/staging', {body: {data: ENVIRONMENT}})
    api.on('GET', '/api/v1/monitors', {body: {data: [MONITOR], hasNext: false, hasPrev: false, totalElements: 1, totalPages: 1}})
    api.on('GET', '/api/v1/runs', {body: {data: [run()], nextCursor: null, hasMore: false}})
    const r = await runCli(['runs', 'list', '--monitor', 'Checkout', '--env', 'staging', '--outcome', 'failed', '--session', 's1', '--flaky', '--adhoc', '-o', 'json'], {api})
    expect(r.code).toBe(0)
    const q = api.calls('GET', '/api/v1/runs')[0]!.query
    expect(q.get('monitorId')).toBe(MONITOR_ID)
    expect(q.get('environmentId')).toBe(ENV_ID)
    expect(q.get('outcome')).toBe('failed')
    expect(q.get('sessionId')).toBe('s1')
    expect(q.get('flaky')).toBe('true')
    expect(q.get('adhoc')).toBe('true')
    expect(q.get('params')).toBeNull()
  }, 60_000)

  test('runs get --steps reads cases', async () => {
    api.on('GET', `/api/v1/runs/${RUN_ID}`, {body: {data: run()}})
    api.on('GET', `/api/v1/runs/${RUN_ID}/cases`, {body: {data: [{
      id: RUN2, organizationId: 1, runId: RUN_ID, attempt: 1, index: 0, title: 'checkout', status: 'passed',
      steps: [{id: RUN2, organizationId: 1, runId: RUN_ID, caseId: RUN2, attempt: 1, index: 0, title: 'goto /', category: 'named', status: 'passed', durationMs: 800, assertion: {expected: 201, ok: true}}],
    }], hasNext: false, hasPrev: false}})
    const r = await runCli(['runs', 'get', RUN_ID, '--steps', '-o', 'table'], {api})
    expect(r.code).toBe(0)
    expect(r.stdout).toContain('✓ goto / (0.8 s)')
  }, 60_000)

  test('runs purge is gated (exit 15) and posts the reason with --yes', async () => {
    api.on('POST', `/api/v1/runs/${RUN_ID}/purge`, {body: {data: run()}})
    const gated = await runCli(['runs', 'purge', RUN_ID, '--reason', 'leak', '-o', 'json'], {api})
    expect(gated.code).toBe(15)
    expect((gated.json as {confirmCommand: string}).confirmCommand).toContain('--yes')
    expect(api.calls('POST', `/api/v1/runs/${RUN_ID}/purge`)).toHaveLength(0)
    const ok = await runCli(['runs', 'purge', RUN_ID, '--reason', 'leak', '--yes', '-o', 'json'], {api})
    expect(ok.code).toBe(0)
    expect(api.calls('POST', `/api/v1/runs/${RUN_ID}/purge`)[0]!.json).toEqual({reason: 'leak'})
  }, 60_000)

  test('runs cancel / pin / unpin hit their routes', async () => {
    api.on('POST', `/api/v1/runs/${RUN_ID}/cancel`, {body: {data: run({cancelRequested: true})}})
    api.on('POST', `/api/v1/runs/${RUN_ID}/pin`, {body: {data: run()}})
    api.on('DELETE', `/api/v1/runs/${RUN_ID}/pin`, {body: {data: run()}})
    for (const verb of ['cancel', 'pin', 'unpin']) expect((await runCli(['runs', verb, RUN_ID, '-o', 'json'], {api})).code).toBe(0)
    expect(api.calls('POST', `/api/v1/runs/${RUN_ID}/cancel`)).toHaveLength(1)
    expect(api.calls('POST', `/api/v1/runs/${RUN_ID}/pin`)).toHaveLength(1)
    expect(api.calls('DELETE', `/api/v1/runs/${RUN_ID}/pin`)).toHaveLength(1)
  }, 60_000)

  test('runs trace / log / console / diff / network', async () => {
    api.on('GET', `/api/v1/runs/${RUN_ID}/trace-summary`, {body: {data: {runId: RUN_ID, failedActions: [], failedRequests: [], consoleErrors: [], text: 'click #pay failed', truncated: false}}})
    api.on('GET', `/api/v1/runs/${RUN_ID}/runner-log`, {raw: 'line one\nline two\n', headers: {'Content-Type': 'text/plain'}})
    api.on('GET', `/api/v1/runs/${RUN_ID}/console`, {body: {data: {state: 'ready', groups: [{level: 'error', text: 'boom', count: 2, sourceUrl: 'https://x/app.js'}]}}})
    api.on('GET', `/api/v1/runs/${RUN_ID}/diff`, {body: {data: {baselineKind: 'last_pass', readsAs: 'slower than baseline', rows: [], picker: []}}})
    api.on('GET', `/api/v1/runs/${RUN_ID}/network`, {body: {data: [], hasMore: false}})
    expect((await runCli(['runs', 'trace', RUN_ID, '-o', 'table'], {api})).stdout).toContain('click #pay failed')
    expect((await runCli(['runs', 'log', RUN_ID, '-o', 'table'], {api})).stdout).toContain('line two')
    expect((await runCli(['runs', 'console', RUN_ID, '--level', 'error', '-o', 'table'], {api})).stdout).toContain('×2 boom')
    expect(api.calls('GET', `/api/v1/runs/${RUN_ID}/console`)[0]!.query.get('level')).toBe('error')
    const d = await runCli(['runs', 'diff', RUN_ID, '--baseline', RUN2, '-o', 'json'], {api})
    expect(d.code).toBe(0)
    expect(api.calls('GET', `/api/v1/runs/${RUN_ID}/diff`)[0]!.query.get('baselineRunId')).toBe(RUN2)
    expect((await runCli(['runs', 'network', RUN_ID, '--failed', '-o', 'json'], {api})).code).toBe(0)
    expect(api.calls('GET', `/api/v1/runs/${RUN_ID}/network`)[0]!.query.get('failed')).toBe('true')
  }, 60_000)

  test('unknown run → exit 4 (not_found)', async () => {
    const r = await runCli(['runs', 'get', 'nope', '-o', 'json'], {api})
    expect(r.code).toBe(4)
  }, 60_000)
})
