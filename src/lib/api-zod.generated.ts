// Auto-generated Zod schemas from OpenAPI spec. DO NOT EDIT.
/* eslint-disable */
import { z } from "zod";

const pageable = z
  .object({
    page: z.number().int().gte(0),
    size: z.number().int().gte(1),
    sort: z.array(z.string()),
  })
  .strict();
const ErrorResponse = z
  .object({
    status: z.number().int(),
    message: z.string(),
    timestamp: z.number().int(),
  })
  .strict();
const DiscordChannelConfig = z
  .object({
    channelType: z.literal("discord"),
    webhookUrl: z.string().min(1),
    mentionRoleId: z.string().nullish(),
  })
  .strict();
const EmailChannelConfig = z
  .object({
    channelType: z.literal("email"),
    recipients: z.array(z.string().email()).min(1),
  })
  .strict();
const OpsGenieChannelConfig = z
  .object({
    channelType: z.literal("opsgenie"),
    apiKey: z.string().min(1),
    region: z.string().nullish(),
  })
  .strict();
const PagerDutyChannelConfig = z
  .object({
    channelType: z.literal("pagerduty"),
    routingKey: z.string().min(1),
    severityOverride: z.string().nullish(),
  })
  .strict();
const SlackChannelConfig = z
  .object({
    channelType: z.literal("slack"),
    webhookUrl: z.string().min(1),
    mentionText: z.string().nullish(),
  })
  .strict();
const TeamsChannelConfig = z
  .object({ channelType: z.literal("teams"), webhookUrl: z.string().min(1) })
  .strict();
const WebhookChannelConfig = z
  .object({
    channelType: z.literal("webhook"),
    url: z.string().min(1),
    signingSecret: z.string().nullish(),
    customHeaders: z.record(z.string().nullable()).nullish(),
  })
  .strict();
const CreateAlertChannelRequest = z
  .object({
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
  })
  .strict();
const UpdateAlertChannelRequest = z
  .object({
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
  })
  .strict();
const TestAlertChannelRequest = z
  .object({
    config: z.union([
      DiscordChannelConfig,
      EmailChannelConfig,
      OpsGenieChannelConfig,
      PagerDutyChannelConfig,
      SlackChannelConfig,
      TeamsChannelConfig,
      WebhookChannelConfig,
    ]),
  })
  .strict();
const CreateApiKeyRequest = z
  .object({
    name: z.string().min(0).max(200),
    expiresAt: z.string().datetime({ offset: true }).nullish(),
  })
  .strict();
const UpdateApiKeyRequest = z
  .object({ name: z.string().min(0).max(200) })
  .strict();
const AcquireDeployLockRequest = z
  .object({
    lockedBy: z.string().min(1),
    ttlMinutes: z.number().int().nullish(),
  })
  .strict();
const CreateEnvironmentRequest = z
  .object({
    name: z.string().min(0).max(100),
    slug: z
      .string()
      .min(0)
      .max(100)
      .regex(/^[a-z0-9][a-z0-9_-]*$/),
    variables: z.record(z.string().nullable()).nullish(),
    isDefault: z.boolean(),
  })
  .strict();
const UpdateEnvironmentRequest = z
  .object({
    name: z.string().min(0).max(100).nullable(),
    variables: z.record(z.string().nullable()).nullable(),
    isDefault: z.boolean().nullable(),
  })
  .partial()
  .strict();
const params = z
  .object({
    status: z
      .enum(["WATCHING", "TRIGGERED", "CONFIRMED", "RESOLVED"])
      .nullish(),
    severity: z.enum(["DOWN", "DEGRADED", "MAINTENANCE"]).nullish(),
    source: z
      .enum([
        "AUTOMATIC",
        "MANUAL",
        "MONITORS",
        "STATUS_DATA",
        "RESOURCE_GROUP",
      ])
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
  })
  .strict();
const CreateManualIncidentRequest = z
  .object({
    title: z.string().min(1),
    severity: z.enum(["DOWN", "DEGRADED", "MAINTENANCE"]),
    monitorId: z.string().uuid().nullish(),
    body: z.string().nullish(),
  })
  .strict();
const ResolveIncidentRequest = z
  .object({ body: z.string().nullable() })
  .partial()
  .strict();
const AddIncidentUpdateRequest = z
  .object({
    body: z.string().nullish(),
    newStatus: z
      .enum(["WATCHING", "TRIGGERED", "CONFIRMED", "RESOLVED"])
      .nullish(),
    notifySubscribers: z.boolean(),
  })
  .strict();
const CreateInviteRequest = z
  .object({
    email: z.string().min(1).email(),
    roleOffered: z.enum(["OWNER", "ADMIN", "MEMBER"]),
  })
  .strict();
const CreateMaintenanceWindowRequest = z
  .object({
    monitorId: z.string().uuid().nullish(),
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
    repeatRule: z.string().min(0).max(100).nullish(),
    reason: z.string().nullish(),
    suppressAlerts: z.boolean().nullish(),
  })
  .strict();
const UpdateMaintenanceWindowRequest = z
  .object({
    monitorId: z.string().uuid().nullish(),
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
    repeatRule: z.string().min(0).max(100).nullish(),
    reason: z.string().nullish(),
    suppressAlerts: z.boolean().nullish(),
  })
  .strict();
const ChangeRoleRequest = z
  .object({ orgRole: z.enum(["OWNER", "ADMIN", "MEMBER"]) })
  .strict();
const ChangeStatusRequest = z
  .object({
    status: z.enum([
      "INVITED",
      "ACTIVE",
      "SUSPENDED",
      "LEFT",
      "REMOVED",
      "DECLINED",
    ]),
  })
  .strict();
const DnsMonitorConfig = z
  .object({
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
  .strict();
const HeartbeatMonitorConfig = z
  .object({
    expectedInterval: z.number().int().gte(1).lte(86400),
    gracePeriod: z.number().int().gte(1),
  })
  .strict();
const HttpMonitorConfig = z
  .object({
    url: z.string().min(1),
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]),
    customHeaders: z.record(z.string().nullable()).nullish(),
    requestBody: z.string().nullish(),
    contentType: z.string().nullish(),
    verifyTls: z.boolean().nullish(),
  })
  .strict();
const IcmpMonitorConfig = z
  .object({
    host: z.string().min(1),
    packetCount: z.number().int().gte(1).lte(20).nullish(),
    timeoutMs: z.number().int().nullish(),
  })
  .strict();
const McpServerMonitorConfig = z
  .object({
    command: z.string().min(1),
    args: z.array(z.string().nullable()).nullish(),
    env: z.record(z.string().nullable()).nullish(),
  })
  .strict();
const TcpMonitorConfig = z
  .object({
    host: z.string().min(1),
    port: z.number().int().gte(1).lte(65535),
    timeoutMs: z.number().int().nullish(),
  })
  .strict();
const BodyContainsAssertion = z
  .object({ type: z.literal("body_contains"), substring: z.string().min(1) })
  .strict();
const DnsExpectedCnameAssertion = z
  .object({ type: z.literal("dns_expected_cname"), value: z.string().min(1) })
  .strict();
const DnsExpectedIpsAssertion = z
  .object({
    type: z.literal("dns_expected_ips"),
    ips: z.array(z.string()).min(1),
  })
  .strict();
const DnsMaxAnswersAssertion = z
  .object({
    type: z.literal("dns_max_answers"),
    recordType: z.string().min(1),
    max: z.number().int(),
  })
  .strict();
const DnsMinAnswersAssertion = z
  .object({
    type: z.literal("dns_min_answers"),
    recordType: z.string().min(1),
    min: z.number().int(),
  })
  .strict();
const DnsRecordContainsAssertion = z
  .object({
    type: z.literal("dns_record_contains"),
    recordType: z.string().min(1),
    substring: z.string().min(1),
  })
  .strict();
const DnsRecordEqualsAssertion = z
  .object({
    type: z.literal("dns_record_equals"),
    recordType: z.string().min(1),
    value: z.string().min(1),
  })
  .strict();
const DnsResolvesAssertion = z
  .object({ type: z.literal("dns_resolves") })
  .strict();
const DnsResponseTimeAssertion = z
  .object({ type: z.literal("dns_response_time"), maxMs: z.number().int() })
  .strict();
const DnsResponseTimeWarnAssertion = z
  .object({
    type: z.literal("dns_response_time_warn"),
    warnMs: z.number().int(),
  })
  .strict();
const DnsTtlHighAssertion = z
  .object({ type: z.literal("dns_ttl_high"), maxTtl: z.number().int() })
  .strict();
const DnsTtlLowAssertion = z
  .object({ type: z.literal("dns_ttl_low"), minTtl: z.number().int() })
  .strict();
const DnsTxtContainsAssertion = z
  .object({ type: z.literal("dns_txt_contains"), substring: z.string().min(1) })
  .strict();
const HeaderValueAssertion = z
  .object({
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
  })
  .strict();
const HeartbeatIntervalDriftAssertion = z
  .object({
    type: z.literal("heartbeat_interval_drift"),
    maxDeviationPercent: z.number().int().gte(1).lte(100),
  })
  .strict();
const HeartbeatMaxIntervalAssertion = z
  .object({
    type: z.literal("heartbeat_max_interval"),
    maxSeconds: z.number().int().gte(1),
  })
  .strict();
const HeartbeatPayloadContainsAssertion = z
  .object({
    type: z.literal("heartbeat_payload_contains"),
    path: z.string().min(1),
    value: z.string(),
  })
  .strict();
const HeartbeatReceivedAssertion = z
  .object({ type: z.literal("heartbeat_received") })
  .strict();
const IcmpPacketLossAssertion = z
  .object({
    type: z.literal("icmp_packet_loss"),
    maxPercent: z.number().gte(0).lte(100),
  })
  .strict();
const IcmpReachableAssertion = z
  .object({ type: z.literal("icmp_reachable") })
  .strict();
const IcmpResponseTimeAssertion = z
  .object({ type: z.literal("icmp_response_time"), maxMs: z.number().int() })
  .strict();
const IcmpResponseTimeWarnAssertion = z
  .object({
    type: z.literal("icmp_response_time_warn"),
    warnMs: z.number().int(),
  })
  .strict();
const JsonPathAssertion = z
  .object({
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
  })
  .strict();
const McpConnectsAssertion = z
  .object({ type: z.literal("mcp_connects") })
  .strict();
const McpHasCapabilityAssertion = z
  .object({
    type: z.literal("mcp_has_capability"),
    capability: z.string().min(1),
  })
  .strict();
const McpMinToolsAssertion = z
  .object({ type: z.literal("mcp_min_tools"), min: z.number().int() })
  .strict();
const McpProtocolVersionAssertion = z
  .object({
    type: z.literal("mcp_protocol_version"),
    version: z.string().min(1),
  })
  .strict();
const McpResponseTimeAssertion = z
  .object({ type: z.literal("mcp_response_time"), maxMs: z.number().int() })
  .strict();
const McpResponseTimeWarnAssertion = z
  .object({
    type: z.literal("mcp_response_time_warn"),
    warnMs: z.number().int(),
  })
  .strict();
const McpToolAvailableAssertion = z
  .object({
    type: z.literal("mcp_tool_available"),
    toolName: z.string().min(1),
  })
  .strict();
const McpToolCountChangedAssertion = z
  .object({
    type: z.literal("mcp_tool_count_changed"),
    expectedCount: z.number().int(),
  })
  .strict();
const RedirectCountAssertion = z
  .object({ type: z.literal("redirect_count"), maxCount: z.number().int() })
  .strict();
const RedirectTargetAssertion = z
  .object({
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
  })
  .strict();
const RegexBodyAssertion = z
  .object({ type: z.literal("regex_body"), pattern: z.string().min(1) })
  .strict();
const ResponseSizeAssertion = z
  .object({ type: z.literal("response_size"), maxBytes: z.number().int() })
  .strict();
const ResponseTimeAssertion = z
  .object({ type: z.literal("response_time"), thresholdMs: z.number().int() })
  .strict();
const ResponseTimeWarnAssertion = z
  .object({ type: z.literal("response_time_warn"), warnMs: z.number().int() })
  .strict();
const SslExpiryAssertion = z
  .object({ type: z.literal("ssl_expiry"), minDaysRemaining: z.number().int() })
  .strict();
const StatusCodeAssertion = z
  .object({
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
  })
  .strict();
const TcpConnectsAssertion = z
  .object({ type: z.literal("tcp_connects") })
  .strict();
const TcpResponseTimeAssertion = z
  .object({ type: z.literal("tcp_response_time"), maxMs: z.number().int() })
  .strict();
const TcpResponseTimeWarnAssertion = z
  .object({
    type: z.literal("tcp_response_time_warn"),
    warnMs: z.number().int(),
  })
  .strict();
const CreateAssertionRequest = z
  .object({
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
  })
  .strict();
const BearerAuthConfig = z
  .object({
    type: z.literal("bearer"),
    vaultSecretId: z.string().uuid().nullish(),
  })
  .strict();
const BasicAuthConfig = z
  .object({
    type: z.literal("basic"),
    vaultSecretId: z.string().uuid().nullish(),
  })
  .strict();
const HeaderAuthConfig = z
  .object({
    type: z.literal("header"),
    headerName: z
      .string()
      .min(1)
      .regex(/^[A-Za-z0-9\-_]+$/),
    vaultSecretId: z.string().uuid().nullish(),
  })
  .strict();
const ApiKeyAuthConfig = z
  .object({
    type: z.literal("api_key"),
    headerName: z
      .string()
      .min(1)
      .regex(/^[A-Za-z0-9\-_]+$/),
    vaultSecretId: z.string().uuid().nullish(),
  })
  .strict();
const MonitorAuthConfig = z.discriminatedUnion("type", [
  BearerAuthConfig,
  BasicAuthConfig,
  HeaderAuthConfig,
  ApiKeyAuthConfig,
]);
const TriggerRule = z
  .object({
    type: z.enum([
      "consecutive_failures",
      "failures_in_window",
      "response_time",
    ]),
    count: z.number().int().nullish(),
    windowMinutes: z.number().int().nullish(),
    scope: z.enum(["per_region", "any_region"]).nullable(),
    thresholdMs: z.number().int().nullish(),
    severity: z.enum(["down", "degraded"]),
    aggregationType: z.enum(["all_exceed", "average", "p95", "max"]).nullish(),
  })
  .strict();
const ConfirmationPolicy = z
  .object({
    type: z.literal("multi_region"),
    minRegionsFailing: z.number().int(),
    maxWaitSeconds: z.number().int(),
  })
  .strict();
const RecoveryPolicy = z
  .object({
    consecutiveSuccesses: z.number().int(),
    minRegionsPassing: z.number().int(),
    cooldownMinutes: z.number().int(),
  })
  .strict();
const UpdateIncidentPolicyRequest = z
  .object({
    triggerRules: z.array(TriggerRule).min(1),
    confirmation: ConfirmationPolicy,
    recovery: RecoveryPolicy,
  })
  .strict();
const NewTagRequest = z
  .object({
    name: z.string().min(0).max(100),
    color: z
      .string()
      .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/)
      .nullish(),
  })
  .strict();
const AddMonitorTagsRequest = z
  .object({
    tagIds: z.array(z.string().uuid()).nullable(),
    newTags: z.array(NewTagRequest).nullable(),
  })
  .partial()
  .strict();
const CreateMonitorRequest = z
  .object({
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
  })
  .strict();
const UpdateMonitorRequest = z
  .object({
    name: z.string().min(0).max(255).nullable(),
    config: z
      .union([
        DnsMonitorConfig,
        HeartbeatMonitorConfig,
        HttpMonitorConfig,
        IcmpMonitorConfig,
        McpServerMonitorConfig,
        TcpMonitorConfig,
      ])
      .nullable(),
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
  .partial()
  .strict();
const RemoveMonitorTagsRequest = z
  .object({ tagIds: z.array(z.string().uuid()).min(1) })
  .strict();
const SetAlertChannelsRequest = z
  .object({ channelIds: z.array(z.string().uuid()) })
  .strict();
const UpdateAssertionRequest = z
  .object({
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
  })
  .strict();
const UpdateMonitorAuthRequest = z
  .object({
    config: z.discriminatedUnion("type", [ApiKeyAuthConfig, BasicAuthConfig, BearerAuthConfig, HeaderAuthConfig]),
  })
  .strict();
const SetMonitorAuthRequest = z
  .object({
    config: z.discriminatedUnion("type", [ApiKeyAuthConfig, BasicAuthConfig, BearerAuthConfig, HeaderAuthConfig]),
  })
  .strict();
const BulkMonitorActionRequest = z
  .object({
    monitorIds: z.array(z.string().uuid()).max(200),
    action: z.enum(["PAUSE", "RESUME", "DELETE", "ADD_TAG", "REMOVE_TAG"]),
    tagIds: z.array(z.string().uuid()).nullish(),
    newTags: z.array(NewTagRequest).nullish(),
  })
  .strict();
const MonitorTestRequest = z
  .object({
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
  })
  .strict();
const MatchRule = z
  .object({
    type: z.enum([
      "severity_gte",
      "monitor_id_in",
      "region_in",
      "incident_status",
      "monitor_type_in",
      "service_id_in",
      "resource_group_id_in",
      "component_name_in",
    ]),
    value: z.string().nullish(),
    monitorIds: z.array(z.string().uuid()).nullish(),
    regions: z.array(z.string()).nullish(),
    values: z.array(z.string()).nullish(),
  })
  .strict();
const EscalationStep = z
  .object({
    delayMinutes: z.number().int().gte(0),
    channelIds: z.array(z.string().uuid()).min(1),
    requireAck: z.boolean().nullish(),
    repeatIntervalSeconds: z.number().int().gte(1).nullish(),
  })
  .strict();
const EscalationChain = z
  .object({
    steps: z.array(EscalationStep).min(1),
    onResolve: z.string().nullish(),
    onReopen: z.string().nullish(),
  })
  .strict();
const CreateNotificationPolicyRequest = z
  .object({
    name: z.string().min(0).max(255),
    matchRules: z.array(MatchRule).nullish(),
    escalation: EscalationChain,
    enabled: z.boolean().nullish().default(true),
    priority: z.number().int().nullish().default(0),
  })
  .strict();
const UpdateNotificationPolicyRequest = z
  .object({
    name: z.string().min(0).max(255).nullable(),
    matchRules: z.array(MatchRule).nullable(),
    escalation: EscalationChain.nullable(),
    enabled: z.boolean().nullable(),
    priority: z.number().int().nullable(),
  })
  .partial()
  .strict();
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
  .partial()
  .strict();
const UpdateOrgDetailsRequest = z
  .object({
    name: z.string().min(0).max(200),
    email: z.string().min(1).email(),
    size: z.string().min(0).max(50).nullish(),
    industry: z.string().min(0).max(100).nullish(),
    websiteUrl: z.string().min(0).max(255).nullish(),
  })
  .strict();
const RetryStrategy = z
  .object({
    type: z.string(),
    maxRetries: z.number().int(),
    interval: z.number().int(),
  })
  .strict();
const CreateResourceGroupRequest = z
  .object({
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
  })
  .strict();
const UpdateResourceGroupRequest = z
  .object({
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
  })
  .strict();
const AddResourceGroupMemberRequest = z
  .object({
    memberType: z
      .string()
      .min(1)
      .regex(/monitor|service/),
    memberId: z.string().uuid(),
  })
  .strict();
const CreateSecretRequest = z
  .object({
    key: z.string().min(0).max(255),
    value: z.string().min(0).max(32768),
  })
  .strict();
const UpdateSecretRequest = z
  .object({ value: z.string().min(0).max(32768) })
  .strict();
const UpdateAlertSensitivityRequest = z
  .object({
    alertSensitivity: z
      .string()
      .min(1)
      .regex(/ALL|INCIDENTS_ONLY|MAJOR_ONLY/),
  })
  .strict();
const ServiceSubscribeRequest = z
  .object({
    componentId: z.string().uuid().nullable(),
    alertSensitivity: z.string().nullable(),
  })
  .partial()
  .strict();
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
  .partial()
  .strict();
const CreateStatusPageRequest = z
  .object({
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
  })
  .strict();
const UpdateStatusPageRequest = z
  .object({
    name: z.string().min(0).max(255).nullable(),
    description: z.string().min(0).max(500).nullable(),
    branding: StatusPageBranding.nullable(),
    visibility: z.enum(["PUBLIC", "PASSWORD", "IP_RESTRICTED"]).nullable(),
    enabled: z.boolean().nullable(),
    incidentMode: z.enum(["MANUAL", "REVIEW", "AUTOMATIC"]).nullable(),
  })
  .partial()
  .strict();
const CreateStatusPageComponentRequest = z
  .object({
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
  })
  .strict();
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
  .partial()
  .strict();
const ComponentPosition = z
  .object({
    componentId: z.string().uuid(),
    displayOrder: z.number().int(),
    groupId: z.string().uuid().nullish(),
  })
  .strict();
const ReorderComponentsRequest = z
  .object({ positions: z.array(ComponentPosition).min(1) })
  .strict();
const AddCustomDomainRequest = z
  .object({
    hostname: z
      .string()
      .min(0)
      .max(255)
      .regex(
        /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/
      ),
  })
  .strict();
const CreateStatusPageComponentGroupRequest = z
  .object({
    name: z.string().min(0).max(255),
    description: z.string().min(0).max(500).nullish(),
    displayOrder: z.number().int().nullish(),
    collapsed: z.boolean().nullish(),
  })
  .strict();
const UpdateStatusPageComponentGroupRequest = z
  .object({
    name: z.string().min(0).max(255).nullable(),
    description: z.string().min(0).max(500).nullable(),
    displayOrder: z.number().int().nullable(),
    collapsed: z.boolean().nullable(),
  })
  .partial()
  .strict();
const AffectedComponent = z
  .object({
    componentId: z.string().uuid(),
    status: z.enum([
      "OPERATIONAL",
      "DEGRADED_PERFORMANCE",
      "PARTIAL_OUTAGE",
      "MAJOR_OUTAGE",
      "UNDER_MAINTENANCE",
    ]),
  })
  .strict();
const CreateStatusPageIncidentRequest = z
  .object({
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
  })
  .strict();
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
  .partial()
  .strict();
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
  .partial()
  .strict();
const CreateStatusPageIncidentUpdateRequest = z
  .object({
    status: z.enum(["INVESTIGATING", "IDENTIFIED", "MONITORING", "RESOLVED"]),
    body: z.string().min(1),
    notifySubscribers: z.boolean().nullish(),
    affectedComponents: z.array(AffectedComponent).nullish(),
  })
  .strict();
const PageSection = z
  .object({
    groupId: z.string().uuid().nullish(),
    componentId: z.string().uuid().nullish(),
    pageOrder: z.number().int(),
  })
  .strict();
const GroupComponentOrder = z
  .object({
    groupId: z.string().uuid(),
    positions: z.array(ComponentPosition).min(1),
  })
  .strict();
const ReorderPageLayoutRequest = z
  .object({
    sections: z.array(PageSection).min(1),
    groupOrders: z.array(GroupComponentOrder).nullish(),
  })
  .strict();
const AdminAddSubscriberRequest = z
  .object({ email: z.string().min(1).email() })
  .strict();
const CreateTagRequest = z
  .object({
    name: z.string().min(0).max(100),
    color: z
      .string()
      .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/)
      .nullish(),
  })
  .strict();
const UpdateTagRequest = z
  .object({
    name: z.string().min(0).max(100).nullable(),
    color: z
      .string()
      .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/)
      .nullable(),
  })
  .partial()
  .strict();
const CreateWebhookEndpointRequest = z
  .object({
    url: z.string().min(0).max(2048),
    description: z.string().min(0).max(255).nullish(),
    subscribedEvents: z
      .array(
        z.enum([
          "monitor.created",
          "monitor.updated",
          "monitor.deleted",
          "incident.created",
          "incident.resolved",
          "incident.reopened",
          "service.status_changed",
          "service.component_changed",
          "service.incident_created",
          "service.incident_updated",
          "service.incident_resolved",
        ])
      )
      .min(1),
  })
  .strict();
const UpdateWebhookEndpointRequest = z
  .object({
    url: z.string().min(0).max(2048).nullable(),
    description: z.string().min(0).max(255).nullable(),
    subscribedEvents: z
      .array(
        z.enum([
          "monitor.created",
          "monitor.updated",
          "monitor.deleted",
          "incident.created",
          "incident.resolved",
          "incident.reopened",
          "service.status_changed",
          "service.component_changed",
          "service.incident_created",
          "service.incident_updated",
          "service.incident_resolved",
        ])
      )
      .nullable(),
    enabled: z.boolean().nullable(),
  })
  .partial()
  .strict();
const TestWebhookEndpointRequest = z
  .object({ eventType: z.string().nullable() })
  .partial()
  .strict();
const CreateWorkspaceRequest = z.object({ name: z.string().min(1) }).strict();
const UpdateWorkspaceRequest = z
  .object({ name: z.string().min(0).max(200) })
  .strict();

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

