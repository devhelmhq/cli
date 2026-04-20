// @ts-nocheck
// Auto-generated Zod schemas from OpenAPI spec. DO NOT EDIT.
import { z } from "zod";

const pageable = z.object({
  page: z.number().int().gte(0),
  size: z.number().int().gte(1),
  sort: z.array(z.string()),
});
const ErrorResponse = z.object({
  status: z.number().int(),
  message: z.string(),
  timestamp: z.number().int(),
});
const DiscordChannelConfig = z.object({
  channelType: z.literal("discord"),
  webhookUrl: z.string().min(1),
  mentionRoleId: z.string().nullish(),
});
const EmailChannelConfig = z.object({
  channelType: z.literal("email"),
  recipients: z.array(z.string().email()).min(1),
});
const OpsGenieChannelConfig = z.object({
  channelType: z.literal("opsgenie"),
  apiKey: z.string().min(1),
  region: z.string().nullish(),
});
const PagerDutyChannelConfig = z.object({
  channelType: z.literal("pagerduty"),
  routingKey: z.string().min(1),
  severityOverride: z.string().nullish(),
});
const SlackChannelConfig = z.object({
  channelType: z.literal("slack"),
  webhookUrl: z.string().min(1),
  mentionText: z.string().nullish(),
});
const TeamsChannelConfig = z.object({
  channelType: z.literal("teams"),
  webhookUrl: z.string().min(1),
});
const WebhookChannelConfig = z.object({
  channelType: z.literal("webhook"),
  url: z.string().min(1),
  signingSecret: z.string().nullish(),
  customHeaders: z.record(z.string().nullable()).nullish(),
});
const CreateAlertChannelRequest = z.object({
  name: z.string().min(0).max(255),
  config: z.union([
    DiscordChannelConfig,
    EmailChannelConfig,
    OpsGenieChannelConfig,
    PagerDutyChannelConfig,
    SlackChannelConfig,
    TeamsChannelConfig,
    WebhookChannelConfig,
  ]),
});
const UpdateAlertChannelRequest = z.object({
  name: z.string().min(0).max(255),
  config: z.union([
    DiscordChannelConfig,
    EmailChannelConfig,
    OpsGenieChannelConfig,
    PagerDutyChannelConfig,
    SlackChannelConfig,
    TeamsChannelConfig,
    WebhookChannelConfig,
  ]),
});
const TestAlertChannelRequest = z.object({
  config: z.union([
    DiscordChannelConfig,
    EmailChannelConfig,
    OpsGenieChannelConfig,
    PagerDutyChannelConfig,
    SlackChannelConfig,
    TeamsChannelConfig,
    WebhookChannelConfig,
  ]),
});
const CreateApiKeyRequest = z.object({
  name: z.string().min(0).max(200),
  expiresAt: z.string().datetime({ offset: true }).nullish(),
});
const UpdateApiKeyRequest = z.object({ name: z.string().min(0).max(200) });
const AcquireDeployLockRequest = z.object({
  lockedBy: z.string().min(1),
  ttlMinutes: z.number().int().nullish(),
});
const CreateEnvironmentRequest = z.object({
  name: z.string().min(0).max(100),
  slug: z
    .string()
    .min(0)
    .max(100)
    .regex(/^[a-z0-9][a-z0-9_-]*$/),
  variables: z.record(z.string().nullable()).nullish(),
  isDefault: z.boolean(),
});
const UpdateEnvironmentRequest = z
  .object({
    name: z.string().min(0).max(100).nullable(),
    variables: z.record(z.string().nullable()).nullable(),
    isDefault: z.boolean().nullable(),
  })
  .partial();
const params = z.object({
  status: z.enum(["WATCHING", "TRIGGERED", "CONFIRMED", "RESOLVED"]).nullish(),
  severity: z.enum(["DOWN", "DEGRADED", "MAINTENANCE"]).nullish(),
  source: z
    .enum(["AUTOMATIC", "MANUAL", "MONITORS", "STATUS_DATA", "RESOURCE_GROUP"])
    .nullish(),
  monitorId: z.string().uuid().nullish(),
  serviceId: z.string().uuid().nullish(),
  resourceGroupId: z.string().uuid().nullish(),
  tagId: z.string().uuid().nullish(),
  environmentId: z.string().uuid().nullish(),
  startedFrom: z.string().datetime({ offset: true }).nullish(),
  startedTo: z.string().datetime({ offset: true }).nullish(),
  page: z.number().int().gte(0),
  size: z.number().int().gte(1).lte(200),
});
const CreateManualIncidentRequest = z.object({
  title: z.string().min(1),
  severity: z.enum(["DOWN", "DEGRADED", "MAINTENANCE"]),
  monitorId: z.string().uuid().nullish(),
  body: z.string().nullish(),
});
const ResolveIncidentRequest = z
  .object({ body: z.string().nullable() })
  .partial();
const AddIncidentUpdateRequest = z.object({
  body: z.string().nullish(),
  newStatus: z
    .enum(["WATCHING", "TRIGGERED", "CONFIRMED", "RESOLVED"])
    .nullish(),
  notifySubscribers: z.boolean(),
});
const CreateInviteRequest = z.object({
  email: z.string().min(1).email(),
  roleOffered: z.enum(["OWNER", "ADMIN", "MEMBER"]),
});
const CreateMaintenanceWindowRequest = z.object({
  monitorId: z.string().uuid().nullish(),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  repeatRule: z.string().min(0).max(100).nullish(),
  reason: z.string().nullish(),
  suppressAlerts: z.boolean().nullish(),
});
const UpdateMaintenanceWindowRequest = z.object({
  monitorId: z.string().uuid().nullish(),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  repeatRule: z.string().min(0).max(100).nullish(),
  reason: z.string().nullish(),
  suppressAlerts: z.boolean().nullish(),
});
const ChangeRoleRequest = z.object({
  orgRole: z.enum(["OWNER", "ADMIN", "MEMBER"]),
});
const ChangeStatusRequest = z.object({
  status: z.enum([
    "INVITED",
    "ACTIVE",
    "SUSPENDED",
    "LEFT",
    "REMOVED",
    "DECLINED",
  ]),
});
const MonitorConfig = z.object({}).partial();
const DnsMonitorConfig = MonitorConfig.and(
  z.object({
    hostname: z.string().min(1),
    recordTypes: z
      .array(
        z
          .enum([
            "A",
            "AAAA",
            "CNAME",
            "MX",
            "NS",
            "TXT",
            "SRV",
            "SOA",
            "CAA",
            "PTR",
          ])
          .nullable()
      )
      .nullish(),
    nameservers: z.array(z.string().nullable()).nullish(),
    timeoutMs: z.number().int().nullish(),
    totalTimeoutMs: z.number().int().nullish(),
  })
);
const HeartbeatMonitorConfig = MonitorConfig.and(
  z.object({
    expectedInterval: z.number().int().gte(1).lte(86400),
    gracePeriod: z.number().int().gte(1),
  })
);
const HttpMonitorConfig = MonitorConfig.and(
  z.object({
    url: z.string().min(1),
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]),
    customHeaders: z.record(z.string().nullable()).nullish(),
    requestBody: z.string().nullish(),
    contentType: z.string().nullish(),
    verifyTls: z.boolean().nullish(),
  })
);
const IcmpMonitorConfig = MonitorConfig.and(
  z.object({
    host: z.string().min(1),
    packetCount: z.number().int().gte(1).lte(20).nullish(),
    timeoutMs: z.number().int().nullish(),
  })
);
const McpServerMonitorConfig = MonitorConfig.and(
  z.object({
    command: z.string().min(1),
    args: z.array(z.string().nullable()).nullish(),
    env: z.record(z.string().nullable()).nullish(),
  })
);
const TcpMonitorConfig = MonitorConfig.and(
  z.object({
    host: z.string().min(1),
    port: z.number().int().gte(1).lte(65535),
    timeoutMs: z.number().int().nullish(),
  })
);
const BodyContainsAssertion = z.object({
  type: z.literal("body_contains"),
  substring: z.string().min(1),
});
const DnsExpectedCnameAssertion = z.object({
  type: z.literal("dns_expected_cname"),
  value: z.string().min(1),
});
const DnsExpectedIpsAssertion = z.object({
  type: z.literal("dns_expected_ips"),
  ips: z.array(z.string()).min(1),
});
const DnsMaxAnswersAssertion = z.object({
  type: z.literal("dns_max_answers"),
  recordType: z.string().min(1),
  max: z.number().int(),
});
const DnsMinAnswersAssertion = z.object({
  type: z.literal("dns_min_answers"),
  recordType: z.string().min(1),
  min: z.number().int(),
});
const DnsRecordContainsAssertion = z.object({
  type: z.literal("dns_record_contains"),
  recordType: z.string().min(1),
  substring: z.string().min(1),
});
const DnsRecordEqualsAssertion = z.object({
  type: z.literal("dns_record_equals"),
  recordType: z.string().min(1),
  value: z.string().min(1),
});
const DnsResolvesAssertion = z.object({ type: z.literal("dns_resolves") });
const DnsResponseTimeAssertion = z.object({
  type: z.literal("dns_response_time"),
  maxMs: z.number().int(),
});
const DnsResponseTimeWarnAssertion = z.object({
  type: z.literal("dns_response_time_warn"),
  warnMs: z.number().int(),
});
const DnsTtlHighAssertion = z.object({
  type: z.literal("dns_ttl_high"),
  maxTtl: z.number().int(),
});
const DnsTtlLowAssertion = z.object({
  type: z.literal("dns_ttl_low"),
  minTtl: z.number().int(),
});
const DnsTxtContainsAssertion = z.object({
  type: z.literal("dns_txt_contains"),
  substring: z.string().min(1),
});
const HeaderValueAssertion = z.object({
  type: z.literal("header_value"),
  headerName: z.string().min(1),
  expected: z.string().min(1),
  operator: z.enum([
    "equals",
    "contains",
    "less_than",
    "greater_than",
    "matches",
    "range",
  ]),
});
const HeartbeatIntervalDriftAssertion = z.object({
  type: z.literal("heartbeat_interval_drift"),
  maxDeviationPercent: z.number().int().gte(1).lte(100),
});
const HeartbeatMaxIntervalAssertion = z.object({
  type: z.literal("heartbeat_max_interval"),
  maxSeconds: z.number().int().gte(1),
});
const HeartbeatPayloadContainsAssertion = z.object({
  type: z.literal("heartbeat_payload_contains"),
  path: z.string().min(1),
  value: z.string(),
});
const HeartbeatReceivedAssertion = z.object({
  type: z.literal("heartbeat_received"),
});
const IcmpPacketLossAssertion = z.object({
  type: z.literal("icmp_packet_loss"),
  maxPercent: z.number().gte(0).lte(100),
});
const IcmpReachableAssertion = z.object({ type: z.literal("icmp_reachable") });
const IcmpResponseTimeAssertion = z.object({
  type: z.literal("icmp_response_time"),
  maxMs: z.number().int(),
});
const IcmpResponseTimeWarnAssertion = z.object({
  type: z.literal("icmp_response_time_warn"),
  warnMs: z.number().int(),
});
const JsonPathAssertion = z.object({
  type: z.literal("json_path"),
  path: z.string().min(1),
  expected: z.string().min(1),
  operator: z.enum([
    "equals",
    "contains",
    "less_than",
    "greater_than",
    "matches",
    "range",
  ]),
});
const McpConnectsAssertion = z.object({ type: z.literal("mcp_connects") });
const McpHasCapabilityAssertion = z.object({
  type: z.literal("mcp_has_capability"),
  capability: z.string().min(1),
});
const McpMinToolsAssertion = z.object({
  type: z.literal("mcp_min_tools"),
  min: z.number().int(),
});
const McpProtocolVersionAssertion = z.object({
  type: z.literal("mcp_protocol_version"),
  version: z.string().min(1),
});
const McpResponseTimeAssertion = z.object({
  type: z.literal("mcp_response_time"),
  maxMs: z.number().int(),
});
const McpResponseTimeWarnAssertion = z.object({
  type: z.literal("mcp_response_time_warn"),
  warnMs: z.number().int(),
});
const McpToolAvailableAssertion = z.object({
  type: z.literal("mcp_tool_available"),
  toolName: z.string().min(1),
});
const McpToolCountChangedAssertion = z.object({
  type: z.literal("mcp_tool_count_changed"),
  expectedCount: z.number().int(),
});
const RedirectCountAssertion = z.object({
  type: z.literal("redirect_count"),
  maxCount: z.number().int(),
});
const RedirectTargetAssertion = z.object({
  type: z.literal("redirect_target"),
  expected: z.string().min(1),
  operator: z.enum([
    "equals",
    "contains",
    "less_than",
    "greater_than",
    "matches",
    "range",
  ]),
});
const RegexBodyAssertion = z.object({
  type: z.literal("regex_body"),
  pattern: z.string().min(1),
});
const ResponseSizeAssertion = z.object({
  type: z.literal("response_size"),
  maxBytes: z.number().int(),
});
const ResponseTimeAssertion = z.object({
  type: z.literal("response_time"),
  thresholdMs: z.number().int(),
});
const ResponseTimeWarnAssertion = z.object({
  type: z.literal("response_time_warn"),
  warnMs: z.number().int(),
});
const SslExpiryAssertion = z.object({
  type: z.literal("ssl_expiry"),
  minDaysRemaining: z.number().int(),
});
const StatusCodeAssertion = z.object({
  type: z.literal("status_code"),
  expected: z.string().min(1),
  operator: z.enum([
    "equals",
    "contains",
    "less_than",
    "greater_than",
    "matches",
    "range",
  ]),
});
const TcpConnectsAssertion = z.object({ type: z.literal("tcp_connects") });
const TcpResponseTimeAssertion = z.object({
  type: z.literal("tcp_response_time"),
  maxMs: z.number().int(),
});
const TcpResponseTimeWarnAssertion = z.object({
  type: z.literal("tcp_response_time_warn"),
  warnMs: z.number().int(),
});
const CreateAssertionRequest = z.object({
  config: z.union([
    BodyContainsAssertion,
    DnsExpectedCnameAssertion,
    DnsExpectedIpsAssertion,
    DnsMaxAnswersAssertion,
    DnsMinAnswersAssertion,
    DnsRecordContainsAssertion,
    DnsRecordEqualsAssertion,
    DnsResolvesAssertion,
    DnsResponseTimeAssertion,
    DnsResponseTimeWarnAssertion,
    DnsTtlHighAssertion,
    DnsTtlLowAssertion,
    DnsTxtContainsAssertion,
    HeaderValueAssertion,
    HeartbeatIntervalDriftAssertion,
    HeartbeatMaxIntervalAssertion,
    HeartbeatPayloadContainsAssertion,
    HeartbeatReceivedAssertion,
    IcmpPacketLossAssertion,
    IcmpReachableAssertion,
    IcmpResponseTimeAssertion,
    IcmpResponseTimeWarnAssertion,
    JsonPathAssertion,
    McpConnectsAssertion,
    McpHasCapabilityAssertion,
    McpMinToolsAssertion,
    McpProtocolVersionAssertion,
    McpResponseTimeAssertion,
    McpResponseTimeWarnAssertion,
    McpToolAvailableAssertion,
    McpToolCountChangedAssertion,
    RedirectCountAssertion,
    RedirectTargetAssertion,
    RegexBodyAssertion,
    ResponseSizeAssertion,
    ResponseTimeAssertion,
    ResponseTimeWarnAssertion,
    SslExpiryAssertion,
    StatusCodeAssertion,
    TcpConnectsAssertion,
    TcpResponseTimeAssertion,
    TcpResponseTimeWarnAssertion,
  ]),
  severity: z.enum(["fail", "warn"]).nullish(),
});
const BearerAuthConfig = z.object({
  type: z.literal("bearer"),
  vaultSecretId: z.string().uuid().nullish(),
});
const BasicAuthConfig = z.object({
  type: z.literal("basic"),
  vaultSecretId: z.string().uuid().nullish(),
});
const HeaderAuthConfig = z.object({
  type: z.literal("header"),
  headerName: z
    .string()
    .min(1)
    .regex(/^[A-Za-z0-9\-_]+$/),
  vaultSecretId: z.string().uuid().nullish(),
});
const ApiKeyAuthConfig = z.object({
  type: z.literal("api_key"),
  headerName: z
    .string()
    .min(1)
    .regex(/^[A-Za-z0-9\-_]+$/),
  vaultSecretId: z.string().uuid().nullish(),
});
const MonitorAuthConfig = z.discriminatedUnion("type", [
  BearerAuthConfig,
  BasicAuthConfig,
  HeaderAuthConfig,
  ApiKeyAuthConfig,
]);
const TriggerRule = z.object({
  type: z.enum(["consecutive_failures", "failures_in_window", "response_time"]),
  count: z.number().int().nullish(),
  windowMinutes: z.number().int().nullish(),
  scope: z.enum(["per_region", "any_region"]).nullable(),
  thresholdMs: z.number().int().nullish(),
  severity: z.enum(["down", "degraded"]),
  aggregationType: z.enum(["all_exceed", "average", "p95", "max"]).nullish(),
});
const ConfirmationPolicy = z.object({
  type: z.literal("multi_region"),
  minRegionsFailing: z.number().int(),
  maxWaitSeconds: z.number().int(),
});
const RecoveryPolicy = z.object({
  consecutiveSuccesses: z.number().int(),
  minRegionsPassing: z.number().int(),
  cooldownMinutes: z.number().int(),
});
const UpdateIncidentPolicyRequest = z.object({
  triggerRules: z.array(TriggerRule).min(1),
  confirmation: ConfirmationPolicy,
  recovery: RecoveryPolicy,
});
const NewTagRequest = z.object({
  name: z.string().min(0).max(100),
  color: z
    .string()
    .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/)
    .nullish(),
});
const AddMonitorTagsRequest = z
  .object({
    tagIds: z.array(z.string().uuid()).nullable(),
    newTags: z.array(NewTagRequest).nullable(),
  })
  .partial();
const CreateMonitorRequest = z.object({
  name: z.string().min(0).max(255),
  type: z.enum(["HTTP", "DNS", "MCP_SERVER", "TCP", "ICMP", "HEARTBEAT"]),
  config: z.union([
    DnsMonitorConfig,
    HeartbeatMonitorConfig,
    HttpMonitorConfig,
    IcmpMonitorConfig,
    McpServerMonitorConfig,
    TcpMonitorConfig,
  ]),
  frequencySeconds: z.number().int().nullish(),
  enabled: z.boolean().nullish(),
  regions: z.array(z.string()).nullish(),
  managedBy: z.enum(["DASHBOARD", "CLI", "TERRAFORM"]),
  environmentId: z.string().uuid().nullish(),
  assertions: z.array(CreateAssertionRequest).nullish(),
  auth: MonitorAuthConfig.nullish(),
  incidentPolicy: UpdateIncidentPolicyRequest.nullish(),
  alertChannelIds: z.array(z.string().uuid()).nullish(),
  tags: AddMonitorTagsRequest.nullish(),
});
const UpdateMonitorRequest = z
  .object({
    name: z.string().min(0).max(255).nullable(),
    config: MonitorConfig.nullable(),
    frequencySeconds: z.number().int().nullable(),
    enabled: z.boolean().nullable(),
    regions: z.array(z.string()).nullable(),
    managedBy: z.enum(["DASHBOARD", "CLI", "TERRAFORM"]).nullable(),
    environmentId: z.string().uuid().nullable(),
    clearEnvironmentId: z.boolean().nullable(),
    assertions: z.array(CreateAssertionRequest).nullable(),
    auth: MonitorAuthConfig.nullable(),
    clearAuth: z.boolean().nullable(),
    incidentPolicy: UpdateIncidentPolicyRequest.nullable(),
    alertChannelIds: z.array(z.string().uuid()).nullable(),
    tags: AddMonitorTagsRequest.nullable(),
  })
  .partial();
const RemoveMonitorTagsRequest = z.object({
  tagIds: z.array(z.string().uuid()).min(1),
});
const SetAlertChannelsRequest = z.object({
  channelIds: z.array(z.string().uuid()),
});
const UpdateAssertionRequest = z.object({
  config: z.union([
    BodyContainsAssertion,
    DnsExpectedCnameAssertion,
    DnsExpectedIpsAssertion,
    DnsMaxAnswersAssertion,
    DnsMinAnswersAssertion,
    DnsRecordContainsAssertion,
    DnsRecordEqualsAssertion,
    DnsResolvesAssertion,
    DnsResponseTimeAssertion,
    DnsResponseTimeWarnAssertion,
    DnsTtlHighAssertion,
    DnsTtlLowAssertion,
    DnsTxtContainsAssertion,
    HeaderValueAssertion,
    HeartbeatIntervalDriftAssertion,
    HeartbeatMaxIntervalAssertion,
    HeartbeatPayloadContainsAssertion,
    HeartbeatReceivedAssertion,
    IcmpPacketLossAssertion,
    IcmpReachableAssertion,
    IcmpResponseTimeAssertion,
    IcmpResponseTimeWarnAssertion,
    JsonPathAssertion,
    McpConnectsAssertion,
    McpHasCapabilityAssertion,
    McpMinToolsAssertion,
    McpProtocolVersionAssertion,
    McpResponseTimeAssertion,
    McpResponseTimeWarnAssertion,
    McpToolAvailableAssertion,
    McpToolCountChangedAssertion,
    RedirectCountAssertion,
    RedirectTargetAssertion,
    RegexBodyAssertion,
    ResponseSizeAssertion,
    ResponseTimeAssertion,
    ResponseTimeWarnAssertion,
    SslExpiryAssertion,
    StatusCodeAssertion,
    TcpConnectsAssertion,
    TcpResponseTimeAssertion,
    TcpResponseTimeWarnAssertion,
  ]),
  severity: z.enum(["fail", "warn"]).nullish(),
});
const UpdateMonitorAuthRequest = z.object({
  config: z.discriminatedUnion("type", [ApiKeyAuthConfig, BasicAuthConfig, BearerAuthConfig, HeaderAuthConfig]),
});
const SetMonitorAuthRequest = z.object({
  config: z.discriminatedUnion("type", [ApiKeyAuthConfig, BasicAuthConfig, BearerAuthConfig, HeaderAuthConfig]),
});
const BulkMonitorActionRequest = z.object({
  monitorIds: z.array(z.string().uuid()).max(200),
  action: z.enum(["PAUSE", "RESUME", "DELETE", "ADD_TAG", "REMOVE_TAG"]),
  tagIds: z.array(z.string().uuid()).nullish(),
  newTags: z.array(NewTagRequest).nullish(),
});
const MonitorTestRequest = z.object({
  type: z.enum(["HTTP", "DNS", "MCP_SERVER", "TCP", "ICMP", "HEARTBEAT"]),
  config: z.union([
    DnsMonitorConfig,
    HeartbeatMonitorConfig,
    HttpMonitorConfig,
    IcmpMonitorConfig,
    McpServerMonitorConfig,
    TcpMonitorConfig,
  ]),
  assertions: z.array(CreateAssertionRequest).nullish(),
});
const MatchRule = z.object({
  type: z.string(),
  value: z.string().nullish(),
  monitorIds: z.array(z.string().uuid()).nullish(),
  regions: z.array(z.string()).nullish(),
  values: z.array(z.string()).nullish(),
});
const EscalationStep = z.object({
  delayMinutes: z.number().int().gte(0),
  channelIds: z.array(z.string().uuid()).min(1),
  requireAck: z.boolean().nullish(),
  repeatIntervalSeconds: z.number().int().gte(1).nullish(),
});
const EscalationChain = z.object({
  steps: z.array(EscalationStep).min(1),
  onResolve: z.string().nullish(),
  onReopen: z.string().nullish(),
});
const CreateNotificationPolicyRequest = z.object({
  name: z.string().min(0).max(255),
  matchRules: z.array(MatchRule).nullish(),
  escalation: EscalationChain,
  enabled: z.boolean().nullish().default(true),
  priority: z.number().int().nullish().default(0),
});
const UpdateNotificationPolicyRequest = z
  .object({
    name: z.string().min(0).max(255).nullable(),
    matchRules: z.array(MatchRule).nullable(),
    escalation: EscalationChain.nullable(),
    enabled: z.boolean().nullable(),
    priority: z.number().int().nullable(),
  })
  .partial();
const TestNotificationPolicyRequest = z
  .object({
    severity: z.string().nullable(),
    monitorId: z.string().uuid().nullable(),
    regions: z.array(z.string()).nullable(),
    eventType: z.string().nullable(),
    monitorType: z.string().nullable(),
    serviceId: z.string().uuid().nullable(),
    componentName: z.string().nullable(),
    resourceGroupIds: z.array(z.string().uuid()).nullable(),
  })
  .partial();
const UpdateOrgDetailsRequest = z.object({
  name: z.string().min(0).max(200),
  email: z.string().min(1).email(),
  size: z.string().min(0).max(50).nullish(),
  industry: z.string().min(0).max(100).nullish(),
  websiteUrl: z.string().min(0).max(255).nullish(),
});
const RetryStrategy = z.object({
  type: z.string(),
  maxRetries: z.number().int(),
  interval: z.number().int(),
});
const CreateResourceGroupRequest = z.object({
  name: z.string().min(0).max(255),
  description: z.string().nullish(),
  alertPolicyId: z.string().uuid().nullish(),
  defaultFrequency: z.number().int().gte(30).lte(86400).nullish(),
  defaultRegions: z.array(z.string()).nullish(),
  defaultRetryStrategy: RetryStrategy.nullish(),
  defaultAlertChannels: z.array(z.string().uuid()).nullish(),
  defaultEnvironmentId: z.string().uuid().nullish(),
  healthThresholdType: z.enum(["COUNT", "PERCENTAGE"]).nullish(),
  healthThresholdValue: z.number().gte(0).lte(100).nullish(),
  suppressMemberAlerts: z.boolean().nullish(),
  confirmationDelaySeconds: z.number().int().gte(0).lte(600).nullish(),
  recoveryCooldownMinutes: z.number().int().gte(0).lte(60).nullish(),
});
const UpdateResourceGroupRequest = z.object({
  name: z.string().min(0).max(255),
  description: z.string().nullish(),
  alertPolicyId: z.string().uuid().nullish(),
  defaultFrequency: z.number().int().gte(30).lte(86400).nullish(),
  defaultRegions: z.array(z.string()).nullish(),
  defaultRetryStrategy: RetryStrategy.nullish(),
  defaultAlertChannels: z.array(z.string().uuid()).nullish(),
  defaultEnvironmentId: z.string().uuid().nullish(),
  healthThresholdType: z.enum(["COUNT", "PERCENTAGE"]).nullish(),
  healthThresholdValue: z.number().gte(0).lte(100).nullish(),
  suppressMemberAlerts: z.boolean().nullish(),
  confirmationDelaySeconds: z.number().int().gte(0).lte(600).nullish(),
  recoveryCooldownMinutes: z.number().int().gte(0).lte(60).nullish(),
});
const AddResourceGroupMemberRequest = z.object({
  memberType: z
    .string()
    .min(1)
    .regex(/monitor|service/),
  memberId: z.string().uuid(),
});
const CreateSecretRequest = z.object({
  key: z.string().min(0).max(255),
  value: z.string().min(0).max(32768),
});
const UpdateSecretRequest = z.object({ value: z.string().min(0).max(32768) });
const UpdateAlertSensitivityRequest = z.object({
  alertSensitivity: z
    .string()
    .min(1)
    .regex(/ALL|INCIDENTS_ONLY|MAJOR_ONLY/),
});
const ServiceSubscribeRequest = z
  .object({
    componentId: z.string().uuid().nullable(),
    alertSensitivity: z.string().nullable(),
  })
  .partial();
const StatusPageBranding = z
  .object({
    logoUrl: z
      .string()
      .min(0)
      .max(2048)
      .regex(/^https?:\/\/.*/)
      .nullable(),
    faviconUrl: z
      .string()
      .min(0)
      .max(2048)
      .regex(/^https?:\/\/.*/)
      .nullable(),
    brandColor: z
      .string()
      .min(0)
      .max(30)
      .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/)
      .nullable(),
    pageBackground: z
      .string()
      .min(0)
      .max(30)
      .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/)
      .nullable(),
    cardBackground: z
      .string()
      .min(0)
      .max(30)
      .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/)
      .nullable(),
    textColor: z
      .string()
      .min(0)
      .max(30)
      .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/)
      .nullable(),
    borderColor: z
      .string()
      .min(0)
      .max(30)
      .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/)
      .nullable(),
    headerStyle: z.string().min(0).max(50).nullable(),
    theme: z.string().min(0).max(50).nullable(),
    reportUrl: z
      .string()
      .min(0)
      .max(2048)
      .regex(/^https?:\/\/.*/)
      .nullable(),
    hidePoweredBy: z.boolean().default(false),
    customCss: z.string().min(0).max(50000).nullable(),
    customHeadHtml: z.string().min(0).max(50000).nullable(),
  })
  .partial();
const CreateStatusPageRequest = z.object({
  name: z.string().min(0).max(255),
  slug: z
    .string()
    .min(3)
    .max(63)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/),
  description: z.string().min(0).max(500).nullish(),
  branding: StatusPageBranding.nullish(),
  visibility: z.enum(["PUBLIC", "PASSWORD", "IP_RESTRICTED"]).nullish(),
  enabled: z.boolean().nullish(),
  incidentMode: z.enum(["MANUAL", "REVIEW", "AUTOMATIC"]).nullish(),
});
const UpdateStatusPageRequest = z
  .object({
    name: z.string().min(0).max(255).nullable(),
    description: z.string().min(0).max(500).nullable(),
    branding: StatusPageBranding.nullable(),
    visibility: z.enum(["PUBLIC", "PASSWORD", "IP_RESTRICTED"]).nullable(),
    enabled: z.boolean().nullable(),
    incidentMode: z.enum(["MANUAL", "REVIEW", "AUTOMATIC"]).nullable(),
  })
  .partial();
const CreateStatusPageComponentRequest = z.object({
  name: z.string().min(0).max(255),
  description: z.string().min(0).max(500).nullish(),
  type: z.enum(["MONITOR", "GROUP", "STATIC"]),
  monitorId: z.string().uuid().nullish(),
  resourceGroupId: z.string().uuid().nullish(),
  groupId: z.string().uuid().nullish(),
  showUptime: z.boolean().nullish(),
  displayOrder: z.number().int().nullish(),
  excludeFromOverall: z.boolean().nullish(),
  startDate: z.string().nullish(),
});
const UpdateStatusPageComponentRequest = z
  .object({
    name: z.string().min(0).max(255).nullable(),
    description: z.string().min(0).max(500).nullable(),
    groupId: z.string().uuid().nullable(),
    removeFromGroup: z.boolean().nullable(),
    showUptime: z.boolean().nullable(),
    displayOrder: z.number().int().nullable(),
    excludeFromOverall: z.boolean().nullable(),
    startDate: z.string().nullable(),
  })
  .partial();
const ComponentPosition = z.object({
  componentId: z.string().uuid(),
  displayOrder: z.number().int(),
  groupId: z.string().uuid().nullish(),
});
const ReorderComponentsRequest = z.object({
  positions: z.array(ComponentPosition).min(1),
});
const AddCustomDomainRequest = z.object({
  hostname: z
    .string()
    .min(0)
    .max(255)
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/),
});
const CreateStatusPageComponentGroupRequest = z.object({
  name: z.string().min(0).max(255),
  description: z.string().min(0).max(500).nullish(),
  displayOrder: z.number().int().nullish(),
  collapsed: z.boolean().nullish(),
});
const UpdateStatusPageComponentGroupRequest = z
  .object({
    name: z.string().min(0).max(255).nullable(),
    description: z.string().min(0).max(500).nullable(),
    displayOrder: z.number().int().nullable(),
    collapsed: z.boolean().nullable(),
  })
  .partial();
const AffectedComponent = z.object({
  componentId: z.string().uuid(),
  status: z.enum([
    "OPERATIONAL",
    "DEGRADED_PERFORMANCE",
    "PARTIAL_OUTAGE",
    "MAJOR_OUTAGE",
    "UNDER_MAINTENANCE",
  ]),
});
const CreateStatusPageIncidentRequest = z.object({
  title: z.string().min(0).max(500),
  status: z
    .enum(["INVESTIGATING", "IDENTIFIED", "MONITORING", "RESOLVED"])
    .nullish(),
  impact: z.enum(["NONE", "MINOR", "MAJOR", "CRITICAL"]),
  body: z.string().min(1),
  affectedComponents: z.array(AffectedComponent).nullish(),
  scheduled: z.boolean().nullish(),
  scheduledFor: z.string().datetime({ offset: true }).nullish(),
  scheduledUntil: z.string().datetime({ offset: true }).nullish(),
  autoResolve: z.boolean().nullish(),
  notifySubscribers: z.boolean().nullish(),
});
const UpdateStatusPageIncidentRequest = z
  .object({
    title: z.string().min(0).max(500).nullable(),
    status: z
      .enum(["INVESTIGATING", "IDENTIFIED", "MONITORING", "RESOLVED"])
      .nullable(),
    impact: z.enum(["NONE", "MINOR", "MAJOR", "CRITICAL"]).nullable(),
    affectedComponents: z.array(AffectedComponent).nullable(),
    postmortemBody: z.string().nullable(),
    postmortemUrl: z
      .string()
      .min(0)
      .max(2048)
      .regex(/^https?:\/\/.*/)
      .nullable(),
  })
  .partial();
const PublishStatusPageIncidentRequest = z
  .object({
    title: z.string().min(0).max(500).nullable(),
    impact: z.enum(["NONE", "MINOR", "MAJOR", "CRITICAL"]).nullable(),
    status: z
      .enum(["INVESTIGATING", "IDENTIFIED", "MONITORING", "RESOLVED"])
      .nullable(),
    body: z.string().nullable(),
    affectedComponents: z.array(AffectedComponent).nullable(),
    notifySubscribers: z.boolean().nullable(),
  })
  .partial();
const CreateStatusPageIncidentUpdateRequest = z.object({
  status: z.enum(["INVESTIGATING", "IDENTIFIED", "MONITORING", "RESOLVED"]),
  body: z.string().min(1),
  notifySubscribers: z.boolean().nullish(),
  affectedComponents: z.array(AffectedComponent).nullish(),
});
const PageSection = z.object({
  groupId: z.string().uuid().nullish(),
  componentId: z.string().uuid().nullish(),
  pageOrder: z.number().int(),
});
const GroupComponentOrder = z.object({
  groupId: z.string().uuid(),
  positions: z.array(ComponentPosition).min(1),
});
const ReorderPageLayoutRequest = z.object({
  sections: z.array(PageSection).min(1),
  groupOrders: z.array(GroupComponentOrder).nullish(),
});
const AdminAddSubscriberRequest = z.object({
  email: z.string().min(1).email(),
});
const CreateTagRequest = z.object({
  name: z.string().min(0).max(100),
  color: z
    .string()
    .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/)
    .nullish(),
});
const UpdateTagRequest = z
  .object({
    name: z.string().min(0).max(100).nullable(),
    color: z
      .string()
      .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/)
      .nullable(),
  })
  .partial();
const CreateWebhookEndpointRequest = z.object({
  url: z.string().min(0).max(2048),
  description: z.string().min(0).max(255).nullish(),
  subscribedEvents: z.array(z.string().min(1)).min(1),
});
const UpdateWebhookEndpointRequest = z
  .object({
    url: z.string().min(0).max(2048).nullable(),
    description: z.string().min(0).max(255).nullable(),
    subscribedEvents: z.array(z.string()).nullable(),
    enabled: z.boolean().nullable(),
  })
  .partial();
const TestWebhookEndpointRequest = z
  .object({ eventType: z.string().nullable() })
  .partial();
const CreateWorkspaceRequest = z.object({ name: z.string().min(1) });
const UpdateWorkspaceRequest = z.object({ name: z.string().min(0).max(200) });

export const schemas = {
  pageable,
  ErrorResponse,
  DiscordChannelConfig,
  EmailChannelConfig,
  OpsGenieChannelConfig,
  PagerDutyChannelConfig,
  SlackChannelConfig,
  TeamsChannelConfig,
  WebhookChannelConfig,
  CreateAlertChannelRequest,
  UpdateAlertChannelRequest,
  TestAlertChannelRequest,
  CreateApiKeyRequest,
  UpdateApiKeyRequest,
  AcquireDeployLockRequest,
  CreateEnvironmentRequest,
  UpdateEnvironmentRequest,
  params,
  CreateManualIncidentRequest,
  ResolveIncidentRequest,
  AddIncidentUpdateRequest,
  CreateInviteRequest,
  CreateMaintenanceWindowRequest,
  UpdateMaintenanceWindowRequest,
  ChangeRoleRequest,
  ChangeStatusRequest,
  MonitorConfig,
  DnsMonitorConfig,
  HeartbeatMonitorConfig,
  HttpMonitorConfig,
  IcmpMonitorConfig,
  McpServerMonitorConfig,
  TcpMonitorConfig,
  BodyContainsAssertion,
  DnsExpectedCnameAssertion,
  DnsExpectedIpsAssertion,
  DnsMaxAnswersAssertion,
  DnsMinAnswersAssertion,
  DnsRecordContainsAssertion,
  DnsRecordEqualsAssertion,
  DnsResolvesAssertion,
  DnsResponseTimeAssertion,
  DnsResponseTimeWarnAssertion,
  DnsTtlHighAssertion,
  DnsTtlLowAssertion,
  DnsTxtContainsAssertion,
  HeaderValueAssertion,
  HeartbeatIntervalDriftAssertion,
  HeartbeatMaxIntervalAssertion,
  HeartbeatPayloadContainsAssertion,
  HeartbeatReceivedAssertion,
  IcmpPacketLossAssertion,
  IcmpReachableAssertion,
  IcmpResponseTimeAssertion,
  IcmpResponseTimeWarnAssertion,
  JsonPathAssertion,
  McpConnectsAssertion,
  McpHasCapabilityAssertion,
  McpMinToolsAssertion,
  McpProtocolVersionAssertion,
  McpResponseTimeAssertion,
  McpResponseTimeWarnAssertion,
  McpToolAvailableAssertion,
  McpToolCountChangedAssertion,
  RedirectCountAssertion,
  RedirectTargetAssertion,
  RegexBodyAssertion,
  ResponseSizeAssertion,
  ResponseTimeAssertion,
  ResponseTimeWarnAssertion,
  SslExpiryAssertion,
  StatusCodeAssertion,
  TcpConnectsAssertion,
  TcpResponseTimeAssertion,
  TcpResponseTimeWarnAssertion,
  CreateAssertionRequest,
  BearerAuthConfig,
  BasicAuthConfig,
  HeaderAuthConfig,
  ApiKeyAuthConfig,
  MonitorAuthConfig,
  TriggerRule,
  ConfirmationPolicy,
  RecoveryPolicy,
  UpdateIncidentPolicyRequest,
  NewTagRequest,
  AddMonitorTagsRequest,
  CreateMonitorRequest,
  UpdateMonitorRequest,
  RemoveMonitorTagsRequest,
  SetAlertChannelsRequest,
  UpdateAssertionRequest,
  UpdateMonitorAuthRequest,
  SetMonitorAuthRequest,
  BulkMonitorActionRequest,
  MonitorTestRequest,
  MatchRule,
  EscalationStep,
  EscalationChain,
  CreateNotificationPolicyRequest,
  UpdateNotificationPolicyRequest,
  TestNotificationPolicyRequest,
  UpdateOrgDetailsRequest,
  RetryStrategy,
  CreateResourceGroupRequest,
  UpdateResourceGroupRequest,
  AddResourceGroupMemberRequest,
  CreateSecretRequest,
  UpdateSecretRequest,
  UpdateAlertSensitivityRequest,
  ServiceSubscribeRequest,
  StatusPageBranding,
  CreateStatusPageRequest,
  UpdateStatusPageRequest,
  CreateStatusPageComponentRequest,
  UpdateStatusPageComponentRequest,
  ComponentPosition,
  ReorderComponentsRequest,
  AddCustomDomainRequest,
  CreateStatusPageComponentGroupRequest,
  UpdateStatusPageComponentGroupRequest,
  AffectedComponent,
  CreateStatusPageIncidentRequest,
  UpdateStatusPageIncidentRequest,
  PublishStatusPageIncidentRequest,
  CreateStatusPageIncidentUpdateRequest,
  PageSection,
  GroupComponentOrder,
  ReorderPageLayoutRequest,
  AdminAddSubscriberRequest,
  CreateTagRequest,
  UpdateTagRequest,
  CreateWebhookEndpointRequest,
  UpdateWebhookEndpointRequest,
  TestWebhookEndpointRequest,
  CreateWorkspaceRequest,
  UpdateWorkspaceRequest,
};

