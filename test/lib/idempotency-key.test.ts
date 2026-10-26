import {describe, expect, it} from 'vitest'
import {beginInvocation, nextIdempotencyKey} from '../../src/lib/api-client.js'
import {FakeApi, runCli} from '../helpers/fake-api.js'

const CI_ENV = {GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '1', GITHUB_JOB: 'deploy', GITHUB_ACTION: '__run_2'}

describe('idempotency keys', () => {
  it('gives every invocation its own seed, in CI or not', () => {
    Object.assign(process.env, CI_ENV)
    beginInvocation('tags:create')
    const first = nextIdempotencyKey('POST', '/api/v1/tags')
    beginInvocation('tags:create')
    expect(nextIdempotencyKey('POST', '/api/v1/tags')).not.toBe(first)
    for (const k of Object.keys(CI_ENV)) delete process.env[k]
  })

  it('gives each POST in one invocation its own key', () => {
    beginInvocation('deploy')
    expect(nextIdempotencyKey('POST', '/api/v1/tags')).not.toBe(nextIdempotencyKey('POST', '/api/v1/tags'))
  })

  it('pins the first key with --idempotency-key and numbers the rest', () => {
    beginInvocation('deploy', 'my-key')
    expect(nextIdempotencyKey('POST', '/api/v1/tags')).toBe('my-key')
    expect(nextIdempotencyKey('POST', '/api/v1/monitors')).toBe('my-key-1')
  })
})

describe('idempotency keys (subprocess)', () => {
  // Same command twice in one CI step: each run is a fresh request, so the
  // API answers the second create itself (409 on 1.11 too), never a replay.
  it('sends different keys for the same command run twice in one CI step', async () => {
    const api = await new FakeApi().start()
    api.on('POST', '/api/v1/status-pages', {status: 500, body: {}})
    try {
      for (let i = 0; i < 2; i++) {
        await runCli(['status-pages', 'create', '--name', 'page-a', '--slug', 'page-a', '-o', 'json'], {api, env: CI_ENV})
      }
      const keys = api.calls('POST', '/api/v1/status-pages').map((c) => c.headers['idempotency-key'])
      expect(keys).toHaveLength(2)
      expect(new Set(keys).size).toBe(2)
    } finally {
      await api.stop()
    }
  }, 120_000)
})
