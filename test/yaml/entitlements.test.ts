import {describe, it, expect, vi, beforeEach} from 'vitest'

vi.mock('../../src/lib/api-client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/api-client.js')>()
  return {
    ...actual,
    // Stub apiGetSingle to bypass the real openapi-fetch call: the test
    // fakes `client.GET(...)` to return a settled promise, so we just unwrap
    // it and let the caller's Zod schema validate the inner data.
    apiGetSingle: vi.fn(
      async (
        client: {GET: (...args: unknown[]) => Promise<unknown>},
        path: string,
        schema: {parse: (v: unknown) => unknown},
      ) => {
        const envelope = (await client.GET(path)) as {data?: unknown}
        return schema.parse(envelope.data)
      },
    ),
  }
})

import {checkEntitlements, formatEntitlementWarnings} from '../../src/lib/yaml/entitlements.js'
import type {Changeset} from '../../src/lib/yaml/differ.js'
import type {EntitlementWarning} from '../../src/lib/yaml/entitlements.js'

function makeFakeClient() {
  return {
    GET: vi.fn(),
    POST: vi.fn(),
    PUT: vi.fn(),
    PATCH: vi.fn(),
    DELETE: vi.fn(),
  } as Parameters<typeof checkEntitlements>[0]
}

function monitorCreates(n: number): Changeset {
  const creates = Array.from({length: n}, (_, i) => ({
    action: 'create' as const,
    resourceType: 'monitor' as const,
    refKey: `m${i}`,
  }))
  return {creates, updates: [], deletes: [], memberships: []}
}

// Build a full /auth/me response shaped to satisfy the strict generated
// `AuthMeResponse` Zod schema. Tests only care about plan + organization,
// but every required field on KeyInfo / PlanInfo / EntitlementDto /
// RateLimitInfo must be present and well-typed (e.g. ISO datetime with
// timezone offset) — exactly what the API guarantees.
function makeAuthMeData(overrides: {
  plan: {
    tier: 'FREE' | 'STARTER' | 'PRO' | 'TEAM' | 'BUSINESS' | 'ENTERPRISE'
    entitlements: Record<string, {value: number; key?: string}>
    usage: Record<string, number>
  }
  organization?: {name: string; id?: number}
}) {
  const planEntitlements: Record<
    string,
    {key: string; value: number; defaultValue: number; overridden: boolean}
  > = {}
  for (const [k, v] of Object.entries(overrides.plan.entitlements)) {
    planEntitlements[k] = {
      key: v.key ?? k,
      value: v.value,
      defaultValue: v.value,
      overridden: false,
    }
  }
  return {
    key: {id: 1, name: 'test-key', createdAt: '2024-01-01T00:00:00+00:00'},
    organization: overrides.organization ?? {id: 1, name: 'TestOrg'},
    plan: {
      tier: overrides.plan.tier,
      trialActive: false,
      entitlements: planEntitlements,
      usage: overrides.plan.usage,
    },
    rateLimits: {requestsPerMinute: 60, remaining: 60, windowMs: 60_000},
  }
}

describe('entitlements', () => {
  let fakeClient: ReturnType<typeof makeFakeClient>
  let mockGet: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    fakeClient = makeFakeClient()
    mockGet = fakeClient.GET as ReturnType<typeof vi.fn>
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
      mockGet.mockRejectedValueOnce(new Error('network'))
      const result = await checkEntitlements(fakeClient, monitorCreates(1))
      expect(result).toBeNull()
    })

    it('returns null when plan data is missing', async () => {
      mockGet.mockResolvedValueOnce({data: {plan: null}})
      const result = await checkEntitlements(fakeClient, monitorCreates(1))
      expect(result).toBeNull()
    })

    it('returns null when entitlements are missing', async () => {
      mockGet.mockResolvedValueOnce({
        data: {plan: {tier: 'FREE', usage: {monitors: 5}}},
      })
      const result = await checkEntitlements(fakeClient, monitorCreates(1))
      expect(result).toBeNull()
    })

    it('detects over-limit creates', async () => {
      mockGet.mockResolvedValueOnce({
        data: makeAuthMeData({
          plan: {tier: 'FREE', entitlements: {monitors: {value: 10}}, usage: {monitors: 8}},
        }),
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
      mockGet.mockResolvedValueOnce({
        data: makeAuthMeData({
          plan: {tier: 'FREE', entitlements: {monitors: {value: 10}}, usage: {monitors: 8}},
        }),
      })
      const result = await checkEntitlements(fakeClient, monitorCreates(1))
      expect(result).not.toBeNull()
      expect(result!.warnings).toHaveLength(0)
    })

    it('skips unlimited entitlements', async () => {
      mockGet.mockResolvedValueOnce({
        data: makeAuthMeData({
          plan: {
            tier: 'FREE',
            entitlements: {monitors: {value: Number.MAX_SAFE_INTEGER}},
            usage: {monitors: 8},
          },
        }),
      })
      const result = await checkEntitlements(fakeClient, monitorCreates(100))
      expect(result).not.toBeNull()
      expect(result!.warnings).toHaveLength(0)
    })

    it('builds header correctly', async () => {
      mockGet.mockResolvedValueOnce({
        data: makeAuthMeData({
          plan: {tier: 'FREE', entitlements: {monitors: {value: 10}}, usage: {monitors: 8}},
        }),
      })
      const result = await checkEntitlements(fakeClient, monitorCreates(0))
      expect(result).not.toBeNull()
      expect(result!.header).toContain('FREE')
      expect(result!.header).toContain('TestOrg')
      expect(result!.header).toMatch(/monitors:\s*8\/10/)
    })

    it('warns when creating statusPages exceeds limit', async () => {
      mockGet.mockResolvedValueOnce({
        data: makeAuthMeData({
          plan: {tier: 'FREE', entitlements: {status_pages: {value: 1}}, usage: {status_pages: 1}},
        }),
      })
      const changeset: Changeset = {
        creates: [{action: 'create', resourceType: 'statusPage', refKey: 'p1'}],
        updates: [], deletes: [], memberships: [],
      }
      const result = await checkEntitlements(fakeClient, changeset)
      expect(result).not.toBeNull()
      expect(result!.warnings).toHaveLength(1)
      expect(result!.warnings[0]).toMatchObject({
        resource: 'status_pages', current: 1, creating: 1, limit: 1,
      })
    })

    it('no warning when statusPage creates under limit', async () => {
      mockGet.mockResolvedValueOnce({
        data: makeAuthMeData({
          plan: {tier: 'PRO', entitlements: {status_pages: {value: 5}}, usage: {status_pages: 2}},
        }),
      })
      const changeset: Changeset = {
        creates: [
          {action: 'create', resourceType: 'statusPage', refKey: 'p1'},
          {action: 'create', resourceType: 'statusPage', refKey: 'p2'},
        ],
        updates: [], deletes: [], memberships: [],
      }
      const result = await checkEntitlements(fakeClient, changeset)
      expect(result).not.toBeNull()
      expect(result!.warnings).toHaveLength(0)
    })

    it('ignores tag creates (no entitlement mapping)', async () => {
      mockGet.mockResolvedValueOnce({
        data: makeAuthMeData({
          plan: {tier: 'FREE', entitlements: {monitors: {value: 10}}, usage: {monitors: 0}},
        }),
      })
      const changeset: Changeset = {
        creates: [
          {action: 'create', resourceType: 'tag', refKey: 't1'},
          {action: 'create', resourceType: 'tag', refKey: 't2'},
        ],
        updates: [], deletes: [], memberships: [],
      }
      const result = await checkEntitlements(fakeClient, changeset)
      expect(result).not.toBeNull()
      // tag isn't mapped to an entitlement key, so no warnings even if
      // hypothetical limits existed.
      expect(result!.warnings).toHaveLength(0)
    })

    it('clamps remaining at zero when current exceeds limit', () => {
      const output = formatEntitlementWarnings([{
        resource: 'status_pages', current: 5, creating: 1, limit: 1,
      }])
      // current > limit would give negative "remaining"; clamp to 0.
      expect(output).toContain('0 remaining')
      expect(output).not.toContain('-')
    })

    it('handles multiple resource types', async () => {
      mockGet.mockResolvedValueOnce({
        data: makeAuthMeData({
          plan: {
            tier: 'FREE',
            entitlements: {monitors: {value: 10}, webhooks: {value: 5}},
            usage: {monitors: 9, webhooks: 4},
          },
        }),
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
