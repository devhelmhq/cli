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

  it('set with same id updates raw in place', () => {
    const refs = new ResolvedRefs()
    refs.set('tags', 'prod', {id: '1', refKey: 'prod', raw: {}})
    refs.set('tags', 'prod', {id: '1', refKey: 'prod', raw: {updated: true}})
    expect(refs.resolve('tags', 'prod')).toBe('1')
    expect(refs.get('tags', 'prod')!.raw).toEqual({updated: true})
    expect(refs.collisions).toHaveLength(0)
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

  it('stores matchSource metadata', () => {
    const refs = new ResolvedRefs()
    refs.set('monitors', 'api', {id: 'mon-1', refKey: 'api', raw: {}, matchSource: 'state'})
    expect(refs.get('monitors', 'api')!.matchSource).toBe('state')
  })

  describe('collision detection', () => {
    it('records collision when two different ids use the same refKey', () => {
      const refs = new ResolvedRefs()
      refs.set('monitors', 'api', {id: 'mon-1', refKey: 'api', raw: {}, matchSource: 'name'})
      refs.set('monitors', 'api', {id: 'mon-2', refKey: 'api', raw: {}, matchSource: 'name'})

      expect(refs.collisions).toHaveLength(1)
      expect(refs.collisions[0]).toMatchObject({
        refType: 'monitors',
        refKey: 'api',
        apiIds: ['mon-1', 'mon-2'],
        winnerApiId: 'mon-1',
      })
    })

    it('deduplicates repeated collisions on the same refKey', () => {
      const refs = new ResolvedRefs()
      refs.set('tags', 'prod', {id: 't-1', refKey: 'prod', raw: {}, matchSource: 'name'})
      refs.set('tags', 'prod', {id: 't-2', refKey: 'prod', raw: {}, matchSource: 'name'})
      refs.set('tags', 'prod', {id: 't-3', refKey: 'prod', raw: {}, matchSource: 'name'})

      expect(refs.collisions).toHaveLength(1)
      expect(refs.collisions[0].apiIds.sort()).toEqual(['t-1', 't-2', 't-3'])
    })

    it('state-matched entry wins over name-matched entry', () => {
      const refs = new ResolvedRefs()
      refs.set('monitors', 'api', {id: 'mon-old', refKey: 'api', raw: {}, matchSource: 'name'})
      refs.set('monitors', 'api', {id: 'mon-new', refKey: 'api', raw: {}, matchSource: 'state'})

      expect(refs.resolve('monitors', 'api')).toBe('mon-new')
      expect(refs.collisions).toHaveLength(1)
      expect(refs.collisions[0].winnerApiId).toBe('mon-new')
    })

    it('earlier state-matched entry wins over later name-matched entry', () => {
      const refs = new ResolvedRefs()
      refs.set('monitors', 'api', {id: 'mon-state', refKey: 'api', raw: {}, matchSource: 'state'})
      refs.set('monitors', 'api', {id: 'mon-name', refKey: 'api', raw: {}, matchSource: 'name'})

      expect(refs.resolve('monitors', 'api')).toBe('mon-state')
      expect(refs.collisions).toHaveLength(1)
      expect(refs.collisions[0].winnerApiId).toBe('mon-state')
    })

    it('same id re-set is a no-op and does not record a collision', () => {
      const refs = new ResolvedRefs()
      refs.set('tags', 'prod', {id: 't-1', refKey: 'prod', raw: {}, matchSource: 'name'})
      refs.set('tags', 'prod', {id: 't-1', refKey: 'prod', raw: {updated: true}, matchSource: 'name'})
      expect(refs.collisions).toHaveLength(0)
      expect(refs.get('tags', 'prod')!.raw).toEqual({updated: true})
    })

    it('collisions across different types are tracked independently', () => {
      const refs = new ResolvedRefs()
      refs.set('monitors', 'api', {id: 'm-1', refKey: 'api', raw: {}, matchSource: 'name'})
      refs.set('monitors', 'api', {id: 'm-2', refKey: 'api', raw: {}, matchSource: 'name'})
      refs.set('tags', 'api', {id: 't-1', refKey: 'api', raw: {}, matchSource: 'name'})
      refs.set('tags', 'api', {id: 't-2', refKey: 'api', raw: {}, matchSource: 'name'})

      expect(refs.collisions).toHaveLength(2)
      const monitorCollision = refs.collisions.find((c) => c.refType === 'monitors')
      const tagCollision = refs.collisions.find((c) => c.refType === 'tags')
      expect(monitorCollision).toBeDefined()
      expect(tagCollision).toBeDefined()
    })
  })
})
