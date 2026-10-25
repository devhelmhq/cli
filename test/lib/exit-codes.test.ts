/**
 * Exit-code contract (doc 32 D-2): every error category maps to its frozen
 * exit code through the central handler, and exit 1 is never produced for
 * a classified error. One subprocess test per category.
 */
import {afterAll, beforeAll, describe, expect, test} from 'vitest'
import {ERROR_CATEGORIES, EXIT_CODES, errorForCategory, exitCodeOf} from '../../src/lib/errors.js'
import {classify} from '../../src/lib/cli/command.js'
import {FakeApi, errorBody, runCli} from '../helpers/fake-api.js'

const MONITOR_ID = '11111111-1111-4111-8111-111111111111'

const STATUS: Record<string, number> = {
  validation: 400, blocked: 409, auth: 401, permission: 403, ownership: 409, plan: 402, quota: 402,
  rate_limit: 429, conflict: 409, confirmation_required: 409, not_found: 404, gone: 410, platform: 500,
}

const EXPECTED: Record<string, number> = {
  validation: 4, blocked: 4, not_found: 4, auth: 17, permission: 17, ownership: 17, plan: 16, quota: 16,
  confirmation_required: 15, conflict: 18, gone: 20, rate_limit: 11, platform: 11, transport: 12,
}

describe('category → exit table', () => {
  test('matches D-2 for every category', () => {
    for (const c of ERROR_CATEGORIES) expect(exitCodeOf(errorForCategory('x', c))).toBe(EXPECTED[c])
  })

  test('no category exits 1', () => {
    for (const c of ERROR_CATEGORIES) expect(exitCodeOf(errorForCategory('x', c))).not.toBe(EXIT_CODES.GENERAL)
  })

  test('category, not status, decides the exit code', () => {
    // A quota refusal sent as 403 (today's Testing cap) is still exit 16.
    expect(exitCodeOf(errorForCategory('cap', 'quota', {status: 403}))).toBe(16)
  })

  test('classify keeps oclif usage errors (exit 2) for oclif', () => {
    const usage = Object.assign(new Error('bad flag'), {oclif: {exit: 2}})
    expect(classify(usage)).toBeUndefined()
    const v = Object.assign(new Error('bad'), {oclif: {exit: 4}})
    expect(exitCodeOf(classify(v)!)).toBe(4)
  })
})

describe('central handler (subprocess)', () => {
  let api: FakeApi
  let category = 'validation'

  beforeAll(async () => {
    api = await new FakeApi().start()
    api.on('GET', `/api/v1/monitors/${MONITOR_ID}`, () => ({status: STATUS[category], body: errorBody(category, `TEST_${category.toUpperCase()}`, STATUS[category]!, {next: {command: 'devhelm auth me', docs: null}})}))
  })
  afterAll(() => api.stop())

  for (const c of ERROR_CATEGORIES.filter((x) => x !== 'transport')) {
    test(`${c} → exit ${EXPECTED[c]} with the error document`, async () => {
      category = c
      const r = await runCli(['monitors', 'drift', MONITOR_ID, '-o', 'json'], {api})
      expect(r.code).toBe(EXPECTED[c])
      const doc = r.json as {ok: boolean; exit: number; error: {category: string; code: string; requestId: string}}
      expect(doc.ok).toBe(false)
      expect(doc.exit).toBe(EXPECTED[c])
      expect(doc.error.category).toBe(c)
      expect(doc.error.code).toBe(`TEST_${c.toUpperCase()}`)
      expect(doc.error.requestId).toBe('req_test')
    }, 60_000)
  }

  test('transport → exit 12', async () => {
    const r = await runCli(['monitors', 'drift', MONITOR_ID, '-o', 'json', '--api-url', 'http://127.0.0.1:1', '--api-token', 't'])
    expect(r.code).toBe(12)
    expect((r.json as {error: {category: string}}).error.category).toBe('transport')
  }, 60_000)

  test('human mode prints code, next and request id on stderr', async () => {
    category = 'permission'
    const r = await runCli(['monitors', 'drift', MONITOR_ID, '-o', 'table'], {api})
    expect(r.code).toBe(17)
    expect(r.stderr).toContain('[TEST_PERMISSION]')
    expect(r.stderr).toContain('next: devhelm auth me')
    expect(r.stderr).toContain('req_test')
  }, 60_000)

  test('a pre-1.12 command maps the category too (no exit 1)', async () => {
    category = 'not_found'
    const r = await runCli(['monitors', 'get', MONITOR_ID], {api})
    expect(r.code).toBe(4)
  }, 60_000)

  test('missing token is NO_TOKEN, exit 4', async () => {
    const r = await runCli(['monitors', 'drift', MONITOR_ID, '-o', 'json'], {env: {DEVHELM_TEST_HOME: '/nonexistent-home'}})
    expect(r.code).toBe(4)
    expect((r.json as {error: {code: string}}).error.code).toBe('NO_TOKEN')
  }, 60_000)
})
