/**
 * Pre-flight entitlement check: fetches /auth/me and compares
 * planned resource creation against plan limits.
 */
import type {ApiClient} from '../api-client.js'
import {typedGet} from '../typed-api.js'
import type {Changeset} from './types.js'

interface Entitlement {
  value: number
}

interface AuthMePlan {
  tier?: string
  entitlements?: Record<string, Entitlement>
  usage?: Record<string, number>
  trialActive?: boolean
  subscriptionStatus?: string
}

interface AuthMeData {
  plan?: AuthMePlan
  organization?: {name?: string}
}

export interface EntitlementWarning {
  resource: string
  current: number
  creating: number
  limit: number
}

export interface EntitlementCheck {
  plan: string
  warnings: EntitlementWarning[]
  header: string
}

const UNLIMITED = Number.MAX_SAFE_INTEGER

const RESOURCE_ENTITLEMENT_MAP: Record<string, string> = {
  monitor: 'monitors',
  alertChannel: 'alert_channels',
  notificationPolicy: 'notification_policies',
  webhook: 'webhooks',
  resourceGroup: 'resource_groups',
  environment: 'environments',
  secret: 'secrets',
}

/**
 * Fetch plan entitlements and check if the changeset would exceed any limits.
 * Returns null if /auth/me is unavailable (non-API-key tokens).
 */
export async function checkEntitlements(
  client: ApiClient,
  changeset: Changeset,
): Promise<EntitlementCheck | null> {
  let data: AuthMeData
  try {
    const resp = await typedGet<AuthMeData>(client, '/api/v1/auth/me')
    data = narrowAuthMeData(resp)
  } catch {
    return null
  }

  const plan = data.plan
  if (!plan?.entitlements || !plan.usage) return null

  const createCounts = new Map<string, number>()
  for (const create of changeset.creates) {
    const entitlementKey = RESOURCE_ENTITLEMENT_MAP[create.resourceType]
    if (entitlementKey) {
      createCounts.set(entitlementKey, (createCounts.get(entitlementKey) ?? 0) + 1)
    }
  }

  const warnings: EntitlementWarning[] = []

  for (const [entitlementKey, createsOfType] of createCounts) {
    const entitlement = plan.entitlements[entitlementKey]
    if (!entitlement || entitlement.value >= UNLIMITED) continue

    const currentUsage = plan.usage[entitlementKey] ?? 0
    if (currentUsage + createsOfType > entitlement.value) {
      warnings.push({
        resource: entitlementKey,
        current: currentUsage,
        creating: createsOfType,
        limit: entitlement.value,
      })
    }
  }

  const tier = plan.tier ?? 'unknown'
  const org = data.organization?.name ?? ''
  const usageParts: string[] = []
  for (const [key, used] of Object.entries(plan.usage)) {
    const limit = plan.entitlements[key]?.value
    if (limit != null && limit < UNLIMITED) {
      usageParts.push(`${key.replace(/_/g, ' ')}: ${used}/${limit}`)
    }
  }

  const header = `Plan: ${tier}${org ? ` (${org})` : ''}${usageParts.length ? ' | ' + usageParts.join(', ') : ''}`

  return {plan: tier, warnings, header}
}

function narrowAuthMeData(resp: unknown): AuthMeData {
  if (!resp || typeof resp !== 'object') return {}
  const obj = resp as Record<string, unknown>
  const inner = (obj.data && typeof obj.data === 'object' ? obj.data : resp) as Record<string, unknown>
  return {
    plan: inner.plan && typeof inner.plan === 'object' ? inner.plan as AuthMePlan : undefined,
    organization: inner.organization && typeof inner.organization === 'object'
      ? inner.organization as AuthMeData['organization']
      : undefined,
  }
}

export function formatEntitlementWarnings(warnings: EntitlementWarning[]): string {
  const lines = warnings.map((w) =>
    `  ⚠ ${w.resource}: deploying ${w.creating} new but only ${w.limit - w.current} remaining (${w.current}/${w.limit} used)`,
  )
  return lines.join('\n')
}
