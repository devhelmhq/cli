import {afterEach, beforeEach, describe, expect, test} from 'vitest'
import {FakeApi, runCli} from '../helpers/fake-api.js'
import {BROWSER_SPEC, PROJECT_YAML, projectRoutes, run, tempProject} from '../helpers/project-api.js'
import {RUN_ID} from '../helpers/monitor-fixtures.js'

describe('devhelm test', () => {
  let api: FakeApi
  let dir: string
  let finalRun: Record<string, unknown>
  let probePassed = true

  beforeEach(async () => {
    api = await new FakeApi().start()
    projectRoutes(api)
    dir = tempProject({'devhelm.yml': PROJECT_YAML, 'synthetics/checkout.spec.ts': BROWSER_SPEC})
    finalRun = run({phase: 'finished', outcome: 'passed', durationMs: 4600})
    probePassed = true
    api.on('POST', '/api/v1/monitors/test', (req) => {
      const body = req.json as {type: string}
      if (body.type === 'BROWSER') return {status: 202, body: {data: run({phase: 'queued'})}}
      return {status: 200, body: {data: {passed: probePassed, assertionResults: [], responseTimeMs: 212, statusCode: probePassed ? 200 : 500}}}
    })
    api.on('GET', `/api/v1/runs/${RUN_ID}`, () => ({body: {data: finalRun}}))
  })
  afterEach(() => api.stop())

  test('new code monitor: uploads the closure, runs ad hoc in its environment, waits, exit 0', async () => {
    const r = await runCli(['test', '-o', 'json'], {api, cwd: dir})
    expect(r.code, r.stderr).toBe(0)
    const upload = api.calls('POST', '/api/v1/bundles')[0]!
    expect(Object.keys((upload.json as {files: object}).files)).toEqual(['synthetics/checkout.spec.ts'])
    const adhoc = api.calls('POST', '/api/v1/monitors/test').map((c) => c.json as Record<string, unknown>)
    const code = adhoc.find((b) => b.type === 'BROWSER')!
    expect(code.environmentId).toBe('33333333-3333-4333-8333-333333333333')
    expect((code.code as {entrypoint: string}).entrypoint).toBe('synthetics/checkout.spec.ts')
    expect(adhoc.find((b) => b.type === 'HTTP')!.config).toEqual({url: 'https://example.com', method: 'GET'})
    const doc = r.json as {ok: boolean; exit: number; data: {results: Array<{kind: string; verdict: string}>; billedRuns: number}}
    expect(doc.ok).toBe(true)
    expect(doc.data.results.map((x) => `${x.kind}:${x.verdict}`).sort()).toEqual(['probe:passed', 'run:passed'])
    expect(doc.data.billedRuns).toBe(1)
  }, 60_000)

  test('a failed run exits 14 and prints the failure with file:line', async () => {
    finalRun = run({phase: 'finished', outcome: 'failed', failure: {kind: 'assertion', message: 'expected 201, got 500', file: 'synthetics/checkout.spec.ts', line: 9}})
    const r = await runCli(['test', 'Checkout', '-o', 'table'], {api, cwd: dir})
    expect(r.code).toBe(14)
    expect(r.stdout).toContain('expected 201, got 500 · synthetics/checkout.spec.ts:9')
    expect(r.stdout).toContain(`next: devhelm runs get ${RUN_ID} --steps`)
  }, 60_000)

  test('a failed probe exits 14; failed beats no verdict', async () => {
    probePassed = false
    finalRun = run({phase: 'finished', outcome: 'execution_error', billable: false})
    const r = await runCli(['test', '-o', 'json'], {api, cwd: dir})
    expect(r.code).toBe(14)
  }, 60_000)

  test('no verdict exits 19, or 0 with --no-fail-on-infra-error', async () => {
    finalRun = run({phase: 'finished', outcome: 'execution_error', billable: false})
    expect((await runCli(['test', 'Checkout', '-o', 'json'], {api, cwd: dir})).code).toBe(19)
    expect((await runCli(['test', 'Checkout', '-o', 'json', '--no-fail-on-infra-error'], {api, cwd: dir})).code).toBe(0)
  }, 60_000)

  test('an unknown selector exits 4', async () => {
    const r = await runCli(['test', 'Nope', '-o', 'json'], {api, cwd: dir})
    expect(r.code).toBe(4)
    expect((r.json as {error: {code: string}}).error.code).toBe('NO_MATCHING_MONITORS')
  }, 60_000)

  test('--reporter junit prints JUnit XML; --reporter github prints annotations', async () => {
    finalRun = run({phase: 'finished', outcome: 'failed', failure: {kind: 'assertion', message: 'boom', file: 'synthetics/checkout.spec.ts', line: 4}})
    const j = await runCli(['test', 'Checkout', '--reporter', 'junit'], {api, cwd: dir})
    expect(j.code).toBe(14)
    expect(j.stdout).toContain('<testsuites')
    expect(j.stdout).toContain('<failure message="boom')
    const g = await runCli(['test', 'Checkout', '--reporter', 'github'], {api, cwd: dir})
    expect(g.stdout).toContain('::error file=synthetics/checkout.spec.ts,line=4')
  }, 60_000)

  test('the session defaults to the GitHub run', async () => {
    await runCli(['test', 'Checkout', '-o', 'json'], {api, cwd: dir, env: {GITHUB_RUN_ID: '123', GITHUB_REPOSITORY: 'acme/web', GITHUB_SHA: 'abc'}})
    const body = api.calls('POST', '/api/v1/monitors/test').map((c) => c.json as {type: string; session?: {id: string; commit: string}}).find((b) => b.type === 'BROWSER')!
    expect(body.session?.id).toBe('gh-acme/web-123-1')
    expect(body.session?.commit).toBe('abc')
  }, 60_000)

  test('an import outside the bundle is refused offline, exit 4', async () => {
    const bad = tempProject({'devhelm.yml': PROJECT_YAML, 'synthetics/checkout.spec.ts': `import x from '../../outside'\n${BROWSER_SPEC}`})
    const r = await runCli(['test', 'Checkout', '-o', 'json'], {api, cwd: bad})
    expect(r.code).toBe(4)
  }, 60_000)
})
