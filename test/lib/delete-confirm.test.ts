import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {z} from 'zod'
import {extractEntityLabel, createDeleteCommand, type ResourceConfig} from '../../src/lib/crud-commands.js'
import {EXIT_CODES} from '../../src/lib/errors.js'

describe('extractEntityLabel', () => {
  it('returns the name field when present', () => {
    expect(extractEntityLabel({id: 'x', name: 'My Monitor'})).toBe('My Monitor')
  })

  it('falls back through the candidate list', () => {
    expect(extractEntityLabel({id: 'x', slug: 'my-page'})).toBe('my-page')
    expect(extractEntityLabel({id: 'x', key: 'API_KEY'})).toBe('API_KEY')
    expect(extractEntityLabel({id: 'x', summary: 'Outage on us-east-1'})).toBe('Outage on us-east-1')
    expect(extractEntityLabel({id: 'x', email: 'ops@example.com'})).toBe('ops@example.com')
  })

  it('prefers name over secondary fields', () => {
    expect(extractEntityLabel({id: 'x', name: 'A', slug: 'b'})).toBe('A')
  })

  it('returns undefined when no candidate field matches', () => {
    expect(extractEntityLabel({id: 'x', foo: 'bar'})).toBeUndefined()
  })

  it('ignores empty strings and non-string values', () => {
    expect(extractEntityLabel({id: 'x', name: ''})).toBeUndefined()
    expect(extractEntityLabel({id: 'x', name: 42})).toBeUndefined()
  })

  it('returns undefined for non-objects', () => {
    expect(extractEntityLabel(null)).toBeUndefined()
    expect(extractEntityLabel(undefined)).toBeUndefined()
    expect(extractEntityLabel('a string')).toBeUndefined()
    expect(extractEntityLabel(42)).toBeUndefined()
  })
})

const TEST_RESOURCE: ResourceConfig<{id: string; name: string}> = {
  name: 'widget',
  plural: 'widgets',
  apiPath: '/api/v1/widgets',
  responseSchema: z.object({id: z.string(), name: z.string()}),
  columns: [
    {header: 'ID', get: (r) => r.id},
    {header: 'NAME', get: (r) => r.name},
  ],
}

describe('createDeleteCommand --yes / TTY behavior', () => {
  const SAVED_TOKEN = process.env.DEVHELM_API_TOKEN
  const ORIGINAL_IS_TTY = process.stdin.isTTY

  beforeEach(() => {
    // Ensure buildClient() doesn't throw on the auth check before we get
    // to the prompt path the test actually exercises.
    process.env.DEVHELM_API_TOKEN = 'dh_test_dummy'
  })

  afterEach(() => {
    if (SAVED_TOKEN === undefined) delete process.env.DEVHELM_API_TOKEN
    else process.env.DEVHELM_API_TOKEN = SAVED_TOKEN
    Object.defineProperty(process.stdin, 'isTTY', {configurable: true, value: ORIGINAL_IS_TTY})
    vi.restoreAllMocks()
  })

  it('exposes the --yes / -y flag on the generated command', () => {
    const Cmd = createDeleteCommand(TEST_RESOURCE) as unknown as {flags: {yes: {char?: string}}}
    expect(Cmd.flags.yes).toBeDefined()
    expect(Cmd.flags.yes.char).toBe('y')
  })

  it('refuses to run in non-TTY mode without --yes', async () => {
    Object.defineProperty(process.stdin, 'isTTY', {configurable: true, value: false})
    const Cmd = createDeleteCommand(TEST_RESOURCE)
    const id = '00000000-0000-0000-0000-000000000001'
    // oclif's `this.error()` throws a typed Error tagged with the exit
    // code; we assert on the message + exit code rather than the
    // concrete class so we're not coupled to oclif's internal type.
    await expect(Cmd.run([id])).rejects.toThrow(/non-interactive mode without --yes/)
    await expect(Cmd.run([id])).rejects.toMatchObject({oclif: {exit: EXIT_CODES.VALIDATION}})
  })

  it('skips the non-TTY refusal entirely when --yes is supplied', async () => {
    Object.defineProperty(process.stdin, 'isTTY', {configurable: true, value: false})
    const Cmd = createDeleteCommand(TEST_RESOURCE)
    const id = '00000000-0000-0000-0000-000000000002'
    // With --yes we expect the command to bypass the prompt and reach
    // the apiDelete network call. We don't have a live API so the call
    // will fail downstream, but it must NOT fail with the
    // "non-interactive mode" guard.
    try {
      await Cmd.run([id, '--yes', '--api-url', 'http://127.0.0.1:1'])
    } catch (err) {
      expect(err).not.toMatchObject({message: expect.stringMatching(/non-interactive mode/)})
    }
  })
})
