import {describe, it, expect} from 'vitest'
import {
  emptyState, upsertStateEntry, processMovedBlocks, previewMovedBlocks,
  lookupByAddress, lookupByApiId, resourceAddress,
} from '../../src/lib/yaml/state.js'

describe('moved blocks', () => {
  describe('simple rename', () => {
    it('renames a monitor address while preserving API ID', () => {
      const state = emptyState()
      upsertStateEntry(state, 'monitor', 'Old API', 'uuid-1', {name: 'Old API', type: 'HTTP'})

      const warnings = processMovedBlocks(state, [
        {from: 'monitors.Old API', to: 'monitors.Core API'},
      ])

      expect(warnings).toHaveLength(0)
      expect(lookupByAddress(state, 'monitors.Old API')).toBeUndefined()
      const renamed = lookupByAddress(state, 'monitors.Core API')
      expect(renamed).toBeDefined()
      expect(renamed!.apiId).toBe('uuid-1')
      expect(renamed!.attributes).toEqual({name: 'Old API', type: 'HTTP'})
    })

    it('renames a status page with children preserved', () => {
      const state = emptyState()
      upsertStateEntry(state, 'statusPage', 'old-slug', 'sp-1', {name: 'Old Page'}, {
        'groups.Platform': {apiId: 'g-1', attributes: {name: 'Platform'}},
        'components.API': {apiId: 'c-1', attributes: {name: 'API'}},
      })

      processMovedBlocks(state, [
        {from: 'statusPages.old-slug', to: 'statusPages.new-slug'},
      ])

      const moved = lookupByAddress(state, 'statusPages.new-slug')
      expect(moved).toBeDefined()
      expect(moved!.children['groups.Platform'].apiId).toBe('g-1')
      expect(moved!.children['components.API'].apiId).toBe('c-1')
    })
  })

  describe('cross-type rename', () => {
    it('supports moving between section namespaces', () => {
      const state = emptyState()
      upsertStateEntry(state, 'alertChannel', 'Old Slack', 'ch-1')

      processMovedBlocks(state, [
        {from: 'alertChannels.Old Slack', to: 'alertChannels.Slack Alerts'},
      ])

      expect(lookupByAddress(state, 'alertChannels.Old Slack')).toBeUndefined()
      expect(lookupByAddress(state, 'alertChannels.Slack Alerts')?.apiId).toBe('ch-1')
    })
  })

  describe('error cases', () => {
    it('warns when source address does not exist', () => {
      const state = emptyState()
      const warnings = processMovedBlocks(state, [
        {from: 'monitors.NonExistent', to: 'monitors.New'},
      ])
      expect(warnings).toHaveLength(1)
      expect(warnings[0]).toContain('not found in state')
    })

    it('warns when target address already exists', () => {
      const state = emptyState()
      upsertStateEntry(state, 'monitor', 'A', 'uuid-1')
      upsertStateEntry(state, 'monitor', 'B', 'uuid-2')

      const warnings = processMovedBlocks(state, [
        {from: 'monitors.A', to: 'monitors.B'},
      ])
      expect(warnings).toHaveLength(1)
      expect(warnings[0]).toContain('already exists')
      expect(lookupByAddress(state, 'monitors.A')?.apiId).toBe('uuid-1')
      expect(lookupByAddress(state, 'monitors.B')?.apiId).toBe('uuid-2')
    })

    it('handles duplicate from addresses', () => {
      const state = emptyState()
      upsertStateEntry(state, 'monitor', 'A', 'uuid-1')

      const warnings = processMovedBlocks(state, [
        {from: 'monitors.A', to: 'monitors.B'},
        {from: 'monitors.A', to: 'monitors.C'},
      ])

      // First move succeeds, second sees "A" gone
      expect(lookupByAddress(state, 'monitors.B')?.apiId).toBe('uuid-1')
      expect(warnings.some((w) => w.includes('not found in state'))).toBe(true)
    })
  })

  describe('chained renames', () => {
    it('processes moves in sequence', () => {
      const state = emptyState()
      upsertStateEntry(state, 'monitor', 'Step1', 'uuid-1')

      processMovedBlocks(state, [
        {from: 'monitors.Step1', to: 'monitors.Step2'},
        {from: 'monitors.Step2', to: 'monitors.Step3'},
      ])

      expect(lookupByAddress(state, 'monitors.Step1')).toBeUndefined()
      expect(lookupByAddress(state, 'monitors.Step2')).toBeUndefined()
      expect(lookupByAddress(state, 'monitors.Step3')?.apiId).toBe('uuid-1')
    })
  })

  describe('API ID lookup after move', () => {
    it('lookupByApiId finds resource after rename', () => {
      const state = emptyState()
      upsertStateEntry(state, 'monitor', 'Old', 'uuid-1')
      processMovedBlocks(state, [
        {from: 'monitors.Old', to: 'monitors.New'},
      ])

      const found = lookupByApiId(state, 'uuid-1')
      expect(found).toBeDefined()
      expect(found!.address).toBe('monitors.New')
    })
  })

  describe('integration with resourceAddress', () => {
    it('resourceAddress generates addresses that moved blocks expect', () => {
      expect(resourceAddress('monitor', 'API')).toBe('monitors.API')
      expect(resourceAddress('statusPage', 'main')).toBe('statusPages.main')
      expect(resourceAddress('alertChannel', 'Slack')).toBe('alertChannels.Slack')
    })
  })

  describe('previewMovedBlocks', () => {
    it('returns a renamed clone without mutating the original state', () => {
      const original = emptyState()
      upsertStateEntry(original, 'monitor', 'Old API', 'uuid-1', {name: 'Old API', type: 'HTTP'})
      const originalSerial = original.serial
      const originalLastDeployed = original.lastDeployedAt

      const {state: preview, warnings} = previewMovedBlocks(original, [
        {from: 'monitors.Old API', to: 'monitors.Core API'},
      ])

      expect(warnings).toHaveLength(0)
      // Preview reflects the move
      expect(lookupByAddress(preview, 'monitors.Old API')).toBeUndefined()
      expect(lookupByAddress(preview, 'monitors.Core API')?.apiId).toBe('uuid-1')
      // Original is untouched
      expect(lookupByAddress(original, 'monitors.Old API')?.apiId).toBe('uuid-1')
      expect(lookupByAddress(original, 'monitors.Core API')).toBeUndefined()
      expect(original.serial).toBe(originalSerial)
      expect(original.lastDeployedAt).toBe(originalLastDeployed)
    })

    it('deep-copies children and attributes so mutations do not leak', () => {
      const original = emptyState()
      upsertStateEntry(original, 'statusPage', 'old-slug', 'sp-1', {name: 'Old Page'}, {
        'components.API': {apiId: 'c-1', attributes: {name: 'API'}},
      })

      const {state: preview} = previewMovedBlocks(original, [
        {from: 'statusPages.old-slug', to: 'statusPages.new-slug'},
      ])

      const moved = lookupByAddress(preview, 'statusPages.new-slug')!
      // Mutate the preview's child attributes
      moved.children['components.API'].attributes!.name = 'mutated'

      // Original is unaffected
      const originalEntry = lookupByAddress(original, 'statusPages.old-slug')!
      expect(originalEntry.children['components.API'].attributes!.name).toBe('API')
    })

    it('surfaces the same warnings as processMovedBlocks for invalid moves', () => {
      const original = emptyState()
      const {warnings} = previewMovedBlocks(original, [
        {from: 'monitors.NonExistent', to: 'monitors.New'},
      ])
      expect(warnings).toHaveLength(1)
      expect(warnings[0]).toContain('not found in state')
    })
  })
})
