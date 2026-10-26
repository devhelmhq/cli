import {computeDigestSync} from '@devhelm/sdk/bundler'
import {afterEach, beforeEach, describe, expect, test} from 'vitest'
import {FakeApi, errorBody, runCli} from '../helpers/fake-api.js'
import {MID, RUN_ID, RV_ID, RV_LIVE, head, monitor, revision} from '../helpers/monitor-fixtures.js'
import {BROWSER_SPEC, projectRoutes, run, tempProject} from '../helpers/project-api.js'

const YAML = `project: acme/web
monitors:
  - name: Checkout
    type: BROWSER
    environment: production
    code: synthetics/checkout.spec.ts
    frequencySeconds: 600
    regions: [us-east]
`
const LOCAL = computeDigestSync({'synthetics/checkout.spec.ts': BROWSER_SPEC})

function owned(over: Record<string, unknown> = {}) {
  return monitor({
    type: 'BROWSER', name: 'Checkout', managedBy: 'CLI', ownerEnforced: true,
    owner: {type: 'CLI', project: 'acme/web'}, frequencySeconds: 600, regions: ['us-east'],
    config: {timeoutSeconds: 90, runtimeId: '2026.11'}, liveRevisionDigest: LOCAL, liveRevisionId: RV_LIVE, ...over,
  })
}

describe('devhelm deploy (code monitors)', () => {
  let api: FakeApi
  let dir: string
  let testOutcome = 'passed'

  async function start(monitors: unknown[]) {
    api = await new FakeApi().start()
    projectRoutes(api, {monitors})
    api.on('GET', /^\/api\/v1\/monitors\/[^/]+\/drift$/, {body: {data: {fields: []}}})
    api.on('GET', /^\/api\/v1\/revisions\/[^/]+\/files$/, {body: {data: {entrypoint: 'synthetics/checkout.spec.ts', files: {'synthetics/checkout.spec.ts': 'old'}}}})
    api.on('POST', '/api/v1/monitors/test', {status: 202, body: {data: run()}})
    api.on('POST', `/api/v1/monitors/${MID}/revisions`, {body: {data: {revision: revision()}}})
    api.on('POST', `/api/v1/monitors/${MID}/revisions/${RV_ID}/test`, {status: 202, body: {data: run()}})
    api.on('GET', `/api/v1/runs/${RUN_ID}`, () => ({body: {data: run({phase: 'finished', outcome: testOutcome, durationMs: 1100})}}))
    api.on('POST', '/api/v1/monitors', {status: 201, body: {data: owned()}})
    api.on('POST', `/api/v1/monitors/${MID}/publish`, {body: {data: head()}})
    api.on('PUT', `/api/v1/monitors/${MID}`, {body: {data: owned({updatedAt: '2026-10-25T00:00:01Z'})}})
  }

  beforeEach(() => {
    testOutcome = 'passed'
    dir = tempProject({'devhelm.yml': YAML, 'synthetics/checkout.spec.ts': BROWSER_SPEC})
  })
  afterEach(() => api.stop())

  test('new code monitor: validation run first, then create with code and Git ownership', async () => {
    await start([])
    const r = await runCli(['deploy', '--yes', '-o', 'json'], {api, cwd: dir})
    expect(r.code, r.stderr + r.stdout).toBe(0)
    const adhoc = api.calls('POST', '/api/v1/monitors/test')[0]!.json as {code: {bundle: string}}
    expect(adhoc.code.bundle).toBe(LOCAL)
    const created = api.calls('POST', '/api/v1/monitors')[0]!.json as Record<string, unknown>
    expect(created).toMatchObject({name: 'Checkout', type: 'BROWSER', ownerEnforced: true, ownerProject: 'acme/web', code: {bundle: LOCAL, entrypoint: 'synthetics/checkout.spec.ts'}})
    expect(['GIT', 'CLI']).toContain(created.managedBy)
    expect(created).not.toHaveProperty('enabled')
    const doc = r.json as {landed: Array<{name: string}>; notLanded: unknown[]}
    expect(doc.landed.map((l) => l.name)).toEqual(['Checkout'])
    expect(doc.notLanded).toEqual([])
  }, 90_000)

  test('a failed validation run creates nothing: notLanded, exit 13', async () => {
    testOutcome = 'failed'
    await start([])
    const r = await runCli(['deploy', '--yes', '-o', 'json'], {api, cwd: dir})
    expect(r.code).toBe(13)
    expect(api.calls('POST', '/api/v1/monitors')).toHaveLength(0)
    const doc = r.json as {notLanded: Array<{name: string; category: string}>}
    expect(doc.notLanded[0]).toMatchObject({name: 'Checkout', category: 'check_failed'})
  }, 90_000)

  test('changed code: draft → test → publish with requireTested and the expected live revision', async () => {
    await start([owned({liveRevisionDigest: 'sha256:' + 'c'.repeat(64)})])
    const r = await runCli(['deploy', '--yes', '-o', 'json'], {api, cwd: dir})
    expect(r.code, r.stderr + r.stdout).toBe(0)
    expect((api.calls('POST', `/api/v1/monitors/${MID}/revisions`)[0]!.json as {code: {bundle: string}}).code.bundle).toBe(LOCAL)
    expect(api.calls('POST', `/api/v1/monitors/${MID}/publish`)[0]!.json).toMatchObject({revisionId: RV_ID, requireTested: true, expectedLiveRevisionId: RV_LIVE})
    expect(api.calls('PUT', `/api/v1/monitors/${MID}`)).toHaveLength(0)
  }, 90_000)

  test('a failed draft test publishes nothing and keeps the draft', async () => {
    testOutcome = 'failed'
    await start([owned({liveRevisionDigest: 'sha256:' + 'c'.repeat(64)})])
    const r = await runCli(['deploy', '--yes', '-o', 'json'], {api, cwd: dir})
    expect(r.code).toBe(13)
    expect(api.calls('POST', `/api/v1/monitors/${MID}/publish`)).toHaveLength(0)
    expect((r.json as {notLanded: Array<{draftRevisionId: string}>}).notLanded[0]!.draftRevisionId).toBe(RV_ID)
  }, 90_000)

  test('--no-test publishes with PUT … code and runs nothing', async () => {
    await start([owned({liveRevisionDigest: 'sha256:' + 'c'.repeat(64)})])
    const r = await runCli(['deploy', '--yes', '--no-test', '-o', 'json'], {api, cwd: dir})
    expect(r.code, r.stderr).toBe(0)
    expect(api.calls('POST', `/api/v1/monitors/${MID}/revisions/${RV_ID}/test`)).toHaveLength(0)
    expect((api.calls('PUT', `/api/v1/monitors/${MID}`)[0]!.json as {code: {bundle: string}}).code.bundle).toBe(LOCAL)
  }, 90_000)

  test('publish refused after the settings PUT: one compensating PUT guarded by expectedUpdatedAt', async () => {
    await start([owned({liveRevisionDigest: 'sha256:' + 'c'.repeat(64), frequencySeconds: 1200})])
    api.on('POST', `/api/v1/monitors/${MID}/publish`, {status: 409, body: errorBody('conflict', 'LIVE_REVISION_CHANGED', 409)})
    const r = await runCli(['deploy', '--yes', '-o', 'json'], {api, cwd: dir})
    expect(r.code).toBe(13)
    const puts = api.calls('PUT', `/api/v1/monitors/${MID}`).map((c) => c.json as Record<string, unknown>)
    expect(puts).toHaveLength(2)
    expect(puts[0]).toMatchObject({frequencySeconds: 600, expectedUpdatedAt: '2026-10-20T10:00:00Z'})
    expect(puts[1]).toMatchObject({frequencySeconds: 1200, expectedUpdatedAt: '2026-10-25T00:00:01Z'})
    expect((r.json as {notLanded: Array<{half: string}>}).notLanded[0]!.half).toBe('both')
  }, 90_000)

  test('compensation fails too: notLanded describes both halves, exit 13', async () => {
    await start([owned({liveRevisionDigest: 'sha256:' + 'c'.repeat(64), frequencySeconds: 1200})])
    api.on('POST', `/api/v1/monitors/${MID}/publish`, {status: 409, body: errorBody('conflict', 'LIVE_REVISION_CHANGED', 409)})
    let n = 0
    api.on('PUT', `/api/v1/monitors/${MID}`, () => (++n === 1
      ? {body: {data: owned({updatedAt: '2026-10-25T00:00:01Z'})}}
      : {status: 409, body: errorBody('conflict', 'MONITOR_UPDATED_CONCURRENTLY', 409)}))
    const r = await runCli(['deploy', '--yes', '-o', 'json'], {api, cwd: dir})
    expect(r.code).toBe(13)
    const nl = (r.json as {notLanded: Array<{half: string; message: string}>}).notLanded[0]!
    expect(nl.half).toBe('settings')
    expect(nl.message).toContain('reverting the settings failed')
    expect(n).toBe(2)
  }, 90_000)

  test('without a TTY and without --yes: exit 15 with changes[] and the confirm command', async () => {
    await start([])
    const r = await runCli(['deploy', '-o', 'json'], {api, cwd: dir})
    expect(r.code).toBe(15)
    const doc = r.json as {changes: unknown[]; confirmCommand: string}
    expect(doc.changes.length).toBeGreaterThan(0)
    expect(doc.confirmCommand).toContain('--yes')
    expect(api.calls('POST', '/api/v1/monitors/test')).toHaveLength(0)
  }, 90_000)

  test('a same-named monitor this project does not own: exit 17 before any write; --adopt transfers it', async () => {
    await start([owned({managedBy: 'DASHBOARD', owner: {type: 'DASHBOARD', project: null}, liveRevisionDigest: LOCAL})])
    const r = await runCli(['deploy', '--yes', '-o', 'json'], {api, cwd: dir})
    expect(r.code).toBe(17)
    expect((r.json as {error: {code: string}}).error.code).toBe('MONITOR_OWNED_BY_OTHER')
    expect(api.calls('POST', '/api/v1/deploy/lock')).toHaveLength(0)
    api.on('POST', `/api/v1/monitors/${MID}/transfer`, {body: {data: owned()}})
    const a = await runCli(['deploy', '--yes', '--adopt', 'Checkout', '-o', 'json'], {api, cwd: dir})
    expect(a.code, a.stderr + a.stdout).toBe(0)
    expect(api.calls('POST', `/api/v1/monitors/${MID}/transfer`)[0]!.json).toMatchObject({project: 'acme/web', reason: 'devhelm deploy --adopt'})
  }, 90_000)

  test('a plan-fit refusal exits 16 before any write', async () => {
    await start([])
    api.on('POST', '/api/v1/monitors/validate', {body: {data: {findings: [{severity: 'ERROR', code: 'MONITOR_FREQUENCY_BELOW_PLAN_MIN', message: 'Free runs code checks hourly', monitorIndex: 0, limit: 3600, plan: 'FREE'}], projections: []}}})
    const r = await runCli(['deploy', '--yes', '-o', 'json'], {api, cwd: dir})
    expect(r.code).toBe(16)
    expect(api.calls('POST', '/api/v1/monitors/test')).toHaveLength(0)
    const p = await runCli(['plan', '-o', 'json'], {api, cwd: dir})
    expect(p.code).toBe(16)
  }, 90_000)

  test('repeated plan after deploy shows no changes', async () => {
    await start([owned()])
    const r = await runCli(['plan', '--detailed-exitcode', '-o', 'json'], {api, cwd: dir})
    expect(r.code, r.stdout).toBe(0)
    expect((r.json as {summary: {updates: number; creates: number}}).summary).toMatchObject({creates: 0, updates: 0})
  }, 90_000)

  test('a file only in code.include ships with the closure', async () => {
    await start([])
    dir = tempProject({
      'devhelm.yml': YAML.replace('code: synthetics/checkout.spec.ts', 'code: {entrypoint: synthetics/checkout.spec.ts, include: [synthetics/fixtures/cart.json]}'),
      'synthetics/checkout.spec.ts': BROWSER_SPEC,
      'synthetics/fixtures/cart.json': '{"sku": "A1"}\n',
    })
    const r = await runCli(['deploy', '--yes', '-o', 'json'], {api, cwd: dir})
    expect(r.code, r.stderr + r.stdout).toBe(0)
    const files = Object.keys((api.calls('POST', '/api/v1/bundles')[0]!.json as {files: object}).files).sort()
    expect(files).toEqual(['synthetics/checkout.spec.ts', 'synthetics/fixtures/cart.json'])
  }, 90_000)

  test('--prune-all is refused (removed)', async () => {
    await start([])
    expect((await runCli(['deploy', '--prune-all', '--yes'], {api, cwd: dir})).code).toBe(4)
  }, 90_000)
})
