import {describe, expect, it, vi, beforeEach} from 'vitest'
import {applyAssertions, parseAssertionFlag} from '../../src/lib/monitor-assertions.js'

describe('parseAssertionFlag — DSL form (P1.Bug2)', () => {
  it('parses status_code=200 → fail / equals', () => {
    expect(parseAssertionFlag('status_code=200')).toEqual({
      severity: 'fail',
      config: {type: 'status_code', expected: '200', operator: 'equals'},
    })
  })

  it('parses status_code=2xx (range pattern)', () => {
    const result = parseAssertionFlag('status_code=2xx')
    expect(result.config).toMatchObject({type: 'status_code', expected: '2xx', operator: 'equals'})
  })

  it('parses response_time<5000 → warn / thresholdMs', () => {
    expect(parseAssertionFlag('response_time<5000')).toEqual({
      severity: 'warn',
      config: {type: 'response_time', thresholdMs: 5000},
    })
  })

  it('parses ssl_expiry>=14 → warn / minDaysRemaining', () => {
    expect(parseAssertionFlag('ssl_expiry>=14')).toEqual({
      severity: 'warn',
      config: {type: 'ssl_expiry', minDaysRemaining: 14},
    })
  })

  it('tolerates surrounding whitespace and inline padding', () => {
    expect(parseAssertionFlag('  status_code = 200 ')).toEqual({
      severity: 'fail',
      config: {type: 'status_code', expected: '200', operator: 'equals'},
    })
  })

  it('rejects empty input', () => {
    expect(() => parseAssertionFlag('   ')).toThrow(/empty value/)
  })

  it('rejects unknown DSL types with a JSON-form hint', () => {
    expect(() => parseAssertionFlag('redirect_count=2')).toThrow(/JSON form for "redirect_count"/)
  })

  it('rejects status_code with non-equals operator', () => {
    expect(() => parseAssertionFlag('status_code<200')).toThrow(/status_code only supports "="/)
  })

  it('rejects response_time with non-< operator', () => {
    expect(() => parseAssertionFlag('response_time>=5000')).toThrow(/response_time only supports "<"/)
  })

  it('rejects ssl_expiry with non->= operator', () => {
    expect(() => parseAssertionFlag('ssl_expiry<14')).toThrow(/ssl_expiry only supports ">="/)
  })

  it('rejects non-integer response_time threshold', () => {
    expect(() => parseAssertionFlag('response_time<5.5')).toThrow(/positive integer/)
    expect(() => parseAssertionFlag('response_time<-1')).toThrow(/positive integer/)
    expect(() => parseAssertionFlag('response_time<abc')).toThrow(/positive integer/)
  })

  it('rejects malformed DSL strings', () => {
    expect(() => parseAssertionFlag('status_code 200')).toThrow(/cannot parse/)
  })
})

describe('parseAssertionFlag — JSON form', () => {
  it('parses a full {severity, config} object', () => {
    const json = JSON.stringify({
      severity: 'fail',
      config: {type: 'status_code', expected: '200', operator: 'equals'},
    })
    expect(parseAssertionFlag(json)).toEqual({
      severity: 'fail',
      config: {type: 'status_code', expected: '200', operator: 'equals'},
    })
  })

  it('defaults severity to "fail" when omitted', () => {
    const json = JSON.stringify({config: {type: 'response_size', maxBytes: 100}})
    expect(parseAssertionFlag(json)).toMatchObject({severity: 'fail'})
  })

  it('passes through any assertion type (no DSL restriction)', () => {
    const json = JSON.stringify({
      severity: 'warn',
      config: {type: 'json_path', path: '$.status', expected: 'ok', operator: 'equals'},
    })
    expect(parseAssertionFlag(json).config).toMatchObject({type: 'json_path', path: '$.status'})
  })

  it('rejects malformed JSON with a parse error', () => {
    expect(() => parseAssertionFlag('{not-json')).toThrow(/invalid JSON/)
  })

  it('rejects JSON arrays', () => {
    expect(() => parseAssertionFlag('[]')).toThrow(/object with \{severity, config\}/)
  })

  it('rejects unknown severity', () => {
    const json = JSON.stringify({severity: 'critical', config: {type: 'status_code'}})
    expect(() => parseAssertionFlag(json)).toThrow(/severity must be "fail" or "warn"/)
  })

  it('rejects missing config', () => {
    expect(() => parseAssertionFlag('{"severity":"fail"}')).toThrow(/missing or invalid `config`/)
  })

  it('rejects config without type', () => {
    expect(() => parseAssertionFlag('{"severity":"fail","config":{}}')).toThrow(/config\.type is required/)
  })
})

describe('applyAssertions', () => {
  type FakeRequest = {method: string; path: string; body?: unknown}
  type Outcome = {ok: true; data?: unknown} | {ok: false; status: number; message: string}

  /**
   * Minimal fake of the openapi-fetch ApiClient surface that matches
   * what `apiPost` / `apiDelete` actually call. Each handler returns an
   * Outcome that the fake materialises into the `{data, error, response}`
   * shape `checkedFetch` expects.
   */
  function fakeClient(outcomes: Record<string, Outcome | (() => Outcome)>) {
    const calls: FakeRequest[] = []
    function resolve(key: string): Outcome {
      const v = outcomes[key] ?? outcomes[key.split(' ')[0]] ?? {ok: true}
      return typeof v === 'function' ? v() : v
    }
    function makeResponse(method: string, path: string, body?: unknown): Promise<{data?: unknown; error?: unknown; response: Response}> {
      calls.push({method, path, body})
      const o = resolve(`${method} ${path}`)
      const response = {
        ok: o.ok, status: o.ok ? 200 : o.status,
        statusText: o.ok ? 'OK' : 'ERR',
        headers: new Headers(),
      } as Response
      if (o.ok) return Promise.resolve({data: o.data ?? {}, response})
      return Promise.resolve({error: {message: o.message}, response})
    }
    const client = {
      POST: vi.fn((path: string, opts?: {body?: unknown}) => makeResponse('POST', path, opts?.body)),
      DELETE: vi.fn((path: string) => makeResponse('DELETE', path)),
    }
    return {client, calls}
  }

  let stderr: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  })

  it('POSTs each assertion to the monitor assertions endpoint', async () => {
    const {client, calls} = fakeClient({})
    const assertions = [
      {severity: 'fail' as const, config: {type: 'status_code', expected: '200', operator: 'equals'}},
      {severity: 'warn' as const, config: {type: 'response_time', thresholdMs: 5000}},
    ]
    await applyAssertions('mon-1', assertions, client as never)
    const posts = calls.filter((c) => c.method === 'POST')
    expect(posts).toHaveLength(2)
    expect(posts[0].path).toBe('/api/v1/monitors/mon-1/assertions')
    expect(posts[0].body).toMatchObject({severity: 'fail', config: {type: 'status_code'}})
  })

  it('rolls back the monitor when an assertion POST fails', async () => {
    const {client, calls} = fakeClient({
      POST: {ok: false, status: 400, message: 'bad request'},
    })
    const assertions = [{severity: 'fail' as const, config: {type: 'status_code', expected: '200', operator: 'equals'}}]
    await expect(applyAssertions('mon-1', assertions, client as never)).rejects.toThrow(
      /Failed to apply --assertion #1 \(status_code\).*Monitor was rolled back/s,
    )
    expect(calls.find((c) => c.method === 'DELETE')?.path).toBe('/api/v1/monitors/mon-1')
    expect(stderr).not.toHaveBeenCalled()
  })

  it('reports both the original failure and a rollback failure', async () => {
    const {client} = fakeClient({
      POST: {ok: false, status: 400, message: '400'},
      DELETE: {ok: false, status: 500, message: 'boom'},
    })
    await expect(
      applyAssertions(
        'mon-1',
        [{severity: 'fail' as const, config: {type: 'status_code'}}],
        client as never,
      ),
    ).rejects.toThrow(/could NOT be rolled back automatically/)
  })

  it('is a no-op for an empty assertion list', async () => {
    const {client, calls} = fakeClient({})
    await applyAssertions('mon-1', [], client as never)
    expect(calls).toHaveLength(0)
  })
})
