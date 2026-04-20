/**
 * Zod schemas for devhelm.yml configuration.
 *
 * Single source of truth for YAML *validation*. Schemas for assertions,
 * alert channel configs, and monitor configs are imported from the
 * generated file (api-zod.generated.ts) — derived from the OpenAPI spec
 * via `npm run zodgen`. This file defines ZERO per-type schemas manually;
 * it only composes generated schemas into dispatch maps and top-level
 * structural schemas.
 *
 * Enum constants are imported from spec-facts.generated.ts (auto-extracted
 * from the OpenAPI spec). The parity test in zod-schemas.test.ts asserts
 * they stay in sync with schema.ts. The spec-field-parity test verifies
 * every YAML field maps to a real API request field.
 *
 * Auth schemas remain hand-written because the YAML format uses a
 * `secret` field that doesn't exist in the API (the CLI resolves it
 * to a vault secret ID).
 */
import {z} from 'zod'

import {schemas as apiSchemas} from '../api-zod.generated.js'
import {
  MONITOR_TYPES, HTTP_METHODS, DNS_RECORD_TYPES, ASSERTION_SEVERITIES,
  CHANNEL_TYPES, TRIGGER_RULE_TYPES, TRIGGER_SCOPES, TRIGGER_SEVERITIES,
  TRIGGER_AGGREGATIONS, ALERT_SENSITIVITIES, HEALTH_THRESHOLD_TYPES,
  STATUS_PAGE_INCIDENT_MODES, STATUS_PAGE_COMPONENT_TYPES,
} from '../spec-facts.generated.js'
import {STATUS_PAGE_VISIBILITIES, MIN_FREQUENCY, MAX_FREQUENCY} from './schema.js'

// ── Enum constants not (yet) expressed as OpenAPI enums ───────────────
// These are the known valid values from the API source code, hardcoded
// here because the OpenAPI spec uses free-form `string` for these fields.
// Kept in sync manually — the parity test will catch drift.

/** Match rule types supported by the notification policy engine. */
export const MATCH_RULE_TYPES = [
  'severity_gte', 'monitor_id_in', 'region_in', 'incident_status',
  'monitor_type_in', 'service_id_in', 'resource_group_id_in', 'component_name_in',
] as const

/** Retry strategy kinds for resource group defaults. */
export const RETRY_STRATEGY_TYPES = ['fixed'] as const

/** All known webhook event type identifiers from the event catalog. */
export const WEBHOOK_EVENT_TYPES = [
  'monitor.created', 'monitor.updated', 'monitor.deleted',
  'incident.created', 'incident.resolved', 'incident.reopened',
  'service.status_changed', 'service.component_changed',
  'service.incident_created', 'service.incident_updated', 'service.incident_resolved',
] as const

// ── Assertion config schemas (imported from generated OpenAPI Zod) ────
// Maps wire-format type strings (from AssertionConfig discriminator)
// to the corresponding generated Zod schema.

const ASSERTION_CONFIG_SCHEMAS: Record<string, z.ZodType> = {
  body_contains: apiSchemas.BodyContainsAssertion,
  dns_expected_cname: apiSchemas.DnsExpectedCnameAssertion,
  dns_expected_ips: apiSchemas.DnsExpectedIpsAssertion,
  dns_max_answers: apiSchemas.DnsMaxAnswersAssertion,
  dns_min_answers: apiSchemas.DnsMinAnswersAssertion,
  dns_record_contains: apiSchemas.DnsRecordContainsAssertion,
  dns_record_equals: apiSchemas.DnsRecordEqualsAssertion,
  dns_resolves: apiSchemas.DnsResolvesAssertion,
  dns_response_time: apiSchemas.DnsResponseTimeAssertion,
  dns_response_time_warn: apiSchemas.DnsResponseTimeWarnAssertion,
  dns_ttl_high: apiSchemas.DnsTtlHighAssertion,
  dns_ttl_low: apiSchemas.DnsTtlLowAssertion,
  dns_txt_contains: apiSchemas.DnsTxtContainsAssertion,
  header_value: apiSchemas.HeaderValueAssertion,
  heartbeat_interval_drift: apiSchemas.HeartbeatIntervalDriftAssertion,
  heartbeat_max_interval: apiSchemas.HeartbeatMaxIntervalAssertion,
  heartbeat_payload_contains: apiSchemas.HeartbeatPayloadContainsAssertion,
  heartbeat_received: apiSchemas.HeartbeatReceivedAssertion,
  icmp_packet_loss: apiSchemas.IcmpPacketLossAssertion,
  icmp_reachable: apiSchemas.IcmpReachableAssertion,
  icmp_response_time: apiSchemas.IcmpResponseTimeAssertion,
  icmp_response_time_warn: apiSchemas.IcmpResponseTimeWarnAssertion,
  json_path: apiSchemas.JsonPathAssertion,
  mcp_connects: apiSchemas.McpConnectsAssertion,
  mcp_has_capability: apiSchemas.McpHasCapabilityAssertion,
  mcp_min_tools: apiSchemas.McpMinToolsAssertion,
  mcp_protocol_version: apiSchemas.McpProtocolVersionAssertion,
  mcp_response_time: apiSchemas.McpResponseTimeAssertion,
  mcp_response_time_warn: apiSchemas.McpResponseTimeWarnAssertion,
  mcp_tool_available: apiSchemas.McpToolAvailableAssertion,
  mcp_tool_count_changed: apiSchemas.McpToolCountChangedAssertion,
  redirect_count: apiSchemas.RedirectCountAssertion,
  redirect_target: apiSchemas.RedirectTargetAssertion,
  regex_body: apiSchemas.RegexBodyAssertion,
  response_size: apiSchemas.ResponseSizeAssertion,
  response_time: apiSchemas.ResponseTimeAssertion,
  response_time_warn: apiSchemas.ResponseTimeWarnAssertion,
  ssl_expiry: apiSchemas.SslExpiryAssertion,
  status_code: apiSchemas.StatusCodeAssertion,
  tcp_connects: apiSchemas.TcpConnectsAssertion,
  tcp_response_time: apiSchemas.TcpResponseTimeAssertion,
  tcp_response_time_warn: apiSchemas.TcpResponseTimeWarnAssertion,
}

export const ASSERTION_WIRE_TYPES = Object.keys(ASSERTION_CONFIG_SCHEMAS)

export {ASSERTION_CONFIG_SCHEMAS}

// ── Channel config schemas (imported from generated OpenAPI Zod) ─────

const CHANNEL_CONFIG_SCHEMAS: Record<string, z.ZodType> = {
  discord: apiSchemas.DiscordChannelConfig,
  email: apiSchemas.EmailChannelConfig,
  opsgenie: apiSchemas.OpsGenieChannelConfig,
  pagerduty: apiSchemas.PagerDutyChannelConfig,
  slack: apiSchemas.SlackChannelConfig,
  teams: apiSchemas.TeamsChannelConfig,
  webhook: apiSchemas.WebhookChannelConfig,
}

// ── Monitor config schemas (imported from generated OpenAPI Zod) ─────

const MONITOR_TYPE_CONFIG_SCHEMAS: Record<string, z.ZodType> = {
  HTTP: apiSchemas.HttpMonitorConfig,
  DNS: apiSchemas.DnsMonitorConfig,
  TCP: apiSchemas.TcpMonitorConfig,
  ICMP: apiSchemas.IcmpMonitorConfig,
  HEARTBEAT: apiSchemas.HeartbeatMonitorConfig,
  MCP_SERVER: apiSchemas.McpServerMonitorConfig,
}

// ── Constants ────────────────────────────────────────────────────────
// Enum tuples are imported from spec-facts.generated.ts (auto-extracted
// from the OpenAPI spec). STATUS_PAGE_VISIBILITIES, MIN_FREQUENCY, and
// MAX_FREQUENCY come from schema.ts so the validator and Zod layer share
// a single source of truth — STATUS_PAGE_VISIBILITIES is intentionally
// narrowed (the spec also accepts PASSWORD and IP_RESTRICTED, but those
// modes are not yet wired to storage or enforcement server-side).

export const _ZOD_ENUMS = {
  MONITOR_TYPES, HTTP_METHODS, DNS_RECORD_TYPES, ASSERTION_SEVERITIES,
  CHANNEL_TYPES, TRIGGER_RULE_TYPES, TRIGGER_SCOPES, TRIGGER_SEVERITIES,
  TRIGGER_AGGREGATIONS, ALERT_SENSITIVITIES, HEALTH_THRESHOLD_TYPES,
  STATUS_PAGE_VISIBILITIES, STATUS_PAGE_INCIDENT_MODES, STATUS_PAGE_COMPONENT_TYPES,
  MIN_FREQUENCY, MAX_FREQUENCY,
  MATCH_RULE_TYPES, RETRY_STRATEGY_TYPES, WEBHOOK_EVENT_TYPES,
} as const

// ── Assertion schema (dispatches by config.type to generated schemas) ─

const AssertionSchema = z.object({
  config: z.record(z.unknown()).refine(
    (c) => typeof c.type === 'string',
    {message: 'config.type is required and must be a string'},
  ),
  severity: z.enum(ASSERTION_SEVERITIES).optional(),
}).strict().superRefine((data, ctx) => {
  const assertionType = data.config.type as string
  const configSchema = ASSERTION_CONFIG_SCHEMAS[assertionType]
  if (!configSchema) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['config', 'type'],
      message: `Unknown assertion type "${assertionType}". Valid types: ${ASSERTION_WIRE_TYPES.join(', ')}`,
    })
    return
  }

  const result = configSchema.safeParse(data.config)
  if (!result.success) {
    for (const issue of result.error.issues) {
      ctx.addIssue({...issue, path: ['config', ...issue.path]})
    }
  }
})

// ── Auth schemas (hand-written — YAML uses `secret`, API uses vaultSecretId) ─

const BearerAuthSchema = z.object({type: z.literal('bearer'), secret: z.string()}).strict()
const BasicAuthSchema = z.object({type: z.literal('basic'), secret: z.string()}).strict()
const ApiKeyAuthSchema = z.object({type: z.literal('api_key'), headerName: z.string(), secret: z.string()}).strict()
const HeaderAuthSchema = z.object({type: z.literal('header'), headerName: z.string(), secret: z.string()}).strict()

const AuthSchema = z.discriminatedUnion('type', [
  BearerAuthSchema,
  BasicAuthSchema,
  ApiKeyAuthSchema,
  HeaderAuthSchema,
])

// ── Incident policy schemas ──────────────────────────────────────────

const MAX_TRIGGER_COUNT = 10

const ConsecutiveFailuresRuleSchema = z.object({
  type: z.literal('consecutive_failures'),
  count: z.number().int().min(1).max(MAX_TRIGGER_COUNT),
  scope: z.enum(TRIGGER_SCOPES),
  severity: z.enum(TRIGGER_SEVERITIES),
  windowMinutes: z.number().int().positive().optional(),
  thresholdMs: z.number().int().positive().optional(),
  aggregationType: z.enum(TRIGGER_AGGREGATIONS).optional(),
}).strict()

const FailuresInWindowRuleSchema = z.object({
  type: z.literal('failures_in_window'),
  count: z.number().int().min(1).max(MAX_TRIGGER_COUNT),
  windowMinutes: z.number().int().positive(),
  scope: z.enum(TRIGGER_SCOPES),
  severity: z.enum(TRIGGER_SEVERITIES),
  thresholdMs: z.number().int().positive().optional(),
  aggregationType: z.enum(TRIGGER_AGGREGATIONS).optional(),
}).strict()

const ResponseTimeRuleSchema = z.object({
  type: z.literal('response_time'),
  count: z.number().int().min(1).max(MAX_TRIGGER_COUNT),
  thresholdMs: z.number().int().positive(),
  scope: z.enum(TRIGGER_SCOPES),
  severity: z.enum(TRIGGER_SEVERITIES),
  aggregationType: z.enum(TRIGGER_AGGREGATIONS).optional(),
  windowMinutes: z.number().int().positive().optional(),
}).strict()

const TriggerRuleSchema = z.discriminatedUnion('type', [
  ConsecutiveFailuresRuleSchema,
  FailuresInWindowRuleSchema,
  ResponseTimeRuleSchema,
])

const ConfirmationPolicySchema = z.object({
  type: z.literal('multi_region'),
  minRegionsFailing: z.number().int().positive().optional(),
  maxWaitSeconds: z.number().int().positive().optional(),
}).strict()

const RecoveryPolicySchema = z.object({
  consecutiveSuccesses: z.number().int().positive().optional(),
  minRegionsPassing: z.number().int().positive().optional(),
  cooldownMinutes: z.number().int().positive().optional(),
}).strict()

const IncidentPolicySchema = z.object({
  triggerRules: z.array(TriggerRuleSchema).min(1),
  confirmation: ConfirmationPolicySchema,
  recovery: RecoveryPolicySchema,
}).strict()

// ── Escalation schemas ───────────────────────────────────────────────

const EscalationStepSchema = z.object({
  channels: z.array(z.string()).min(1),
  delayMinutes: z.number().int().min(0).optional(),
  requireAck: z.boolean().optional(),
  repeatIntervalSeconds: z.number().int().positive().optional(),
}).strict()

const EscalationChainSchema = z.object({
  steps: z.array(EscalationStepSchema).min(1),
  onResolve: z.string().optional(),
  onReopen: z.string().optional(),
}).strict()

// ── Match rule schema ────────────────────────────────────────────────

const MatchRuleSchema = z.object({
  type: z.enum(MATCH_RULE_TYPES),
  value: z.string().optional(),
  monitorNames: z.array(z.string()).optional(),
  regions: z.array(z.string()).optional(),
  values: z.array(z.string()).optional(),
}).strict()

// ── Channel config union (from generated schemas) ────────────────────

export const ChannelConfigSchema = z.union([
  apiSchemas.SlackChannelConfig,
  apiSchemas.DiscordChannelConfig,
  apiSchemas.EmailChannelConfig,
  apiSchemas.WebhookChannelConfig,
  apiSchemas.PagerDutyChannelConfig,
  apiSchemas.OpsGenieChannelConfig,
  apiSchemas.TeamsChannelConfig,
])

// ── Retry strategy schema ────────────────────────────────────────────

const RetryStrategySchema = z.object({
  type: z.enum(RETRY_STRATEGY_TYPES),
  maxRetries: z.number().int().positive(),
  interval: z.number().int().positive(),
}).strict()

// ── Top-level resource schemas ───────────────────────────────────────

const TagSchema = z.object({
  name: z.string(),
  color: z.string().optional(),
}).strict()

const EnvironmentSchema = z.object({
  name: z.string(),
  slug: z.string(),
  variables: z.record(z.string()).optional(),
  isDefault: z.boolean().optional(),
}).strict()

const SecretSchema = z.object({
  key: z.string(),
  value: z.string(),
}).strict()

const AlertChannelSchema = z.object({
  name: z.string(),
  config: z.record(z.unknown()).refine(
    (c) => typeof c.channelType === 'string',
    {message: 'config.channelType is required'},
  ),
}).strict().superRefine((data, ctx) => {
  const channelType = data.config.channelType as string
  if (!(CHANNEL_TYPES as readonly string[]).includes(channelType)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['config', 'channelType'],
      message: `Unknown channel type "${channelType}". Valid types: ${CHANNEL_TYPES.join(', ')}`,
    })
    return
  }

  const configSchema = CHANNEL_CONFIG_SCHEMAS[channelType]
  if (!configSchema) return
  const result = configSchema.safeParse(data.config)
  if (!result.success) {
    for (const issue of result.error.issues) {
      ctx.addIssue({...issue, path: ['config', ...issue.path]})
    }
  }
})

const NotificationPolicySchema = z.object({
  name: z.string(),
  enabled: z.boolean().optional(),
  priority: z.number().int().optional(),
  matchRules: z.array(MatchRuleSchema).optional(),
  escalation: EscalationChainSchema,
}).strict()

const WebhookSchema = z.object({
  url: z.string(),
  subscribedEvents: z.array(z.enum(WEBHOOK_EVENT_TYPES)).min(1),
  description: z.string().optional(),
  enabled: z.boolean().optional(),
}).strict()

const ResourceGroupSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  alertPolicy: z.string().optional(),
  defaultFrequency: z.number().int().min(MIN_FREQUENCY).max(MAX_FREQUENCY).optional(),
  defaultRegions: z.array(z.string()).optional(),
  defaultRetryStrategy: RetryStrategySchema.optional(),
  defaultAlertChannels: z.array(z.string()).optional(),
  defaultEnvironment: z.string().optional(),
  healthThresholdType: z.enum(HEALTH_THRESHOLD_TYPES).optional(),
  healthThresholdValue: z.number().optional(),
  suppressMemberAlerts: z.boolean().optional(),
  confirmationDelaySeconds: z.number().int().min(0).optional(),
  recoveryCooldownMinutes: z.number().int().min(0).optional(),
  monitors: z.array(z.string()).optional(),
  services: z.array(z.string()).optional(),
}).strict()

const MonitorSchema = z.object({
  name: z.string(),
  type: z.enum(MONITOR_TYPES),
  config: z.record(z.unknown()),
  frequencySeconds: z.number().int().min(MIN_FREQUENCY).max(MAX_FREQUENCY).optional(),
  enabled: z.boolean().optional(),
  regions: z.array(z.string()).optional(),
  environment: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  alertChannels: z.array(z.string()).optional(),
  assertions: z.array(AssertionSchema).optional(),
  auth: AuthSchema.nullable().optional(),
  incidentPolicy: IncidentPolicySchema.optional(),
}).strict().superRefine((data, ctx) => {
  const configSchema = MONITOR_TYPE_CONFIG_SCHEMAS[data.type]
  if (!configSchema) return
  const result = configSchema.safeParse(data.config)
  if (!result.success) {
    for (const issue of result.error.issues) {
      ctx.addIssue({...issue, path: ['config', ...issue.path]})
    }
  }
})

const DependencySchema = z.object({
  service: z.string(),
  alertSensitivity: z.enum(ALERT_SENSITIVITIES).optional(),
  component: z.string().optional(),
}).strict()

// ── Status page schemas ──────────────────────────────────────────────

// Matches the Jakarta pattern on StatusPageBranding fields server-side:
// 3-, 6-, or 8-digit hex (leading `#`). Validated early so users get a
// clear client-side error before the API 400s.
const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/
const HTTP_URL = /^https?:\/\/.+/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const StatusPageBrandingSchema = z.object({
  logoUrl: z.string().regex(HTTP_URL, 'must be an http(s) URL').max(2048).optional(),
  faviconUrl: z.string().regex(HTTP_URL, 'must be an http(s) URL').max(2048).optional(),
  brandColor: z.string().regex(HEX_COLOR, 'must be a hex color, e.g. #4F46E5').optional(),
  pageBackground: z.string().regex(HEX_COLOR, 'must be a hex color').optional(),
  cardBackground: z.string().regex(HEX_COLOR, 'must be a hex color').optional(),
  textColor: z.string().regex(HEX_COLOR, 'must be a hex color').optional(),
  borderColor: z.string().regex(HEX_COLOR, 'must be a hex color').optional(),
  headerStyle: z.string().max(50).optional(),
  theme: z.string().max(50).optional(),
  reportUrl: z.string().regex(HTTP_URL, 'must be an http(s) URL').max(2048).optional(),
  hidePoweredBy: z.boolean().optional(),
  customCss: z.string().max(50_000).optional(),
  customHeadHtml: z.string().max(50_000).optional(),
}).strict()

const StatusPageComponentGroupSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  collapsed: z.boolean().optional(),
}).strict()

const StatusPageComponentSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  type: z.enum(STATUS_PAGE_COMPONENT_TYPES),
  monitor: z.string().optional(),
  resourceGroup: z.string().optional(),
  group: z.string().optional(),
  showUptime: z.boolean().optional(),
  excludeFromOverall: z.boolean().optional(),
  startDate: z.string().regex(ISO_DATE, 'must be an ISO date (YYYY-MM-DD)').optional(),
}).strict()

const StatusPageSchema = z.object({
  name: z.string(),
  slug: z.string(),
  description: z.string().optional(),
  visibility: z.enum(STATUS_PAGE_VISIBILITIES).optional(),
  enabled: z.boolean().optional(),
  incidentMode: z.enum(STATUS_PAGE_INCIDENT_MODES).optional(),
  branding: StatusPageBrandingSchema.optional(),
  componentGroups: z.array(StatusPageComponentGroupSchema).optional(),
  components: z.array(StatusPageComponentSchema).optional(),
}).strict()

// ── Defaults schema ──────────────────────────────────────────────────

const MonitorDefaultsSchema = z.object({
  frequencySeconds: z.number().int().min(MIN_FREQUENCY).max(MAX_FREQUENCY).optional(),
  enabled: z.boolean().optional(),
  regions: z.array(z.string()).optional(),
  alertChannels: z.array(z.string()).optional(),
  incidentPolicy: IncidentPolicySchema.optional(),
}).strict()

const DefaultsSchema = z.object({
  monitors: MonitorDefaultsSchema.optional(),
}).strict()

// ── Moved block schema ───────────────────────────────────────────────

const MovedBlockSchema = z.object({
  from: z.string(),
  to: z.string(),
}).strict()

// ── Top-level config ─────────────────────────────────────────────────

export const DevhelmConfigSchema = z.object({
  version: z.string().optional(),
  defaults: DefaultsSchema.optional(),
  moved: z.array(MovedBlockSchema).optional(),
  tags: z.array(TagSchema).optional(),
  environments: z.array(EnvironmentSchema).optional(),
  secrets: z.array(SecretSchema).optional(),
  alertChannels: z.array(AlertChannelSchema).optional(),
  notificationPolicies: z.array(NotificationPolicySchema).optional(),
  webhooks: z.array(WebhookSchema).optional(),
  resourceGroups: z.array(ResourceGroupSchema).optional(),
  monitors: z.array(MonitorSchema).optional(),
  dependencies: z.array(DependencySchema).optional(),
  statusPages: z.array(StatusPageSchema).optional(),
}).strict()

export type DevhelmConfigZ = z.infer<typeof DevhelmConfigSchema>

// ── Error formatting ─────────────────────────────────────────────────

export function formatZodErrors(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '(root)'
    return `${path}: ${issue.message}`
  })
}
