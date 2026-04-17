import {describe, it, expect, vi} from 'vitest'
import {diffChildren, applyChildDiff, hasChildChanges} from '../../src/lib/yaml/child-reconciler.js'
import type {ChildCollectionDef} from '../../src/lib/yaml/child-reconciler.js'

interface TestYaml {
  name: string
  color?: string
}

interface TestApi {
  id: string
  name: string
  color: string
  displayOrder: number
}

function makeDef(overrides: Partial<ChildCollectionDef<TestYaml, TestApi>> = {}): ChildCollectionDef<TestYaml, TestApi> {
  return {
    name: 'items',
    identityKey: (yaml) => yaml.name,
    apiIdentityKey: (api) => api.name,
    apiId: (api) => api.id,
    toDesiredSnapshot: (yaml) => ({name: yaml.name, color: yaml.color ?? 'red'}),
    toCurrentSnapshot: (api) => ({name: api.name, color: api.color}),
    applyCreate: vi.fn(async () => `new-${Math.random().toString(36).slice(2, 8)}`),
    applyUpdate: vi.fn(async () => {}),
    applyDelete: vi.fn(async () => {}),
    ...overrides,
  }
}

describe('child-reconciler', () => {
  describe('diffChildren', () => {
    it('detects creates for new children', () => {
      const def = makeDef()
      const result = diffChildren(def, [{name: 'A'}, {name: 'B'}], [])
      expect(result.creates).toHaveLength(2)
      expect(result.updates).toHaveLength(0)
      expect(result.deletes).toHaveLength(0)
      expect(result.creates[0].key).toBe('A')
      expect(result.creates[1].key).toBe('B')
    })

    it('detects deletes for removed children', () => {
      const def = makeDef()
      const current: TestApi[] = [
        {id: 'id-1', name: 'A', color: 'red', displayOrder: 0},
        {id: 'id-2', name: 'B', color: 'blue', displayOrder: 1},
      ]
      const result = diffChildren(def, [], current)
      expect(result.creates).toHaveLength(0)
      expect(result.deletes).toHaveLength(2)
    })

    it('detects updates when attributes differ', () => {
      const def = makeDef()
      const current: TestApi[] = [{id: 'id-1', name: 'A', color: 'blue', displayOrder: 0}]
      const result = diffChildren(def, [{name: 'A', color: 'red'}], current)
      expect(result.updates).toHaveLength(1)
      expect(result.updates[0].childId).toBe('id-1')
    })

    it('no changes when in sync', () => {
      const def = makeDef()
      const current: TestApi[] = [{id: 'id-1', name: 'A', color: 'red', displayOrder: 0}]
      const result = diffChildren(def, [{name: 'A', color: 'red'}], current)
      expect(result.creates).toHaveLength(0)
      expect(result.updates).toHaveLength(0)
      expect(result.deletes).toHaveLength(0)
      expect(hasChildChanges(result)).toBe(false)
    })

    it('detects ordering changes', () => {
      const def = makeDef()
      const current: TestApi[] = [
        {id: 'id-1', name: 'A', color: 'red', displayOrder: 0},
        {id: 'id-2', name: 'B', color: 'red', displayOrder: 1},
      ]
      // Reversed order
      const result = diffChildren(def, [{name: 'B', color: 'red'}, {name: 'A', color: 'red'}], current)
      expect(result.creates).toHaveLength(0)
      expect(result.updates).toHaveLength(0)
      expect(result.deletes).toHaveLength(0)
      expect(result.reorder).toBe(true)
    })

    it('mixed: create + update + delete', () => {
      const def = makeDef()
      const current: TestApi[] = [
        {id: 'id-1', name: 'Keep', color: 'red', displayOrder: 0},
        {id: 'id-2', name: 'Update', color: 'blue', displayOrder: 1},
        {id: 'id-3', name: 'Delete', color: 'green', displayOrder: 2},
      ]
      const desired: TestYaml[] = [
        {name: 'Keep', color: 'red'},
        {name: 'Update', color: 'red'},
        {name: 'New'},
      ]
      const result = diffChildren(def, desired, current)
      expect(result.creates).toHaveLength(1)
      expect(result.creates[0].key).toBe('New')
      expect(result.updates).toHaveLength(1)
      expect(result.updates[0].key).toBe('Update')
      expect(result.deletes).toHaveLength(1)
      expect(result.deletes[0].key).toBe('Delete')
    })

    it('uses state-based identity for renamed children', () => {
      const def = makeDef()
      const current: TestApi[] = [
        {id: 'id-1', name: 'OldName', color: 'red', displayOrder: 0},
      ]
      // State says id-1 is now known as "NewName" — the identity match works,
      // but since the API still has name "OldName", it's detected as an update
      const stateChildren = {
        'items.NewName': {apiId: 'id-1', attributes: {name: 'NewName'}},
      }
      const result = diffChildren(def, [{name: 'NewName', color: 'red'}], current, stateChildren)
      expect(result.creates).toHaveLength(0)
      expect(result.deletes).toHaveLength(0)
      // Correctly detected as update (name changed from OldName → NewName)
      expect(result.updates).toHaveLength(1)
      expect(result.updates[0].childId).toBe('id-1')
    })
  })

  describe('applyChildDiff', () => {
    it('applies creates and returns new IDs', async () => {
      const createFn = vi.fn(async (_pid: string, yaml: TestYaml) => `new-${yaml.name}`)
      const def = makeDef({applyCreate: createFn})
      const desired: TestYaml[] = [{name: 'A'}, {name: 'B'}]
      const diffResult = {
        creates: [{key: 'A', index: 0}, {key: 'B', index: 1}],
        updates: [],
        deletes: [],
        reorder: false,
      }
      const result = await applyChildDiff(def, 'parent-1', desired, diffResult, [])
      expect(result.changes).toHaveLength(2)
      expect(result.changes[0]).toEqual({action: 'create', childKey: 'A', childId: 'new-A'})
      expect(result.childState['items.A'].apiId).toBe('new-A')
      expect(result.childState['items.B'].apiId).toBe('new-B')
    })

    it('applies deletes before creates', async () => {
      const callOrder: string[] = []
      const def = makeDef({
        applyDelete: vi.fn(async () => {callOrder.push('delete')}),
        applyCreate: vi.fn(async () => {callOrder.push('create'); return 'new-id'}),
      })
      const diffResult = {
        creates: [{key: 'New', index: 0}],
        updates: [],
        deletes: [{key: 'Old', childId: 'old-id'}],
        reorder: false,
      }
      await applyChildDiff(def, 'p-1', [{name: 'New'}], diffResult, [])
      expect(callOrder).toEqual(['delete', 'create'])
    })

    it('applies updates', async () => {
      const updateFn = vi.fn(async () => {})
      const def = makeDef({applyUpdate: updateFn})
      const current: TestApi[] = [{id: 'id-1', name: 'A', color: 'blue', displayOrder: 0}]
      const diffResult = {
        creates: [],
        updates: [{key: 'A', childId: 'id-1', index: 0}],
        deletes: [],
        reorder: false,
      }
      const result = await applyChildDiff(def, 'p-1', [{name: 'A', color: 'red'}], diffResult, current)
      expect(updateFn).toHaveBeenCalledOnce()
      expect(result.changes).toHaveLength(1)
      expect(result.changes[0].action).toBe('update')
    })

    it('calls reorder when reorder flag is set', async () => {
      const reorderFn = vi.fn(async () => {})
      const def = makeDef({applyReorder: reorderFn})
      const current: TestApi[] = [
        {id: 'id-1', name: 'A', color: 'red', displayOrder: 0},
        {id: 'id-2', name: 'B', color: 'red', displayOrder: 1},
      ]
      const diffResult = {
        creates: [],
        updates: [],
        deletes: [],
        reorder: true,
      }
      await applyChildDiff(def, 'p-1', [{name: 'B'}, {name: 'A'}], diffResult, current)
      expect(reorderFn).toHaveBeenCalledWith('p-1', ['id-2', 'id-1'])
    })

    it('builds complete child state for state file', async () => {
      const def = makeDef({
        applyCreate: vi.fn(async () => 'new-c'),
      })
      const current: TestApi[] = [{id: 'id-1', name: 'Existing', color: 'red', displayOrder: 0}]
      const diffResult = {
        creates: [{key: 'New', index: 1}],
        updates: [],
        deletes: [],
        reorder: true,
      }
      const result = await applyChildDiff(def, 'p-1', [{name: 'Existing'}, {name: 'New'}], diffResult, current)
      expect(result.childState['items.Existing']).toBeDefined()
      expect(result.childState['items.Existing'].apiId).toBe('id-1')
      expect(result.childState['items.New']).toBeDefined()
      expect(result.childState['items.New'].apiId).toBe('new-c')
    })
  })

  describe('hasChildChanges', () => {
    it('returns true for creates', () => {
      expect(hasChildChanges({creates: [{key: 'a', index: 0}], updates: [], deletes: [], reorder: false})).toBe(true)
    })
    it('returns true for updates', () => {
      expect(hasChildChanges({creates: [], updates: [{key: 'a', childId: '1', index: 0}], deletes: [], reorder: false})).toBe(true)
    })
    it('returns true for deletes', () => {
      expect(hasChildChanges({creates: [], updates: [], deletes: [{key: 'a', childId: '1'}], reorder: false})).toBe(true)
    })
    it('returns false when empty', () => {
      expect(hasChildChanges({creates: [], updates: [], deletes: [], reorder: true})).toBe(false)
    })
  })
})
