/**
 * Pre-flight entitlement check: fetches /auth/me and compares
 * planned resource creation against plan limits.
 */
import type {ApiClient} from '../api-client.js'
import {checkedFetch} from '../api-client.js'
import type {components} from '../api.generated.js'
import type {Changeset} from './types.js'

type AuthMeResponse = components['schemas']['AuthMeResponse']

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
  statusPage: 'status_pages',
}

/**
 * Fetch plan entitlements and check if the changeset would exceed any limits.
 * Returns null if /auth/me is unavailable (non-API-key tokens).
 */
export async function checkEntitlements(
  client: ApiClient,
  changeset: Changeset,
): Promise<EntitlementCheck | null> {
  let data: AuthMeResponse
  try {
    const resp = await checkedFetch<{data?: AuthMeResponse}>(client.GET('/api/v1/auth/me'))
    data = resp.data ?? ({} as AuthMeResponse)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    process.stderr.write(`Entitlement check skipped: ${msg}\n`)
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
    const limit = entitlement?.value
    if (limit == null || limit >= UNLIMITED) continue

    const currentUsage = plan.usage[entitlementKey] ?? 0
    if (currentUsage + createsOfType > limit) {
      warnings.push({
        resource: entitlementKey,
        current: currentUsage,
        creating: createsOfType,
        limit,
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

export function formatEntitlementWarnings(warnings: EntitlementWarning[]): string {
  const lines = warnings.map((w) =>
    `  ⚠ ${w.resource}: deploying ${w.creating} new but only ${w.limit - w.current} remaining (${w.current}/${w.limit} used)`,
  )
  return lines.join('\n')
}
