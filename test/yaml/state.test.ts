import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import {mkdirSync, rmSync, existsSync, writeFileSync, readFileSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {
  readState, writeState, buildState, buildStateV2, emptyState, StateFileCorruptError,
  upsertStateEntry, removeStateEntry, lookupByAddress,
  lookupByApiId, processMovedBlocks, resourceAddress,
  parseAddress, migrateV1, migrateV2,
} from '../../src/lib/yaml/state.js'
import type {DeployStateV1} from '../../src/lib/yaml/state.js'

describe('state v3', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = join(tmpdir(), `devhelm-test-${Date.now()}`)
    mkdirSync(tmpDir, {recursive: true})
  })

  afterEach(() => {
    rmSync(tmpDir, {recursive: true, force: true})
  })

  // ── Read / write ───────────────────────────────────────────────────

  it('returns undefined when state file does not exist', () => {
    expect(readState(tmpDir)).toBeUndefined()
  })

  it('writes and reads v3 state', () => {
    const state = buildState([
      {resourceType: 'monitor', refKey: 'API', apiId: 'mon-1'},
    ])
    writeState(state, tmpDir)
    expect(existsSync(join(tmpDir, '.devhelm', 'state.json'))).toBe(true)

    const loaded = readState(tmpDir)
    expect(loaded).toBeDefined()
    expect(loaded!.version).toBe('3')
    expect(loaded!.serial).toBe(1)
    expect(loaded!.resources['monitors.API']).toBeDefined()
    expect(loaded!.resources['monitors.API'].apiId).toBe('mon-1')
  })

  it('does NOT persist `attributes` on disk (v3 is identity-only)', () => {
    const state = buildState([
      {resourceType: 'monitor', refKey: 'API', apiId: 'mon-1'},
    ])
    writeState(state, tmpDir)
    const raw = readFileSync(join(tmpDir, '.devhelm', 'state.json'), 'utf8')
    expect(raw).not.toContain('attributes')
  })

  it('creates .devhelm directory if missing', () => {
    writeState(emptyState(), tmpDir)
    expect(existsSync(join(tmpDir, '.devhelm'))).toBe(true)
  })

  it('throws StateFileCorruptError on invalid JSON', () => {
    const dir = join(tmpDir, '.devhelm')
    mkdirSync(dir, {recursive: true})
    writeFileSync(join(dir, 'state.json'), 'not valid json {{{')
    expect(() => readState(tmpDir)).toThrow(StateFileCorruptError)
  })

  it('throws StateFileCorruptError on non-object JSON', () => {
    const dir = join(tmpDir, '.devhelm')
    mkdirSync(dir, {recursive: true})
    writeFileSync(join(dir, 'state.json'), '"just a string"')
    expect(() => readState(tmpDir)).toThrow(StateFileCorruptError)
  })

  it('throws StateFileCorruptError on unknown state version', () => {
    const dir = join(tmpDir, '.devhelm')
    mkdirSync(dir, {recursive: true})
    writeFileSync(join(dir, 'state.json'), JSON.stringify({version: '99', resources: {}}))
    expect(() => readState(tmpDir)).toThrow(StateFileCorruptError)
  })

  it('overwrites previous state on write', () => {
    const s1 = buildState([{resourceType: 'tag', refKey: 'A', apiId: 't-1'}])
    writeState(s1, tmpDir)

    const s2 = buildState([
      {resourceType: 'tag', refKey: 'A', apiId: 't-1'},
      {resourceType: 'monitor', refKey: 'B', apiId: 'm-1'},
    ])
    writeState(s2, tmpDir)

    const loaded = readState(tmpDir)!
    expect(Object.keys(loaded.resources)).toHaveLength(2)
  })

  // ── Serial increment ──────────────────────────────────────────────

  it('buildState increments serial from previous', () => {
    const s = buildState([], 5)
    expect(s.serial).toBe(6)
  })

  it('buildState defaults serial to 1 when no previous', () => {
    const s = buildState([])
    expect(s.serial).toBe(1)
  })

  it('buildStateV2 alias still works (deprecated shim)', () => {
    const s = buildStateV2([{resourceType: 'tag', refKey: 'X', apiId: 't-1'}])
    expect(s.version).toBe('3')
    expect(s.resources['tags.X'].apiId).toBe('t-1')
  })

  // ── Address helpers ───────────────────────────────────────────────

  it('resourceAddress builds correct addresses', () => {
    expect(resourceAddress('monitor', 'API')).toBe('monitors.API')
    expect(resourceAddress('statusPage', 'devhelm')).toBe('statusPages.devhelm')
    expect(resourceAddress('alertChannel', 'Slack')).toBe('alertChannels.Slack')
    expect(resourceAddress('notificationPolicy', 'Default')).toBe('notificationPolicies.Default')
  })

  it('parseAddress parses valid addresses', () => {
    expect(parseAddress('monitors.API')).toEqual({section: 'monitors', refKey: 'API'})
    expect(parseAddress('statusPages.devhelm')).toEqual({section: 'statusPages', refKey: 'devhelm'})
  })

  it('parseAddress handles dots in refKey', () => {
    expect(parseAddress('monitors.api.example.com')).toEqual({section: 'monitors', refKey: 'api.example.com'})
  })

  it('parseAddress returns undefined for invalid addresses', () => {
    expect(parseAddress('')).toBeUndefined()
    expect(parseAddress('noDot')).toBeUndefined()
    expect(parseAddress('.missing')).toBeUndefined()
    expect(parseAddress('trailing.')).toBeUndefined()
  })

  // ── Upsert / remove ──────────────────────────────────────────────

  it('upsertStateEntry adds a new entry and increments serial', () => {
    const state = emptyState()
    upsertStateEntry(state, 'monitor', 'API', 'uuid-1')
    expect(state.resources['monitors.API']).toBeDefined()
    expect(state.resources['monitors.API'].apiId).toBe('uuid-1')
    expect(state.serial).toBe(1)
  })

  it('upsertStateEntry overwrites existing entry', () => {
    const state = emptyState()
    upsertStateEntry(state, 'monitor', 'API', 'uuid-1')
    upsertStateEntry(state, 'monitor', 'API', 'uuid-2')
    expect(state.resources['monitors.API'].apiId).toBe('uuid-2')
    expect(state.serial).toBe(2)
  })

  it('upsertStateEntry with children', () => {
    const state = emptyState()
    upsertStateEntry(state, 'statusPage', 'devhelm', 'sp-1', {
      'groups.Platform': {apiId: 'g-1'},
    })
    const entry = state.resources['statusPages.devhelm']
    expect(entry.children['groups.Platform'].apiId).toBe('g-1')
  })

  it('removeStateEntry removes existing entry', () => {
    const state = emptyState()
    upsertStateEntry(state, 'monitor', 'API', 'uuid-1')
    const removed = removeStateEntry(state, 'monitors.API')
    expect(removed).toBe(true)
    expect(state.resources['monitors.API']).toBeUndefined()
  })

  it('removeStateEntry returns false for missing entry', () => {
    const state = emptyState()
    expect(removeStateEntry(state, 'monitors.NonExistent')).toBe(false)
  })

  // ── Lookup helpers ────────────────────────────────────────────────

  it('lookupByAddress finds entry', () => {
    const state = buildState([{resourceType: 'monitor', refKey: 'API', apiId: 'uuid-1'}])
    expect(lookupByAddress(state, 'monitors.API')?.apiId).toBe('uuid-1')
  })

  it('lookupByAddress returns undefined for missing', () => {
    const state = emptyState()
    expect(lookupByAddress(state, 'monitors.Missing')).toBeUndefined()
  })

  it('lookupByApiId finds entry across resource types', () => {
    const state = buildState([
      {resourceType: 'monitor', refKey: 'API', apiId: 'uuid-1'},
      {resourceType: 'tag', refKey: 'prod', apiId: 'uuid-2'},
    ])
    const result = lookupByApiId(state, 'uuid-2')
    expect(result).toBeDefined()
    expect(result!.address).toBe('tags.prod')
    expect(result!.entry.apiId).toBe('uuid-2')
  })

  it('lookupByApiId returns undefined for unknown ID', () => {
    const state = emptyState()
    expect(lookupByApiId(state, 'unknown')).toBeUndefined()
  })

  // ── Moved blocks ─────────────────────────────────────────────────

  it('processMovedBlocks renames an entry', () => {
    const state = emptyState()
    upsertStateEntry(state, 'monitor', 'Old API', 'uuid-1')
    const serial = state.serial

    const warnings = processMovedBlocks(state, [{from: 'monitors.Old API', to: 'monitors.Core API'}])
    expect(warnings).toHaveLength(0)
    expect(state.resources['monitors.Old API']).toBeUndefined()
    expect(state.resources['monitors.Core API']).toBeDefined()
    expect(state.resources['monitors.Core API'].apiId).toBe('uuid-1')
    expect(state.serial).toBe(serial + 1)
  })

  it('processMovedBlocks warns when source not found', () => {
    const state = emptyState()
    const warnings = processMovedBlocks(state, [{from: 'monitors.Ghost', to: 'monitors.New'}])
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('not found in state')
  })

  it('processMovedBlocks warns when target already exists', () => {
    const state = emptyState()
    upsertStateEntry(state, 'monitor', 'A', 'uuid-1')
    upsertStateEntry(state, 'monitor', 'B', 'uuid-2')
    const warnings = processMovedBlocks(state, [{from: 'monitors.A', to: 'monitors.B'}])
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('already exists')
  })

  it('processMovedBlocks handles multiple moves', () => {
    const state = emptyState()
    upsertStateEntry(state, 'monitor', 'Old1', 'uuid-1')
    upsertStateEntry(state, 'monitor', 'Old2', 'uuid-2')
    const warnings = processMovedBlocks(state, [
      {from: 'monitors.Old1', to: 'monitors.New1'},
      {from: 'monitors.Old2', to: 'monitors.New2'},
    ])
    expect(warnings).toHaveLength(0)
    expect(state.resources['monitors.New1']?.apiId).toBe('uuid-1')
    expect(state.resources['monitors.New2']?.apiId).toBe('uuid-2')
  })

  it('processMovedBlocks preserves children through rename', () => {
    const state = emptyState()
    upsertStateEntry(state, 'statusPage', 'old-slug', 'sp-1', {
      'groups.Platform': {apiId: 'g-1'},
    })
    processMovedBlocks(state, [{from: 'statusPages.old-slug', to: 'statusPages.new-slug'}])
    const moved = state.resources['statusPages.new-slug']
    expect(moved.children['groups.Platform'].apiId).toBe('g-1')
  })

  // ── V1 → V3 migration ────────────────────────────────────────────

  it('migrateV1 converts to v3 format', () => {
    const v1: DeployStateV1 = {
      version: '1',
      lastDeployedAt: '2025-01-01T00:00:00Z',
      resources: [
        {resourceType: 'monitor', refKey: 'API', id: 'mon-1', createdAt: '2025-01-01'},
        {resourceType: 'tag', refKey: 'prod', id: 'tag-1', createdAt: '2025-01-01'},
      ],
    }
    const v3 = migrateV1(v1)
    expect(v3.version).toBe('3')
    expect(v3.serial).toBe(1)
    expect(v3.resources['monitors.API']).toBeDefined()
    expect(v3.resources['monitors.API'].apiId).toBe('mon-1')
    expect(v3.resources['monitors.API']).not.toHaveProperty('attributes')
    expect(v3.resources['tags.prod']).toBeDefined()
    expect(v3.resources['tags.prod'].apiId).toBe('tag-1')
  })

  it('readState auto-migrates v1 on disk', () => {
    const v1 = {
      version: '1',
      lastDeployedAt: '2025-01-01T00:00:00Z',
      resources: [
        {resourceType: 'monitor', refKey: 'API', id: 'mon-1', createdAt: '2025-01-01'},
      ],
    }
    const dir = join(tmpDir, '.devhelm')
    mkdirSync(dir, {recursive: true})
    writeFileSync(join(dir, 'state.json'), JSON.stringify(v1))

    const loaded = readState(tmpDir)!
    expect(loaded.version).toBe('3')
    expect(loaded.serial).toBe(1)
    expect(loaded.resources['monitors.API'].apiId).toBe('mon-1')
  })

  it('migrateV1 handles empty resources array', () => {
    const v1: DeployStateV1 = {version: '1', lastDeployedAt: '2025-01-01T00:00:00Z', resources: []}
    const v3 = migrateV1(v1)
    expect(v3.version).toBe('3')
    expect(Object.keys(v3.resources)).toHaveLength(0)
  })

  // ── V2 → V3 migration ────────────────────────────────────────────

  it('migrateV2 strips parent and child attributes', () => {
    const v2 = {
      version: '2' as const,
      serial: 7,
      lastDeployedAt: '2025-04-22T00:00:00Z',
      resources: {
        'statusPages.devhelm': {
          apiId: 'sp-1',
          resourceType: 'statusPage',
          attributes: {name: 'DevHelm', slug: 'devhelm'},
          children: {
            'groups.Platform': {apiId: 'g-1', attributes: {name: 'Platform', defaultOpen: true}},
            'components.API': {apiId: 'c-1', attributes: {name: 'API'}},
          },
        },
      },
    }
    const v3 = migrateV2(v2)
    expect(v3.version).toBe('3')
    expect(v3.serial).toBe(7)
    expect(v3.resources['statusPages.devhelm'].apiId).toBe('sp-1')
    expect(v3.resources['statusPages.devhelm']).not.toHaveProperty('attributes')
    expect(v3.resources['statusPages.devhelm'].children['groups.Platform'].apiId).toBe('g-1')
    expect(v3.resources['statusPages.devhelm'].children['groups.Platform']).not.toHaveProperty('attributes')
    expect(v3.resources['statusPages.devhelm'].children['components.API'].apiId).toBe('c-1')
  })

  it('readState auto-migrates v2 on disk silently', () => {
    const v2 = {
      version: '2',
      serial: 3,
      lastDeployedAt: '2025-04-22T00:00:00Z',
      resources: {
        'monitors.API': {
          apiId: 'mon-1', resourceType: 'monitor',
          attributes: {name: 'API', frequencySeconds: 60},
          children: {},
        },
      },
    }
    const dir = join(tmpDir, '.devhelm')
    mkdirSync(dir, {recursive: true})
    writeFileSync(join(dir, 'state.json'), JSON.stringify(v2))

    const loaded = readState(tmpDir)!
    expect(loaded.version).toBe('3')
    expect(loaded.serial).toBe(3)
    expect(loaded.resources['monitors.API'].apiId).toBe('mon-1')
  })

  // ── emptyState ────────────────────────────────────────────────────

  it('emptyState creates valid empty v3 state', () => {
    const state = emptyState()
    expect(state.version).toBe('3')
    expect(state.serial).toBe(0)
    expect(Object.keys(state.resources)).toHaveLength(0)
    expect(state.lastDeployedAt).toBeTruthy()
  })

  // ── Round-trip ────────────────────────────────────────────────────

  it('full write/read round-trip preserves identity (no attributes expected in v3)', () => {
    const state = buildState([
      {
        resourceType: 'statusPage', refKey: 'devhelm', apiId: 'sp-1',
        children: {
          'groups.Platform': {apiId: 'g-1'},
          'components.API': {apiId: 'c-1'},
        },
      },
      {resourceType: 'monitor', refKey: 'API', apiId: 'mon-1'},
    ])
    writeState(state, tmpDir)

    const loaded = readState(tmpDir)!
    expect(loaded.version).toBe('3')
    expect(loaded.serial).toBe(1)
    expect(loaded.resources['statusPages.devhelm'].children['groups.Platform'].apiId).toBe('g-1')
    expect(loaded.resources['monitors.API'].apiId).toBe('mon-1')
  })
})
