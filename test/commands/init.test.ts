import {existsSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {afterEach, beforeEach, describe, expect, test} from 'vitest'
import {parse as parseYaml} from 'yaml'
import {FakeApi, runCli} from '../helpers/fake-api.js'
import {ENTITLEMENTS, projectRoutes} from '../helpers/project-api.js'

describe('devhelm init', () => {
  let api: FakeApi
  let dir: string
  beforeEach(async () => {
    api = await new FakeApi().start()
    projectRoutes(api)
    api.on('GET', '/api/v1/entitlements', {body: {data: {...ENTITLEMENTS, entitlements: {'code_check.min_frequency_seconds': {key: 'code_check.min_frequency_seconds', value: 300, defaultValue: 300, overridden: false}}}}})
    dir = mkdtempSync(join(tmpdir(), 'devhelm-init-'))
  })
  afterEach(() => api.stop())

  test('--browser writes a starter check, a plan-valid entry at the plan floor and .gitignore; validate passes', async () => {
    const r = await runCli(['init', '--browser', 'Login', '--no-skills', '-o', 'json'], {api, cwd: dir})
    expect(r.code, r.stderr).toBe(0)
    expect(existsSync(join(dir, 'synthetics/login.spec.ts'))).toBe(true)
    const yml = parseYaml(readFileSync(join(dir, 'devhelm.yml'), 'utf8')) as {monitors: Array<Record<string, unknown>>}
    expect(yml.monitors[0]).toMatchObject({name: 'Login', type: 'BROWSER', environment: 'production', code: 'synthetics/login.spec.ts', frequencySeconds: 300})
    expect(readFileSync(join(dir, '.gitignore'), 'utf8')).toContain('.devhelm/')
    const doc = r.json as {data: {auth: {loggedIn: boolean}; next: Array<{cmd: string}>}}
    expect(doc.data.auth.loggedIn).toBe(true)
    expect(doc.data.next[0]!.cmd).toBe('devhelm test')
    writeFileSync(join(dir, 'devhelm.yml'), `project: acme/web\n${readFileSync(join(dir, 'devhelm.yml'), 'utf8')}`)
    expect((await runCli(['validate'], {cwd: dir})).code).toBe(0)
  }, 60_000)

  test('without a token: files are still written, next is auth login, never prompts', async () => {
    const r = await runCli(['init', '--api', 'Orders API', '--no-skills', '-o', 'json'], {cwd: dir, env: {DEVHELM_TEST_HOME: dir}})
    expect(r.code, r.stderr).toBe(0)
    expect(existsSync(join(dir, 'synthetics/orders-api.spec.ts'))).toBe(true)
    const doc = r.json as {data: {auth: {loggedIn: boolean}; next: Array<{cmd: string}>}}
    expect(doc.data.auth.loggedIn).toBe(false)
    expect(doc.data.next[0]!.cmd).toBe('devhelm auth login')
  }, 60_000)

  test('a duplicate name exits 4 and never rewrites devhelm.yml; --force re-creates only the starter file', async () => {
    await runCli(['init', '--browser', 'Login', '--no-skills', '-o', 'json'], {api, cwd: dir})
    const before = readFileSync(join(dir, 'devhelm.yml'), 'utf8')
    writeFileSync(join(dir, 'synthetics/login.spec.ts'), 'edited')
    const again = await runCli(['init', '--browser', 'Login', '--no-skills', '-o', 'json'], {api, cwd: dir})
    expect(again.code).toBe(4)
    const forced = await runCli(['init', '--browser', 'Login', '--no-skills', '--force', '-o', 'json'], {api, cwd: dir})
    expect(forced.code).toBe(0)
    expect(readFileSync(join(dir, 'devhelm.yml'), 'utf8')).toBe(before)
    expect(readFileSync(join(dir, 'synthetics/login.spec.ts'), 'utf8')).not.toBe('edited')
  }, 60_000)

  test('--agent installs skills and returns the prompt; --ci github writes the workflow', async () => {
    const r = await runCli(['init', '--browser', 'Login', '--agent', 'claude-code', '--ci', 'github', '-o', 'json'], {api, cwd: dir})
    expect(r.code, r.stderr).toBe(0)
    expect(existsSync(join(dir, '.claude/skills'))).toBe(true)
    expect(readFileSync(join(dir, '.github/workflows/devhelm.yml'), 'utf8')).toContain('devhelm deploy --yes --lock-timeout 5m')
    expect((r.json as {data: {prompt: string; mode: string}}).data.prompt).toContain('devhelm test')
  }, 60_000)

  test('without --browser/--api: the pre-1.12 starter file', async () => {
    const r = await runCli(['init', '--path', join(dir, 'devhelm.yml')], {cwd: dir})
    expect(r.code).toBe(0)
    expect(readFileSync(join(dir, 'devhelm.yml'), 'utf8')).toContain('type: HTTP')
  }, 60_000)
})
