/**
 * YAML configuration schema types — derived from OpenAPI-generated API types.
 *
 * These types define what users write in devhelm.yml. They mirror API request
 * types 1:1, with UUIDs replaced by name/slug references. Field names match
 * the API exactly (e.g. `frequencySeconds`, not `frequency`).
 *
 * The transform layer (transform.ts) handles only name→UUID resolution and
 * anti-drift default injection.
 */
import type {components} from '../api.generated.js'
import {
  MONITOR_TYPES, HTTP_METHODS, DNS_RECORD_TYPES, ASSERTION_SEVERITIES,
  CHANNEL_TYPES, TRIGGER_RULE_TYPES, TRIGGER_SCOPES, TRIGGER_SEVERITIES,
  TRIGGER_AGGREGATIONS, ALERT_SENSITIVITIES, HEALTH_THRESHOLD_TYPES,
  STATUS_PAGE_INCIDENT_MODES, STATUS_PAGE_COMPONENT_TYPES,
  COMPARISON_OPERATORS,
} from '../spec-facts.generated.js'

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

// ── Re-export generated enum constants ────────────────────────────────
// These are auto-extracted from the OpenAPI spec via spec-facts.generated.ts.
// Previously maintained by hand — now they update automatically on `npm run zodgen`.

export {
  MONITOR_TYPES, HTTP_METHODS, DNS_RECORD_TYPES, ASSERTION_SEVERITIES,
  CHANNEL_TYPES, TRIGGER_RULE_TYPES, TRIGGER_SCOPES, TRIGGER_SEVERITIES,
  TRIGGER_AGGREGATIONS, ALERT_SENSITIVITIES, HEALTH_THRESHOLD_TYPES,
  COMPARISON_OPERATORS,
}
export type ChannelType = (typeof CHANNEL_TYPES)[number]

export const MIN_FREQUENCY = 30
export const MAX_FREQUENCY = 86400

// ── Assertion type names ────────────────────────────────────────────
// PascalCase names are the OpenAPI schema names (API source of truth).
// Snake_case names are the user-facing YAML vocabulary and wire format.

export const ASSERTION_SCHEMA_NAMES = [
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

/** @deprecated Use ASSERTION_SCHEMA_NAMES — kept for backward compat */
export const ASSERTION_TYPES = ASSERTION_SCHEMA_NAMES

export type AssertionSchemaName = (typeof ASSERTION_SCHEMA_NAMES)[number]
/** @deprecated Use AssertionSchemaName */
export type AssertionType = AssertionSchemaName

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

// ── Assertion config (YAML matches API's CreateAssertionRequest) ───────
// The `config` field is a discriminated union keyed by `config.type`,
// matching the API's AssertionConfig sealed interface exactly.

export interface YamlAssertion {
  config: {type: string; [key: string]: unknown}
  severity?: AssertionSeverity
}

// ── Auth config (with vault secret name reference) ─────────────────────

export interface YamlBearerAuth {
  type: 'bearer'
  secret: string
}

export interface YamlBasicAuth {
  type: 'basic'
  secret: string
}

export interface YamlApiKeyAuth {
  type: 'api_key'
  headerName: string
  secret: string
}

export interface YamlHeaderAuth {
  type: 'header'
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

// ── Channel configs (YAML matches API's AlertChannelConfig union) ──────

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
  maxRetries: number
  interval: number
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
  config: {channelType: ChannelType} & YamlChannelConfig
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
  subscribedEvents: string[]
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
  frequencySeconds?: number
  enabled?: boolean
  regions?: string[]
  /** null = explicitly clear an existing environment association on update. */
  environment?: string | null
  tags?: string[]
  alertChannels?: string[]
  assertions?: YamlAssertion[]
  /** null = explicitly clear existing auth on update. */
  auth?: YamlAuth | null
  incidentPolicy?: YamlIncidentPolicy
}

export interface YamlDependency {
  service: string
  alertSensitivity?: (typeof ALERT_SENSITIVITIES)[number]
  component?: string
}

// ── Status Page types ──────────────────────────────────────────────────

export {STATUS_PAGE_INCIDENT_MODES, STATUS_PAGE_COMPONENT_TYPES}

// Note: the API's SpVisibility enum also declares PASSWORD and IP_RESTRICTED,
// but those modes are not yet wired to storage or enforcement server-side.
// YAML/CLI deliberately only accepts PUBLIC until the API implements them
// so users cannot set a value that silently has no effect.
// Tuple is intentionally narrowed (the spec-facts version includes
// PASSWORD and IP_RESTRICTED). Single source of truth for both the YAML
// validator and the Zod layer — see zod-schemas.ts which re-imports it.
export const STATUS_PAGE_VISIBILITIES = ['PUBLIC'] as const
export type StatusPageVisibility = (typeof STATUS_PAGE_VISIBILITIES)[number]
export type StatusPageIncidentMode = (typeof STATUS_PAGE_INCIDENT_MODES)[number]
export type StatusPageComponentType = (typeof STATUS_PAGE_COMPONENT_TYPES)[number]

/**
 * Visual tokens applied to the public status page. Every field is optional;
 * omitted keys inherit the design-system defaults. The YAML shape mirrors the
 * API's StatusPageBranding record (JSONB). See
 * `api/src/main/java/io/devhelm/db/model/StatusPageBranding.java` for the
 * field → CSS-variable mapping.
 */
export interface YamlStatusPageBranding {
  logoUrl?: string
  faviconUrl?: string
  brandColor?: string
  pageBackground?: string
  cardBackground?: string
  textColor?: string
  borderColor?: string
  headerStyle?: string
  theme?: string
  reportUrl?: string
  hidePoweredBy?: boolean
  customCss?: string
  customHeadHtml?: string
}

export interface YamlStatusPageComponentGroup {
  name: string
  description?: string
  collapsed?: boolean
}

export interface YamlStatusPageComponent {
  name: string
  description?: string
  type: StatusPageComponentType
  monitor?: string
  resourceGroup?: string
  group?: string
  showUptime?: boolean
  /** Exclude from overall status calculation (e.g. third-party deps). */
  excludeFromOverall?: boolean
  /** ISO 8601 date (YYYY-MM-DD) — uptime history starts from this day. */
  startDate?: string
}

export interface YamlStatusPage {
  name: string
  slug: string
  description?: string
  visibility?: StatusPageVisibility
  enabled?: boolean
  incidentMode?: StatusPageIncidentMode
  branding?: YamlStatusPageBranding
  componentGroups?: YamlStatusPageComponentGroup[]
  components?: YamlStatusPageComponent[]
}

// ── Defaults section ───────────────────────────────────────────────────

export interface YamlMonitorDefaults {
  frequencySeconds?: number
  enabled?: boolean
  regions?: string[]
  alertChannels?: string[]
  incidentPolicy?: YamlIncidentPolicy
}

export interface YamlDefaults {
  monitors?: YamlMonitorDefaults
}

// ── Top-level config ───────────────────────────────────────────────────

export interface MovedBlock {
  from: string
  to: string
}

export interface DevhelmConfig {
  version?: string
  defaults?: YamlDefaults
  moved?: MovedBlock[]
  tags?: YamlTag[]
  environments?: YamlEnvironment[]
  secrets?: YamlSecret[]
  alertChannels?: YamlAlertChannel[]
  notificationPolicies?: YamlNotificationPolicy[]
  webhooks?: YamlWebhook[]
  resourceGroups?: YamlResourceGroup[]
  monitors?: YamlMonitor[]
  dependencies?: YamlDependency[]
  statusPages?: YamlStatusPage[]
}

// ── Section keys (for parity enforcement) ──────────────────────────────

export const YAML_SECTION_KEYS = [
  'tags', 'environments', 'secrets', 'alertChannels',
  'notificationPolicies', 'webhooks', 'resourceGroups',
  'monitors', 'dependencies', 'statusPages',
] as const

export type YamlSectionKey = (typeof YAML_SECTION_KEYS)[number]
