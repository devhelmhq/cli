/** New `monitors …` verbs (doc 42 §6.4): routes, bodies and exit codes. */
import {mkdtempSync, readFileSync, existsSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {parse as parseYaml} from 'yaml'
import {afterEach, beforeEach, describe, expect, test} from 'vitest'
import {FakeApi, errorBody, runCli} from '../helpers/fake-api.js'
import {ENV_ID, MID, RUN_ID, RV_ID, RV_LIVE, cursor, head, monitor, page, revision, run} from '../helpers/monitor-fixtures.js'

type Doc = {ok: boolean; exit: number; data: Record<string, unknown>; warnings: string[]; error?: {code: string}; changes?: unknown[]; confirmCommand?: string}

describe('monitors overlays and lifecycle', () => {
  let api: FakeApi
  beforeEach(async () => {
    api = await new FakeApi().start()
    api.on('GET', `/api/v1/monitors/${MID}`, {body: {data: monitor({type: 'BROWSER'})}})
  })
  afterEach(() => api.stop())

  test('mute --for sends an expiry; unmute posts', async () => {
    api.on('POST', `/api/v1/monitors/${MID}/mute`, {body: {data: monitor({muted: true})}})
    api.on('POST', `/api/v1/monitors/${MID}/unmute`, {body: {data: monitor()}})
    const r = await runCli(['monitors', 'mute', MID, '--for', '2h', '--reason', 'outage'], {api})
    expect(r.code).toBe(0)
    expect((r.json as Doc).ok).toBe(true)
    const body = api.calls('POST', `/api/v1/monitors/${MID}/mute`)[0]!.json as {reason: string; expiresAt: string}
    expect(body.reason).toBe('outage')
    expect(Date.parse(body.expiresAt) - Date.now()).toBeGreaterThan(7_000_000)
    expect((await runCli(['monitors', 'unmute', MID], {api})).code).toBe(0)
  }, 60_000)

  test('quarantine requires --reason and sends expiresAt', async () => {
    api.on('POST', `/api/v1/monitors/${MID}/quarantine`, {body: {data: monitor()}})
    api.on('POST', `/api/v1/monitors/${MID}/release-quarantine`, {body: {data: monitor()}})
    expect((await runCli(['monitors', 'quarantine', MID], {api})).code).toBe(2)
    const r = await runCli(['monitors', 'quarantine', MID, '--reason', 'flaky', '--until', '1d'], {api})
    expect(r.code).toBe(0)
    expect(api.calls('POST', `/api/v1/monitors/${MID}/quarantine`)[0]!.json).toMatchObject({reason: 'flaky'})
    expect((await runCli(['monitors', 'release-quarantine', MID], {api})).code).toBe(0)
  }, 60_000)

  test('trash list and restore by name from Trash', async () => {
    api.on('GET', '/api/v1/monitors/trash', {body: page([monitor({deletedAt: '2026-10-22T10:00:00Z'})])})
    api.on('POST', `/api/v1/monitors/${MID}/restore`, {body: {data: monitor()}})
    const list = await runCli(['monitors', 'trash', 'list'], {api})
    expect(((list.json as Doc).data as unknown as unknown[]).length).toBe(1)
    const r = await runCli(['monitors', 'restore', 'Checkout'], {api})
    expect(r.code).toBe(0)
    expect(api.calls('POST', `/api/v1/monitors/${MID}/restore`)[0]!.json).toEqual({})
  }, 60_000)

  test('history filters by --failed / --region / --since', async () => {
    api.on('GET', `/api/v1/monitors/${MID}/history`, {body: cursor([
      {kind: 'not_run', monitorId: MID, reason: 'quota', region: 'us-east', from: new Date().toISOString(), to: new Date().toISOString(), count: 1},
      {kind: 'not_run', monitorId: MID, reason: 'blocked', region: 'eu-west', from: '2020-01-01T00:00:00Z', to: '2020-01-01T00:00:00Z', count: 2},
    ])})
    const r = await runCli(['monitors', 'history', MID, '--region', 'us-east', '--since', '24h', '--failed'], {api})
    expect(r.code).toBe(0)
    expect(((r.json as Doc).data as unknown as Array<{reason: string}>).map((x) => x.reason)).toEqual(['quota'])
  }, 60_000)

  test('run: code monitor posts /runs and waits', async () => {
    api.on('POST', `/api/v1/monitors/${MID}/runs`, {status: 202, body: {data: run({source: 'run_now'})}})
    api.on('GET', `/api/v1/runs/${RUN_ID}`, {body: {data: run({phase: 'finished', outcome: 'passed'})}})
    const r = await runCli(['monitors', 'run', MID], {api})
    expect(r.code).toBe(0)
    expect((r.json as Doc).data.outcome).toBe('passed')
  }, 60_000)

  test('run: uptime monitor is refused client-side (exit 4)', async () => {
    api.on('GET', `/api/v1/monitors/${MID}`, {body: {data: monitor()}})
    const r = await runCli(['monitors', 'run', MID], {api})
    expect(r.code).toBe(4)
    expect((r.json as Doc).error!.code).toBe('MONITOR_CODE_TYPE_REQUIRED')
    expect(api.calls('POST', `/api/v1/monitors/${MID}/runs`)).toHaveLength(0)
  }, 60_000)

  test('transfer: non-TTY without --yes exits 15 with changes and confirmCommand', async () => {
    const r = await runCli(['monitors', 'transfer', MID, '--to', 'git', '--project', 'acme/web', '--reason', 'adopt'], {api})
    expect(r.code).toBe(15)
    const doc = r.json as Doc
    expect(doc.changes).toHaveLength(1)
    expect(doc.confirmCommand).toContain('--yes')
    expect(api.calls('POST', `/api/v1/monitors/${MID}/transfer`)).toHaveLength(0)
  }, 60_000)

  test('transfer --yes posts the git owner and prints before → after', async () => {
    api.on('POST', `/api/v1/monitors/${MID}/transfer`, {body: {data: monitor({type: 'BROWSER', managedBy: 'CLI', owner: {type: 'CLI', project: 'acme/web'}})}})
    const r = await runCli(['monitors', 'transfer', MID, '--to', 'git', '--project', 'acme/web', '--reason', 'adopt', '--yes', '-o', 'table'], {api})
    expect(r.code).toBe(0)
    const body = api.calls('POST', `/api/v1/monitors/${MID}/transfer`)[0]!.json as {to: string; project: string}
    expect(['GIT', 'CLI']).toContain(body.to)
    expect(body.project).toBe('acme/web')
    expect(r.stdout).toContain('DASHBOARD → GIT · acme/web')
    expect(r.stdout).toContain('undo: devhelm monitors transfer')
  }, 60_000)

  test('secret-requests list prints the fix command for missing keys', async () => {
    api.on('GET', `/api/v1/monitors/${MID}/secret-requests`, {body: {data: {
      environment: {id: ENV_ID, orgId: 1, name: 'Production', slug: 'production', variables: {}, createdAt: '2026-10-20T10:00:00Z', updatedAt: '2026-10-20T10:00:00Z', monitorCount: 1, isDefault: true},
      requests: [{key: 'CARD_TOKEN', readiness: 'missing'}],
    }}})
    const r = await runCli(['monitors', 'secret-requests', 'list', MID, '-o', 'table'], {api})
    expect(r.code).toBe(0)
    expect(r.stdout).toContain('devhelm secrets values set CARD_TOKEN --env production --value-stdin')
  }, 60_000)

  test('secret-requests rescan / sessions list / renew / revoke hit their routes', async () => {
    const reqs = {environment: {id: ENV_ID, orgId: 1, name: 'P', slug: 'production', variables: {}, createdAt: '2026-10-20T10:00:00Z', updatedAt: '2026-10-20T10:00:00Z', monitorCount: 1, isDefault: true}, requests: []}
    const session = {lifecycle: 'revoked', reusePolicy: 'reuse', setupFile: 'auth.setup.ts', cookieNames: [], storageKeys: []}
    api.on('POST', `/api/v1/monitors/${MID}/secret-requests/rescan`, {body: {data: reqs}})
    api.on('GET', `/api/v1/monitors/${MID}/sessions`, {body: page([session])})
    api.on('POST', `/api/v1/monitors/${MID}/sessions/revoke`, {body: {data: session}})
    api.on('POST', `/api/v1/monitors/${MID}/sessions/renew`, {status: 202, body: {data: run({source: 'session_renew'})}})
    expect((await runCli(['monitors', 'secret-requests', 'rescan', MID], {api})).code).toBe(0)
    expect((await runCli(['monitors', 'sessions', 'list', MID], {api})).code).toBe(0)
    expect((await runCli(['monitors', 'sessions', 'revoke', MID, '--setup-file', 'auth.setup.ts'], {api})).code).toBe(0)
    expect(api.calls('POST', `/api/v1/monitors/${MID}/sessions/revoke`)[0]!.query.get('setupFile')).toBe('auth.setup.ts')
    expect((await runCli(['monitors', 'sessions', 'renew', MID, '--no-wait'], {api})).code).toBe(0)
  }, 60_000)
})

describe('monitors revisions, publish, rollback, export', () => {
  let api: FakeApi
  beforeEach(async () => {
    api = await new FakeApi().start()
    api.on('GET', `/api/v1/monitors/${MID}`, {body: {data: monitor({type: 'BROWSER'})}})
  })
  afterEach(() => api.stop())

  test('revisions list sends state flat and renders the columns', async () => {
    api.on('GET', `/api/v1/monitors/${MID}/revisions`, {body: page([revision({liveStats: {runs: 10, failed: 1}, source: {commit: 'abcdef123'}})])})
    const r = await runCli(['monitors', 'revisions', 'list', MID, '--state', 'draft,all', '-o', 'table'], {api})
    expect(r.code).toBe(0)
    expect(api.calls('GET', `/api/v1/monitors/${MID}/revisions`)[0]!.query.get('state')).toBe('draft,all')
    for (const h of ['ID', '#', 'STATE', 'SOURCE', 'COMMIT', 'WHEN', 'WHILE LIVE']) expect(r.stdout).toContain(h)
    expect(r.stdout).toContain('9/10 passed')
    expect(r.stdout).toContain('abcdef1')
  }, 60_000)

  test('revisions get --files --dir writes the files', async () => {
    api.on('GET', `/api/v1/revisions/${RV_ID}`, {body: {data: revision()}})
    api.on('GET', `/api/v1/revisions/${RV_ID}/files`, {body: {data: {entrypoint: 'checkout.spec.ts', files: {'checkout.spec.ts': 'test()', 'lib/a.ts': 'x'}}}})
    const dir = mkdtempSync(join(tmpdir(), 'dh-rv-'))
    const r = await runCli(['monitors', 'revisions', 'get', MID, RV_ID, '--files', '--dir', dir], {api})
    expect(r.code).toBe(0)
    expect(readFileSync(join(dir, 'lib/a.ts'), 'utf8')).toBe('x')
  }, 60_000)

  test('revisions diff with one id compares against the live revision', async () => {
    api.on('GET', `/api/v1/revisions/${RV_LIVE}/diff/${RV_ID}`, {body: {data: {left: revision({id: RV_LIVE, number: 2}), right: revision(), hunks: [{path: 'a.ts', change: 'changed', left: 'a', right: 'b'}]}}})
    const r = await runCli(['monitors', 'revisions', 'diff', MID, RV_ID, '-o', 'table'], {api})
    expect(r.code).toBe(0)
    expect(r.stdout).toContain('~ a.ts')
  }, 60_000)

  test('revisions create needs the bundler (exit 4 until wired)', async () => {
    const r = await runCli(['monitors', 'revisions', 'create', MID, '--code', 'x.spec.ts'], {api})
    expect(r.code).toBe(4)
  }, 60_000)

  test('revisions test waits; failed → 14, inconclusive → 19', async () => {
    let outcome = 'failed'
    api.on('POST', `/api/v1/monitors/${MID}/revisions/${RV_ID}/test`, {status: 202, body: {data: run()}})
    api.on('GET', `/api/v1/runs/${RUN_ID}`, () => ({body: {data: run({phase: 'finished', outcome})}}))
    expect((await runCli(['monitors', 'revisions', 'test', MID, RV_ID, '--region', 'eu-west'], {api})).code).toBe(14)
    expect(api.calls('POST', `/api/v1/monitors/${MID}/revisions/${RV_ID}/test`)[0]!.json).toEqual({region: 'eu-west'})
    outcome = 'inconclusive'
    expect((await runCli(['monitors', 'revisions', 'test', MID, RV_ID], {api})).code).toBe(19)
  }, 60_000)

  test('revisions test --timeout elapsed → 19 with the run still going', async () => {
    api.on('POST', `/api/v1/monitors/${MID}/revisions/${RV_ID}/test`, {status: 202, body: {data: run()}})
    api.on('GET', `/api/v1/runs/${RUN_ID}`, {body: {data: run({phase: 'running'})}})
    const r = await runCli(['monitors', 'revisions', 'test', MID, RV_ID, '--timeout', '1s'], {api})
    expect(r.code).toBe(19)
    expect((r.json as Doc).warnings.join(' ')).toContain('keeps running')
  }, 60_000)

  test('revisions discard / keep / purge', async () => {
    api.on('DELETE', `/api/v1/monitors/${MID}/revisions/${RV_ID}`, {status: 204})
    api.on('POST', `/api/v1/monitors/${MID}/revisions/${RV_ID}/keep`, {body: {data: revision()}})
    api.on('POST', `/api/v1/revisions/${RV_ID}/purge`, {body: {data: revision()}})
    expect((await runCli(['monitors', 'revisions', 'discard', MID, RV_ID], {api})).code).toBe(0)
    expect((await runCli(['monitors', 'revisions', 'keep', MID, RV_ID], {api})).code).toBe(0)
    expect((await runCli(['monitors', 'revisions', 'purge', MID, RV_ID, '--reason', 'leaked'], {api})).code).toBe(0)
    expect(api.calls('POST', `/api/v1/revisions/${RV_ID}/purge`)[0]!.json).toEqual({reason: 'leaked'})
  }, 60_000)

  test('discard of a live revision is a conflict (exit 18)', async () => {
    api.on('DELETE', `/api/v1/monitors/${MID}/revisions/${RV_ID}`, {status: 409, body: errorBody('conflict', 'REVISION_IS_LIVE', 409)})
    expect((await runCli(['monitors', 'revisions', 'discard', MID, RV_ID], {api})).code).toBe(18)
  }, 60_000)

  test('publish sends requireTested/expected-live; REVISION_UNTESTED exits 18', async () => {
    api.on('POST', `/api/v1/monitors/${MID}/publish`, {body: {data: head()}})
    const r = await runCli(['monitors', 'publish', MID, '--revision', RV_ID, '--require-tested', '--expected-live', RV_LIVE, '--note', 'ship'], {api})
    expect(r.code).toBe(0)
    expect(api.calls('POST', `/api/v1/monitors/${MID}/publish`)[0]!.json).toEqual({revisionId: RV_ID, requireTested: true, expectedLiveRevisionId: RV_LIVE, note: 'ship'})
    api.on('POST', `/api/v1/monitors/${MID}/publish`, {status: 409, body: errorBody('conflict', 'REVISION_UNTESTED', 409)})
    expect((await runCli(['monitors', 'publish', MID, '--revision', RV_ID, '--require-tested'], {api})).code).toBe(18)
  }, 60_000)

  test('rollback previews, then posts; emergency needs --yes without a TTY', async () => {
    api.on('GET', `/api/v1/monitors/${MID}/rollback-preview`, {body: {data: {
      target: revision({id: RV_LIVE, number: 2}),
      current: head({linkedIncidents: [{id: MID, monitorId: MID, status: 'CONFIRMED', title: 'Checkout down'}]}),
      affectedMonitors: [monitor({type: 'BROWSER'})],
    }}})
    api.on('POST', `/api/v1/monitors/${MID}/rollback`, {body: {data: head({revision: revision({id: RV_LIVE, number: 2, state: 'live'})})}})
    const r = await runCli(['monitors', 'rollback', MID, '--reason', 'provider v2 returns 503', '-o', 'table'], {api})
    expect(r.code).toBe(0)
    expect(r.stdout).toContain('affected: Checkout (production)')
    expect(r.stdout).toContain('open incident')
    expect(api.calls('POST', `/api/v1/monitors/${MID}/rollback`)[0]!.json).toEqual({reason: 'provider v2 returns 503'})
    const e = await runCli(['monitors', 'rollback', MID, '--reason', 'provider v2 returns 503', '--emergency'], {api})
    expect(e.code).toBe(15)
    const ok = await runCli(['monitors', 'rollback', MID, '--reason', 'provider v2 returns 503', '--emergency', '--yes', '--revision', RV_LIVE], {api})
    expect(ok.code).toBe(0)
    expect(api.calls('GET', `/api/v1/monitors/${MID}/rollback-preview`).at(-1)!.query.get('revisionId')).toBe(RV_LIVE)
  }, 60_000)

  test('export writes code, a devhelm.yml entry and the fidelity report', async () => {
    api.on('GET', `/api/v1/monitors/${MID}`, {body: {data: monitor({type: 'BROWSER', alertChannelIds: [ENV_ID], tags: [{id: ENV_ID, organizationId: 1, name: 'checkout', color: '#fff', createdAt: '2026-10-20T10:00:00Z', updatedAt: '2026-10-20T10:00:00Z'}], muted: true, capturePolicy: {screenshots: 'on_failure', trace: null}})}})
    api.on('GET', '/api/v1/alert-channels', {body: page([{id: ENV_ID, name: 'slack-oncall', channelType: 'slack', enabled: true, createdAt: '2026-10-20T10:00:00Z', updatedAt: '2026-10-20T10:00:00Z'}])})
    api.on('GET', `/api/v1/revisions/${RV_LIVE}/files`, {body: {data: {entrypoint: 'checkout.spec.ts', files: {'checkout.spec.ts': 'test()'}}}})
    const dir = mkdtempSync(join(tmpdir(), 'dh-export-'))
    const r = await runCli(['monitors', 'export', MID, '--dir', dir], {api})
    expect(r.code).toBe(0)
    const yml = parseYaml(readFileSync(join(dir, 'devhelm.yml'), 'utf8')) as {monitors: Array<Record<string, unknown>>}
    expect(yml.monitors[0]).toMatchObject({name: 'Checkout', type: 'BROWSER', environment: 'production', code: 'checkout.spec.ts', regions: ['us-east', 'eu-west'], capturePolicy: {screenshots: 'on_failure'}, tags: ['checkout']})
    expect(yml.monitors[0]!.enabled).toBeUndefined()
    expect(existsSync(join(dir, 'checkout.spec.ts'))).toBe(true)
    const report = JSON.parse(readFileSync(join(dir, 'export-report.json'), 'utf8')) as Array<{notExported: string[]}>
    expect(report[0]!.notExported.join(' ')).toContain('muted')
  }, 60_000)

  test('export needs exactly one selector', async () => {
    expect((await runCli(['monitors', 'export', '--dir', '/tmp/x'], {api})).code).toBe(4)
  }, 60_000)
})
