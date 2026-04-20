import {readFileSync} from 'node:fs'
import {Flags} from '@oclif/core'
import {z} from 'zod'
import {ResourceConfig} from './crud-commands.js'
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
} from './spec-facts.generated.js'

// ── Description lookup from OpenAPI spec ───────────────────────────────
function desc(schema: string, field: string, fallback?: string): string {
  return fieldDescriptions[schema]?.[field] ?? fallback ?? field
}

// ── Derived types from OpenAPI spec ────────────────────────────────────
type Schemas = components['schemas']

type MonitorDto = Schemas['MonitorDto']
type IncidentDto = Schemas['IncidentDto']
type AlertChannelDto = Schemas['AlertChannelDto']
type NotificationPolicyDto = Schemas['NotificationPolicyDto']
type EnvironmentDto = Schemas['EnvironmentDto']
type SecretDto = Schemas['SecretDto']
type TagDto = Schemas['TagDto']
type ResourceGroupDto = Schemas['ResourceGroupDto']
type WebhookEndpointDto = Schemas['WebhookEndpointDto']
type ApiKeyDto = Schemas['ApiKeyDto']
type ServiceSubscriptionDto = Schemas['ServiceSubscriptionDto']

type MonitorType = Schemas['CreateMonitorRequest']['type']
type HttpMethod = Schemas['HttpMonitorConfig']['method']
type IncidentSeverity = Schemas['CreateManualIncidentRequest']['severity']

type CreateMonitorRequest = Schemas['CreateMonitorRequest']
type CreateManualIncidentRequest = Schemas['CreateManualIncidentRequest']
type CreateAlertChannelRequest = Schemas['CreateAlertChannelRequest']
type CreateNotificationPolicyRequest = Schemas['CreateNotificationPolicyRequest']
type UpdateNotificationPolicyRequest = Schemas['UpdateNotificationPolicyRequest']
type CreateApiKeyRequest = Schemas['CreateApiKeyRequest']

// ── Resource definitions ───────────────────────────────────────────────

export const MONITORS: ResourceConfig<MonitorDto> = {
  name: 'monitor',
  plural: 'monitors',
  apiPath: '/api/v1/monitors',
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
  bodyBuilder: (raw) => {
    const monitorType = raw.type as MonitorType | undefined
    if (monitorType) {
      const body: CreateMonitorRequest = {
        name: String(raw.name),
        type: monitorType,
        managedBy: 'CLI',
        frequencySeconds: raw.frequency ? Number(raw.frequency) : 60,
        config: buildMonitorConfig(monitorType, raw),
      }
      if (raw.regions) {
        body.regions = String(raw.regions).split(',').map((s) => s.trim()).filter(Boolean)
      }
      return body
    }
    const body: Record<string, unknown> = {}
    if (raw.name !== undefined) body.name = raw.name
    if (raw.frequency) body.frequencySeconds = Number(raw.frequency)
    if (raw.url !== undefined || raw.method !== undefined) {
      body.config = {url: raw.url, method: (raw.method as HttpMethod) || 'GET'}
    }
    return body
  },
}

/**
 * Generated config types extend `Record<string, never>` (OAS generator artifact for
 * abstract base class MonitorConfig), which prevents direct object literal assignment.
 * The single cast at the end is the narrowest workaround.
 */
function buildMonitorConfig(type: MonitorType, raw: Record<string, unknown>): CreateMonitorRequest['config'] {
  const method: HttpMethod = (raw.method as HttpMethod) || 'GET'
  switch (type) {
    case 'HTTP':
      return {url: String(raw.url ?? ''), method} as CreateMonitorRequest['config']
    case 'TCP':
      return {host: String(raw.url ?? ''), port: raw.port ? Number(raw.port) : 443} as CreateMonitorRequest['config']
    case 'DNS':
      return {hostname: String(raw.url ?? '')} as CreateMonitorRequest['config']
    case 'ICMP':
      return {host: String(raw.url ?? '')} as CreateMonitorRequest['config']
    case 'HEARTBEAT':
      return {expectedInterval: 60, gracePeriod: 60} as CreateMonitorRequest['config']
    case 'MCP_SERVER':
      return {command: String(raw.url ?? '')} as CreateMonitorRequest['config']
    default:
      return {url: String(raw.url ?? ''), method: 'GET'} as CreateMonitorRequest['config']
  }
}

export const INCIDENTS: ResourceConfig<IncidentDto> = {
  name: 'incident',
  plural: 'incidents',
  apiPath: '/api/v1/incidents',
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
  bodyBuilder: (raw) => {
    const body: CreateManualIncidentRequest = {
      title: String(raw.title),
      severity: raw.severity as IncidentSeverity,
    }
    if (raw['monitor-id'] !== undefined) body.monitorId = String(raw['monitor-id'])
    if (raw.body !== undefined) body.body = String(raw.body)
    return body
  },
}

export const ALERT_CHANNELS: ResourceConfig<AlertChannelDto> = {
  name: 'alert channel',
  plural: 'alert-channels',
  apiPath: '/api/v1/alert-channels',
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
  bodyBuilder: (raw) => {
    let config: CreateAlertChannelRequest['config'] | undefined
    if (raw.config) {
      config = parseAlertChannelConfigFlag(String(raw.config))
    } else {
      const channelType = String(raw.type || 'slack').toLowerCase()
      if (raw['webhook-url'] !== undefined) {
        config = {channelType, webhookUrl: String(raw['webhook-url'])} as CreateAlertChannelRequest['config']
      } else {
        config = {channelType} as CreateAlertChannelRequest['config']
      }
    }
    const body: Partial<CreateAlertChannelRequest> = {}
    if (raw.name !== undefined) body.name = String(raw.name)
    if (config !== undefined) body.config = config
    return body
  },
}

// Validates a `--config` JSON string against the per-channelType schema from
// the OpenAPI spec. Throws with a clear message if the JSON is malformed,
// the discriminator is missing, or the payload doesn't match the expected
// shape — so users see the error here rather than a generic API 400.
function parseAlertChannelConfigFlag(raw: string): CreateAlertChannelRequest['config'] {
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

  return result.data as CreateAlertChannelRequest['config']
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

export const NOTIFICATION_POLICIES: ResourceConfig<NotificationPolicyDto> = {
  name: 'notification policy',
  plural: 'notification-policies',
  apiPath: '/api/v1/notification-policies',
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
  bodyBuilder: (raw) => {
    const channelIds = raw['channel-ids']
      ? String(raw['channel-ids']).split(',').map((s) => s.trim()).filter(Boolean)
      : []
    const body: CreateNotificationPolicyRequest = {
      name: String(raw.name),
      matchRules: [],
      escalation: {steps: [{channelIds, delayMinutes: 0}]},
      enabled: (raw.enabled as boolean) ?? true,
      priority: 0,
    }
    return body
  },
  updateBodyBuilder: (raw) => {
    const body: Partial<UpdateNotificationPolicyRequest> = {}
    if (raw.name !== undefined) body.name = String(raw.name)
    if (raw.enabled !== undefined) body.enabled = raw.enabled as boolean
    if (raw['channel-ids'] !== undefined) {
      const channelIds = String(raw['channel-ids']).split(',').map((s) => s.trim()).filter(Boolean)
      body.escalation = {steps: [{channelIds, delayMinutes: 0}]}
    }
    return body
  },
}

export const ENVIRONMENTS: ResourceConfig<EnvironmentDto> = {
  name: 'environment',
  plural: 'environments',
  apiPath: '/api/v1/environments',
  idField: 'slug',
  columns: [
    {header: 'SLUG', get: (r) => r.slug ?? ''},
    {header: 'NAME', get: (r) => r.name ?? ''},
    {header: 'MONITORS', get: (r) => String(r.monitorCount ?? 0)},
    {header: 'DEFAULT', get: (r) => String(r.isDefault ?? false)},
  ],
  createFlags: {
    name: Flags.string({description: desc('CreateEnvironmentRequest', 'name'), required: true}),
    slug: Flags.string({description: desc('CreateEnvironmentRequest', 'slug'), required: true}),
  },
  updateFlags: {
    name: Flags.string({description: desc('UpdateEnvironmentRequest', 'name')}),
  },
}

export const SECRETS: ResourceConfig<SecretDto> = {
  name: 'secret',
  plural: 'secrets',
  apiPath: '/api/v1/secrets',
  idField: 'key',
  columns: [
    {header: 'KEY', get: (r) => r.key ?? ''},
    {header: 'CREATED', get: (r) => r.createdAt ?? ''},
    {header: 'UPDATED', get: (r) => r.updatedAt ?? ''},
  ],
  createFlags: {
    key: Flags.string({description: desc('CreateSecretRequest', 'key'), required: true}),
    value: Flags.string({description: desc('CreateSecretRequest', 'value'), required: true}),
    environment: Flags.string({description: 'Environment slug to scope this secret to'}),
  },
  updateFlags: {
    value: Flags.string({description: desc('UpdateSecretRequest', 'value'), required: true}),
  },
}

export const TAGS: ResourceConfig<TagDto> = {
  name: 'tag',
  plural: 'tags',
  apiPath: '/api/v1/tags',
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
}

export const RESOURCE_GROUPS: ResourceConfig<ResourceGroupDto> = {
  name: 'resource group',
  plural: 'resource-groups',
  apiPath: '/api/v1/resource-groups',
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
    name: Flags.string({description: desc('UpdateResourceGroupRequest', 'name')}),
    description: Flags.string({description: desc('UpdateResourceGroupRequest', 'description')}),
  },
}

export const WEBHOOKS: ResourceConfig<WebhookEndpointDto> = {
  name: 'webhook',
  plural: 'webhooks',
  apiPath: '/api/v1/webhooks',
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
      body.subscribedEvents = String(raw.events).split(',').map((s) => s.trim()).filter(Boolean)
    }
    if (raw.description !== undefined) body.description = String(raw.description)
    return body
  },
}

export const API_KEYS: ResourceConfig<ApiKeyDto> = {
  name: 'API key',
  plural: 'api-keys',
  apiPath: '/api/v1/api-keys',
  validateIdAsUuid: false,
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
  columns: [
    {header: 'ID', get: (r) => r.subscriptionId ?? ''},
    {header: 'SERVICE', get: (r) => r.name ?? ''},
    {header: 'SLUG', get: (r) => r.slug ?? ''},
    {header: 'STATUS', get: (r) => r.overallStatus ?? ''},
    {header: 'ENABLED', get: (r) => String(r.enabled ?? '')},
  ],
}

export const STATUS_PAGES: ResourceConfig<Schemas['StatusPageDto']> = {
  name: 'status page',
  plural: 'status-pages',
  apiPath: '/api/v1/status-pages',
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
    // Only PUBLIC is enforced today — PASSWORD / IP_RESTRICTED exist in the
    // API enum but are not implemented. Expose a narrower, honest option set.
    visibility: Flags.string({description: 'Page visibility (PUBLIC only today)', options: ['PUBLIC']}),
    'incident-mode': Flags.string({description: desc('CreateStatusPageRequest', 'incidentMode'), options: [...STATUS_PAGE_INCIDENT_MODES]}),
    'branding-file': Flags.string({description: 'Path to a JSON file with branding fields (logoUrl, brandColor, theme, customCss, …)'}),
  },
  updateFlags: {
    name: Flags.string({description: desc('UpdateStatusPageRequest', 'name')}),
    description: Flags.string({description: desc('UpdateStatusPageRequest', 'description')}),
    visibility: Flags.string({description: 'Page visibility (PUBLIC only today)', options: ['PUBLIC']}),
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
function loadBrandingFile(path: string): components['schemas']['StatusPageBranding'] {
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
  return result.data as components['schemas']['StatusPageBranding']
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
