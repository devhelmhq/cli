/**
 * Type-checked transforms: YAML config types → API request types.
 * Every function here is compile-time verified against both sides.
 */
import {isCodeMonitorType} from '@devhelm/sdk'
import type {components} from '../api.generated.js'
import type {
  YamlMonitor, YamlAlertChannel, YamlNotificationPolicy,
  YamlResourceGroup, YamlWebhook, YamlTag, YamlEnvironment,
  YamlSecret, YamlAssertion, YamlAuth,
  YamlIncidentPolicy, YamlEscalationStep, YamlMatchRule,
  YamlStatusPage, YamlStatusPageBranding,
} from './schema.js'
import type {ResolvedRefs} from './resolver.js'
import {OWNER_TOOL, ownerAddress} from './project-context.js'

type Schemas = components['schemas']

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
    isDefault: env.isDefault ?? false,
  }
}

// ── Secret ─────────────────────────────────────────────────────────────

export function toCreateSecretRequest(secret: YamlSecret): Schemas['CreateSecretRequest'] {
  return {key: secret.key, value: secret.value}
}

// ── Alert Channel ──────────────────────────────────────────────────────

export function toCreateAlertChannelRequest(channel: YamlAlertChannel): Schemas['CreateAlertChannelRequest'] {
  return {
    name: channel.name,
    config: channel.config as Schemas['CreateAlertChannelRequest']['config'],
    managedBy: 'CLI',
  }
}

// ── Notification Policy ────────────────────────────────────────────────

export function toCreateNotificationPolicyRequest(
  policy: YamlNotificationPolicy,
  refs: ResolvedRefs,
): Schemas['CreateNotificationPolicyRequest'] {
  return {
    name: policy.name,
    description: policy.description,
    enabled: policy.enabled ?? true,
    priority: policy.priority ?? 0,
    matchRules: policy.matchRules?.map((r) => toMatchRule(r, refs)) ?? [],
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
    // API stores Nullable Boolean but echoes back `false` for unset values
    // (Jackson serializes Boolean.FALSE for null on the response side). We
    // send `false` explicitly so subsequent plans don't see phantom drift.
    requireAck: step.requireAck ?? false,
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
    subscribedEvents: webhook.subscribedEvents,
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
    managedBy: 'CLI',
  }
}

// ── Monitor ────────────────────────────────────────────────────────────

/**
 * Narrow YAML monitor config to the API config union. The YAML schema
 * (zod) only accepts configs whose shape matches one of the API config
 * types; we route on `monitor.type` so the type-assertion is at least
 * partitioned per monitor type and any shape drift surfaces as a zod
 * parse failure before reaching this function.
 *
 * SAFETY: Each YAML config type (YamlHttpConfig, etc.) is structurally
 * identical to its API counterpart (HttpMonitorConfig, etc.), but
 * defined in schema.ts rather than api.generated.ts, so TS treats them
 * as unrelated types. Zod validation at config load time guarantees the
 * shapes match before this function is reached.
 */
export function isCodeMonitor(monitor: Pick<YamlMonitor, 'type'>): boolean {
  return isCodeMonitorType(monitor.type)
}

function toMonitorConfig(
  monitor: YamlMonitor,
): Schemas['CreateMonitorRequest']['config'] {
  const cfg: unknown = monitor.config
  switch (monitor.type) {
    case 'HTTP': return cfg as Schemas['HttpMonitorConfig']
    case 'DNS': return cfg as Schemas['DnsMonitorConfig']
    case 'TCP': return cfg as Schemas['TcpMonitorConfig']
    case 'ICMP': return cfg as Schemas['IcmpMonitorConfig']
    case 'HEARTBEAT': return cfg as Schemas['HeartbeatMonitorConfig']
    case 'MCP_SERVER': return cfg as Schemas['McpServerMonitorConfig']
    case 'BROWSER':
    case 'MULTI_STEP_API':
      return cfg === undefined ? undefined : cfg as Schemas['ScriptMonitorConfig']
  }
}

function tagsRequest(tags: string[], refs: ResolvedRefs): Schemas['AddMonitorTagsRequest'] {
  return {
    tagIds: tags.map((n) => refs.resolve('tags', n)).filter((id): id is string => id !== undefined),
    newTags: tags.filter((n) => !refs.resolve('tags', n)).map((n) => ({name: n})),
  }
}

/**
 * Code-monitor fields that YAML authors explicitly. Omitted keys are left
 * out of the body so the server keeps (or defaults) them.
 */
function codeMonitorFields(monitor: YamlMonitor): Partial<Schemas['CreateMonitorRequest']> {
  const out: Partial<Schemas['CreateMonitorRequest']> = {}
  if (monitor.runParallel !== undefined) out.runParallel = monitor.runParallel
  if (monitor.fastRetryMaxAttempts !== undefined) out.fastRetryMaxAttempts = monitor.fastRetryMaxAttempts
  if (monitor.capturePolicy !== undefined) out.capturePolicy = monitor.capturePolicy
  if (monitor.secretKeys !== undefined) out.secretKeys = monitor.secretKeys
  return out
}

export function toCreateMonitorRequest(
  monitor: YamlMonitor,
  refs: ResolvedRefs,
): Schemas['CreateMonitorRequest'] {
  const ctx = refs.project
  const environmentId = monitor.environment ? refs.resolve('environments', monitor.environment) ?? null : null
  const alertChannelIds = monitor.alertChannels?.map((n) => refs.require('alertChannels', n)) ?? null
  if (isCodeMonitor(monitor)) {
    const state = ctx.code.get(monitor.name)
    const body: Schemas['CreateMonitorRequest'] = {
      name: monitor.name,
      type: monitor.type,
      managedBy: OWNER_TOOL,
      ownerEnforced: true,
      environmentId,
      ...codeMonitorFields(monitor),
    }
    const config = toMonitorConfig(monitor)
    if (config !== undefined) body.config = config
    if (ctx.project) {
      body.ownerProject = ctx.project
      body.ownerDeclaration = {address: ownerAddress(ctx.project, monitor.key ?? monitor.name) ?? null, label: monitor.name}
    }
    if (monitor.frequencySeconds !== undefined) body.frequencySeconds = monitor.frequencySeconds
    if (monitor.regions !== undefined) body.regions = monitor.regions
    if (alertChannelIds) body.alertChannelIds = alertChannelIds
    if (monitor.tags) body.tags = tagsRequest(monitor.tags, refs)
    if (monitor.incidentPolicy) body.incidentPolicy = toIncidentPolicy(monitor.incidentPolicy)
    if (state?.code) body.code = state.code
    return body
  }
  const body: Schemas['CreateMonitorRequest'] = {
    name: monitor.name,
    type: monitor.type,
    config: toMonitorConfig(monitor),
    managedBy: OWNER_TOOL,
    frequencySeconds: monitor.frequencySeconds,
    regions: monitor.regions ?? null,
    environmentId,
    assertions: monitor.assertions?.map(toCreateAssertionRequest) ?? null,
    auth: monitor.auth ? toAuthConfig(monitor.auth, refs) : undefined,
    incidentPolicy: monitor.incidentPolicy ? toIncidentPolicy(monitor.incidentPolicy) : undefined,
    alertChannelIds,
    tags: monitor.tags ? tagsRequest(monitor.tags, refs) : undefined,
  }
  if (ctx.project) body.ownerProject = ctx.project
  return body
}

/**
 * Settings update. `enabled` is never sent: pause is an overlay deploy
 * leaves alone (F14). For code monitors `managedBy` is never sent (code
 * monitors change owner through transfer) and the code half travels
 * separately (draft → test → publish), unless `--no-test` puts it on this
 * call (`withCode`).
 */
export function toUpdateMonitorRequest(
  monitor: YamlMonitor,
  refs: ResolvedRefs,
  opts: {withCode?: boolean} = {},
): Schemas['UpdateMonitorRequest'] {
  // YAML null means "explicitly clear" (parallels Terraform's clear_* flags
  // and the API's clearAuth/clearEnvironmentId fields). Omitting the key
  // entirely means "preserve current API value". The snapshot in
  // handlers.ts mirrors this distinction so the diff phase emits an update
  // only when the user actually changed something.
  const ctx = refs.project
  if (isCodeMonitor(monitor)) {
    const body: Schemas['UpdateMonitorRequest'] = {
      name: monitor.name,
      ...codeMonitorFields(monitor),
    }
    const config = toMonitorConfig(monitor)
    if (config !== undefined) body.config = config as Schemas['UpdateMonitorRequest']['config']
    if (monitor.frequencySeconds !== undefined) body.frequencySeconds = monitor.frequencySeconds
    if (monitor.regions !== undefined) body.regions = monitor.regions
    if (monitor.environment) body.environmentId = refs.resolve('environments', monitor.environment) ?? null
    if (monitor.alertChannels) body.alertChannelIds = monitor.alertChannels.map((n) => refs.require('alertChannels', n))
    if (monitor.tags) body.tags = tagsRequest(monitor.tags, refs)
    if (monitor.incidentPolicy) body.incidentPolicy = toIncidentPolicy(monitor.incidentPolicy)
    if (ctx.project) body.ownerProject = ctx.project
    const state = ctx.code.get(monitor.name)
    if (opts.withCode && state?.code) {
      body.code = state.code
      if (state.acknowledgeRollback) body.acknowledgeRollback = state.acknowledgeRollback
    }
    return body
  }

  const clearAuth = monitor.auth === null
  const clearEnvironmentId = monitor.environment === null

  const body: Schemas['UpdateMonitorRequest'] = {
    name: monitor.name,
    config: toMonitorConfig(monitor) as Schemas['UpdateMonitorRequest']['config'],
    managedBy: OWNER_TOOL,
    frequencySeconds: monitor.frequencySeconds ?? null,
    regions: monitor.regions ?? null,
    environmentId: monitor.environment
      ? refs.resolve('environments', monitor.environment) ?? null
      : null,
    assertions: monitor.assertions?.map(toCreateAssertionRequest) ?? null,
    auth: monitor.auth ? toAuthConfig(monitor.auth, refs) : undefined,
    incidentPolicy: monitor.incidentPolicy
      ? toIncidentPolicy(monitor.incidentPolicy)
      : undefined,
    alertChannelIds: monitor.alertChannels?.map((n) => refs.require('alertChannels', n)) ?? null,
    tags: monitor.tags ? tagsRequest(monitor.tags, refs) : {tagIds: null, newTags: null},
  }
  if (ctx.project) body.ownerProject = ctx.project

  if (clearAuth) body.clearAuth = true
  if (clearEnvironmentId) body.clearEnvironmentId = true

  return body
}

export function toCreateAssertionRequest(a: YamlAssertion): Schemas['CreateAssertionRequest'] {
  return {
    config: a.config as Schemas['CreateAssertionRequest']['config'],
    severity: a.severity ?? 'fail',
  }
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

/**
 * Normalize YAML branding to the API's StatusPageBranding shape.
 *
 * Fields the user didn't set are serialized as `null`, which the server
 * treats as "unset — fall back to design-system default". `hidePoweredBy`
 * is a required boolean on the API side, so it defaults to `false`.
 */
export function toBrandingRequest(
  branding: YamlStatusPageBranding,
): Schemas['StatusPageBranding'] {
  return {
    logoUrl: branding.logoUrl ?? null,
    faviconUrl: branding.faviconUrl ?? null,
    brandColor: branding.brandColor ?? null,
    pageBackground: branding.pageBackground ?? null,
    cardBackground: branding.cardBackground ?? null,
    textColor: branding.textColor ?? null,
    borderColor: branding.borderColor ?? null,
    headerStyle: branding.headerStyle ?? null,
    theme: branding.theme ?? null,
    reportUrl: branding.reportUrl ?? null,
    hidePoweredBy: branding.hidePoweredBy ?? false,
    showSubscribeButton: branding.showSubscribeButton ?? true,
    customCss: branding.customCss ?? null,
    customHeadHtml: branding.customHeadHtml ?? null,
  }
}

export function toCreateStatusPageRequest(page: YamlStatusPage): Schemas['CreateStatusPageRequest'] {
  return {
    name: page.name,
    slug: page.slug,
    description: page.description ?? null,
    branding: page.branding ? toBrandingRequest(page.branding) : null,
    visibility: page.visibility ?? null,
    enabled: page.enabled ?? null,
    incidentMode: page.incidentMode ?? null,
    managedBy: 'CLI',
  }
}

export function toUpdateStatusPageRequest(page: YamlStatusPage): Schemas['UpdateStatusPageRequest'] {
  // The API treats the entire `branding` field as atomic (null preserves
  // current, non-null replaces). Omitting `branding` from YAML preserves
  // whatever the dashboard last saved; providing it makes YAML authoritative.
  return {
    name: page.name,
    description: page.description ?? null,
    branding: page.branding ? toBrandingRequest(page.branding) : null,
    visibility: page.visibility ?? null,
    enabled: page.enabled ?? null,
    incidentMode: page.incidentMode ?? null,
  }
}
