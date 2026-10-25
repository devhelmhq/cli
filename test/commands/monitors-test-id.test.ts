import {afterEach, beforeEach, describe, expect, test} from 'vitest'
import {FakeApi, runCli} from '../helpers/fake-api.js'
import {MID, RUN_ID, monitor, page, run} from '../helpers/monitor-fixtures.js'

describe('monitors test <monitor>', () => {
  let api: FakeApi
  beforeEach(async () => {
    api = await new FakeApi().start()
  })
  afterEach(() => api.stop())

  function codeMonitor(finalOutcome: string, extra: Record<string, unknown> = {}) {
    api.on('GET', `/api/v1/monitors/${MID}`, {body: {data: monitor({type: 'BROWSER'})}})
    api.on('POST', `/api/v1/monitors/${MID}/test`, {status: 202, body: {data: run()}})
    let polls = 0
    api.on('GET', `/api/v1/runs/${RUN_ID}`, () => {
      polls++
      return {body: {data: polls < 2 ? run({phase: 'running'}) : run({phase: 'finished', outcome: finalOutcome, durationMs: 4600, ...extra})}}
    })
  }

  test('code monitor: queues, waits and exits 0 on pass', async () => {
    codeMonitor('passed')
    const r = await runCli(['monitors', 'test', MID, '--region', 'eu-west', '-o', 'json'], {api})
    expect(r.code).toBe(0)
    const post = api.calls('POST', `/api/v1/monitors/${MID}/test`)[0]!
    expect(post.json).toEqual({region: 'eu-west'})
    expect(post.headers['idempotency-key']).toBeTruthy()
    expect(r.stderr).toContain(`Queued validation run ${RUN_ID}`)
    expect((r.json as {outcome: string}).outcome).toBe('passed')
  }, 60_000)

  test('code monitor: a failed run exits 14 and prints file:line', async () => {
    codeMonitor('failed', {failure: {kind: 'assertion', message: 'expected 201, got 500', file: 'orders.spec.ts', line: 9}})
    const r = await runCli(['monitors', 'test', MID, '-o', 'table'], {api})
    expect(r.code).toBe(14)
    expect(r.stdout).toContain('orders.spec.ts:9')
    expect(r.stdout).toContain(`devhelm runs get ${RUN_ID} --steps`)
  }, 60_000)

  test('code monitor: execution_error exits 19, or 0 with --no-fail-on-infra-error', async () => {
    codeMonitor('execution_error', {billable: false})
    expect((await runCli(['monitors', 'test', MID, '-o', 'json'], {api})).code).toBe(19)
    expect((await runCli(['monitors', 'test', MID, '-o', 'json', '--no-fail-on-infra-error'], {api})).code).toBe(0)
  }, 60_000)

  test('--no-wait returns the queued run without polling it to the end', async () => {
    codeMonitor('passed')
    const r = await runCli(['monitors', 'test', MID, '--no-wait', '-o', 'json'], {api})
    expect(r.code).toBe(0)
    expect(api.calls('GET', `/api/v1/runs/${RUN_ID}`)).toHaveLength(0)
  }, 60_000)

  test('--code needs the bundler (exit 4 until it is wired)', async () => {
    codeMonitor('passed')
    const r = await runCli(['monitors', 'test', MID, '--code', 'x.spec.ts', '-o', 'json'], {api})
    expect(r.code).toBe(4)
  }, 60_000)

  const probe = {statusCode: 204, passed: true, assertionResults: [], responseTimeMs: 9, futureField: {nested: 1}}

  for (const format of ['json', 'yaml'] as const) {
    test(`uptime probe prints the result as before (${format})`, async () => {
      api.on('GET', `/api/v1/monitors/${MID}`, {body: {data: monitor()}})
      api.on('POST', `/api/v1/monitors/${MID}/test`, {body: {data: probe}})
      const r = await runCli(['monitors', 'test', MID, '--output', format], {api})
      expect(r.code).toBe(0)
      expect(api.calls('POST', `/api/v1/monitors/${MID}/test`)[0]!.body).toBe('')
      expect(r.stderr).toContain('Running test...')
      if (format === 'json') expect(r.json).toEqual(probe)
      else expect(r.stdout).toContain('futureField')
    }, 60_000)
  }

  test('uptime probe failure exits 14', async () => {
    api.on('GET', `/api/v1/monitors/${MID}`, {body: {data: monitor()}})
    api.on('POST', `/api/v1/monitors/${MID}/test`, {body: {data: {...probe, passed: false, error: 'timeout'}}})
    const r = await runCli(['monitors', 'test', MID, '-o', 'json'], {api})
    expect(r.code).toBe(14)
  }, 60_000)

  test('heartbeat is not_applicable, exit 0, no test call', async () => {
    api.on('GET', `/api/v1/monitors/${MID}`, {body: {data: monitor({type: 'HEARTBEAT'})}})
    const r = await runCli(['monitors', 'test', MID, '-o', 'json'], {api})
    expect(r.code).toBe(0)
    expect(r.json).toEqual({monitorId: MID, outcome: 'not_applicable'})
    expect(api.calls('POST', `/api/v1/monitors/${MID}/test`)).toHaveLength(0)
  }, 60_000)

  test('resolves an exact name', async () => {
    api.on('GET', '/api/v1/monitors', {body: page([monitor(), monitor({id: '99999999-9999-4999-8999-999999999999', name: 'Checkout v2'})])})
    api.on('POST', `/api/v1/monitors/${MID}/test`, {body: {data: probe}})
    const r = await runCli(['monitors', 'test', 'Checkout', '-o', 'json'], {api})
    expect(r.code).toBe(0)
    expect(api.calls('GET', '/api/v1/monitors')[0]!.query.get('name')).toBe('Checkout')
  }, 60_000)
})
