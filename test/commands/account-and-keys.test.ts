import {afterAll, afterEach, beforeAll, describe, expect, test} from 'vitest'
import {FakeApi, runCli} from '../helpers/fake-api.js'
import {INCIDENT_ID, MONITOR_ID, run} from '../helpers/other-fixtures.js'

const KEY = {id: 9, name: 'deploy', key: 'dh_live_x', createdAt: '2026-10-01T00:00:00Z', scopes: ['workspace:read']}
const INCIDENT = {
  id: INCIDENT_ID, organizationId: 1, source: 'MONITORS', status: 'CONFIRMED', severity: 'DOWN', title: 'Checkout down',
  affectedRegions: ['us-east'], reopenCount: 0, statusPageVisible: false, suppressDispatch: false,
  createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', monitorId: MONITOR_ID,
}
const DETAIL = {incident: INCIDENT, updates: []}

describe('account, audit, runtimes, regions, workspaces, api-keys, incidents', () => {
  let api: FakeApi
  beforeAll(async () => {
    api = await new FakeApi().start()
  })
  afterAll(() => api.stop())
  afterEach(() => {
    api.captured = []
  })

  test('account usage / entitlements', async () => {
    api.on('GET', '/api/v1/synthetics/usage', {body: {data: {periodStart: '2026-10-01T00:00:00Z', periodEnd: '2026-11-01T00:00:00Z', browser: {used: 10, included: 100, testRuns: 2}, api: {used: 1, testRuns: 0}, monitors: []}}})
    api.on('GET', '/api/v1/entitlements', {body: {data: {tier: 'FREE', entitlements: {'monitors.max': {key: 'monitors.max', value: 5, defaultValue: 5, overridden: false}}, usage: {'monitors.max': 2}, trialActive: false, usagePeriodStart: '2026-10-01T00:00:00Z'}}})
    const u = await runCli(['account', 'usage', '-o', 'table'], {api})
    expect(u.code).toBe(0)
    expect(u.stdout).toContain('browser: 10 / 100 runs (2 validation) · 90 remaining')
    const e = await runCli(['account', 'entitlements', '-o', 'json'], {api})
    expect((e.json as {data: {tier: string}}).data.tier).toBe('FREE')
  }, 60_000)

  test('audit events sends filters', async () => {
    api.on('GET', '/api/v1/audit-log', {body: {data: [], hasNext: false, hasPrev: false}})
    const r = await runCli(['audit', 'events', '--actor', '4', '--action', 'monitor.updated', '--since', '24h', '-o', 'json'], {api})
    expect(r.code).toBe(0)
    const q = api.calls('GET', '/api/v1/audit-log')[0]!.query
    expect(q.get('actorId')).toBe('4')
    expect(q.get('action')).toBe('monitor.updated')
    expect(q.get('from')).toMatch(/^\d{4}-/)
  }, 60_000)

  test('runtimes list --deprecations / show', async () => {
    const rt = (id: string, status: string) => ({id, nodeVersion: '22', playwrightVersion: '1.56', status, packages: {'@playwright/test': '1.56.0'}, browser: {iframes: true, stripeElements: true, popups: true, downloads: false, viewport: true, geolocation: true, clipboard: false, upload: true}, platformDefault: status === 'available', regions: [{region: 'us-east', available: true}]})
    api.on('GET', '/api/v1/synthetics/runtime-profiles', {body: {data: [rt('2026.11', 'available'), rt('2026.05', 'deprecated')], hasNext: false, hasPrev: false}})
    api.on('GET', '/api/v1/synthetics/runtime-profiles/2026.11', {body: {data: rt('2026.11', 'available')}})
    const l = await runCli(['runtimes', 'list', '--deprecations', '-o', 'json'], {api})
    expect((l.json as {data: Array<{id: string}>}).data.map((x) => x.id)).toEqual(['2026.05'])
    const s = await runCli(['runtimes', 'show', '2026.11', '-o', 'table'], {api})
    expect(s.stdout).toContain('@playwright/test 1.56.0')
    expect(s.stdout).toContain('downloads ✗')
  }, 60_000)

  test('regions and workspaces', async () => {
    api.on('GET', '/api/v1/regions', {body: {data: [{id: 'us-east', displayName: 'US East'}]}})
    api.on('GET', '/api/v1/workspaces', {body: {data: [{id: 2, name: 'prod', orgId: 1, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z'}], hasNext: false, hasPrev: false}})
    expect((await runCli(['regions', 'list', '-o', 'table'], {api})).stdout).toContain('US East')
    expect((await runCli(['workspaces', 'list', '-o', 'table'], {api})).stdout).toContain('prod')
  }, 60_000)

  test('api-keys create --preset --expires; legacy create keeps the bare JSON', async () => {
    api.on('POST', '/api/v1/api-keys', {status: 201, body: {data: KEY}})
    const r = await runCli(['api-keys', 'create', '--name', 'deploy', '--preset', 'ci-deploy', '--expires', '90d', '--output', 'json'], {api})
    expect(r.code).toBe(0)
    expect((r.json as {id: number}).id).toBe(9)
    const body = api.calls('POST', '/api/v1/api-keys')[0]!.json as {preset: string; expiresAt: string}
    expect(body.preset).toBe('ci-deploy')
    expect(Date.parse(body.expiresAt) - Date.now()).toBeGreaterThan(89 * 86_400_000)
    const both = await runCli(['api-keys', 'create', '--name', 'x', '--preset', 'ci-pr', '--scope', 'runs:execute'], {api})
    expect(both.code).toBe(2)
    await runCli(['api-keys', 'create', '--name', 'x', '--scope', 'workspace:read', '--scope', 'runs:execute', '--output', 'json'], {api})
    expect((api.calls('POST', '/api/v1/api-keys')[1]!.json as {scopes: string[]}).scopes).toEqual(['workspace:read', 'runs:execute'])
  }, 60_000)

  test('api-keys rotate calls regenerate', async () => {
    api.on('POST', '/api/v1/api-keys/9/regenerate', {body: {data: KEY}})
    expect((await runCli(['api-keys', 'rotate', '9', '-o', 'json'], {api})).code).toBe(0)
    expect(api.calls('POST', '/api/v1/api-keys/9/regenerate')).toHaveLength(1)
  }, 60_000)

  test('api-keys revoke', async () => {
    api.on('POST', '/api/v1/api-keys/9/revoke', {body: {data: {...KEY, updatedAt: '2026-10-02T00:00:00Z'}}})
    const r = await runCli(['api-keys', 'revoke', '9'], {api})
    expect(r.code).toBe(0)
    expect(r.stdout).toContain('revoked')
  }, 60_000)

  test('incidents ack (alias), add-update, update, related, runs', async () => {
    api.on('POST', `/api/v1/incidents/${INCIDENT_ID}/acknowledge`, {body: {data: {acknowledged: [], skipped: []}}})
    api.on('POST', `/api/v1/incidents/${INCIDENT_ID}/updates`, {body: {data: DETAIL}})
    api.on('PATCH', `/api/v1/incidents/${INCIDENT_ID}`, {body: {data: DETAIL}})
    api.on('GET', `/api/v1/incidents/${INCIDENT_ID}/related`, {body: {data: [INCIDENT], total: 1}})
    api.on('GET', `/api/v1/incidents/${INCIDENT_ID}/runs`, {body: {data: [run()], nextCursor: null, hasMore: false}})
    expect((await runCli(['incidents', 'ack', INCIDENT_ID, '-o', 'json'], {api})).code).toBe(0)
    expect(api.calls('POST', `/api/v1/incidents/${INCIDENT_ID}/acknowledge`)).toHaveLength(1)
    expect((await runCli(['incidents', 'add-update', INCIDENT_ID, '--body', 'rolled back', '--status', 'RESOLVED', '-o', 'json'], {api})).code).toBe(0)
    expect(api.calls('POST', `/api/v1/incidents/${INCIDENT_ID}/updates`)[0]!.json).toEqual({body: 'rolled back', newStatus: 'RESOLVED', notifySubscribers: false})
    expect((await runCli(['incidents', 'add-update', INCIDENT_ID, '--body', 'x', '--notify-subscribers', '-o', 'json'], {api})).code).toBe(0)
    expect(api.calls('POST', `/api/v1/incidents/${INCIDENT_ID}/updates`)[1]!.json).toMatchObject({notifySubscribers: true})
    expect((await runCli(['incidents', 'update', INCIDENT_ID, '--severity', 'DEGRADED', '-o', 'json'], {api})).code).toBe(0)
    expect(api.calls('PATCH', `/api/v1/incidents/${INCIDENT_ID}`)[0]!.json).toEqual({severity: 'DEGRADED'})
    expect((await runCli(['incidents', 'related', INCIDENT_ID, '--window-days', '7', '-o', 'table'], {api})).stdout).toContain('1 related')
    expect((await runCli(['incidents', 'runs', INCIDENT_ID, '-o', 'table'], {api})).stdout).toContain('us-east')
  }, 60_000)
})
