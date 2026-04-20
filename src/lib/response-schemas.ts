/**
 * Zod schemas for runtime validation of critical API responses.
 *
 * These are intentionally loose (.passthrough()) — they verify the structural
 * contract (required fields exist with correct types) without rejecting extra
 * fields the server may add in newer versions.
 */
import {z} from 'zod'

const EntitlementDto = z
  .object({
    key: z.string(),
    value: z.number().optional(),
    defaultValue: z.number().optional(),
    overridden: z.boolean().optional(),
  })
  .passthrough()

const KeyInfo = z
  .object({
    id: z.number().optional(),
    name: z.string(),
    createdAt: z.string(),
    expiresAt: z.string().nullish(),
    lastUsedAt: z.string().nullish(),
  })
  .passthrough()

const OrgInfo = z
  .object({
    id: z.number().optional(),
    name: z.string(),
  })
  .passthrough()

const PlanInfo = z
  .object({
    tier: z.enum(['FREE', 'STARTER', 'PRO', 'TEAM', 'BUSINESS', 'ENTERPRISE']),
    subscriptionStatus: z.string().nullish(),
    trialActive: z.boolean().optional(),
    trialExpiresAt: z.string().nullish(),
    entitlements: z.record(EntitlementDto),
    usage: z.record(z.number()),
  })
  .passthrough()

const RateLimitInfo = z
  .object({
    requestsPerMinute: z.number(),
    remaining: z.number(),
    windowMs: z.number(),
  })
  .passthrough()

export const AuthMeResponseSchema = z.object({
  key: KeyInfo,
  organization: OrgInfo,
  plan: PlanInfo,
  rateLimits: RateLimitInfo,
})

export const MonitorsSummarySchema = z
  .object({
    total: z.number(),
    up: z.number(),
    down: z.number(),
    degraded: z.number(),
    paused: z.number(),
    avgUptime24h: z.number().nullish(),
    avgUptime30d: z.number().nullish(),
  })
  .passthrough()

export const IncidentsSummarySchema = z
  .object({
    active: z.number(),
    resolvedToday: z.number(),
    mttr30d: z.number().nullish(),
  })
  .passthrough()

export const DashboardOverviewSchema = z.object({
  monitors: MonitorsSummarySchema,
  incidents: IncidentsSummarySchema,
})
