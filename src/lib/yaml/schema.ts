/**
 * YAML configuration schema types — derived from OpenAPI-generated API types.
 *
 * These types define what users write in devhelm.yml. They mirror API request
 * types closely, but replace UUIDs with name/slug references and use friendlier
 * field names (e.g. `frequency` instead of `frequencySeconds`).
 *
 * The transform layer (transform.ts) maps these to API request types with
 * compile-time type checking on both sides.
 */
import type {components} from '../api.generated.js'

type Schemas = components['schemas']

// ── Re-export API types used directly in YAML (no transformation needed) ──

export type MonitorType = Schemas['CreateMonitorRequest']['type']
export type HttpMethod = Schemas['HttpMonitorConfig']['method']
export type DnsRecordType = NonNullable<NonNullable<Schemas['DnsMonitorConfig']['recordTypes']>[number]>
export type AssertionSeverity = NonNullable<Schemas['CreateAssertionRequest']['severity']>
export type TriggerRuleType = Schemas['TriggerRule']['type']
export type TriggerRuleScope = Schemas['TriggerRule']['scope']
export type TriggerRuleSeverity = Schemas['TriggerRule']['severity']
export type TriggerAggregation = NonNullable<Schemas['TriggerRule']['aggregationType']>
export type ComparisonOperator = Schemas['StatusCodeAssertion'] extends {type: string} & infer R
  ? R extends {operator: infer O} ? O : never
  : never

// ── Enum constants for validation ──────────────────────────────────────

export const MONITOR_TYPES: readonly MonitorType[] = ['HTTP', 'DNS', 'TCP', 'ICMP', 'HEARTBEAT', 'MCP_SERVER']
export const HTTP_METHODS: readonly HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']
export const DNS_RECORD_TYPES: readonly string[] = ['A', 'AAAA', 'CNAME', 'MX', 'NS', 'TXT', 'SRV', 'SOA', 'CAA', 'PTR']
export const ASSERTION_SEVERITIES: readonly AssertionSeverity[] = ['fail', 'warn']
export const COMPARISON_OPERATORS: readonly string[] = ['equals', 'contains', 'less_than', 'greater_than', 'matches', 'range']
export const TRIGGER_RULE_TYPES: readonly TriggerRuleType[] = ['consecutive_failures', 'failures_in_window', 'response_time']
export const TRIGGER_SCOPES: readonly string[] = ['per_region', 'any_region']
export const TRIGGER_SEVERITIES: readonly TriggerRuleSeverity[] = ['down', 'degraded']
export const TRIGGER_AGGREGATIONS: readonly string[] = ['all_exceed', 'average', 'p95', 'max']
export const CHANNEL_TYPES = ['slack', 'email', 'pagerduty', 'opsgenie', 'discord', 'teams', 'webhook'] as const
export type ChannelType = (typeof CHANNEL_TYPES)[number]
export const ALERT_SENSITIVITIES = ['ALL', 'INCIDENTS_ONLY', 'MAJOR_ONLY'] as const
export const HEALTH_THRESHOLD_TYPES = ['COUNT', 'PERCENTAGE'] as const

export const MIN_FREQUENCY = 30
export const MAX_FREQUENCY = 86400

// ── Assertion type names (discriminator values) ────────────────────────

export const ASSERTION_TYPES = [
  'StatusCodeAssertion', 'ResponseTimeAssertion', 'ResponseTimeWarnAssertion',
  'BodyContainsAssertion', 'RegexBodyAssertion', 'HeaderValueAssertion',
  'JsonPathAssertion', 'SslExpiryAssertion', 'ResponseSizeAssertion',
  'RedirectCountAssertion', 'RedirectTargetAssertion',
  'DnsResolvesAssertion', 'DnsResponseTimeAssertion', 'DnsResponseTimeWarnAssertion',
  'DnsExpectedIpsAssertion', 'DnsExpectedCnameAssertion',
  'DnsRecordContainsAssertion', 'DnsRecordEqualsAssertion',
  'DnsTxtContainsAssertion', 'DnsMinAnswersAssertion', 'DnsMaxAnswersAssertion',
  'DnsTtlLowAssertion', 'DnsTtlHighAssertion',
  'TcpConnectsAssertion', 'TcpResponseTimeAssertion', 'TcpResponseTimeWarnAssertion',
  'IcmpReachableAssertion', 'IcmpResponseTimeAssertion', 'IcmpResponseTimeWarnAssertion',
  'IcmpPacketLossAssertion',
  'HeartbeatReceivedAssertion', 'HeartbeatMaxIntervalAssertion',
  'HeartbeatIntervalDriftAssertion', 'HeartbeatPayloadContainsAssertion',
  'McpConnectsAssertion', 'McpResponseTimeAssertion', 'McpResponseTimeWarnAssertion',
  'McpHasCapabilityAssertion', 'McpToolAvailableAssertion',
  'McpMinToolsAssertion', 'McpProtocolVersionAssertion', 'McpToolCountChangedAssertion',
] as const

export type AssertionType = (typeof ASSERTION_TYPES)[number]

// ── Monitor config types (YAML mirrors API directly) ───────────────────

export interface YamlHttpConfig {
  url: string
  method: HttpMethod
  customHeaders?: Record<string, string>
  requestBody?: string
  contentType?: string
  verifyTls?: boolean
}

export interface YamlDnsConfig {
  hostname: string
  recordTypes?: DnsRecordType[]
  nameservers?: string[]
  timeoutMs?: number
  totalTimeoutMs?: number
}

export interface YamlTcpConfig {
  host: string
  port?: number
  timeoutMs?: number
}

export interface YamlIcmpConfig {
  host: string
  packetCount?: number
  timeoutMs?: number
}

export interface YamlHeartbeatConfig {
  expectedInterval: number
  gracePeriod: number
}

export interface YamlMcpServerConfig {
  command: string
  args?: string[]
  env?: Record<string, string>
}

export type YamlMonitorConfig =
  | YamlHttpConfig
  | YamlDnsConfig
  | YamlTcpConfig
  | YamlIcmpConfig
  | YamlHeartbeatConfig
  | YamlMcpServerConfig

// ── Assertion config (YAML mirrors API discriminated union) ────────────

export interface YamlAssertion {
  type: AssertionType
  config?: Record<string, unknown>
  severity?: AssertionSeverity
}

// ── Auth config (with vault secret name reference) ─────────────────────

export interface YamlBearerAuth {
  type: 'BearerAuthConfig'
  secret: string
}

export interface YamlBasicAuth {
  type: 'BasicAuthConfig'
  secret: string
}

export interface YamlApiKeyAuth {
  type: 'ApiKeyAuthConfig'
  headerName: string
  secret: string
}

export interface YamlHeaderAuth {
  type: 'HeaderAuthConfig'
  headerName: string
  secret: string
}

export type YamlAuth = YamlBearerAuth | YamlBasicAuth | YamlApiKeyAuth | YamlHeaderAuth

// ── Incident policy (YAML mirrors API types directly) ──────────────────

export interface YamlTriggerRule {
  type: TriggerRuleType
  count?: number
  windowMinutes?: number
  scope: TriggerRuleScope
  thresholdMs?: number
  severity: TriggerRuleSeverity
  aggregationType?: TriggerAggregation
}

export interface YamlConfirmationPolicy {
  type: 'multi_region'
  minRegionsFailing?: number
  maxWaitSeconds?: number
}

export interface YamlRecoveryPolicy {
  consecutiveSuccesses?: number
  minRegionsPassing?: number
  cooldownMinutes?: number
}

export interface YamlIncidentPolicy {
  triggerRules: YamlTriggerRule[]
  confirmation: YamlConfirmationPolicy
  recovery: YamlRecoveryPolicy
}

// ── Escalation (with channel name references) ──────────────────────────

export interface YamlEscalationStep {
  channels: string[]
  delayMinutes?: number
  requireAck?: boolean
  repeatIntervalSeconds?: number
}

export interface YamlEscalationChain {
  steps: YamlEscalationStep[]
  onResolve?: string
  onReopen?: string
}

// ── Match rules for notification policies ──────────────────────────────

export interface YamlMatchRule {
  type: string
  value?: string
  monitorNames?: string[]
  regions?: string[]
  values?: string[]
}

// ── Channel configs (YAML uses lowercase type + flat config) ───────────

export interface YamlSlackConfig {
  webhookUrl: string
  mentionText?: string
}

export interface YamlDiscordConfig {
  webhookUrl: string
  mentionRoleId?: string
}

export interface YamlEmailConfig {
  recipients: string[]
}

export interface YamlWebhookConfig {
  url: string
  signingSecret?: string
  customHeaders?: Record<string, string>
}

export interface YamlPagerDutyConfig {
  routingKey: string
  severityOverride?: string
}

export interface YamlOpsGenieConfig {
  apiKey: string
  region?: string
}

export interface YamlTeamsConfig {
  webhookUrl: string
}

export type YamlChannelConfig =
  | YamlSlackConfig
  | YamlDiscordConfig
  | YamlEmailConfig
  | YamlWebhookConfig
  | YamlPagerDutyConfig
  | YamlOpsGenieConfig
  | YamlTeamsConfig

// ── Retry strategy (for resource groups) ───────────────────────────────

export interface YamlRetryStrategy {
  type: string
  maxRetries?: number
  interval?: number
}

// ── Top-level YAML resource types ──────────────────────────────────────

export interface YamlTag {
  name: string
  color?: string
}

export interface YamlEnvironment {
  name: string
  slug: string
  variables?: Record<string, string>
  isDefault?: boolean
}

export interface YamlSecret {
  key: string
  value: string
}

export interface YamlAlertChannel {
  name: string
  type: ChannelType
  config: YamlChannelConfig
}

export interface YamlNotificationPolicy {
  name: string
  enabled?: boolean
  priority?: number
  matchRules?: YamlMatchRule[]
  escalation: YamlEscalationChain
}

export interface YamlWebhook {
  url: string
  events: string[]
  description?: string
  enabled?: boolean
}

export interface YamlResourceGroup {
  name: string
  description?: string
  alertPolicy?: string
  defaultFrequency?: number
  defaultRegions?: string[]
  defaultRetryStrategy?: YamlRetryStrategy
  defaultAlertChannels?: string[]
  defaultEnvironment?: string
  healthThresholdType?: (typeof HEALTH_THRESHOLD_TYPES)[number]
  healthThresholdValue?: number
  suppressMemberAlerts?: boolean
  confirmationDelaySeconds?: number
  recoveryCooldownMinutes?: number
  monitors?: string[]
  services?: string[]
}

export interface YamlMonitor {
  name: string
  type: MonitorType
  config: YamlMonitorConfig
  frequency?: number
  enabled?: boolean
  regions?: string[]
  environment?: string
  tags?: string[]
  alertChannels?: string[]
  assertions?: YamlAssertion[]
  auth?: YamlAuth
  incidentPolicy?: YamlIncidentPolicy
}

export interface YamlDependency {
  service: string
  alertSensitivity?: (typeof ALERT_SENSITIVITIES)[number]
  component?: string
}

// ── Defaults section ───────────────────────────────────────────────────

export interface YamlMonitorDefaults {
  frequency?: number
  enabled?: boolean
  regions?: string[]
  alertChannels?: string[]
  incidentPolicy?: YamlIncidentPolicy
}

export interface YamlDefaults {
  monitors?: YamlMonitorDefaults
}

// ── Top-level config ───────────────────────────────────────────────────

export interface DevhelmConfig {
  version?: string
  defaults?: YamlDefaults
  tags?: YamlTag[]
  environments?: YamlEnvironment[]
  secrets?: YamlSecret[]
  alertChannels?: YamlAlertChannel[]
  notificationPolicies?: YamlNotificationPolicy[]
  webhooks?: YamlWebhook[]
  resourceGroups?: YamlResourceGroup[]
  monitors?: YamlMonitor[]
  dependencies?: YamlDependency[]
}

// ── Section keys (for parity enforcement) ──────────────────────────────

export const YAML_SECTION_KEYS = [
  'tags', 'environments', 'secrets', 'alertChannels',
  'notificationPolicies', 'webhooks', 'resourceGroups',
  'monitors', 'dependencies',
] as const

export type YamlSectionKey = (typeof YAML_SECTION_KEYS)[number]
