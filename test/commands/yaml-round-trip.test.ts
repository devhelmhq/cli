/**
 * Round-trip (doc 42 §6.2): `monitors export` (and `import monitor`) write
 * the same keys deploy reads, and a plan over the written devhelm.yml shows
 * no changes.
 */
import {readFileSync, writeFileSync, mkdtempSync, mkdirSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {computeDigestSync} from '@devhelm/sdk/bundler'
import {afterEach, beforeEach, describe, expect, test} from 'vitest'
import {parse as parseYaml} from 'yaml'
import {FakeApi, runCli} from '../helpers/fake-api.js'
import {MID, RV_LIVE, monitor} from '../helpers/monitor-fixtures.js'
import {BROWSER_SPEC, projectRoutes} from '../helpers/project-api.js'

const FILES = {'checkout.spec.ts': BROWSER_SPEC, 'fixtures/cart.json': '{"sku":"A1"}\n'}

function live() {
  return monitor({
    type: 'BROWSER', name: 'Checkout', managedBy: 'GIT', ownerEnforced: true,
    owner: {type: 'GIT', project: 'acme/web'}, frequencySeconds: 600, regions: ['us-east'], runParallel: true,
    fastRetryMaxAttempts: 1, capturePolicy: {screenshots: 'on_failure', trace: 'on_failure', video: 'off', network: 'on_failure'},
    config: {timeoutSeconds: 90, runtimeId: '2026.11'},
    liveRevisionId: RV_LIVE,
    liveRevisionDigest: computeDigestSync(FILES),
  })
}

describe('YAML round-trip', () => {
  let api: FakeApi
  beforeEach(async () => {
    api = await new FakeApi().start()
    projectRoutes(api, {monitors: [live()]})
    api.on('GET', `/api/v1/monitors/${MID}`, {body: {data: live()}})
    api.on('GET', `/api/v1/revisions/${RV_LIVE}/files`, {body: {data: {entrypoint: 'checkout.spec.ts', files: FILES}}})
    api.on('GET', /^\/api\/v1\/monitors\/[^/]+\/drift$/, {body: {data: {fields: []}}})
  })
  afterEach(() => api.stop())

  test('export → plan shows no changes', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'devhelm-rt-'))
    mkdirSync(join(dir, '.git'))
    const out = join(dir)
    const e = await runCli(['monitors', 'export', 'Checkout', '--dir', out, '-o', 'json'], {api, cwd: dir})
    expect(e.code, e.stderr + e.stdout).toBe(0)
    const yml = readFileSync(join(out, 'devhelm.yml'), 'utf8')
    const doc = parseYaml(yml) as {monitors: Array<Record<string, unknown>>}
    expect(Object.keys(doc.monitors[0]!).sort()).toEqual(expect.arrayContaining(['name', 'type', 'environment', 'code', 'frequencySeconds', 'regions', 'runParallel', 'fastRetryMaxAttempts', 'capturePolicy', 'config']))
    writeFileSync(join(out, 'devhelm.yml'), `project: acme/web\n${yml}`)
    const p = await runCli(['plan', '--detailed-exitcode', '-o', 'json'], {api, cwd: out})
    expect(p.code, JSON.stringify(p.json)).toBe(0)
    expect((p.json as {summary: {creates: number; updates: number}}).summary).toMatchObject({creates: 0, updates: 0})
  }, 90_000)
})
