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
  ChannelType, YamlStatusPage,
} from './schema.js'
import type {ResolvedRefs} from './resolver.js'

type Schemas = components['schemas']

// ── Channel type discriminator mapping ─────────────────────────────────

const CHANNEL_TYPE_DISCRIMINATOR: Record<ChannelType, string> = {
  slack: 'SlackChannelConfig',
  discord: 'DiscordChannelConfig',
  email: 'EmailChannelConfig',
  webhook: 'WebhookChannelConfig',
  pagerduty: 'PagerDutyChannelConfig',
  opsgenie: 'OpsGenieChannelConfig',
  teams: 'TeamsChannelConfig',
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
  const channelType = CHANNEL_TYPE_DISCRIMINATOR[channel.type]
  const config = {channelType, ...channel.config} as Schemas['CreateAlertChannelRequest']['config']
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

export function toCreateMonitorRequest(
  monitor: YamlMonitor,
  refs: ResolvedRefs,
): Schemas['CreateMonitorRequest'] {
  return {
    name: monitor.name,
    type: monitor.type,
    config: monitor.config as Schemas['CreateMonitorRequest']['config'],
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
    config: monitor.config as Schemas['UpdateMonitorRequest']['config'],
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
    case 'BearerAuthConfig':
      return {type: 'BearerAuthConfig', vaultSecretId: secretId ?? null} as Schemas['BearerAuthConfig']
    case 'BasicAuthConfig':
      return {type: 'BasicAuthConfig', vaultSecretId: secretId ?? null} as Schemas['BasicAuthConfig']
    case 'ApiKeyAuthConfig':
      return {type: 'ApiKeyAuthConfig', headerName: auth.headerName, vaultSecretId: secretId ?? null} as Schemas['ApiKeyAuthConfig']
    case 'HeaderAuthConfig':
      return {type: 'HeaderAuthConfig', headerName: auth.headerName, vaultSecretId: secretId ?? null} as Schemas['HeaderAuthConfig']
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
