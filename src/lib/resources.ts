import {Flags} from '@oclif/core'
import {ResourceConfig} from './crud-commands.js'

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
    {key: 'interval', header: 'INTERVAL'},
  ],
  createFlags: {
    name: Flags.string({description: 'Monitor name', required: true}),
    type: Flags.string({description: 'Monitor type (HTTP, DNS, TCP, ICMP, HEARTBEAT)', required: true}),
    url: Flags.string({description: 'Target URL or host'}),
    interval: Flags.string({description: 'Check interval in seconds'}),
    method: Flags.string({description: 'HTTP method (GET, POST, HEAD, etc.)'}),
    timeout: Flags.string({description: 'Timeout in ms'}),
    regions: Flags.string({description: 'Comma-separated probe regions'}),
  },
  updateFlags: {
    name: Flags.string({description: 'Monitor name'}),
    url: Flags.string({description: 'Target URL or host'}),
    interval: Flags.string({description: 'Check interval in seconds'}),
    method: Flags.string({description: 'HTTP method'}),
    timeout: Flags.string({description: 'Timeout in ms'}),
  },
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
    title: Flags.string({description: 'Incident title', required: true}),
    'monitor-id': Flags.string({description: 'Monitor ID', required: true}),
    severity: Flags.string({description: 'Severity (CRITICAL, HIGH, MEDIUM, LOW)'}),
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
    name: Flags.string({description: 'Channel name', required: true}),
    type: Flags.string({description: 'Channel type (SLACK, EMAIL, PAGERDUTY, OPSGENIE, DISCORD, TEAMS, WEBHOOK)', required: true}),
    config: Flags.string({description: 'Channel config as JSON'}),
  },
  updateFlags: {
    name: Flags.string({description: 'Channel name'}),
    config: Flags.string({description: 'Channel config as JSON'}),
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
    name: Flags.string({description: 'Policy name', required: true}),
    severity: Flags.string({description: 'Minimum severity'}),
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
    name: Flags.string({description: 'Environment name', required: true}),
    slug: Flags.string({description: 'Environment slug'}),
    color: Flags.string({description: 'Color hex code'}),
  },
  updateFlags: {
    name: Flags.string({description: 'Environment name'}),
    color: Flags.string({description: 'Color hex code'}),
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
    key: Flags.string({description: 'Secret key', required: true}),
    value: Flags.string({description: 'Secret value', required: true}),
    environment: Flags.string({description: 'Environment slug'}),
  },
  updateFlags: {
    value: Flags.string({description: 'Secret value', required: true}),
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
    name: Flags.string({description: 'Tag name', required: true}),
    color: Flags.string({description: 'Color hex code'}),
  },
  updateFlags: {
    name: Flags.string({description: 'Tag name'}),
    color: Flags.string({description: 'Color hex code'}),
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
    name: Flags.string({description: 'Group name', required: true}),
    description: Flags.string({description: 'Description'}),
  },
  updateFlags: {
    name: Flags.string({description: 'Group name'}),
    description: Flags.string({description: 'Description'}),
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
    url: Flags.string({description: 'Webhook URL', required: true}),
    events: Flags.string({description: 'Comma-separated event types'}),
    secret: Flags.string({description: 'Webhook secret'}),
  },
  updateFlags: {
    url: Flags.string({description: 'Webhook URL'}),
    events: Flags.string({description: 'Comma-separated event types'}),
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
    name: Flags.string({description: 'Key name', required: true}),
    scopes: Flags.string({description: 'Comma-separated scopes'}),
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
