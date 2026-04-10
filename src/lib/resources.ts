import {Flags} from '@oclif/core'
import {ResourceConfig} from './crud-commands.js'
import type {components} from './api.generated.js'
import {fieldDescriptions} from './descriptions.generated.js'

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
type CreateApiKeyRequest = Schemas['CreateApiKeyRequest']

const MONITOR_TYPES: MonitorType[] = ['HTTP', 'DNS', 'TCP', 'ICMP', 'HEARTBEAT', 'MCP_SERVER']
const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']
const INCIDENT_SEVERITIES: IncidentSeverity[] = ['DOWN', 'DEGRADED', 'MAINTENANCE']
const CHANNEL_TYPES = ['SLACK', 'EMAIL', 'PAGERDUTY', 'OPSGENIE', 'DISCORD', 'TEAMS', 'WEBHOOK'] as const

const CHANNEL_TYPE_MAP: Record<string, string> = {
  SLACK: 'slack',
  EMAIL: 'email',
  PAGERDUTY: 'pagerduty',
  OPSGENIE: 'opsgenie',
  DISCORD: 'discord',
  TEAMS: 'teams',
  WEBHOOK: 'webhook',
}

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
      options: MONITOR_TYPES,
    }),
    url: Flags.string({description: desc('HttpMonitorConfig', 'url', 'Target URL or host')}),
    frequency: Flags.string({description: desc('CreateMonitorRequest', 'frequencySeconds'), default: '60'}),
    method: Flags.string({
      description: desc('HttpMonitorConfig', 'method'),
      options: HTTP_METHODS,
    }),
    port: Flags.string({description: desc('TcpMonitorConfig', 'port', 'TCP port to connect to')}),
    regions: Flags.string({description: desc('CreateMonitorRequest', 'regions')}),
  },
  updateFlags: {
    name: Flags.string({description: desc('UpdateMonitorRequest', 'name')}),
    url: Flags.string({description: desc('HttpMonitorConfig', 'url', 'Target URL or host')}),
    frequency: Flags.string({description: desc('UpdateMonitorRequest', 'frequencySeconds')}),
    method: Flags.string({description: desc('HttpMonitorConfig', 'method'), options: HTTP_METHODS}),
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
      body.config = {monitorType: 'HTTP', url: raw.url, method: (raw.method as HttpMethod) || 'GET'}
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
      options: INCIDENT_SEVERITIES,
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
    'webhook-url': Flags.string({description: desc('SlackChannelConfig', 'webhookUrl', 'Slack/Discord/Teams webhook URL')}),
  },
  updateFlags: {
    name: Flags.string({description: desc('UpdateAlertChannelRequest', 'name')}),
    type: Flags.string({description: 'Alert channel type', options: [...CHANNEL_TYPES]}),
    config: Flags.string({description: 'Channel-specific configuration as JSON'}),
    'webhook-url': Flags.string({description: desc('SlackChannelConfig', 'webhookUrl', 'Slack/Discord/Teams webhook URL')}),
  },
  bodyBuilder: (raw) => {
    let config: CreateAlertChannelRequest['config'] | undefined
    if (raw.config) {
      config = JSON.parse(String(raw.config)) as CreateAlertChannelRequest['config']
    } else {
      const typeKey = String(raw.type || 'SLACK').toUpperCase()
      const channelType = CHANNEL_TYPE_MAP[typeKey] ?? 'slack'
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
      escalation: {steps: [{channelIds, delayMinutes: 0}]},
      enabled: (raw.enabled as boolean) ?? true,
      priority: 0,
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
    color: Flags.string({description: desc('CreateTagRequest', 'color', 'Color hex code')}),
  },
  updateFlags: {
    name: Flags.string({description: desc('UpdateEnvironmentRequest', 'name')}),
    color: Flags.string({description: 'New color hex code'}),
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
    url: Flags.string({description: desc('CreateWebhookEndpointRequest', 'url'), required: true}),
    events: Flags.string({description: desc('CreateWebhookEndpointRequest', 'subscribedEvents'), required: true}),
    description: Flags.string({description: desc('CreateWebhookEndpointRequest', 'description')}),
  },
  updateFlags: {
    url: Flags.string({description: desc('UpdateWebhookEndpointRequest', 'url')}),
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
  columns: [
    {header: 'ID', get: (r) => r.subscriptionId ?? ''},
    {header: 'SERVICE', get: (r) => r.name ?? ''},
    {header: 'SLUG', get: (r) => r.slug ?? ''},
    {header: 'STATUS', get: (r) => r.overallStatus ?? ''},
    {header: 'ENABLED', get: (r) => String(r.enabled ?? '')},
  ],
}
