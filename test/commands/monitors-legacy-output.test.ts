/**
 * Pre-1.12 monitor commands keep their output contract (bare JSON, table
 * default without a TTY) while gaining <monitor> name resolution.
 */
import {afterEach, beforeEach, describe, expect, test} from 'vitest'
import {FakeApi, errorBody, runCli} from '../helpers/fake-api.js'
import {ENV_ID, MID, MID2, cursor, monitor, page} from '../helpers/monitor-fixtures.js'

describe('legacy monitor commands', () => {
  let api: FakeApi
  beforeEach(async () => {
    api = await new FakeApi().start()
    api.on('GET', `/api/v1/monitors/${MID}`, {body: {data: monitor()}})
  })
  afterEach(() => api.stop())

  test('list -o json is a bare list and sends filters flat', async () => {
    api.on('GET', `/api/v1/environments/production`, {body: {data: {id: ENV_ID, orgId: 1, name: 'Production', slug: 'production', variables: {}, createdAt: '2026-10-20T10:00:00Z', updatedAt: '2026-10-20T10:00:00Z', monitorCount: 1, isDefault: true}}})
    api.on('GET', '/api/v1/monitors', {body: page([monitor()])})
    const r = await runCli(['monitors', 'list', '--env', 'production', '--type', 'BROWSER', '--owner', 'git', '--health', 'down', '--tag', 'smoke', '-o', 'json'], {api})
    expect(r.code).toBe(0)
    expect(Array.isArray(r.json)).toBe(true)
    const q = api.calls('GET', '/api/v1/monitors')[0]!.query
    expect(q.get('environmentId')).toBe(ENV_ID)
    expect(q.get('type')).toBe('BROWSER')
    expect(q.get('managedBy')).toBe('GIT')
    expect(q.get('displayHealth')).toBe('down')
    expect(q.get('tag')).toBe('smoke')
    expect(q.get('page')).toBe('0')
  }, 60_000)

  test('list without a TTY still prints a table', async () => {
    api.on('GET', '/api/v1/monitors', {body: page([monitor()])})
    const r = await runCli(['monitors', 'list'], {api})
    expect(r.code).toBe(0)
    expect(r.stdout).toContain('ID')
    expect(r.json).toBeUndefined()
  }, 60_000)

  test('list --name keeps exact matches only', async () => {
    api.on('GET', '/api/v1/monitors', {body: page([monitor(), monitor({id: MID2, name: 'Checkout v2'})])})
    const r = await runCli(['monitors', 'list', '--name', 'Checkout', '-o', 'json'], {api})
    expect((r.json as unknown[]).length).toBe(1)
  }, 60_000)

  test('get -o json is the bare monitor', async () => {
    const r = await runCli(['monitors', 'get', MID, '-o', 'json'], {api})
    expect((r.json as {id: string}).id).toBe(MID)
  }, 60_000)

  test('pause / resume print paused / resumed', async () => {
    api.on('POST', `/api/v1/monitors/${MID}/pause`, {body: {data: monitor({enabled: false})}})
    api.on('POST', `/api/v1/monitors/${MID}/resume`, {body: {data: monitor()}})
    const p = await runCli(['monitors', 'pause', MID, '--reason', 'maint', '--until', '2h'], {api})
    expect(p.code).toBe(0)
    expect(p.stdout.toLowerCase()).toContain('paused')
    const body = api.calls('POST', `/api/v1/monitors/${MID}/pause`)[0]!.json as {reason: string; expiresAt: string}
    expect(body.reason).toBe('maint')
    expect(Date.parse(body.expiresAt)).toBeGreaterThan(Date.now())
    const res = await runCli(['monitors', 'resume', MID], {api})
    expect(res.stdout.toLowerCase()).toContain('resumed')
  }, 60_000)

  test('versions list -o json is a bare list', async () => {
    api.on('GET', `/api/v1/monitors/${MID}/versions`, {body: page([{id: MID2, monitorId: MID, version: 2, snapshot: monitor(), changedVia: 'API', createdAt: '2026-10-20T10:00:00Z'}])})
    const r = await runCli(['monitors', 'versions', 'list', MID, '-o', 'json'], {api})
    expect(r.code).toBe(0)
    expect((r.json as Array<{version: number}>)[0]!.version).toBe(2)
  }, 60_000)

  test('results is a deprecated alias of history (bare list)', async () => {
    api.on('GET', `/api/v1/monitors/${MID}/history`, {body: cursor([{kind: 'not_run', monitorId: MID, reason: 'quota', from: '2026-10-21T10:00:00Z', to: '2026-10-21T11:00:00Z', count: 3}])})
    const r = await runCli(['monitors', 'results', MID, '--limit', '5', '-o', 'json'], {api})
    expect(r.code).toBe(0)
    expect(Array.isArray(r.json)).toBe(true)
    expect(r.stderr).toContain('2027-01-31')
    expect(api.calls('GET', `/api/v1/monitors/${MID}/history`)[0]!.query.get('limit')).toBe('5')
  }, 60_000)

  test('results for an unknown id fails (exit 4)', async () => {
    const r = await runCli(['monitors', 'results', '999999'], {api: api.on('GET', '/api/v1/monitors', {body: page([])})})
    expect(r.code).toBe(4)
  }, 60_000)

  test('create HTTP keeps the pre-1.12 body and prints the monitor', async () => {
    api.on('POST', '/api/v1/monitors', {status: 201, body: {data: monitor()}})
    const r = await runCli(['monitors', 'create', '--name', 'API', '--type', 'HTTP', '--url', 'https://x.example', '--regions', 'us-east', '-o', 'json'], {api})
    expect(r.code).toBe(0)
    expect((r.json as {id: string}).id).toBe(MID)
    const body = api.calls('POST', '/api/v1/monitors')[0]!.json as Record<string, unknown>
    expect(body).toMatchObject({name: 'API', type: 'HTTP', frequencySeconds: 60, regions: ['us-east'], config: {url: 'https://x.example', method: 'GET'}})
  }, 60_000)

  test('create BROWSER requires --code and --env', async () => {
    const r = await runCli(['monitors', 'create', '--name', 'C', '--type', 'BROWSER', '-o', 'json'], {api})
    expect(r.code).toBe(4)
    expect(api.calls('POST', '/api/v1/monitors')).toHaveLength(0)
  }, 60_000)

  test('update sends the PUT for a resolved name', async () => {
    api.on('GET', '/api/v1/monitors', {body: page([monitor()])})
    api.on('PUT', `/api/v1/monitors/${MID}`, {body: {data: monitor({frequencySeconds: 300})}})
    const r = await runCli(['monitors', 'update', 'Checkout', '--frequency', '300', '-o', 'json'], {api})
    expect(r.code).toBe(0)
    expect(api.calls('PUT', `/api/v1/monitors/${MID}`)[0]!.json).toEqual({frequencySeconds: 300})
  }, 60_000)

  test('delete without --yes in a non-TTY exits 15; with --yes it deletes', async () => {
    api.on('DELETE', `/api/v1/monitors/${MID}`, {status: 204})
    const r = await runCli(['monitors', 'delete', MID], {api})
    expect(r.code).toBe(15)
    expect(api.calls('DELETE', `/api/v1/monitors/${MID}`)).toHaveLength(0)
    const ok = await runCli(['monitors', 'delete', MID, '--yes'], {api})
    expect(ok.code).toBe(0)
    expect(ok.stdout).toContain('deleted')
  }, 60_000)

  test('set-channels resolves the monitor', async () => {
    api.on('PUT', `/api/v1/monitors/${MID}/alert-channels`, {body: {data: []}})
    const r = await runCli(['monitors', 'set-channels', MID, '--channel-ids', ''], {api})
    expect(r.code).toBe(0)
    expect(r.stdout).toContain('Cleared')
  }, 60_000)

  test('a 404 from get exits 4', async () => {
    api.on('GET', `/api/v1/monitors/${MID2}`, {status: 404, body: errorBody('not_found', 'MONITOR_NOT_FOUND', 404)})
    expect((await runCli(['monitors', 'get', MID2], {api})).code).toBe(4)
  }, 60_000)
})

describe('<monitor> resolution', () => {
  let api: FakeApi
  beforeEach(async () => {
    api = await new FakeApi().start()
  })
  afterEach(() => api.stop())

  test('ambiguous name exits 4 listing id, type, environment, owner', async () => {
    api.on('GET', '/api/v1/monitors', {body: page([monitor(), monitor({id: MID2, environment: {id: MID2, name: 'Staging', slug: 'staging'}, managedBy: 'TERRAFORM'})])})
    const r = await runCli(['monitors', 'drift', 'Checkout', '-o', 'json'], {api})
    expect(r.code).toBe(4)
    const err = (r.json as {error: {code: string; details: {matches: Array<{id: string; environment: string; owner: string}>}}}).error
    expect(err.code).toBe('MONITOR_AMBIGUOUS')
    expect(err.details.matches.map((m) => m.environment)).toEqual(['production', 'staging'])
    expect(err.details.matches[1]!.owner).toBe('TERRAFORM')
  }, 60_000)

  test('unknown name exits 4 with did-you-mean', async () => {
    api.on('GET', '/api/v1/monitors', (req) => ({body: page(req.query.get('name') ? [] : [monitor({name: 'Checkout flow'})])}))
    const r = await runCli(['monitors', 'drift', 'Checkout', '-o', 'json'], {api})
    expect(r.code).toBe(4)
    const err = (r.json as {error: {code: string; message: string}}).error
    expect(err.code).toBe('MONITOR_NOT_FOUND')
    expect(err.message).toContain('Checkout flow')
  }, 60_000)

  test('unknown environment slug exits 4 ENVIRONMENT_NOT_FOUND', async () => {
    const r = await runCli(['monitors', 'drift', 'Checkout', '--env', 'nope', '-o', 'json'], {api})
    expect(r.code).toBe(4)
    expect((r.json as {error: {code: string}}).error.code).toBe('ENVIRONMENT_NOT_FOUND')
  }, 60_000)
})
