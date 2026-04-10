import {describe, it, expect, vi, beforeEach} from 'vitest'

vi.mock('../../src/lib/typed-api.js', () => ({
  typedGet: vi.fn(),
  typedPost: vi.fn(),
  typedPut: vi.fn(),
  typedPatch: vi.fn(),
  typedDelete: vi.fn(),
  fetchPaginated: vi.fn(),
}))

import type {ApiClient} from '../../src/lib/api-client.js'
import {checkEntitlements, formatEntitlementWarnings} from '../../src/lib/yaml/entitlements.js'
import {typedGet} from '../../src/lib/typed-api.js'
import type {Changeset} from '../../src/lib/yaml/differ.js'
import type {EntitlementWarning} from '../../src/lib/yaml/entitlements.js'

const mockTypedGet = vi.mocked(typedGet)
const fakeClient = {} as ApiClient

function monitorCreates(n: number): Changeset {
  const creates = Array.from({length: n}, (_, i) => ({
    action: 'create' as const,
    resourceType: 'monitor' as const,
    refKey: `m${i}`,
  }))
  return {creates, updates: [], deletes: [], memberships: []}
}

describe('entitlements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('formatEntitlementWarnings', () => {
    it('formats single warning', () => {
      const warnings: EntitlementWarning[] = [{
        resource: 'monitors', current: 48, creating: 5, limit: 50,
      }]
      const output = formatEntitlementWarnings(warnings)
      expect(output).toContain('monitors')
      expect(output).toContain('5 new')
      expect(output).toContain('2 remaining')
    })

    it('formats multiple warnings', () => {
      const warnings: EntitlementWarning[] = [
        {resource: 'monitors', current: 9, creating: 3, limit: 10},
        {resource: 'webhooks', current: 4, creating: 2, limit: 5},
      ]
      const output = formatEntitlementWarnings(warnings)
      expect(output).toContain('monitors')
      expect(output).toContain('webhooks')
      expect(output.split('\n')).toHaveLength(2)
    })

    it('returns empty string for no warnings', () => {
      expect(formatEntitlementWarnings([])).toBe('')
    })
  })

  describe('checkEntitlements', () => {
    it('returns null on API error', async () => {
      mockTypedGet.mockRejectedValueOnce(new Error('network'))
      const result = await checkEntitlements(fakeClient, monitorCreates(1))
      expect(result).toBeNull()
    })

    it('returns null when plan data is missing', async () => {
      mockTypedGet.mockResolvedValueOnce({data: {plan: null}})
      const result = await checkEntitlements(fakeClient, monitorCreates(1))
      expect(result).toBeNull()
    })

    it('returns null when entitlements are missing', async () => {
      mockTypedGet.mockResolvedValueOnce({
        data: {plan: {tier: 'FREE', usage: {monitors: 5}}},
      })
      const result = await checkEntitlements(fakeClient, monitorCreates(1))
      expect(result).toBeNull()
    })

    it('detects over-limit creates', async () => {
      mockTypedGet.mockResolvedValueOnce({
        data: {
          plan: {
            tier: 'FREE',
            entitlements: {monitors: {value: 10}},
            usage: {monitors: 8},
          },
          organization: {name: 'TestOrg'},
        },
      })
      const result = await checkEntitlements(fakeClient, monitorCreates(5))
      expect(result).not.toBeNull()
      expect(result!.warnings).toHaveLength(1)
      expect(result!.warnings[0]).toMatchObject({
        resource: 'monitors',
        current: 8,
        creating: 5,
        limit: 10,
      })
    })

    it('no warnings when under limit', async () => {
      mockTypedGet.mockResolvedValueOnce({
        data: {
          plan: {
            tier: 'FREE',
            entitlements: {monitors: {value: 10}},
            usage: {monitors: 8},
          },
          organization: {name: 'TestOrg'},
        },
      })
      const result = await checkEntitlements(fakeClient, monitorCreates(1))
      expect(result).not.toBeNull()
      expect(result!.warnings).toHaveLength(0)
    })

    it('skips unlimited entitlements', async () => {
      mockTypedGet.mockResolvedValueOnce({
        data: {
          plan: {
            tier: 'FREE',
            entitlements: {monitors: {value: Number.MAX_SAFE_INTEGER}},
            usage: {monitors: 8},
          },
        },
      })
      const result = await checkEntitlements(fakeClient, monitorCreates(100))
      expect(result).not.toBeNull()
      expect(result!.warnings).toHaveLength(0)
    })

    it('builds header correctly', async () => {
      mockTypedGet.mockResolvedValueOnce({
        data: {
          plan: {
            tier: 'FREE',
            entitlements: {monitors: {value: 10}},
            usage: {monitors: 8},
          },
          organization: {name: 'TestOrg'},
        },
      })
      const result = await checkEntitlements(fakeClient, monitorCreates(0))
      expect(result).not.toBeNull()
      expect(result!.header).toContain('FREE')
      expect(result!.header).toContain('TestOrg')
      expect(result!.header).toMatch(/monitors:\s*8\/10/)
    })

    it('handles multiple resource types', async () => {
      mockTypedGet.mockResolvedValueOnce({
        data: {
          plan: {
            tier: 'FREE',
            entitlements: {
              monitors: {value: 10},
              webhooks: {value: 5},
            },
            usage: {monitors: 9, webhooks: 4},
          },
        },
      })
      const changeset: Changeset = {
        creates: [
          {action: 'create', resourceType: 'monitor', refKey: 'a'},
          {action: 'create', resourceType: 'monitor', refKey: 'b'},
          {action: 'create', resourceType: 'webhook', refKey: 'u1'},
          {action: 'create', resourceType: 'webhook', refKey: 'u2'},
        ],
        updates: [],
        deletes: [],
        memberships: [],
      }
      const result = await checkEntitlements(fakeClient, changeset)
      expect(result).not.toBeNull()
      expect(result!.warnings).toHaveLength(2)
      const resources = result!.warnings.map((w) => w.resource).sort()
      expect(resources).toEqual(['monitors', 'webhooks'])
    })
  })
})
