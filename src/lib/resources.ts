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

// Jackson @JsonSubTypes uses lowercase names, not the class names from the OpenAPI spec
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

export const MONITORS: ResourceConfig = {
  name: 'monitor',
  plural: 'monitors',
  apiPath: '/api/v1/monitors',
  columns: [
    {key: 'id', header: 'ID'},
    {key: 'name', header: 'NAME'},
    {key: 'type', header: 'TYPE'},
    {key: 'status', header: 'STATUS'},
    {key: 'url', header: 'URL'},
    {key: 'frequencySeconds', header: 'FREQUENCY_S'},
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
  bodyBuilder: (raw): CreateMonitorRequest | Record<string, unknown> => {
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
      return body as unknown as Record<string, unknown>
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

// openapi-typescript generates MonitorConfig as Record<string, never> (empty base),
// so the intersection types need casting through the concrete schema types.
function buildMonitorConfig(type: MonitorType, raw: Record<string, unknown>): CreateMonitorRequest['config'] {
  switch (type) {
    case 'HTTP':
      return {url: String(raw.url ?? ''), method: (raw.method as HttpMethod) || 'GET'} as unknown as Schemas['HttpMonitorConfig']
    case 'TCP':
      return {host: String(raw.url ?? ''), port: raw.port ? Number(raw.port) : 443} as unknown as Schemas['TcpMonitorConfig']
    case 'DNS':
      return {hostname: String(raw.url ?? '')} as unknown as Schemas['DnsMonitorConfig']
    case 'ICMP':
      return {host: String(raw.url ?? '')} as unknown as Schemas['IcmpMonitorConfig']
    case 'HEARTBEAT':
      return {expectedInterval: 60, gracePeriod: 60} as unknown as Schemas['HeartbeatMonitorConfig']
    case 'MCP_SERVER':
      return {command: String(raw.url ?? '')} as unknown as Schemas['McpServerMonitorConfig']
    default:
      return {url: String(raw.url ?? ''), method: 'GET'} as unknown as Schemas['HttpMonitorConfig']
  }
}

export const INCIDENTS: ResourceConfig = {
  name: 'incident',
  plural: 'incidents',
  apiPath: '/api/v1/incidents',
  columns: [
    {key: 'id', header: 'ID'},
    {key: 'title', header: 'TITLE'},
    {key: 'status', header: 'STATUS'},
    {key: 'severity', header: 'SEVERITY'},
    {key: 'monitorName', header: 'MONITOR'},
    {key: 'startedAt', header: 'STARTED'},
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
  bodyBuilder: (raw): Record<string, unknown> => {
    const body: CreateManualIncidentRequest = {
      title: String(raw.title),
      severity: raw.severity as IncidentSeverity,
    }
    if (raw['monitor-id'] !== undefined) body.monitorId = String(raw['monitor-id'])
    if (raw.body !== undefined) body.body = String(raw.body)
    return body as unknown as Record<string, unknown>
  },
}

export const ALERT_CHANNELS: ResourceConfig = {
  name: 'alert channel',
  plural: 'alert-channels',
  apiPath: '/api/v1/alert-channels',
  columns: [
    {key: 'id', header: 'ID'},
    {key: 'name', header: 'NAME'},
    {key: 'type', header: 'TYPE'},
    {key: 'enabled', header: 'ENABLED'},
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
  bodyBuilder: (raw): Record<string, unknown> => {
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
    const body: Record<string, unknown> = {}
    if (raw.name !== undefined) body.name = raw.name
    if (config !== undefined) body.config = config
    return body
  },
}

export const NOTIFICATION_POLICIES: ResourceConfig = {
  name: 'notification policy',
  plural: 'notification-policies',
  apiPath: '/api/v1/notification-policies',
  columns: [
    {key: 'id', header: 'ID'},
    {key: 'name', header: 'NAME'},
    {key: 'enabled', header: 'ENABLED'},
    {key: 'severity', header: 'SEVERITY'},
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
  bodyBuilder: (raw): Record<string, unknown> => {
    const channelIds = raw['channel-ids']
      ? String(raw['channel-ids']).split(',').map((s) => s.trim()).filter(Boolean)
      : []
    const body: CreateNotificationPolicyRequest = {
      name: String(raw.name),
      escalation: {steps: [{channelIds, delayMinutes: 0}]},
      enabled: (raw.enabled as boolean) ?? true,
      priority: 0,
    }
    return body as unknown as Record<string, unknown>
  },
}

export const ENVIRONMENTS: ResourceConfig = {
  name: 'environment',
  plural: 'environments',
  apiPath: '/api/v1/environments',
  idField: 'slug',
  columns: [
    {key: 'slug', header: 'SLUG'},
    {key: 'name', header: 'NAME'},
    {key: 'color', header: 'COLOR'},
    {key: 'variableCount', header: 'VARIABLES'},
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

export const SECRETS: ResourceConfig = {
  name: 'secret',
  plural: 'secrets',
  apiPath: '/api/v1/secrets',
  idField: 'key',
  columns: [
    {key: 'key', header: 'KEY'},
    {key: 'environmentSlug', header: 'ENVIRONMENT'},
    {key: 'createdAt', header: 'CREATED'},
    {key: 'updatedAt', header: 'UPDATED'},
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

export const TAGS: ResourceConfig = {
  name: 'tag',
  plural: 'tags',
  apiPath: '/api/v1/tags',
  columns: [
    {key: 'id', header: 'ID'},
    {key: 'name', header: 'NAME'},
    {key: 'color', header: 'COLOR'},
    {key: 'monitorCount', header: 'MONITORS'},
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

export const RESOURCE_GROUPS: ResourceConfig = {
  name: 'resource group',
  plural: 'resource-groups',
  apiPath: '/api/v1/resource-groups',
  columns: [
    {key: 'id', header: 'ID'},
    {key: 'name', header: 'NAME'},
    {key: 'description', header: 'DESCRIPTION'},
    {key: 'healthStatus', header: 'HEALTH'},
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

export const WEBHOOKS: ResourceConfig = {
  name: 'webhook',
  plural: 'webhooks',
  apiPath: '/api/v1/webhooks',
  columns: [
    {key: 'id', header: 'ID'},
    {key: 'url', header: 'URL'},
    {key: 'enabled', header: 'ENABLED'},
    {key: 'events', header: 'EVENTS'},
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
  bodyBuilder: (raw): Record<string, unknown> => {
    const body: Record<string, unknown> = {}
    if (raw.url !== undefined) body.url = raw.url
    if (raw.events !== undefined) {
      body.subscribedEvents = String(raw.events).split(',').map((s) => s.trim()).filter(Boolean)
    }
    if (raw.description !== undefined) body.description = raw.description
    return body
  },
}

export const API_KEYS: ResourceConfig = {
  name: 'API key',
  plural: 'api-keys',
  apiPath: '/api/v1/api-keys',
  columns: [
    {key: 'id', header: 'ID'},
    {key: 'name', header: 'NAME'},
    {key: 'prefix', header: 'PREFIX'},
    {key: 'status', header: 'STATUS'},
    {key: 'lastUsedAt', header: 'LAST USED'},
    {key: 'createdAt', header: 'CREATED'},
  ],
  createFlags: {
    name: Flags.string({description: desc('CreateApiKeyRequest', 'name'), required: true}),
    'expires-at': Flags.string({description: desc('CreateApiKeyRequest', 'expiresAt')}),
  },
  bodyBuilder: (raw): Record<string, unknown> => {
    const body: CreateApiKeyRequest = {name: String(raw.name)}
    if (raw['expires-at'] !== undefined) body.expiresAt = String(raw['expires-at'])
    return body as unknown as Record<string, unknown>
  },
}

export const DEPENDENCIES: ResourceConfig = {
  name: 'dependency',
  plural: 'dependencies',
  apiPath: '/api/v1/service-subscriptions',
  columns: [
    {key: 'id', header: 'ID'},
    {key: 'serviceName', header: 'SERVICE'},
    {key: 'serviceSlug', header: 'SLUG'},
    {key: 'alertSensitivity', header: 'SENSITIVITY'},
    {key: 'status', header: 'STATUS'},
  ],
}
