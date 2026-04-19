import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {existsSync, mkdirSync, writeFileSync, readFileSync, rmSync, readdirSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'

let tempDir: string
let contextsPath: string

vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof import('node:os')>('node:os')
  return {
    ...actual,
    homedir: () => tempDir,
  }
})

async function freshAuth() {
  vi.resetModules()
  return import('../../src/lib/auth.js')
}

beforeEach(() => {
  tempDir = join(tmpdir(), `devhelm-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(join(tempDir, '.devhelm'), {recursive: true})
  contextsPath = join(tempDir, '.devhelm', 'contexts.json')
})

afterEach(() => {
  rmSync(tempDir, {recursive: true, force: true})
})

describe('readContextsFile validation', () => {
  it('returns undefined when file does not exist', async () => {
    const auth = await freshAuth()
    expect(auth.getCurrentContext()).toBeUndefined()
  })

  it('reads a valid contexts file', async () => {
    writeFileSync(contextsPath, JSON.stringify({
      version: 1,
      current: 'prod',
      contexts: {
        prod: {name: 'prod', apiUrl: 'https://api.devhelm.io', token: 'tok-abc123'},
      },
    }))
    const auth = await freshAuth()
    const ctx = auth.getCurrentContext()
    expect(ctx).toEqual({name: 'prod', apiUrl: 'https://api.devhelm.io', token: 'tok-abc123'})
  })

  it('reads valid file without version field (backward compat)', async () => {
    writeFileSync(contextsPath, JSON.stringify({
      current: 'dev',
      contexts: {
        dev: {name: 'dev', apiUrl: 'http://localhost:8080', token: 'dev-token'},
      },
    }))
    const auth = await freshAuth()
    expect(auth.getCurrentContext()?.name).toBe('dev')
  })

  it('backs up and warns on invalid JSON', async () => {
    writeFileSync(contextsPath, '{not valid json!!!')
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const auth = await freshAuth()
    expect(auth.getCurrentContext()).toBeUndefined()
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('invalid JSON'))
    const backups = readdirSync(join(tempDir, '.devhelm')).filter(f => f.startsWith('contexts.json.bak.'))
    expect(backups.length).toBe(1)
    stderr.mockRestore()
  })

  it('backs up and warns on wrong shape (contexts is an array)', async () => {
    writeFileSync(contextsPath, JSON.stringify({current: 'x', contexts: ['not', 'a', 'record']}))
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const auth = await freshAuth()
    expect(auth.getCurrentContext()).toBeUndefined()
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('invalid shape'))
    stderr.mockRestore()
  })

  it('backs up and warns when contexts is null', async () => {
    writeFileSync(contextsPath, JSON.stringify({current: 'x', contexts: null}))
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const auth = await freshAuth()
    expect(auth.getCurrentContext()).toBeUndefined()
    stderr.mockRestore()
  })

  it('backs up and warns when context entry has wrong shape', async () => {
    writeFileSync(contextsPath, JSON.stringify({
      current: 'bad',
      contexts: {bad: {name: 'bad', apiUrl: 123, token: true}},
    }))
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const auth = await freshAuth()
    expect(auth.getCurrentContext()).toBeUndefined()
    stderr.mockRestore()
  })

  it('backs up and warns when missing required fields', async () => {
    writeFileSync(contextsPath, JSON.stringify({current: 'x'}))
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const auth = await freshAuth()
    expect(auth.getCurrentContext()).toBeUndefined()
    stderr.mockRestore()
  })
})

describe('saveContext', () => {
  it('creates file from scratch with version field', async () => {
    rmSync(contextsPath, {force: true})
    const auth = await freshAuth()
    auth.saveContext({name: 'new', apiUrl: 'https://api.example.com', token: 'tok'})
    const file = JSON.parse(readFileSync(contextsPath, 'utf8'))
    expect(file.version).toBe(1)
    expect(file.current).toBe('new')
    expect(file.contexts.new.token).toBe('tok')
  })

  it('preserves existing contexts when adding a new one', async () => {
    writeFileSync(contextsPath, JSON.stringify({
      version: 1,
      current: 'a',
      contexts: {a: {name: 'a', apiUrl: 'https://a.example.com', token: 'tok-a'}},
    }))
    const auth = await freshAuth()
    auth.saveContext({name: 'b', apiUrl: 'https://b.example.com', token: 'tok-b'})
    const file = JSON.parse(readFileSync(contextsPath, 'utf8'))
    expect(Object.keys(file.contexts)).toEqual(['a', 'b'])
    expect(file.current).toBe('b')
  })

  it('does not set current when setCurrent=false', async () => {
    writeFileSync(contextsPath, JSON.stringify({
      version: 1,
      current: 'a',
      contexts: {a: {name: 'a', apiUrl: 'https://a.example.com', token: 'tok-a'}},
    }))
    const auth = await freshAuth()
    auth.saveContext({name: 'b', apiUrl: 'https://b.example.com', token: 'tok-b'}, false)
    const file = JSON.parse(readFileSync(contextsPath, 'utf8'))
    expect(file.current).toBe('a')
  })
})

describe('removeContext', () => {
  it('removes a context and updates current', async () => {
    writeFileSync(contextsPath, JSON.stringify({
      version: 1,
      current: 'a',
      contexts: {
        a: {name: 'a', apiUrl: 'https://a.example.com', token: 'tok-a'},
        b: {name: 'b', apiUrl: 'https://b.example.com', token: 'tok-b'},
      },
    }))
    const auth = await freshAuth()
    expect(auth.removeContext('a')).toBe(true)
    const file = JSON.parse(readFileSync(contextsPath, 'utf8'))
    expect(file.contexts.a).toBeUndefined()
    expect(file.current).toBe('b')
  })

  it('returns false for nonexistent context', async () => {
    writeFileSync(contextsPath, JSON.stringify({
      version: 1,
      current: '',
      contexts: {},
    }))
    const auth = await freshAuth()
    expect(auth.removeContext('ghost')).toBe(false)
  })
})

describe('listContexts', () => {
  it('returns empty when file is missing', async () => {
    rmSync(contextsPath, {force: true})
    const auth = await freshAuth()
    const result = auth.listContexts()
    expect(result).toEqual({current: '', contexts: []})
  })

  it('lists all contexts', async () => {
    writeFileSync(contextsPath, JSON.stringify({
      version: 1,
      current: 'prod',
      contexts: {
        prod: {name: 'prod', apiUrl: 'https://api.devhelm.io', token: 'tok-prod'},
        staging: {name: 'staging', apiUrl: 'https://staging.devhelm.io', token: 'tok-staging'},
      },
    }))
    const auth = await freshAuth()
    const result = auth.listContexts()
    expect(result.current).toBe('prod')
    expect(result.contexts).toHaveLength(2)
  })
})
