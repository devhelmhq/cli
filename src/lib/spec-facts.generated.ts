// Auto-generated from OpenAPI spec. DO NOT EDIT.
// Re-run `npm run zodgen` to regenerate.

export const MONITOR_TYPES = ['HTTP', 'DNS', 'MCP_SERVER', 'TCP', 'ICMP', 'HEARTBEAT'] as const
export type MonitorTypes = (typeof MONITOR_TYPES)[number]

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'] as const
export type HttpMethods = (typeof HTTP_METHODS)[number]

export const DNS_RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'NS', 'TXT', 'SRV', 'SOA', 'CAA', 'PTR'] as const
export type DnsRecordTypes = (typeof DNS_RECORD_TYPES)[number]

export const INCIDENT_SEVERITIES = ['DOWN', 'DEGRADED', 'MAINTENANCE'] as const
export type IncidentSeverities = (typeof INCIDENT_SEVERITIES)[number]

export const ASSERTION_SEVERITIES = ['fail', 'warn'] as const
export type AssertionSeverities = (typeof ASSERTION_SEVERITIES)[number]

export const CHANNEL_TYPES = ['email', 'webhook', 'slack', 'pagerduty', 'opsgenie', 'teams', 'discord'] as const
export type ChannelTypes = (typeof CHANNEL_TYPES)[number]

export const TRIGGER_RULE_TYPES = ['consecutive_failures', 'failures_in_window', 'response_time'] as const
export type TriggerRuleTypes = (typeof TRIGGER_RULE_TYPES)[number]

export const TRIGGER_SCOPES = ['per_region', 'any_region'] as const
export type TriggerScopes = (typeof TRIGGER_SCOPES)[number]

export const TRIGGER_SEVERITIES = ['down', 'degraded'] as const
export type TriggerSeverities = (typeof TRIGGER_SEVERITIES)[number]

export const TRIGGER_AGGREGATIONS = ['all_exceed', 'average', 'p95', 'max'] as const
export type TriggerAggregations = (typeof TRIGGER_AGGREGATIONS)[number]

export const ALERT_SENSITIVITIES = ['ALL', 'INCIDENTS_ONLY', 'MAJOR_ONLY'] as const
export type AlertSensitivities = (typeof ALERT_SENSITIVITIES)[number]

export const HEALTH_THRESHOLD_TYPES = ['COUNT', 'PERCENTAGE'] as const
export type HealthThresholdTypes = (typeof HEALTH_THRESHOLD_TYPES)[number]

export const STATUS_PAGE_VISIBILITIES = ['PUBLIC', 'PASSWORD', 'IP_RESTRICTED'] as const
export type StatusPageVisibilities = (typeof STATUS_PAGE_VISIBILITIES)[number]

export const STATUS_PAGE_INCIDENT_MODES = ['MANUAL', 'REVIEW', 'AUTOMATIC'] as const
export type StatusPageIncidentModes = (typeof STATUS_PAGE_INCIDENT_MODES)[number]

export const STATUS_PAGE_COMPONENT_TYPES = ['MONITOR', 'GROUP', 'STATIC'] as const
export type StatusPageComponentTypes = (typeof STATUS_PAGE_COMPONENT_TYPES)[number]

export const SP_INCIDENT_IMPACTS = ['NONE', 'MINOR', 'MAJOR', 'CRITICAL'] as const
export type SpIncidentImpacts = (typeof SP_INCIDENT_IMPACTS)[number]

export const SP_INCIDENT_STATUSES = ['INVESTIGATING', 'IDENTIFIED', 'MONITORING', 'RESOLVED'] as const
export type SpIncidentStatuses = (typeof SP_INCIDENT_STATUSES)[number]

export const AUTH_TYPES = ['bearer', 'basic', 'header', 'api_key'] as const
export type AuthTypes = (typeof AUTH_TYPES)[number]

export const MANAGED_BY = ['DASHBOARD', 'CLI', 'TERRAFORM'] as const
export type ManagedBy = (typeof MANAGED_BY)[number]

export const MATCH_RULE_TYPES = ['severity_gte', 'monitor_id_in', 'region_in', 'incident_status', 'monitor_type_in', 'service_id_in', 'resource_group_id_in', 'component_name_in', 'monitor_tag_in'] as const
export type MatchRuleTypes = (typeof MATCH_RULE_TYPES)[number]

export const WEBHOOK_EVENT_TYPES = ['monitor.created', 'monitor.updated', 'monitor.deleted', 'incident.created', 'incident.resolved', 'incident.reopened', 'service.status_changed', 'service.component_changed', 'service.incident_created', 'service.incident_updated', 'service.incident_resolved'] as const
export type WebhookEventTypes = (typeof WEBHOOK_EVENT_TYPES)[number]

export const COMPARISON_OPERATORS = ['equals', 'contains', 'less_than', 'greater_than', 'matches', 'range'] as const
export type ComparisonOperators = (typeof COMPARISON_OPERATORS)[number]

