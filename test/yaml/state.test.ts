import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import {mkdirSync, rmSync, existsSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {readState, writeState, buildState} from '../../src/lib/yaml/state.js'

describe('state', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = join(tmpdir(), `devhelm-test-${Date.now()}`)
    mkdirSync(tmpDir, {recursive: true})
  })

  afterEach(() => {
    rmSync(tmpDir, {recursive: true, force: true})
  })

  it('returns undefined when state file does not exist', () => {
    expect(readState(tmpDir)).toBeUndefined()
  })

  it('writes and reads state', () => {
    const state = buildState([
      {resourceType: 'monitor', refKey: 'test', id: 'mon-1', createdAt: '2025-01-01'},
    ])
    writeState(state, tmpDir)
    expect(existsSync(join(tmpDir, '.devhelm', 'state.json'))).toBe(true)

    const loaded = readState(tmpDir)
    expect(loaded).toBeDefined()
    expect(loaded!.version).toBe('1')
    expect(loaded!.resources).toHaveLength(1)
    expect(loaded!.resources[0].refKey).toBe('test')
  })

  it('creates .devhelm directory if missing', () => {
    const state = buildState([])
    writeState(state, tmpDir)
    expect(existsSync(join(tmpDir, '.devhelm'))).toBe(true)
  })

  it('buildState sets lastDeployedAt', () => {
    const before = Date.now()
    const state = buildState([])
    const after = Date.now()
    const ts = new Date(state.lastDeployedAt).getTime()
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after)
  })

  it('returns undefined on corrupt JSON', () => {
    const dir = join(tmpDir, '.devhelm')
    mkdirSync(dir, {recursive: true})
    writeFileSync(join(dir, 'state.json'), 'not valid json {{{')
    expect(readState(tmpDir)).toBeUndefined()
  })

  it('overwrites previous state on write', () => {
    const state1 = buildState([
      {resourceType: 'tag', refKey: 'A', id: 't-1', createdAt: '2025-01-01'},
    ])
    writeState(state1, tmpDir)
    expect(readState(tmpDir)!.resources).toHaveLength(1)

    const state2 = buildState([
      {resourceType: 'tag', refKey: 'A', id: 't-1', createdAt: '2025-01-01'},
      {resourceType: 'monitor', refKey: 'B', id: 'm-1', createdAt: '2025-01-02'},
    ])
    writeState(state2, tmpDir)
    const loaded = readState(tmpDir)!
    expect(loaded.resources).toHaveLength(2)
  })

  it('accumulates state across multiple deploys', () => {
    const deploy1 = buildState([
      {resourceType: 'tag', refKey: 'A', id: 't-1', createdAt: '2025-01-01'},
    ])
    writeState(deploy1, tmpDir)

    const existing = readState(tmpDir)!
    const combined = buildState([
      ...existing.resources,
      {resourceType: 'monitor', refKey: 'M', id: 'm-1', createdAt: '2025-01-02'},
    ])
    writeState(combined, tmpDir)

    const final = readState(tmpDir)!
    expect(final.resources).toHaveLength(2)
    expect(final.resources.map((r) => r.refKey).sort()).toEqual(['A', 'M'])
  })

  it('buildState with empty entries creates valid state', () => {
    const state = buildState([])
    expect(state.version).toBe('1')
    expect(state.resources).toEqual([])
    expect(state.lastDeployedAt).toBeTruthy()
  })
})
