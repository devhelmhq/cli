import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {afterAll, afterEach, beforeAll, describe, expect, test} from 'vitest'
import {deviceLogin} from '../../src/lib/device-login.js'
import {AuthError} from '../../src/lib/errors.js'
import {keyNotices} from '../../src/lib/key-notices.js'
import {FakeApi, runCli} from '../helpers/fake-api.js'
import {runCliInput, tmpHome} from '../helpers/other-fixtures.js'

const ME = {
  key: {id: 7, name: 'ci', createdAt: '2026-10-01T00:00:00Z', expiresAt: null, scopes: ['full']},
  organization: {id: 3, name: 'acme-prod'},
  plan: {tier: 'STARTER', trialActive: false, entitlements: {}, usage: {}},
  rateLimits: {requestsPerMinute: 100, remaining: 99, windowMs: 60000},
}

describe('auth', () => {
  let api: FakeApi
  beforeAll(async () => {
    api = await new FakeApi().start()
    api.on('GET', '/api/v1/auth/me', {body: {data: ME}})
  })
  afterAll(() => api.stop())
  afterEach(() => {
    api.captured = []
  })

  test('login without a TTY and without a token → exit 4 NO_TOKEN', async () => {
    const r = await runCli(['auth', 'login', '--api-url', api.url], {env: {DEVHELM_TEST_HOME: tmpHome()}})
    expect(r.code).toBe(4)
    expect(r.stderr).toContain('NO_TOKEN')
    expect(api.calls('POST', '/api/v1/auth/device')).toHaveLength(0)
  }, 60_000)

  test('login --token-stdin validates and saves the context with the org id', async () => {
    const home = tmpHome()
    const r = await runCliInput(['auth', 'login', '--token-stdin', '--api-url', api.url, '--name', 'ci'], 'dh_live_abc\n', {env: {HOME: home}})
    expect(r.code).toBe(0)
    expect(r.stdout).toContain('Authenticated')
    const ctx = JSON.parse(readFileSync(join(home, '.devhelm', 'contexts.json'), 'utf8')) as {current: string; contexts: Record<string, {token: string; orgId: number}>}
    expect(ctx.current).toBe('ci')
    expect(ctx.contexts.ci!.token).toBe('dh_live_abc')
    expect(ctx.contexts.ci!.orgId).toBe(3)
  }, 60_000)

  test('a rejected token → non-zero exit (17) mentioning the failure', async () => {
    const bad = await new FakeApi().start()
    bad.on('GET', /.*/, {status: 401, body: {status: 401, code: 'UNAUTHORIZED', category: 'auth', retryable: false, message: 'bad key', timestamp: 0}})
    const r = await runCli(['auth', 'login', '--token', 'nope', '--api-url', bad.url], {env: {DEVHELM_TEST_HOME: tmpHome()}})
    await bad.stop()
    expect(r.code).toBe(17)
    expect(r.stderr.toLowerCase()).toContain('failed')
  }, 60_000)

  test('auth me prints scopes and the legacy-key notice', async () => {
    const r = await runCli(['auth', 'me'], {api})
    expect(r.code).toBe(0)
    expect(r.stdout).toContain('Scopes: full')
    expect(r.stderr).toContain('legacy key: replace with a scoped key')
    const j = await runCli(['auth', 'me', '--output', 'json'], {api})
    expect((j.json as {key: {id: number}}).key.id).toBe(7)
  }, 60_000)

  test('auth switch to an unknown context → exit 4', async () => {
    const r = await runCli(['auth', 'switch', 'nope', '-o', 'json'], {env: {DEVHELM_TEST_HOME: tmpHome()}})
    expect(r.code).toBe(4)
  }, 60_000)
})

describe('deviceLogin', () => {
  test('polls until complete, honouring slow_down', async () => {
    const api = await new FakeApi().start()
    const statuses = ['authorization_pending', 'slow_down', 'complete']
    api.on('POST', '/api/v1/auth/device', {body: {data: {deviceCode: 'dc', userCode: 'WDJB-MJHT', verificationUri: 'https://app/cli', verificationUriComplete: 'https://app/cli?code=WDJB-MJHT', expiresIn: 600, interval: 5}}})
    api.on('POST', '/api/v1/auth/device/token', () => {
      const status = statuses.shift()!
      return {body: {data: {status, interval: 5, ...(status === 'complete' ? {apiKey: 'dh_live_new', organizationId: 3, workspaceId: 4} : {})}}}
    })
    const sleeps: number[] = []
    let prompted = ''
    const res = await deviceLogin(api.url, {openBrowser: false, sleep: async (ms) => {sleeps.push(ms)}, onPrompt: (a) => {prompted = a.userCode}})
    await api.stop()
    expect(res).toEqual({token: 'dh_live_new', orgId: 3, workspaceId: 4})
    expect(prompted).toBe('WDJB-MJHT')
    expect(sleeps).toEqual([5000, 5000, 10000])
    expect(JSON.parse(api.calls('POST', '/api/v1/auth/device')[0]!.body)).toEqual({clientName: expect.stringContaining('devhelm CLI') as string})
  })

  test('expired and denied codes are AuthError (exit 17)', async () => {
    for (const status of ['expired', 'denied']) {
      const api = await new FakeApi().start()
      api.on('POST', '/api/v1/auth/device', {body: {data: {deviceCode: 'dc', userCode: 'U', verificationUri: 'u', verificationUriComplete: 'u', expiresIn: 600, interval: 1}}})
      api.on('POST', '/api/v1/auth/device/token', {body: {data: {status, interval: 1}}})
      const err = await deviceLogin(api.url, {openBrowser: false, sleep: async () => {}}).catch((e: unknown) => e)
      await api.stop()
      expect(err).toBeInstanceOf(AuthError)
      expect((err as AuthError).exitCode).toBe(17)
    }
  })
})

describe('keyNotices', () => {
  const now = Date.parse('2026-10-25T00:00:00Z')
  test('warns 14 and 3 days before expiry', () => {
    expect(keyNotices({scopes: ['runs:execute'], expiresAt: '2026-11-30T00:00:00Z'}, now)).toEqual([])
    expect(keyNotices({scopes: ['runs:execute'], expiresAt: '2026-11-05T00:00:00Z'}, now)[0]).toContain('11 days')
    expect(keyNotices({scopes: ['runs:execute'], expiresAt: '2026-10-27T00:00:00Z'}, now)[0]).toContain('rotate')
    expect(keyNotices({scopes: ['full']}, now)[0]).toContain('legacy key')
  })
})
