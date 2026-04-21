import {readFileSync} from 'node:fs'
import {Flags} from '@oclif/core'
import {z} from 'zod'
import type {CreatableResource, ResourceConfig, UpdatableResource} from './crud-commands.js'
import type {components} from './api.generated.js'
import {schemas as apiSchemas} from './api-zod.generated.js'
import {fieldDescriptions} from './descriptions.generated.js'
import {urlFlag} from './validators.js'
import {
  MONITOR_TYPES,
  HTTP_METHODS,
  INCIDENT_SEVERITIES,
  CHANNEL_TYPES,
  STATUS_PAGE_INCIDENT_MODES,
  WEBHOOK_EVENT_TYPES,
  type WebhookEventTypes,
} from './spec-facts.generated.js'
import {STATUS_PAGE_VISIBILITIES} from './yaml/schema.js'

/**
 * Resources that expose both `create` and `update`. Almost every CRUD
 * resource in the CLI is in this category — only INCIDENTS / API_KEYS
 * (create-only) and DEPENDENCIES (read-only subscriptions) opt out.
 */
type FullResource<T> = CreatableResource<T> & UpdatableResource<T>

// ── Description lookup from OpenAPI spec ───────────────────────────────
function desc(schema: string, field: string, fallback?: string): string {
  return fieldDescriptions[schema]?.[field] ?? fallback ?? field
}

// ── Derived types from OpenAPI spec ────────────────────────────────────
type Schemas = components['schemas']

type MonitorDto = Schemas['MonitorDto']
type IncidentDto = Schemas['IncidentDto']
type IncidentDetailDto = Schemas['IncidentDetailDto']
type AlertChannelDto = Schemas['AlertChannelDto']
type NotificationPolicyDto = Schemas['NotificationPolicyDto']
type EnvironmentDto = Schemas['EnvironmentDto']
type SecretDto = Schemas['SecretDto']
type TagDto = Schemas['TagDto']
type ResourceGroupDto = Schemas['ResourceGroupDto']
type WebhookEndpointDto = Schemas['WebhookEndpointDto']
type ApiKeyDto = Schemas['ApiKeyDto']
type ApiKeyCreateResponse = Schemas['ApiKeyCreateResponse']
type ServiceSubscriptionDto = Schemas['ServiceSubscriptionDto']

// Imperative `bodyBuilder`s build `Record<string, unknown>` and lean on the
// outer `apiSchemas.Create/Update*Request` Zod parse for shape enforcement,
// so all request-DTO aliases were dropped — they were only used for `as`
// casts that the runtime validation now backstops. The only request-DTO
// alias retained is `CreateApiKeyRequest`, where the builder is small
// enough that an explicit type adds clarity without inviting drift.
type CreateApiKeyRequest = Schemas['CreateApiKeyRequest']

// ── Resource definitions ───────────────────────────────────────────────

export const MONITORS: FullResource<MonitorDto> = {
  name: 'monitor',
  plural: 'monitors',
  apiPath: '/api/v1/monitors',
  responseSchema: apiSchemas.MonitorDto as z.ZodType<MonitorDto>,
  createRequestSchema: apiSchemas.CreateMonitorRequest,
  updateRequestSchema: apiSchemas.UpdateMonitorRequest,
  columns: [
    {header: 'ID', get: (r) => r.id ?? ''},
    {header: 'NAME', get: (r) => r.name ?? ''},
    {header: 'TYPE', get: (r) => r.type ?? ''},
    {header: 'ENABLED', get: (r) => String(r.enabled ?? '')},
    {header: 'FREQ(s)', get: (r) => String(r.frequencySeconds ?? '')},
    {header: 'REGIONS', get: (r) => (r.regions ?? []).join(', ')},
    {header: 'MANAGED', get: (r) => r.managedBy ?? ''},
  ],
  createFlags: {
    name: Flags.string({description: desc('CreateMonitorRequest', 'name'), required: true}),
    type: Flags.string({
      description: desc('CreateMonitorRequest', 'type'),
      required: true,
      options: [...MONITOR_TYPES],
    }),
    url: Flags.string({description: desc('HttpMonitorConfig', 'url', 'Target URL or host')}),
    frequency: Flags.string({description: desc('CreateMonitorRequest', 'frequencySeconds'), default: '60'}),
    method: Flags.string({
      description: desc('HttpMonitorConfig', 'method'),
      options: [...HTTP_METHODS],
    }),
    port: Flags.string({description: desc('TcpMonitorConfig', 'port', 'TCP port to connect to')}),
    regions: Flags.string({description: desc('CreateMonitorRequest', 'regions')}),
  },
  updateFlags: {
    name: Flags.string({description: desc('UpdateMonitorRequest', 'name')}),
    url: Flags.string({description: desc('HttpMonitorConfig', 'url', 'Target URL or host')}),
    frequency: Flags.string({description: desc('UpdateMonitorRequest', 'frequencySeconds')}),
    method: Flags.string({description: desc('HttpMonitorConfig', 'method'), options: [...HTTP_METHODS]}),
    port: Flags.string({description: desc('TcpMonitorConfig', 'port', 'TCP port to connect to')}),
  },
  // bodyBuilder returns a plain `Record<string, unknown>`; the outer
  // `parseSchema(MONITORS.createRequestSchema, ...)` / `updateRequestSchema`
  // call in the CRUD factory validates the discriminated union (HTTP / TCP /
  // DNS / …) and rejects any wrong shape at runtime. Keeping the local
  // type loose lets us drop the per-variant `as CreateMonitorRequest['config']`
  // casts that used to paper over the OAS generator emitting
  // `Record<string, never>` for the abstract `MonitorConfig` base class.
  bodyBuilder: (raw) => {
    const body: Record<string, unknown> = {}
    if (raw.name !== undefined) body.name = String(raw.name)
    if (raw.type !== undefined) {
      const monitorType = String(raw.type)
      body.type = monitorType
      body.managedBy = 'CLI'
      body.frequencySeconds = raw.frequency ? Number(raw.frequency) : 60
      body.config = buildMonitorConfig(monitorType, raw)
      if (raw.regions) {
        body.regions = String(raw.regions).split(',').map((s) => s.trim()).filter(Boolean)
      }
    } else {
      if (raw.frequency) body.frequencySeconds = Number(raw.frequency)
      if (raw.url !== undefined || raw.method !== undefined) {
        body.config = {url: raw.url, method: raw.method ?? 'GET'}
      }
    }
    return body
  },
}

// Returns the monitor's `config` payload as a plain object — the discriminated
// union (HttpMonitorConfig | TcpMonitorConfig | …) is enforced by the outer
// `apiSchemas.Create/UpdateMonitorRequest` Zod parse, so an unknown `type`
// (e.g. spec drift) surfaces as a typed `ValidationError` with `config` in the
// path instead of a confusing 400 from the API.
function buildMonitorConfig(type: string, raw: Record<string, unknown>): object {
  const method = raw.method !== undefined ? String(raw.method) : 'GET'
  switch (type) {
    case 'HTTP':
      return {url: String(raw.url ?? ''), method}
    case 'TCP':
      return {host: String(raw.url ?? ''), port: raw.port ? Number(raw.port) : 443}
    case 'DNS':
      return {hostname: String(raw.url ?? '')}
    case 'ICMP':
      return {host: String(raw.url ?? '')}
    case 'HEARTBEAT':
      return {expectedInterval: 60, gracePeriod: 60}
    case 'MCP_SERVER':
      return {command: String(raw.url ?? '')}
    default:
      // Unknown type → outer schema parse will reject with a clear error
      // listing valid `type` enum values.
      return {url: String(raw.url ?? ''), method: 'GET'}
  }
}

export const INCIDENTS: CreatableResource<IncidentDto, IncidentDetailDto> = {
  name: 'incident',
  plural: 'incidents',
  apiPath: '/api/v1/incidents',
  responseSchema: apiSchemas.IncidentDto as z.ZodType<IncidentDto>,
  // POST /api/v1/incidents and GET /api/v1/incidents/{id} both return
  // the full IncidentDetailDto envelope ({incident, updates,
  // statusPageIncidents}); only list returns the flat IncidentDto.
  // Distinguishing the two prevents the strict SingleValueResponse
  // parser from rejecting the wider create / get payload.
  createResponseSchema: apiSchemas.IncidentDetailDto as z.ZodType<IncidentDetailDto>,
  getResponseSchema: apiSchemas.IncidentDetailDto as z.ZodType<IncidentDetailDto>,
  createRequestSchema: apiSchemas.CreateManualIncidentRequest,
  columns: [
    {header: 'ID', get: (r) => r.id ?? ''},
    {header: 'TITLE', get: (r) => r.title ?? ''},
    {header: 'STATUS', get: (r) => r.status ?? ''},
    {header: 'SEVERITY', get: (r) => r.severity ?? ''},
    {header: 'MONITOR', get: (r) => r.monitorName ?? ''},
    {header: 'STARTED', get: (r) => r.startedAt ?? ''},
  ],
  createFlags: {
    title: Flags.string({description: desc('CreateManualIncidentRequest', 'title'), required: true}),
    severity: Flags.string({
      description: desc('CreateManualIncidentRequest', 'severity'),
      required: true,
      options: [...INCIDENT_SEVERITIES],
    }),
    'monitor-id': Flags.string({description: desc('CreateManualIncidentRequest', 'monitorId')}),
    body: Flags.string({description: desc('CreateManualIncidentRequest', 'body')}),
  },
  // `severity` is coerced to string and validated against the
  // `INCIDENT_SEVERITIES` enum by the outer
  // `apiSchemas.CreateManualIncidentRequest` Zod parse.
  bodyBuilder: (raw) => {
    const body: Record<string, unknown> = {
      title: String(raw.title),
      severity: String(raw.severity),
    }
    if (raw['monitor-id'] !== undefined) body.monitorId = String(raw['monitor-id'])
    if (raw.body !== undefined) body.body = String(raw.body)
    return body
  },
}

export const ALERT_CHANNELS: FullResource<AlertChannelDto> = {
  name: 'alert channel',
  plural: 'alert-channels',
  apiPath: '/api/v1/alert-channels',
  responseSchema: apiSchemas.AlertChannelDto as z.ZodType<AlertChannelDto>,
  createRequestSchema: apiSchemas.CreateAlertChannelRequest,
  updateRequestSchema: apiSchemas.UpdateAlertChannelRequest,
  columns: [
    {header: 'ID', get: (r) => r.id},
    {header: 'NAME', get: (r) => r.name},
    {header: 'TYPE', get: (r) => r.channelType},
    {header: 'LAST DELIVERY', get: (r) => r.lastDeliveryAt ?? ''},
    {header: 'STATUS', get: (r) => r.lastDeliveryStatus ?? ''},
  ],
  createFlags: {
    name: Flags.string({description: desc('CreateAlertChannelRequest', 'name'), required: true}),
    type: Flags.string({
      description: `Alert channel type (${CHANNEL_TYPES.join(', ')})`,
      required: true,
      options: [...CHANNEL_TYPES],
    }),
    config: Flags.string({description: 'Channel-specific configuration as JSON'}),
    'webhook-url': urlFlag({description: desc('SlackChannelConfig', 'webhookUrl', 'Slack/Discord/Teams webhook URL')}),
  },
  updateFlags: {
    name: Flags.string({description: desc('UpdateAlertChannelRequest', 'name')}),
    type: Flags.string({description: 'Alert channel type', options: [...CHANNEL_TYPES]}),
    config: Flags.string({description: 'Channel-specific configuration as JSON'}),
    'webhook-url': urlFlag({description: desc('SlackChannelConfig', 'webhookUrl', 'Slack/Discord/Teams webhook URL')}),
  },
  // bodyBuilder produces a plain object; the outer
  // `apiSchemas.Create/UpdateAlertChannelRequest` Zod parse validates the
  // `config` discriminated union (one of seven channelType variants) and
  // surfaces shape errors with a path into the offending field.
  bodyBuilder: (raw) => {
    const body: Record<string, unknown> = {}
    if (raw.name !== undefined) body.name = String(raw.name)
    if (raw.config) {
      body.config = parseAlertChannelConfigFlag(String(raw.config))
    } else if (raw['webhook-url'] !== undefined || raw.type !== undefined) {
      const channelType = String(raw.type || 'slack').toLowerCase()
      body.config = raw['webhook-url'] !== undefined
        ? {channelType, webhookUrl: String(raw['webhook-url'])}
        : {channelType}
    }
    return body
  },
}

// Validates a `--config` JSON string against the per-channelType schema from
// the OpenAPI spec. Throws with a clear message if the JSON is malformed,
// the discriminator is missing, or the payload doesn't match the expected
// shape — so users see the error here rather than a generic API 400.
//
// Returns `object`: the precise per-variant type (Slack / Discord / …)
// would force a cast at every call site. The outer
// `Create/UpdateAlertChannelRequest` Zod parse re-validates the union as a
// safety net, so structural mistakes always surface with a typed error.
function parseAlertChannelConfigFlag(raw: string): object {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to parse --config as JSON: ${msg}`)
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('--config must be a JSON object, e.g. \'{"channelType":"slack","webhookUrl":"..."}\'')
  }

  const channelType = (parsed as Record<string, unknown>).channelType
  if (typeof channelType !== 'string') {
    throw new Error(
      `--config must include "channelType" (one of: ${[...CHANNEL_TYPES].join(', ')})`,
    )
  }

  const schema = ALERT_CHANNEL_CONFIG_SCHEMAS[channelType]
  if (!schema) {
    throw new Error(
      `Unknown channelType "${channelType}". Valid types: ${[...CHANNEL_TYPES].join(', ')}`,
    )
  }

  const result = schema.safeParse(parsed)
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('; ')
    throw new Error(`Invalid --config payload for channelType "${channelType}": ${issues}`)
  }

  // result.data is the inferred Zod output (a specific channel-config record);
  // returning it as `object` lets the caller drop the per-variant cast.
  return result.data as object
}

// Discriminated by `channelType` to match the API's AlertChannelConfig union.
const ALERT_CHANNEL_CONFIG_SCHEMAS: Record<string, z.ZodType> = {
  discord: apiSchemas.DiscordChannelConfig,
  email: apiSchemas.EmailChannelConfig,
  opsgenie: apiSchemas.OpsGenieChannelConfig,
  pagerduty: apiSchemas.PagerDutyChannelConfig,
  slack: apiSchemas.SlackChannelConfig,
  teams: apiSchemas.TeamsChannelConfig,
  webhook: apiSchemas.WebhookChannelConfig,
}

export const NOTIFICATION_POLICIES: FullResource<NotificationPolicyDto> = {
  name: 'notification policy',
  plural: 'notification-policies',
  apiPath: '/api/v1/notification-policies',
  responseSchema: apiSchemas.NotificationPolicyDto as z.ZodType<NotificationPolicyDto>,
  createRequestSchema: apiSchemas.CreateNotificationPolicyRequest,
  updateRequestSchema: apiSchemas.UpdateNotificationPolicyRequest,
  columns: [
    {header: 'ID', get: (r) => r.id ?? ''},
    {header: 'NAME', get: (r) => r.name ?? ''},
    {header: 'ENABLED', get: (r) => String(r.enabled ?? '')},
    {header: 'PRIORITY', get: (r) => String(r.priority ?? '')},
  ],
  createFlags: {
    name: Flags.string({description: desc('CreateNotificationPolicyRequest', 'name'), required: true}),
    'channel-ids': Flags.string({description: desc('EscalationStep', 'channelIds', 'Comma-separated alert channel IDs for escalation')}),
    enabled: Flags.boolean({description: desc('CreateNotificationPolicyRequest', 'enabled'), default: true, allowNo: true}),
  },
  updateFlags: {
    name: Flags.string({description: desc('UpdateNotificationPolicyRequest', 'name')}),
    'channel-ids': Flags.string({description: desc('EscalationStep', 'channelIds', 'Comma-separated alert channel IDs')}),
    enabled: Flags.boolean({description: desc('UpdateNotificationPolicyRequest', 'enabled'), allowNo: true}),
  },
  // The notification policy body has nested escalation/match-rule shapes;
  // building as `Record<string, unknown>` keeps this builder cast-free and
  // hands shape enforcement to the outer
  // `apiSchemas.Create/UpdateNotificationPolicyRequest` parse.
  bodyBuilder: (raw) => {
    const channelIds = raw['channel-ids']
      ? String(raw['channel-ids']).split(',').map((s) => s.trim()).filter(Boolean)
      : []
    return {
      name: String(raw.name),
      matchRules: [],
      escalation: {steps: [{channelIds, delayMinutes: 0}]},
      enabled: raw.enabled === undefined ? true : Boolean(raw.enabled),
      priority: 0,
    }
  },
  updateBodyBuilder: (raw) => {
    const body: Record<string, unknown> = {}
    if (raw.name !== undefined) body.name = String(raw.name)
    if (raw.enabled !== undefined) body.enabled = Boolean(raw.enabled)
    if (raw['channel-ids'] !== undefined) {
      const channelIds = String(raw['channel-ids']).split(',').map((s) => s.trim()).filter(Boolean)
      body.escalation = {steps: [{channelIds, delayMinutes: 0}]}
    }
    return body
  },
}

export const ENVIRONMENTS: FullResource<EnvironmentDto> = {
  name: 'environment',
  plural: 'environments',
  apiPath: '/api/v1/environments',
  idField: 'slug',
  responseSchema: apiSchemas.EnvironmentDto as z.ZodType<EnvironmentDto>,
  createRequestSchema: apiSchemas.CreateEnvironmentRequest,
  updateRequestSchema: apiSchemas.UpdateEnvironmentRequest,
  columns: [
    {header: 'SLUG', get: (r) => r.slug ?? ''},
    {header: 'NAME', get: (r) => r.name ?? ''},
    {header: 'MONITORS', get: (r) => String(r.monitorCount ?? 0)},
    {header: 'DEFAULT', get: (r) => String(r.isDefault ?? false)},
  ],
  createFlags: {
    name: Flags.string({description: desc('CreateEnvironmentRequest', 'name'), required: true}),
    slug: Flags.string({description: desc('CreateEnvironmentRequest', 'slug'), required: true}),
    default: Flags.boolean({description: desc('CreateEnvironmentRequest', 'isDefault'), default: false, allowNo: true}),
  },
  updateFlags: {
    name: Flags.string({description: desc('UpdateEnvironmentRequest', 'name')}),
    default: Flags.boolean({description: desc('UpdateEnvironmentRequest', 'isDefault'), allowNo: true}),
  },
  bodyBuilder: (raw) => {
    // CreateEnvironmentRequest requires `isDefault` (strict, not nullish),
    // so the create flag defaults to `false`. Only include set fields here
    // so the same builder works for update via .partial().
    const body: Record<string, unknown> = {}
    if (raw.name !== undefined) body.name = String(raw.name)
    if (raw.slug !== undefined) body.slug = String(raw.slug)
    if (raw.default !== undefined) body.isDefault = Boolean(raw.default)
    return body
  },
}

export const SECRETS: FullResource<SecretDto> = {
  name: 'secret',
  plural: 'secrets',
  apiPath: '/api/v1/secrets',
  idField: 'key',
  responseSchema: apiSchemas.SecretDto as z.ZodType<SecretDto>,
  // CreateSecretRequest is `{key, value}.strict()` and UpdateSecretRequest is
  // `{value}.strict()`. Distinct shapes mean we need separate builders so
  // strict validation accepts each path's body.
  createRequestSchema: apiSchemas.CreateSecretRequest,
  updateRequestSchema: apiSchemas.UpdateSecretRequest,
  columns: [
    {header: 'KEY', get: (r) => r.key ?? ''},
    {header: 'CREATED', get: (r) => r.createdAt ?? ''},
    {header: 'UPDATED', get: (r) => r.updatedAt ?? ''},
  ],
  createFlags: {
    key: Flags.string({description: desc('CreateSecretRequest', 'key'), required: true}),
    value: Flags.string({description: desc('CreateSecretRequest', 'value'), required: true}),
  },
  updateFlags: {
    value: Flags.string({description: desc('UpdateSecretRequest', 'value'), required: true}),
  },
  bodyBuilder: (raw) => ({key: String(raw.key), value: String(raw.value)}),
  updateBodyBuilder: (raw) => ({value: String(raw.value)}),
}

export const TAGS: FullResource<TagDto> = {
  name: 'tag',
  plural: 'tags',
  apiPath: '/api/v1/tags',
  responseSchema: apiSchemas.TagDto as z.ZodType<TagDto>,
  createRequestSchema: apiSchemas.CreateTagRequest,
  updateRequestSchema: apiSchemas.UpdateTagRequest,
  columns: [
    {header: 'ID', get: (r) => r.id ?? ''},
    {header: 'NAME', get: (r) => r.name ?? ''},
    {header: 'COLOR', get: (r) => r.color ?? ''},
  ],
  createFlags: {
    name: Flags.string({description: desc('CreateTagRequest', 'name'), required: true}),
    color: Flags.string({description: desc('CreateTagRequest', 'color')}),
  },
  updateFlags: {
    name: Flags.string({description: desc('UpdateTagRequest', 'name')}),
    color: Flags.string({description: desc('UpdateTagRequest', 'color')}),
  },
  bodyBuilder: (raw) => {
    const body: Record<string, unknown> = {}
    if (raw.name !== undefined) body.name = String(raw.name)
    if (raw.color !== undefined) body.color = String(raw.color)
    return body
  },
}

export const RESOURCE_GROUPS: FullResource<ResourceGroupDto> = {
  name: 'resource group',
  plural: 'resource-groups',
  apiPath: '/api/v1/resource-groups',
  responseSchema: apiSchemas.ResourceGroupDto as z.ZodType<ResourceGroupDto>,
  createRequestSchema: apiSchemas.CreateResourceGroupRequest,
  updateRequestSchema: apiSchemas.UpdateResourceGroupRequest,
  columns: [
    {header: 'ID', get: (r) => r.id ?? ''},
    {header: 'NAME', get: (r) => r.name ?? ''},
    {header: 'DESCRIPTION', get: (r) => r.description ?? ''},
    {header: 'HEALTH', get: (r) => r.health?.status ?? ''},
  ],
  createFlags: {
    name: Flags.string({description: desc('CreateResourceGroupRequest', 'name'), required: true}),
    description: Flags.string({description: desc('CreateResourceGroupRequest', 'description')}),
  },
  updateFlags: {
    // UpdateResourceGroupRequest requires `name` (no `.partial()`); the rest
    // are nullish so we still treat them as optional and only include set
    // ones in the body.
    name: Flags.string({description: desc('UpdateResourceGroupRequest', 'name'), required: true}),
    description: Flags.string({description: desc('UpdateResourceGroupRequest', 'description')}),
  },
  bodyBuilder: (raw) => {
    const body: Record<string, unknown> = {}
    if (raw.name !== undefined) body.name = String(raw.name)
    if (raw.description !== undefined) body.description = String(raw.description)
    return body
  },
}

export const WEBHOOKS: FullResource<WebhookEndpointDto> = {
  name: 'webhook',
  plural: 'webhooks',
  apiPath: '/api/v1/webhooks',
  responseSchema: apiSchemas.WebhookEndpointDto as z.ZodType<WebhookEndpointDto>,
  createRequestSchema: apiSchemas.CreateWebhookEndpointRequest,
  updateRequestSchema: apiSchemas.UpdateWebhookEndpointRequest,
  columns: [
    {header: 'ID', get: (r) => r.id ?? ''},
    {header: 'URL', get: (r) => r.url ?? ''},
    {header: 'ENABLED', get: (r) => String(r.enabled ?? '')},
    {header: 'EVENTS', get: (r) => (r.subscribedEvents ?? []).join(', ')},
  ],
  createFlags: {
    url: urlFlag({description: desc('CreateWebhookEndpointRequest', 'url'), required: true}),
    events: Flags.string({description: desc('CreateWebhookEndpointRequest', 'subscribedEvents'), required: true}),
    description: Flags.string({description: desc('CreateWebhookEndpointRequest', 'description')}),
  },
  updateFlags: {
    url: urlFlag({description: desc('UpdateWebhookEndpointRequest', 'url')}),
    events: Flags.string({description: desc('UpdateWebhookEndpointRequest', 'subscribedEvents')}),
    description: Flags.string({description: desc('UpdateWebhookEndpointRequest', 'description')}),
  },
  bodyBuilder: (raw) => {
    const body: Partial<Schemas['CreateWebhookEndpointRequest']> = {}
    if (raw.url !== undefined) body.url = String(raw.url)
    if (raw.events !== undefined) {
      body.subscribedEvents = parseWebhookEvents(String(raw.events))
    }
    if (raw.description !== undefined) body.description = String(raw.description)
    return body
  },
}

// Splits a comma-separated `--events` flag, validates each value against the
// spec-derived `WEBHOOK_EVENT_TYPES` tuple, and returns the narrowed array.
// Throws a single error listing every unknown value so users don't have to
// fix-and-retry per typo.
function parseWebhookEvents(raw: string): WebhookEventTypes[] {
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean)
  const valid = new Set<string>(WEBHOOK_EVENT_TYPES)
  const invalid = parts.filter((p) => !valid.has(p))
  if (invalid.length > 0) {
    throw new Error(
      `Unknown webhook event(s): ${invalid.join(', ')}. Valid: ${[...WEBHOOK_EVENT_TYPES].join(', ')}`,
    )
  }
  return parts as WebhookEventTypes[]
}

export const API_KEYS: CreatableResource<ApiKeyDto, ApiKeyCreateResponse> = {
  name: 'API key',
  plural: 'api-keys',
  apiPath: '/api/v1/api-keys',
  validateIdAsUuid: false,
  responseSchema: apiSchemas.ApiKeyDto as z.ZodType<ApiKeyDto>,
  // POST /api/v1/api-keys returns the one-shot ApiKeyCreateResponse
  // (omits updatedAt/lastUsedAt/revokedAt; surfaces the full secret
  // exactly once). list/get use the persisted ApiKeyDto.
  createResponseSchema: apiSchemas.ApiKeyCreateResponse as z.ZodType<ApiKeyCreateResponse>,
  createRequestSchema: apiSchemas.CreateApiKeyRequest,
  columns: [
    {header: 'ID', get: (r) => String(r.id ?? '')},
    {header: 'NAME', get: (r) => r.name ?? ''},
    {header: 'KEY', get: (r) => r.key ?? ''},
    {header: 'LAST USED', get: (r) => r.lastUsedAt ?? ''},
    {header: 'CREATED', get: (r) => r.createdAt ?? ''},
  ],
  createFlags: {
    name: Flags.string({description: desc('CreateApiKeyRequest', 'name'), required: true}),
    'expires-at': Flags.string({description: desc('CreateApiKeyRequest', 'expiresAt')}),
  },
  bodyBuilder: (raw) => {
    const body: CreateApiKeyRequest = {name: String(raw.name)}
    if (raw['expires-at'] !== undefined) body.expiresAt = String(raw['expires-at'])
    return body
  },
}

export const DEPENDENCIES: ResourceConfig<ServiceSubscriptionDto> = {
  name: 'dependency',
  plural: 'dependencies',
  apiPath: '/api/v1/service-subscriptions',
  idField: 'subscriptionId',
  responseSchema: apiSchemas.ServiceSubscriptionDto as z.ZodType<ServiceSubscriptionDto>,
  columns: [
    {header: 'ID', get: (r) => r.subscriptionId ?? ''},
    {header: 'SERVICE', get: (r) => r.name ?? ''},
    {header: 'SLUG', get: (r) => r.slug ?? ''},
    {header: 'STATUS', get: (r) => r.overallStatus ?? ''},
    {header: 'ENABLED', get: (r) => String(r.enabled ?? '')},
  ],
}

export const STATUS_PAGES: FullResource<Schemas['StatusPageDto']> = {
  name: 'status page',
  plural: 'status-pages',
  apiPath: '/api/v1/status-pages',
  responseSchema: apiSchemas.StatusPageDto as z.ZodType<Schemas['StatusPageDto']>,
  createRequestSchema: apiSchemas.CreateStatusPageRequest,
  updateRequestSchema: apiSchemas.UpdateStatusPageRequest,
  columns: [
    {header: 'ID', get: (r) => r.id ?? ''},
    {header: 'NAME', get: (r) => r.name ?? ''},
    {header: 'SLUG', get: (r) => r.slug ?? ''},
    {header: 'VISIBILITY', get: (r) => r.visibility ?? ''},
    {header: 'ENABLED', get: (r) => String(r.enabled ?? '')},
    {header: 'STATUS', get: (r) => r.overallStatus ?? ''},
  ],
  createFlags: {
    name: Flags.string({description: desc('CreateStatusPageRequest', 'name'), required: true}),
    slug: Flags.string({description: desc('CreateStatusPageRequest', 'slug'), required: true}),
    description: Flags.string({description: desc('CreateStatusPageRequest', 'description')}),
    // STATUS_PAGE_VISIBILITIES is intentionally narrowed to ['PUBLIC'] in
    // schema.ts because PASSWORD / IP_RESTRICTED exist in the API enum but
    // are not implemented yet. Sharing the constant keeps the imperative
    // flag and YAML validator in lockstep.
    visibility: Flags.string({description: desc('CreateStatusPageRequest', 'visibility'), options: [...STATUS_PAGE_VISIBILITIES]}),
    'incident-mode': Flags.string({description: desc('CreateStatusPageRequest', 'incidentMode'), options: [...STATUS_PAGE_INCIDENT_MODES]}),
    'branding-file': Flags.string({description: 'Path to a JSON file with branding fields (logoUrl, brandColor, theme, customCss, …)'}),
  },
  updateFlags: {
    name: Flags.string({description: desc('UpdateStatusPageRequest', 'name')}),
    description: Flags.string({description: desc('UpdateStatusPageRequest', 'description')}),
    visibility: Flags.string({description: desc('UpdateStatusPageRequest', 'visibility'), options: [...STATUS_PAGE_VISIBILITIES]}),
    enabled: Flags.boolean({description: 'Whether the page is enabled', allowNo: true}),
    'incident-mode': Flags.string({description: desc('UpdateStatusPageRequest', 'incidentMode'), options: [...STATUS_PAGE_INCIDENT_MODES]}),
    'branding-file': Flags.string({description: 'Path to a JSON file with branding fields; omit to preserve existing branding'}),
  },
  bodyBuilder: (raw) => {
    const body: Record<string, unknown> = {}
    if (raw.name !== undefined) body.name = raw.name
    if (raw.slug !== undefined) body.slug = raw.slug
    if (raw.description !== undefined) body.description = raw.description
    if (raw.visibility !== undefined) body.visibility = raw.visibility
    if (raw.enabled !== undefined) body.enabled = raw.enabled
    if (raw['incident-mode'] !== undefined) body.incidentMode = raw['incident-mode']
    if (raw['branding-file'] !== undefined) {
      body.branding = loadBrandingFile(String(raw['branding-file']))
    }
    return body
  },
}

// Sync read is fine — CLI is short-lived and this flag path runs once per
// command invocation. Kept outside bodyBuilder for reuse + unit-testability.
//
// We use a top-level ESM `import` (not a lazy `require`) because the package
// is `"type": "module"` and CommonJS `require` is undefined in that context.
// `readFileSync` is in the always-resolved Node core, so the import cost is
// effectively zero — it's already loaded before the CLI's top-level code runs.
// Returns the parsed branding object as plain `object`. The CLI's outer
// `apiSchemas.Create/UpdateStatusPageRequest` Zod parse re-checks this when
// the branding lands in the request body — combined with `BrandingFileSchema`
// here, that gives users a per-field error before the API is hit AND blocks
// any drift in `StatusPageBranding` from sneaking through.
function loadBrandingFile(path: string): object {
  const raw = readFileSync(path, 'utf8')
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to parse branding file "${path}" as JSON: ${msg}`)
  }

  const result = BrandingFileSchema.safeParse(parsed)
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
      .join('; ')
    throw new Error(`Invalid branding file "${path}": ${issues}`)
  }
  return result.data
}

// Mirrors the API's StatusPageBranding record (see api-zod.generated.ts).
// Hand-defined here (rather than reusing the generated schema) so we can
// surface clearer per-field validation errors on hex colors and URLs before
// the request hits the API.
const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/
const HTTP_URL_RE = /^https?:\/\/.+/
const BrandingFileSchema = z.object({
  logoUrl: z.string().regex(HTTP_URL_RE, 'must be an http(s) URL').max(2048).optional(),
  faviconUrl: z.string().regex(HTTP_URL_RE, 'must be an http(s) URL').max(2048).optional(),
  brandColor: z.string().regex(HEX_COLOR_RE, 'must be a hex color, e.g. #4F46E5').optional(),
  pageBackground: z.string().regex(HEX_COLOR_RE, 'must be a hex color').optional(),
  cardBackground: z.string().regex(HEX_COLOR_RE, 'must be a hex color').optional(),
  textColor: z.string().regex(HEX_COLOR_RE, 'must be a hex color').optional(),
  borderColor: z.string().regex(HEX_COLOR_RE, 'must be a hex color').optional(),
  headerStyle: z.string().max(50).optional(),
  theme: z.string().max(50).optional(),
  reportUrl: z.string().regex(HTTP_URL_RE, 'must be an http(s) URL').max(2048).optional(),
  hidePoweredBy: z.boolean().optional(),
  customCss: z.string().max(50_000).optional(),
  customHeadHtml: z.string().max(50_000).optional(),
}).strict()
