/**
 * Zod schemas for devhelm.yml configuration.
 *
 * Single source of truth for YAML *validation*. Enum constants are
 * intentionally re-declared here as `as const` tuples because Zod's
 * `z.enum` requires a literal tuple type, while `schema.ts` exports them
 * as `readonly Foo[]` for the type-system layer. The contract test in
 * `test/yaml/parser.test.ts` (and the `enum-parity` block in
 * `zod-schemas.test.ts`) asserts the two lists stay in sync — if you add
 * an enum value, add it in both places.
 *
 * Assertion and auth types use snake_case wire-format names as the
 * user-facing vocabulary. The bidirectional mapping functions in
 * `transform.ts` convert between these and the PascalCase OpenAPI schema
 * names.
 */
import {z} from 'zod'

// ── Discriminator wire-format derivation ─────────────────────────────

function pascalToSnake(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/([A-Z])([A-Z][a-z])/g, '$1_$2').toLowerCase()
}

// ── Assertion types (snake_case) ─────────────────────────────────────

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

export const ASSERTION_WIRE_TYPES = ASSERTION_SCHEMA_NAMES.map(
  (n) => pascalToSnake(n.replace(/Assertion$/, '')),
) as unknown as readonly string[]

// ── Constants (kept in sync with schema.ts via parity test) ──────────

const MONITOR_TYPES = ['HTTP', 'DNS', 'TCP', 'ICMP', 'HEARTBEAT', 'MCP_SERVER'] as const
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'] as const
const DNS_RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'NS', 'TXT', 'SRV', 'SOA', 'CAA', 'PTR'] as const
const ASSERTION_SEVERITIES = ['fail', 'warn'] as const
const CHANNEL_TYPES = ['slack', 'email', 'pagerduty', 'opsgenie', 'discord', 'teams', 'webhook'] as const
const TRIGGER_RULE_TYPES = ['consecutive_failures', 'failures_in_window', 'response_time'] as const
const TRIGGER_SCOPES = ['per_region', 'any_region'] as const
const TRIGGER_SEVERITIES = ['down', 'degraded'] as const
const TRIGGER_AGGREGATIONS = ['all_exceed', 'average', 'p95', 'max'] as const
const ALERT_SENSITIVITIES = ['ALL', 'INCIDENTS_ONLY', 'MAJOR_ONLY'] as const
const HEALTH_THRESHOLD_TYPES = ['COUNT', 'PERCENTAGE'] as const
// Only PUBLIC is accepted today. The API enum defines PASSWORD / IP_RESTRICTED
// but neither mode is implemented server-side yet, so exposing them in YAML
// would silently do nothing. See schema.ts for the matching narrowing.
const STATUS_PAGE_VISIBILITIES = ['PUBLIC'] as const
const STATUS_PAGE_INCIDENT_MODES = ['MANUAL', 'REVIEW', 'AUTOMATIC'] as const
const STATUS_PAGE_COMPONENT_TYPES = ['MONITOR', 'GROUP', 'STATIC'] as const

const MIN_FREQUENCY = 30
const MAX_FREQUENCY = 86400

// Internal-only re-export so the parity test can import the Zod-side
// tuples without going through individual named exports.
export const _ZOD_ENUMS = {
  MONITOR_TYPES, HTTP_METHODS, DNS_RECORD_TYPES, ASSERTION_SEVERITIES,
  CHANNEL_TYPES, TRIGGER_RULE_TYPES, TRIGGER_SCOPES, TRIGGER_SEVERITIES,
  TRIGGER_AGGREGATIONS, ALERT_SENSITIVITIES, HEALTH_THRESHOLD_TYPES,
  STATUS_PAGE_VISIBILITIES, STATUS_PAGE_INCIDENT_MODES, STATUS_PAGE_COMPONENT_TYPES,
  MIN_FREQUENCY, MAX_FREQUENCY,
} as const

// ── Monitor config schemas ───────────────────────────────────────────

const HttpConfigSchema = z.object({
  url: z.string(),
  method: z.enum(HTTP_METHODS),
  customHeaders: z.record(z.string()).optional(),
  requestBody: z.string().optional(),
  contentType: z.string().optional(),
  verifyTls: z.boolean().optional(),
}).strict()

const DnsConfigSchema = z.object({
  hostname: z.string(),
  recordTypes: z.array(z.enum(DNS_RECORD_TYPES)).optional(),
  nameservers: z.array(z.string()).optional(),
  timeoutMs: z.number().int().positive().optional(),
  totalTimeoutMs: z.number().int().positive().optional(),
}).strict()

const TcpConfigSchema = z.object({
  host: z.string(),
  port: z.number().int().positive().optional(),
  timeoutMs: z.number().int().positive().optional(),
}).strict()

const IcmpConfigSchema = z.object({
  host: z.string(),
  packetCount: z.number().int().positive().optional(),
  timeoutMs: z.number().int().positive().optional(),
}).strict()

const HeartbeatConfigSchema = z.object({
  expectedInterval: z.number().positive(),
  gracePeriod: z.number().positive(),
}).strict()

const McpServerConfigSchema = z.object({
  command: z.string(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
}).strict()

const MonitorConfigSchema = z.union([
  HttpConfigSchema,
  DnsConfigSchema,
  TcpConfigSchema,
  IcmpConfigSchema,
  HeartbeatConfigSchema,
  McpServerConfigSchema,
])

// ── Assertion schema ─────────────────────────────────────────────────

/**
 * Assertion types that require a non-empty `config` block. The API rejects
 * empty configs for these at request time; we short-circuit with a clearer
 * error message at YAML parse time.
 *
 * Threshold-bearing assertions (response_time, dns_response_time, etc.) all
 * require at least one numeric threshold field; "expected value" assertions
 * (dns_expected_ips, mcp_tool_available, etc.) require the expected value.
 *
 * The fine-grained per-type shape validation is left to the API — duplicating
 * ~40 discriminated unions client-side would drift from the server and
 * provide little additional safety.
 */
const ASSERTIONS_REQUIRING_CONFIG: readonly string[] = [
  'status_code',
  'response_time', 'response_time_warn',
  'body_contains', 'regex_body', 'header_value', 'json_path',
  'ssl_expiry', 'response_size',
  'redirect_count', 'redirect_target',
  'dns_response_time', 'dns_response_time_warn',
  'dns_expected_ips', 'dns_expected_cname',
  'dns_record_contains', 'dns_record_equals',
  'dns_txt_contains', 'dns_min_answers', 'dns_max_answers',
  'dns_ttl_low', 'dns_ttl_high',
  'tcp_response_time', 'tcp_response_time_warn',
  'icmp_response_time', 'icmp_response_time_warn',
  'icmp_packet_loss',
  'heartbeat_max_interval', 'heartbeat_interval_drift', 'heartbeat_payload_contains',
  'mcp_response_time', 'mcp_response_time_warn',
  'mcp_has_capability', 'mcp_tool_available',
  'mcp_min_tools', 'mcp_protocol_version',
]

const AssertionSchema = z.object({
  type: z.string().refine(
    (v) => ASSERTION_WIRE_TYPES.includes(v),
    (v) => ({message: `Unknown assertion type "${v}". Valid types: ${ASSERTION_WIRE_TYPES.join(', ')}`}),
  ),
  config: z.record(z.unknown()).optional(),
  severity: z.enum(ASSERTION_SEVERITIES).optional(),
}).superRefine((data, ctx) => {
  if (ASSERTIONS_REQUIRING_CONFIG.includes(data.type)) {
    if (!data.config || Object.keys(data.config).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['config'],
        message: `Assertion type "${data.type}" requires a non-empty "config" block (e.g. thresholdMs, expected, etc.)`,
      })
    }
  }
})

// ── Auth schemas ─────────────────────────────────────────────────────

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

const TriggerRuleSchema = z.object({
  type: z.enum(TRIGGER_RULE_TYPES),
  count: z.number().int().positive().optional(),
  windowMinutes: z.number().int().positive().optional(),
  scope: z.enum(TRIGGER_SCOPES),
  thresholdMs: z.number().int().positive().optional(),
  severity: z.enum(TRIGGER_SEVERITIES),
  aggregationType: z.enum(TRIGGER_AGGREGATIONS).optional(),
}).strict()

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
  type: z.string(),
  value: z.string().optional(),
  monitorNames: z.array(z.string()).optional(),
  regions: z.array(z.string()).optional(),
  values: z.array(z.string()).optional(),
}).strict()

// ── Channel config schemas ───────────────────────────────────────────

const SlackConfigSchema = z.object({
  webhookUrl: z.string(),
  mentionText: z.string().optional(),
}).strict()

const DiscordConfigSchema = z.object({
  webhookUrl: z.string(),
  mentionRoleId: z.string().optional(),
}).strict()

const EmailConfigSchema = z.object({
  recipients: z.array(z.string()).min(1),
}).strict()

const WebhookConfigSchema = z.object({
  url: z.string(),
  signingSecret: z.string().optional(),
  customHeaders: z.record(z.string()).optional(),
}).strict()

const PagerDutyConfigSchema = z.object({
  routingKey: z.string(),
  severityOverride: z.string().optional(),
}).strict()

const OpsGenieConfigSchema = z.object({
  apiKey: z.string(),
  region: z.string().optional(),
}).strict()

const TeamsConfigSchema = z.object({
  webhookUrl: z.string(),
}).strict()

const ChannelConfigSchema = z.union([
  SlackConfigSchema,
  DiscordConfigSchema,
  EmailConfigSchema,
  WebhookConfigSchema,
  PagerDutyConfigSchema,
  OpsGenieConfigSchema,
  TeamsConfigSchema,
])

// ── Retry strategy schema ────────────────────────────────────────────

const RetryStrategySchema = z.object({
  type: z.string(),
  maxRetries: z.number().int().positive().optional(),
  interval: z.number().int().positive().optional(),
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
  type: z.enum(CHANNEL_TYPES),
  config: ChannelConfigSchema,
}).strict()

const NotificationPolicySchema = z.object({
  name: z.string(),
  enabled: z.boolean().optional(),
  priority: z.number().int().optional(),
  matchRules: z.array(MatchRuleSchema).optional(),
  escalation: EscalationChainSchema,
}).strict()

const WebhookSchema = z.object({
  url: z.string(),
  events: z.array(z.string()).min(1),
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
  config: MonitorConfigSchema,
  frequency: z.number().int().min(MIN_FREQUENCY).max(MAX_FREQUENCY).optional(),
  enabled: z.boolean().optional(),
  regions: z.array(z.string()).optional(),
  // null = explicitly clear an existing environment association on update
  // (omitted = preserve current API value)
  environment: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  alertChannels: z.array(z.string()).optional(),
  assertions: z.array(AssertionSchema).optional(),
  // null = explicitly clear existing auth on update (omitted = preserve)
  auth: AuthSchema.nullable().optional(),
  incidentPolicy: IncidentPolicySchema.optional(),
}).strict()

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
  frequency: z.number().int().min(MIN_FREQUENCY).max(MAX_FREQUENCY).optional(),
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
