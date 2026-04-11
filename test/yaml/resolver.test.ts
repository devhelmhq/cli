import {describe, it, expect} from 'vitest'
import {ResolvedRefs} from '../../src/lib/yaml/resolver.js'

describe('ResolvedRefs', () => {
  it('get returns undefined for unset ref', () => {
    const refs = new ResolvedRefs()
    expect(refs.get('tags', 'foo')).toBeUndefined()
  })

  it('get returns entry after set', () => {
    const refs = new ResolvedRefs()
    refs.set('tags', 'prod', {id: 'tag-1', refKey: 'prod', raw: {name: 'prod'}})
    const entry = refs.get('tags', 'prod')
    expect(entry).toBeDefined()
    expect(entry!.id).toBe('tag-1')
    expect(entry!.refKey).toBe('prod')
    expect(entry!.raw).toEqual({name: 'prod'})
  })

  it('resolve returns id for existing ref', () => {
    const refs = new ResolvedRefs()
    refs.set('monitors', 'api', {id: 'mon-1', refKey: 'api', raw: {}})
    expect(refs.resolve('monitors', 'api')).toBe('mon-1')
  })

  it('resolve returns undefined for missing ref', () => {
    const refs = new ResolvedRefs()
    expect(refs.resolve('monitors', 'missing')).toBeUndefined()
  })

  it('require returns id for existing ref', () => {
    const refs = new ResolvedRefs()
    refs.set('alertChannels', 'slack', {id: 'ch-1', refKey: 'slack', raw: {}})
    expect(refs.require('alertChannels', 'slack')).toBe('ch-1')
  })

  it('require throws for missing ref', () => {
    const refs = new ResolvedRefs()
    expect(() => refs.require('alertChannels', 'missing'))
      .toThrow('Cannot resolve alertChannels reference "missing"')
  })

  it('all returns empty map for unset type', () => {
    const refs = new ResolvedRefs()
    const map = refs.all('tags')
    expect(map.size).toBe(0)
  })

  it('all returns map with all entries for type', () => {
    const refs = new ResolvedRefs()
    refs.set('tags', 'a', {id: '1', refKey: 'a', raw: {}})
    refs.set('tags', 'b', {id: '2', refKey: 'b', raw: {}})
    const map = refs.all('tags')
    expect(map.size).toBe(2)
    expect(map.get('a')!.id).toBe('1')
    expect(map.get('b')!.id).toBe('2')
  })

  it('allEntries returns array of entries', () => {
    const refs = new ResolvedRefs()
    refs.set('environments', 'prod', {id: 'e-1', refKey: 'prod', raw: {}})
    refs.set('environments', 'staging', {id: 'e-2', refKey: 'staging', raw: {}})
    const entries = refs.allEntries('environments')
    expect(entries).toHaveLength(2)
    expect(entries.map((e) => e.refKey).sort()).toEqual(['prod', 'staging'])
  })

  it('allEntries returns empty for unset type', () => {
    const refs = new ResolvedRefs()
    expect(refs.allEntries('secrets')).toHaveLength(0)
  })

  it('set overwrites existing entry', () => {
    const refs = new ResolvedRefs()
    refs.set('tags', 'prod', {id: '1', refKey: 'prod', raw: {}})
    refs.set('tags', 'prod', {id: '2', refKey: 'prod', raw: {updated: true}})
    expect(refs.resolve('tags', 'prod')).toBe('2')
    expect(refs.get('tags', 'prod')!.raw).toEqual({updated: true})
  })

  it('types are isolated', () => {
    const refs = new ResolvedRefs()
    refs.set('tags', 'same-key', {id: 'tag-1', refKey: 'same-key', raw: {}})
    refs.set('monitors', 'same-key', {id: 'mon-1', refKey: 'same-key', raw: {}})
    expect(refs.resolve('tags', 'same-key')).toBe('tag-1')
    expect(refs.resolve('monitors', 'same-key')).toBe('mon-1')
  })

  it('stores managedBy metadata', () => {
    const refs = new ResolvedRefs()
    refs.set('monitors', 'api', {id: 'mon-1', refKey: 'api', managedBy: 'CLI', raw: {}})
    expect(refs.get('monitors', 'api')!.managedBy).toBe('CLI')
  })
})
