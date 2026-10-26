import {afterEach, beforeEach, describe, expect, it} from 'vitest'
import {beginInvocation, nextIdempotencyKey} from '../../src/lib/api-client.js'
import {FakeApi, runCli} from '../helpers/fake-api.js'

const CI_ENV = {GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '1', GITHUB_JOB: 'deploy', GITHUB_ACTION: '__run_2'}

function keyFor(argv: string[], env: Record<string, string> = CI_ENV): string {
  Object.assign(process.env, env)
  beginInvocation('status-pages:create', undefined, argv)
  return nextIdempotencyKey('POST', '/api/v1/status-pages')
}

describe('CI-derived idempotency keys', () => {
  const saved = {...process.env}
  beforeEach(() => {
    for (const k of Object.keys(CI_ENV)) delete process.env[k]
  })
  afterEach(() => {
    process.env = {...saved}
  })

  it('gives two different commands in one CI step different keys', () => {
    expect(keyFor(['status-pages', 'create', '--name', 'a'])).not.toBe(keyFor(['status-pages', 'create', '--name', 'b']))
  })

  it('replays the same command in the same step and attempt', () => {
    const argv = ['status-pages', 'create', '--name', 'a']
    expect(keyFor(argv)).toBe(keyFor(argv))
  })

  it('gives the same command in another step or attempt a new key', () => {
    const argv = ['status-pages', 'create', '--name', 'a']
    expect(keyFor(argv)).not.toBe(keyFor(argv, {...CI_ENV, GITHUB_ACTION: '__run_3'}))
    expect(keyFor(argv)).not.toBe(keyFor(argv, {...CI_ENV, GITHUB_RUN_ATTEMPT: '2'}))
  })

  it('uses a random seed outside CI', () => {
    const argv = ['status-pages', 'create', '--name', 'a']
    expect(keyFor(argv, {})).not.toBe(keyFor(argv, {}))
  })
})

describe('CI-derived idempotency keys (subprocess)', () => {
  // `status-pages create` comes from the generic CRUD factory, not
  // DevhelmCommand, so it relies on the default per-process invocation.
  it('gives two creates from the generic CRUD commands different keys', async () => {
    const api = await new FakeApi().start()
    api.on('POST', '/api/v1/status-pages', {status: 500, body: {}})
    try {
      for (const name of ['page-a', 'page-b']) {
        await runCli(['status-pages', 'create', '--name', name, '--slug', name, '-o', 'json'], {api, env: CI_ENV})
      }
      const keys = api.calls('POST', '/api/v1/status-pages').map((c) => c.headers['idempotency-key'])
      expect(new Set(keys).size).toBe(2)
    } finally {
      await api.stop()
    }
  }, 120_000)
})
