import {afterEach, beforeEach, describe, expect, test} from 'vitest'
import {FakeApi, runCli} from '../helpers/fake-api.js'
import {MID, MID2, monitor} from '../helpers/monitor-fixtures.js'
import {projectRoutes, tempProject, BROWSER_SPEC, PROJECT_YAML} from '../helpers/project-api.js'

const OWNED = monitor({type: 'BROWSER', name: 'Checkout', managedBy: 'GIT', owner: {type: 'GIT', project: 'acme/web'}})
const OTHER = monitor({id: MID2, type: 'BROWSER', name: 'Other', managedBy: 'GIT', owner: {type: 'GIT', project: 'acme/api'}})

describe('doctor and destroy', () => {
  let api: FakeApi
  beforeEach(async () => {
    api = await new FakeApi().start()
    projectRoutes(api, {monitors: [OWNED, OTHER]})
  })
  afterEach(() => api.stop())

  test('doctor reports missing secret values with the fix command (exit 4)', async () => {
    api.on('GET', `/api/v1/monitors/${MID}/secret-requests`, {body: {data: {environment: {id: '33333333-3333-4333-8333-333333333333', orgId: 1, name: 'Production', slug: 'production', variables: {}, isDefault: true, monitorCount: 1, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z'}, requests: [{key: 'CARD_TOKEN', readiness: 'missing'}]}}})
    const dir = tempProject({'devhelm.yml': PROJECT_YAML, 'synthetics/checkout.spec.ts': BROWSER_SPEC})
    const r = await runCli(['doctor', '-o', 'json'], {api, cwd: dir})
    expect(r.code, r.stdout).toBe(4)
    const checks = (r.json as {data: {checks: Array<{check: string; status: string; fix?: string}>}}).data.checks
    const mon = checks.find((c) => c.check === 'monitor Checkout')!
    expect(mon.status).toBe('fail')
    expect(mon.fix).toContain('devhelm secrets values set CARD_TOKEN --env production --value-stdin')
    expect(checks.find((c) => c.check === 'token')!.detail).toContain('legacy key')
  }, 60_000)

  test('destroy --project without a TTY exits 15 with a token; the token deletes only that project', async () => {
    api.on('DELETE', `/api/v1/monitors/${MID}`, {status: 204})
    const r = await runCli(['destroy', '--project', 'acme/web', '-o', 'json'], {api})
    expect(r.code).toBe(15)
    const cmd = (r.json as {confirmCommand: string}).confirmCommand
    const token = cmd.split('--confirm ')[1]!
    const ok = await runCli(['destroy', '--project', 'acme/web', '--confirm', token, '-o', 'json'], {api})
    expect(ok.code).toBe(0)
    expect(api.calls('DELETE', `/api/v1/monitors/${MID}`)).toHaveLength(1)
    expect(api.calls('DELETE', `/api/v1/monitors/${MID2}`)).toHaveLength(0)
    expect((await runCli(['destroy', '--project', 'acme/web', '--confirm', 'cft_wrong', '-o', 'json'], {api})).code).toBe(4)
  }, 60_000)
})
