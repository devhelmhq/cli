/**
 * Type-checked transforms: YAML config types → API request types.
 * Every function here is compile-time verified against both sides.
 */
import type {components} from '../api.generated.js'
import type {
  YamlMonitor, YamlAlertChannel, YamlNotificationPolicy,
  YamlResourceGroup, YamlWebhook, YamlTag, YamlEnvironment,
  YamlSecret, YamlAssertion, YamlAuth,
  YamlIncidentPolicy, YamlEscalationStep, YamlMatchRule,
  YamlStatusPage,
} from './schema.js'
import type {ResolvedRefs} from './resolver.js'

type Schemas = components['schemas']

// ── Discriminator wire-format helpers ─────────────────────────────────
// YAML now uses snake_case names that match the API wire format directly.
// These helpers convert between YAML/wire names and PascalCase schema names
// for any code that needs the reverse mapping (e.g. reading API responses).

export function pascalToSnake(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/([A-Z])([A-Z][a-z])/g, '$1_$2').toLowerCase()
}

export function snakeToPascal(s: string): string {
  return s.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('')
}

export function assertionSchemaToWire(schemaName: string): string {
  return pascalToSnake(schemaName.replace(/Assertion$/, ''))
}

export function assertionWireToSchema(wire: string): string {
  return snakeToPascal(wire) + 'Assertion'
}

export function authSchemaToWire(schemaName: string): string {
  return pascalToSnake(schemaName.replace(/AuthConfig$/, ''))
}

export function authWireToSchema(wire: string): string {
  return snakeToPascal(wire) + 'AuthConfig'
}

// ── Tag ────────────────────────────────────────────────────────────────

export function toCreateTagRequest(tag: YamlTag): Schemas['CreateTagRequest'] {
  return {
    name: tag.name,
    color: tag.color ?? null,
  }
}

// ── Environment ────────────────────────────────────────────────────────

export function toCreateEnvironmentRequest(env: YamlEnvironment): Schemas['CreateEnvironmentRequest'] {
  return {
    name: env.name,
    slug: env.slug,
    variables: env.variables ?? null,
    isDefault: env.isDefault,
  }
}

// ── Secret ─────────────────────────────────────────────────────────────

export function toCreateSecretRequest(secret: YamlSecret): Schemas['CreateSecretRequest'] {
  return {key: secret.key, value: secret.value}
}

// ── Alert Channel ──────────────────────────────────────────────────────

export function toCreateAlertChannelRequest(channel: YamlAlertChannel): Schemas['CreateAlertChannelRequest'] {
  const config = {channelType: channel.type, ...channel.config} as Schemas['CreateAlertChannelRequest']['config']
  return {name: channel.name, config}
}

// ── Notification Policy ────────────────────────────────────────────────

export function toCreateNotificationPolicyRequest(
  policy: YamlNotificationPolicy,
  refs: ResolvedRefs,
): Schemas['CreateNotificationPolicyRequest'] {
  return {
    name: policy.name,
    enabled: policy.enabled ?? true,
    priority: policy.priority ?? 0,
    matchRules: policy.matchRules?.map((r) => toMatchRule(r, refs)),
    escalation: {
      steps: policy.escalation.steps.map((s) => toEscalationStep(s, refs)),
      onResolve: policy.escalation.onResolve ?? null,
      onReopen: policy.escalation.onReopen ?? null,
    },
  }
}

function toEscalationStep(step: YamlEscalationStep, refs: ResolvedRefs): Schemas['EscalationStep'] {
  return {
    channelIds: step.channels.map((name) => refs.require('alertChannels', name)),
    delayMinutes: step.delayMinutes ?? 0,
    requireAck: step.requireAck ?? null,
    repeatIntervalSeconds: step.repeatIntervalSeconds ?? null,
  }
}

function toMatchRule(rule: YamlMatchRule, refs: ResolvedRefs): Schemas['MatchRule'] {
  return {
    type: rule.type,
    value: rule.value ?? null,
    monitorIds: rule.monitorNames?.map((name) => refs.require('monitors', name)) ?? null,
    regions: rule.regions ?? null,
    values: rule.values ?? null,
  }
}

// ── Webhook ────────────────────────────────────────────────────────────

export function toCreateWebhookRequest(webhook: YamlWebhook): Schemas['CreateWebhookEndpointRequest'] {
  return {
    url: webhook.url,
    subscribedEvents: webhook.events,
    description: webhook.description,
  }
}

// ── Resource Group ─────────────────────────────────────────────────────

export function toCreateResourceGroupRequest(
  group: YamlResourceGroup,
  refs: ResolvedRefs,
): Schemas['CreateResourceGroupRequest'] {
  return {
    name: group.name,
    description: group.description ?? null,
    alertPolicyId: group.alertPolicy ? refs.resolve('notificationPolicies', group.alertPolicy) ?? null : null,
    defaultFrequency: group.defaultFrequency ?? null,
    defaultRegions: group.defaultRegions ?? null,
    defaultRetryStrategy: group.defaultRetryStrategy ? {
      type: group.defaultRetryStrategy.type,
      maxRetries: group.defaultRetryStrategy.maxRetries,
      interval: group.defaultRetryStrategy.interval,
    } : undefined,
    defaultAlertChannels: group.defaultAlertChannels?.map((n) => refs.resolve('alertChannels', n) ?? n) ?? null,
    defaultEnvironmentId: group.defaultEnvironment ? refs.resolve('environments', group.defaultEnvironment) ?? null : null,
    healthThresholdType: group.healthThresholdType ?? null,
    healthThresholdValue: group.healthThresholdValue ?? null,
    suppressMemberAlerts: group.suppressMemberAlerts,
    confirmationDelaySeconds: group.confirmationDelaySeconds ?? null,
    recoveryCooldownMinutes: group.recoveryCooldownMinutes ?? null,
  }
}

// ── Monitor ────────────────────────────────────────────────────────────

/**
 * Narrow YAML monitor config to the API config union. The YAML schema
 * (zod) only accepts configs whose shape matches one of the API config
 * types; we route on `monitor.type` so the type-assertion is at least
 * partitioned per monitor type and any shape drift surfaces as a zod
 * parse failure before reaching this function.
 */
function toMonitorConfig(
  monitor: YamlMonitor,
): Schemas['CreateMonitorRequest']['config'] {
  const cfg = monitor.config as unknown
  switch (monitor.type) {
    case 'HTTP': return cfg as Schemas['HttpMonitorConfig']
    case 'DNS': return cfg as Schemas['DnsMonitorConfig']
    case 'TCP': return cfg as Schemas['TcpMonitorConfig']
    case 'ICMP': return cfg as Schemas['IcmpMonitorConfig']
    case 'HEARTBEAT': return cfg as Schemas['HeartbeatMonitorConfig']
    case 'MCP_SERVER': return cfg as Schemas['McpServerMonitorConfig']
  }
}

export function toCreateMonitorRequest(
  monitor: YamlMonitor,
  refs: ResolvedRefs,
): Schemas['CreateMonitorRequest'] {
  return {
    name: monitor.name,
    type: monitor.type,
    config: toMonitorConfig(monitor),
    managedBy: 'CLI',
    frequencySeconds: monitor.frequency,
    enabled: monitor.enabled,
    regions: monitor.regions ?? null,
    environmentId: monitor.environment ? refs.resolve('environments', monitor.environment) ?? null : null,
    assertions: monitor.assertions?.map(toCreateAssertionRequest) ?? null,
    auth: monitor.auth ? toAuthConfig(monitor.auth, refs) : undefined,
    incidentPolicy: monitor.incidentPolicy ? toIncidentPolicy(monitor.incidentPolicy) : undefined,
    alertChannelIds: monitor.alertChannels?.map((n) => refs.require('alertChannels', n)) ?? null,
    tags: monitor.tags ? {
      tagIds: monitor.tags.map((n) => refs.resolve('tags', n)).filter((id): id is string => id !== undefined),
      newTags: monitor.tags
        .filter((n) => !refs.resolve('tags', n))
        .map((n) => ({name: n})),
    } : undefined,
  }
}

export function toUpdateMonitorRequest(
  monitor: YamlMonitor,
  refs: ResolvedRefs,
): Schemas['UpdateMonitorRequest'] {
  return {
    name: monitor.name,
    config: toMonitorConfig(monitor) as Schemas['UpdateMonitorRequest']['config'],
    managedBy: 'CLI',
    frequencySeconds: monitor.frequency ?? null,
    enabled: monitor.enabled ?? null,
    regions: monitor.regions ?? null,
    environmentId: monitor.environment ? refs.resolve('environments', monitor.environment) ?? null : null,
    assertions: monitor.assertions?.map(toCreateAssertionRequest) ?? null,
    auth: monitor.auth ? toAuthConfig(monitor.auth, refs) : undefined,
    incidentPolicy: monitor.incidentPolicy ? toIncidentPolicy(monitor.incidentPolicy) : undefined,
    alertChannelIds: monitor.alertChannels?.map((n) => refs.require('alertChannels', n)) ?? null,
    tags: monitor.tags ? {
      tagIds: monitor.tags.map((n) => refs.resolve('tags', n)).filter((id): id is string => id !== undefined),
      newTags: monitor.tags
        .filter((n) => !refs.resolve('tags', n))
        .map((n) => ({name: n})),
    } : {tagIds: null, newTags: null},
  } as Schemas['UpdateMonitorRequest']
}

export function toCreateAssertionRequest(a: YamlAssertion): Schemas['CreateAssertionRequest'] {
  const config = {type: a.type, ...(a.config ?? {})} as Schemas['CreateAssertionRequest']['config']
  return {config, severity: a.severity}
}

export function toAuthConfig(auth: YamlAuth, refs: ResolvedRefs): Schemas['CreateMonitorRequest']['auth'] {
  const secretId = refs.resolve('secrets', auth.secret) ?? undefined
  switch (auth.type) {
    case 'bearer':
      return {type: 'bearer', vaultSecretId: secretId ?? null} as Schemas['BearerAuthConfig']
    case 'basic':
      return {type: 'basic', vaultSecretId: secretId ?? null} as Schemas['BasicAuthConfig']
    case 'api_key':
      return {type: 'api_key', headerName: auth.headerName, vaultSecretId: secretId ?? null} as Schemas['ApiKeyAuthConfig']
    case 'header':
      return {type: 'header', headerName: auth.headerName, vaultSecretId: secretId ?? null} as Schemas['HeaderAuthConfig']
  }
}

export function toIncidentPolicy(policy: YamlIncidentPolicy): Schemas['UpdateIncidentPolicyRequest'] {
  return {
    triggerRules: policy.triggerRules.map((r) => ({
      type: r.type,
      count: r.count ?? null,
      windowMinutes: r.windowMinutes ?? null,
      scope: r.scope,
      thresholdMs: r.thresholdMs ?? null,
      severity: r.severity,
      aggregationType: r.aggregationType ?? null,
    })),
    confirmation: {
      type: policy.confirmation.type,
      minRegionsFailing: policy.confirmation.minRegionsFailing ?? 0,
      maxWaitSeconds: policy.confirmation.maxWaitSeconds ?? 0,
    },
    recovery: {
      consecutiveSuccesses: policy.recovery.consecutiveSuccesses ?? 1,
      minRegionsPassing: policy.recovery.minRegionsPassing ?? 1,
      cooldownMinutes: policy.recovery.cooldownMinutes ?? 0,
    },
  }
}

// ── Status Page ────────────────────────────────────────────────────────

export function toCreateStatusPageRequest(page: YamlStatusPage): Schemas['CreateStatusPageRequest'] {
  return {
    name: page.name,
    slug: page.slug,
    description: page.description ?? null,
    visibility: page.visibility ?? null,
    enabled: page.enabled ?? null,
    incidentMode: page.incidentMode ?? null,
  }
}

export function toUpdateStatusPageRequest(page: YamlStatusPage): Schemas['UpdateStatusPageRequest'] {
  // Branding is intentionally omitted — YAML does not currently model branding,
  // and sending a body with null branding fields would reset user-configured
  // branding on every deploy. The API's "null preserves current" semantic applies
  // at the top level; omitting `branding` leaves it untouched.
  return {
    name: page.name,
    description: page.description ?? null,
    visibility: page.visibility ?? null,
    enabled: page.enabled ?? null,
    incidentMode: page.incidentMode ?? null,
  }
}
