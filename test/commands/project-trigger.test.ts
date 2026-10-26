import {afterEach, beforeEach, describe, expect, test} from 'vitest'
import {FakeApi, runCli} from '../helpers/fake-api.js'
import {MID, MID2, RUN_ID, monitor, page} from '../helpers/monitor-fixtures.js'
import {projectRoutes, run} from '../helpers/project-api.js'

const CODE = monitor({type: 'BROWSER', name: 'Checkout', regions: ['us-east', 'eu-west']})
const HTTP = monitor({id: MID2, type: 'HTTP', name: 'Homepage'})

describe('devhelm trigger', () => {
  let api: FakeApi
  let outcome = 'passed'
  beforeEach(async () => {
    outcome = 'passed'
    api = await new FakeApi().start()
    projectRoutes(api)
    api.on('GET', '/api/v1/monitors', (req) => ({body: page(req.query.get('tag') === 'smoke' ? [CODE, HTTP] : req.query.get('name') === 'Homepage' ? [HTTP] : [CODE])}))
    api.on('POST', `/api/v1/monitors/${MID}/triggers`, {status: 202, body: {data: {triggerId: '88888888-8888-4888-8888-888888888888', billedRuns: 2, runs: [
      {id: RUN_ID, region: 'us-east', phase: 'queued', url: 'https://app.devhelm.io/runs/1'},
    ]}}})
    api.on('GET', `/api/v1/runs/${RUN_ID}`, () => ({body: {data: run({source: 'run_now', phase: 'finished', outcome})}}))
  })
  afterEach(() => api.stop())

  test('fans out over every configured region with --region all; uptime goes to skipped[]', async () => {
    const r = await runCli(['trigger', '--tag', 'smoke', '--region', 'all', '-o', 'json'], {api})
    expect(r.code, r.stderr).toBe(0)
    expect(api.calls('POST', `/api/v1/monitors/${MID}/triggers`)[0]!.json).toEqual({regions: ['us-east', 'eu-west']})
    const doc = r.json as {skipped: Array<{target: string; code: string}>; data: {billedRuns: number}}
    expect(doc.skipped).toEqual([expect.objectContaining({target: 'Homepage', code: 'TRIGGER_UNSUPPORTED_TYPE'})])
    expect(doc.data.billedRuns).toBe(2)
  }, 60_000)

  test('an uptime-only selection exits 4 TRIGGER_UNSUPPORTED_TYPE', async () => {
    const r = await runCli(['trigger', 'Homepage', '-o', 'json'], {api})
    expect(r.code).toBe(4)
    expect((r.json as {error: {code: string}}).error.code).toBe('TRIGGER_UNSUPPORTED_TYPE')
  }, 60_000)

  test('over --max-runs exits 4 MAX_RUNS_EXCEEDED before anything runs', async () => {
    const r = await runCli(['trigger', 'Checkout', '--region', 'all', '--max-runs', '1', '-o', 'json'], {api})
    expect(r.code).toBe(4)
    expect((r.json as {error: {code: string}}).error.code).toBe('MAX_RUNS_EXCEEDED')
    expect(api.calls('POST', `/api/v1/monitors/${MID}/triggers`)).toHaveLength(0)
  }, 60_000)

  test('a failed run exits 14; human output says it will not alert', async () => {
    outcome = 'failed'
    const r = await runCli(['trigger', 'Checkout', '-o', 'table'], {api})
    expect(r.code).toBe(14)
    expect(r.stdout).toContain('recorded run · will not alert')
    expect(r.stdout).toContain(`https://app.devhelm.io/runs/${RUN_ID}`)
  }, 60_000)

  test('--signal is sent; nothing matched with --allow-empty is exit 0', async () => {
    await runCli(['trigger', 'Checkout', '--signal', '-o', 'json'], {api})
    expect(api.calls('POST', `/api/v1/monitors/${MID}/triggers`)[0]!.json).toMatchObject({signal: true})
    const e = await runCli(['trigger', '--tag', 'none', '--allow-empty', '-o', 'json'], {api})
    expect(e.code).toBe(0)
  }, 60_000)
})
