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
    code: z.string(),
    message: z.string(),
    timestamp: z.number().int(),
    requestId: z.string().nullish(),
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
    isDefault: z.boolean().nullish(),
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
    managedBy: z.enum(["DASHBOARD", "CLI", "TERRAFORM", "MCP", "API"]),
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
    managedBy: z
      .enum(["DASHBOARD", "CLI", "TERRAFORM", "MCP", "API"])
      .nullable(),
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
      "monitor_tag_in",
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
    defaultOpen: z.boolean().nullish(),
  })
  .strict();
const UpdateStatusPageComponentGroupRequest = z
  .object({
    name: z.string().min(0).max(255).nullable(),
    description: z.string().min(0).max(500).nullable(),
    displayOrder: z.number().int().nullable(),
    defaultOpen: z.boolean().nullable(),
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
const AlertChannelDisplayConfig = z
  .object({
    recipients: z.array(z.string()).nullable(),
    region: z.string().nullable(),
    severityOverride: z.string().nullable(),
    mentionRoleId: z.string().nullable(),
    customHeaders: z.record(z.string().nullable()).nullable(),
  })
  .partial()
  .strict();
const AlertChannelDto = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    channelType: z.enum([
      "email",
      "webhook",
      "slack",
      "pagerduty",
      "opsgenie",
      "teams",
      "discord",
    ]),
    displayConfig: AlertChannelDisplayConfig.nullish(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
    configHash: z.string().nullish(),
    lastDeliveryAt: z.string().datetime({ offset: true }).nullish(),
    lastDeliveryStatus: z.string().nullish(),
  })
  .strict();
const AlertDeliveryDto = z
  .object({
    id: z.string().uuid(),
    incidentId: z.string().uuid(),
    dispatchId: z.string().uuid().nullish(),
    channelId: z.string().uuid(),
    channel: z.string(),
    channelType: z.string(),
    status: z.enum([
      "PENDING",
      "DELIVERED",
      "RETRY_PENDING",
      "FAILED",
      "CANCELLED",
    ]),
    eventType: z.enum([
      "INCIDENT_CREATED",
      "INCIDENT_RESOLVED",
      "INCIDENT_REOPENED",
    ]),
    stepNumber: z.number().int(),
    fireCount: z.number().int(),
    attemptCount: z.number().int(),
    lastAttemptAt: z.string().datetime({ offset: true }).nullish(),
    nextRetryAt: z.string().datetime({ offset: true }).nullish(),
    deliveredAt: z.string().datetime({ offset: true }).nullish(),
    errorMessage: z.string().nullish(),
    createdAt: z.string().datetime({ offset: true }),
  })
  .strict();
const ApiKeyCreateResponse = z
  .object({
    id: z.number().int(),
    name: z.string().min(1),
    key: z.string().min(1),
    createdAt: z.string().datetime({ offset: true }),
    expiresAt: z.string().datetime({ offset: true }).nullish(),
  })
  .strict();
const ApiKeyDto = z
  .object({
    id: z.number().int(),
    name: z.string().min(1),
    key: z.string().min(1),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
    lastUsedAt: z.string().datetime({ offset: true }).nullish(),
    revokedAt: z.string().datetime({ offset: true }).nullish(),
    expiresAt: z.string().datetime({ offset: true }).nullish(),
  })
  .strict();
const AssertionResultDto = z
  .object({
    type: z.string(),
    passed: z.boolean(),
    severity: z.enum(["fail", "warn"]),
    message: z.string().nullish(),
    expected: z.string().nullish(),
    actual: z.string().nullish(),
  })
  .strict();
const AssertionTestResultDto = z
  .object({
    assertionType: z.enum([
      "status_code",
      "response_time",
      "body_contains",
      "json_path",
      "header_value",
      "regex_body",
      "dns_resolves",
      "dns_response_time",
      "dns_expected_ips",
      "dns_expected_cname",
      "dns_record_contains",
      "dns_record_equals",
      "dns_txt_contains",
      "dns_min_answers",
      "dns_max_answers",
      "dns_response_time_warn",
      "dns_ttl_low",
      "dns_ttl_high",
      "mcp_connects",
      "mcp_response_time",
      "mcp_has_capability",
      "mcp_tool_available",
      "mcp_min_tools",
      "mcp_protocol_version",
      "mcp_response_time_warn",
      "mcp_tool_count_changed",
      "ssl_expiry",
      "response_size",
      "redirect_count",
      "redirect_target",
      "response_time_warn",
      "tcp_connects",
      "tcp_response_time",
      "tcp_response_time_warn",
      "icmp_reachable",
      "icmp_response_time",
      "icmp_response_time_warn",
      "icmp_packet_loss",
      "heartbeat_received",
      "heartbeat_max_interval",
      "heartbeat_interval_drift",
      "heartbeat_payload_contains",
    ]),
    passed: z.boolean(),
    severity: z.enum(["fail", "warn"]),
    message: z.string(),
    expected: z.string().nullish(),
    actual: z.string().nullish(),
  })
  .strict();
const MemberRoleChangedMetadata = z
  .object({
    kind: z.literal("member_role_changed"),
    oldRole: z.enum(["OWNER", "ADMIN", "MEMBER"]),
    newRole: z.enum(["OWNER", "ADMIN", "MEMBER"]),
  })
  .strict();
const AuditMetadata = MemberRoleChangedMetadata;
const AuditEventDto = z
  .object({
    id: z.number().int(),
    actorId: z.number().int().nullish(),
    actorEmail: z.string().nullish(),
    action: z.string(),
    resourceType: z.string().nullish(),
    resourceId: z.string().nullish(),
    resourceName: z.string().nullish(),
    metadata: AuditMetadata.nullish(),
    createdAt: z.string().datetime({ offset: true }),
  })
  .strict();
const KeyInfo = z
  .object({
    id: z.number().int(),
    name: z.string(),
    createdAt: z.string().datetime({ offset: true }),
    expiresAt: z.string().datetime({ offset: true }).nullish(),
    lastUsedAt: z.string().datetime({ offset: true }).nullish(),
  })
  .strict();
const OrgInfo = z.object({ id: z.number().int(), name: z.string() }).strict();
const EntitlementDto = z
  .object({
    key: z.string(),
    value: z.number().int(),
    defaultValue: z.number().int(),
    overridden: z.boolean(),
  })
  .strict();
const PlanInfo = z
  .object({
    tier: z.enum(["FREE", "STARTER", "PRO", "TEAM", "BUSINESS", "ENTERPRISE"]),
    subscriptionStatus: z.string().nullish(),
    trialActive: z.boolean(),
    trialExpiresAt: z.string().datetime({ offset: true }).nullish(),
    entitlements: z.record(EntitlementDto),
    usage: z.record(z.number().int()),
  })
  .strict();
const RateLimitInfo = z
  .object({
    requestsPerMinute: z.number().int(),
    remaining: z.number().int(),
    windowMs: z.number().int(),
  })
  .strict();
const AuthMeResponse = z
  .object({
    key: KeyInfo,
    organization: OrgInfo,
    plan: PlanInfo,
    rateLimits: RateLimitInfo,
  })
  .strict();
const IncidentRef = z
  .object({ id: z.string().uuid(), title: z.string(), impact: z.string() })
  .strict();
const ComponentUptimeDayDto = z
  .object({
    date: z.string().datetime({ offset: true }),
    partialOutageSeconds: z.number().int(),
    majorOutageSeconds: z.number().int(),
    degradedSeconds: z.number().int(),
    uptimePercentage: z.number(),
    incidents: z.array(IncidentRef).nullish(),
  })
  .strict();
const BatchComponentUptimeDto = z
  .object({ components: z.record(z.array(ComponentUptimeDayDto)) })
  .strict();
const FailureDetail = z
  .object({ monitorId: z.string().uuid(), reason: z.string() })
  .strict();
const BulkMonitorActionResult = z
  .object({
    succeeded: z.array(z.string().uuid()),
    failed: z.array(FailureDetail),
  })
  .strict();
const CategoryDto = z
  .object({ category: z.string(), serviceCount: z.number().int() })
  .strict();
const ChartBucketDto = z
  .object({
    bucket: z.string().datetime({ offset: true }),
    uptimePercent: z.number().nullish(),
    avgLatencyMs: z.number().nullish(),
    p95LatencyMs: z.number().nullish(),
    p99LatencyMs: z.number().nullish(),
  })
  .strict();
const TlsInfoDto = z
  .object({
    subjectCn: z.string().nullable(),
    subjectSan: z.array(z.string()).nullable(),
    issuerCn: z.string().nullable(),
    issuerOrg: z.string().nullable(),
    notBefore: z.string().nullable(),
    notAfter: z.string().nullable(),
    serialNumber: z.string().nullable(),
    tlsVersion: z.string().nullable(),
    cipherSuite: z.string().nullable(),
    chainValid: z.boolean().nullable(),
  })
  .partial()
  .strict();
const TimingPhasesDto = z
  .object({
    dns_ms: z.number().int().nullable(),
    tcp_ms: z.number().int().nullable(),
    tls_ms: z.number().int().nullable(),
    ttfb_ms: z.number().int().nullable(),
    download_ms: z.number().int().nullable(),
    total_ms: z.number().int().nullable(),
  })
  .partial()
  .strict();
const Http = z
  .object({
    check_type: z.literal("http"),
    timing: TimingPhasesDto.nullish(),
    bodyTruncated: z.boolean().nullish(),
  })
  .strict();
const Tcp = z
  .object({
    check_type: z.literal("tcp"),
    host: z.string(),
    port: z.number().int(),
    connected: z.boolean(),
  })
  .strict();
const Icmp = z
  .object({
    check_type: z.literal("icmp"),
    host: z.string(),
    packetsSent: z.number().int().nullish(),
    packetsReceived: z.number().int().nullish(),
    packetLoss: z.number().nullish(),
    avgRttMs: z.number().nullish(),
    minRttMs: z.number().nullish(),
    maxRttMs: z.number().nullish(),
    jitterMs: z.number().nullish(),
  })
  .strict();
const Dns = z
  .object({
    check_type: z.literal("dns"),
    hostname: z.string().nullish(),
    requestedTypes: z.array(z.string().nullable()).nullish(),
    usedResolver: z.string().nullish(),
    records: z
      .record(
        z
          .array(
            z.record(z.object({}).partial().strict().nullable()).nullable()
          )
          .nullable()
      )
      .nullish(),
    attempts: z
      .array(z.record(z.object({}).partial().strict().nullable()).nullable())
      .nullish(),
    failureKind: z.string().nullish(),
  })
  .strict();
const McpServer = z
  .object({
    check_type: z.literal("mcp_server"),
    url: z.string().nullish(),
    protocolVersion: z.string().nullish(),
    serverInfo: z.record(z.object({}).partial().strict().nullable()).nullish(),
    toolCount: z.number().int().nullish(),
    resourceCount: z.number().int().nullish(),
    promptCount: z.number().int().nullish(),
  })
  .strict();
const CheckTypeDetailsDto = z.discriminatedUnion("check_type", [
  Http,
  Tcp,
  Icmp,
  Dns,
  McpServer,
]);
const CheckResultDetailsDto = z
  .object({
    statusCode: z.number().int().nullable(),
    responseHeaders: z
      .record(z.array(z.string().nullable()).nullable())
      .nullable(),
    responseBodySnapshot: z.string().nullable(),
    assertionResults: z.array(AssertionResultDto).nullable(),
    tlsInfo: TlsInfoDto.nullable(),
    redirectCount: z.number().int().nullable(),
    redirectTarget: z.string().nullable(),
    responseSizeBytes: z.number().int().nullable(),
    checkDetails: CheckTypeDetailsDto.nullable(),
  })
  .partial()
  .strict();
const CheckResultDto = z
  .object({
    id: z.string().uuid(),
    timestamp: z.string().datetime({ offset: true }),
    region: z.string(),
    responseTimeMs: z.number().int().nullish(),
    passed: z.boolean(),
    failureReason: z.string().nullish(),
    severityHint: z.string().nullish(),
    details: CheckResultDetailsDto.nullish(),
    checkId: z.string().uuid().nullish(),
  })
  .strict();
const RuleEvaluationDto = z
  .object({
    id: z.string().uuid(),
    occurredAt: z.string().datetime({ offset: true }),
    monitorId: z.string().uuid(),
    region: z.string().min(1),
    policySnapshotHashHex: z.string().min(1),
    ruleIndex: z.number().int(),
    ruleType: z.string().min(1),
    ruleScope: z.string().min(1),
    inputResultIds: z.array(z.string().uuid()).min(1),
    outputMatched: z.boolean(),
    evaluationDetails: z.record(z.object({}).partial().strict()),
    engineVersion: z.string().min(1),
    checkId: z.string().uuid(),
    triggeringTransitionId: z.string().uuid().nullish(),
  })
  .strict();
const StateTransitionDetails = z
  .object({ source: z.enum(["pipeline", "public-api"]) })
  .strict();
const IncidentStateTransitionDto = z
  .object({
    id: z.string().uuid(),
    occurredAt: z.string().datetime({ offset: true }),
    monitorId: z.string().uuid(),
    incidentId: z.string().uuid().nullish(),
    fromStatus: z.string().min(1),
    toStatus: z.string().min(1),
    reason: z.string().min(1),
    triggeringEvaluationIds: z.array(z.string().uuid()),
    affectedRegions: z.array(z.string()),
    policySnapshotHashHex: z.string().min(1),
    engineVersion: z.string().min(1),
    checkId: z.string().uuid(),
    details: StateTransitionDetails,
  })
  .strict();
const PolicySnapshotDto = z
  .object({
    hashHex: z.string().min(1),
    policy: z.record(z.object({}).partial().strict()),
    engineVersion: z.string().min(1),
    firstSeenAt: z.string().datetime({ offset: true }),
    lastSeenAt: z.string().datetime({ offset: true }),
  })
  .strict();
const CheckTraceDto = z
  .object({
    checkId: z.string().uuid(),
    evaluations: z.array(RuleEvaluationDto),
    transitions: z.array(IncidentStateTransitionDto),
    policySnapshot: PolicySnapshotDto.nullish(),
  })
  .strict();
const ComponentImpact = z
  .object({
    componentId: z.string().uuid(),
    componentName: z.string(),
    groupName: z.string().nullish(),
    uptimePercentage: z.number(),
    partialOutageSeconds: z.number().int(),
    majorOutageSeconds: z.number().int(),
  })
  .strict();
const ComponentsSummaryDto = z
  .object({
    totalCount: z.number().int(),
    includedCount: z.number().int(),
    groupComponentCounts: z.record(z.number().int()),
  })
  .strict();
const ComponentStatusDto = z
  .object({ id: z.string(), name: z.string(), status: z.string() })
  .strict();
const ComponentUptimeSummaryDto = z
  .object({
    day: z.number().nullish(),
    week: z.number().nullish(),
    month: z.number().nullish(),
    source: z.string(),
  })
  .strict();
const CursorPageCheckResultDto = z
  .object({
    data: z.array(CheckResultDto),
    nextCursor: z.string().nullish(),
    hasMore: z.boolean(),
  })
  .strict();
const ServiceCatalogDto = z
  .object({
    id: z.string().uuid(),
    slug: z.string(),
    name: z.string(),
    category: z.string().nullish(),
    officialStatusUrl: z.string().nullish(),
    developerContext: z.string().nullish(),
    logoUrl: z.string().nullish(),
    adapterType: z.string(),
    pollingIntervalSeconds: z.number().int(),
    enabled: z.boolean(),
    published: z.boolean(),
    overallStatus: z.string().nullish(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
    componentCount: z.number().int(),
    activeIncidentCount: z.number().int(),
    dataCompleteness: z.string(),
    uptime30d: z.number().nullish(),
  })
  .strict();
const CursorPageServiceCatalogDto = z
  .object({
    data: z.array(ServiceCatalogDto),
    nextCursor: z.string().nullish(),
    hasMore: z.boolean(),
  })
  .strict();
const ServicePollResultDto = z
  .object({
    serviceId: z.string().uuid(),
    timestamp: z.string().datetime({ offset: true }),
    overallStatus: z.string().nullish(),
    responseTimeMs: z.number().int().nullish(),
    httpStatusCode: z.number().int().nullish(),
    passed: z.boolean(),
    failureReason: z.string().nullish(),
    componentCount: z.number().int(),
    degradedCount: z.number().int(),
  })
  .strict();
const CursorPageServicePollResultDto = z
  .object({
    data: z.array(ServicePollResultDto),
    nextCursor: z.string().nullish(),
    hasMore: z.boolean(),
  })
  .strict();
const MonitorsSummaryDto = z
  .object({
    total: z.number().int(),
    up: z.number().int(),
    down: z.number().int(),
    degraded: z.number().int(),
    paused: z.number().int(),
    avgUptime24h: z.number().nullish(),
    avgUptime30d: z.number().nullish(),
  })
  .strict();
const IncidentsSummaryDto = z
  .object({
    active: z.number().int(),
    resolvedToday: z.number().int(),
    mttr30d: z.number().nullish(),
  })
  .strict();
const DashboardOverviewDto = z
  .object({ monitors: MonitorsSummaryDto, incidents: IncidentsSummaryDto })
  .strict();
const DayIncident = z
  .object({
    id: z.string().uuid(),
    title: z.string(),
    status: z.enum(["INVESTIGATING", "IDENTIFIED", "MONITORING", "RESOLVED"]),
    impact: z.enum(["NONE", "MINOR", "MAJOR", "CRITICAL"]),
    scheduled: z.boolean(),
    startedAt: z.string().datetime({ offset: true }).nullish(),
    resolvedAt: z.string().datetime({ offset: true }).nullish(),
    affectedComponentNames: z.array(z.string()),
  })
  .strict();
const DekRotationResultDto = z
  .object({
    previousDekVersion: z.number().int(),
    newDekVersion: z.number().int(),
    secretsReEncrypted: z.number().int(),
    channelsReEncrypted: z.number().int(),
    rotatedAt: z.string().datetime({ offset: true }),
  })
  .strict();
const DeleteChannelResult = z
  .object({
    affectedPolicies: z.number().int(),
    disabledPolicies: z.number().int(),
  })
  .strict();
const DeliveryAttemptDto = z
  .object({
    id: z.string().uuid(),
    deliveryId: z.string().uuid(),
    attemptNumber: z.number().int(),
    status: z.string(),
    responseStatusCode: z.number().int().nullish(),
    requestPayload: z.string().nullish(),
    responseBody: z.string().nullish(),
    errorMessage: z.string().nullish(),
    responseTimeMs: z.number().int().nullish(),
    externalId: z.string().nullish(),
    requestHeaders: z.record(z.string().nullable()).nullish(),
    attemptedAt: z.string().datetime({ offset: true }),
  })
  .strict();
const DeployLockDto = z
  .object({
    id: z.string().uuid(),
    lockedBy: z.string().min(1),
    lockedAt: z.string().datetime({ offset: true }),
    expiresAt: z.string().datetime({ offset: true }),
  })
  .strict();
const EnvironmentDto = z
  .object({
    id: z.string().uuid(),
    orgId: z.number().int(),
    name: z.string().min(1),
    slug: z.string().min(1),
    variables: z.record(z.string()),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
    monitorCount: z.number().int(),
    isDefault: z.boolean(),
  })
  .strict();
const GlobalStatusSummaryDto = z
  .object({
    totalServices: z.number().int(),
    operationalCount: z.number().int(),
    degradedCount: z.number().int(),
    partialOutageCount: z.number().int(),
    majorOutageCount: z.number().int(),
    maintenanceCount: z.number().int(),
    unknownCount: z.number().int(),
    activeIncidentCount: z.number().int(),
    servicesWithIssues: z.array(ServiceCatalogDto),
  })
  .strict();
const HeartbeatPingResponse = z.object({ ok: z.boolean() }).strict();
const IncidentDto = z
  .object({
    id: z.string().uuid(),
    monitorId: z.string().uuid().nullish(),
    organizationId: z.number().int(),
    source: z.enum([
      "AUTOMATIC",
      "MANUAL",
      "MONITORS",
      "STATUS_DATA",
      "RESOURCE_GROUP",
    ]),
    status: z.enum(["WATCHING", "TRIGGERED", "CONFIRMED", "RESOLVED"]),
    severity: z.enum(["DOWN", "DEGRADED", "MAINTENANCE"]),
    title: z.string().nullish(),
    triggeredByRule: z.string().nullish(),
    affectedRegions: z.array(z.string()),
    reopenCount: z.number().int(),
    createdByUserId: z.number().int().nullish(),
    statusPageVisible: z.boolean(),
    serviceIncidentId: z.string().uuid().nullish(),
    serviceId: z.string().uuid().nullish(),
    externalRef: z.string().nullish(),
    affectedComponents: z.array(z.string()).nullish(),
    shortlink: z.string().nullish(),
    resolutionReason: z
      .enum(["MANUAL", "AUTO_RECOVERED", "AUTO_RESOLVED"])
      .nullish(),
    startedAt: z.string().datetime({ offset: true }).nullish(),
    confirmedAt: z.string().datetime({ offset: true }).nullish(),
    resolvedAt: z.string().datetime({ offset: true }).nullish(),
    cooldownUntil: z.string().datetime({ offset: true }).nullish(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
    monitorName: z.string().nullish(),
    serviceName: z.string().nullish(),
    serviceSlug: z.string().nullish(),
    monitorType: z.string().nullish(),
    resourceGroupId: z.string().uuid().nullish(),
    resourceGroupName: z.string().nullish(),
    triggeringCheckId: z.string().uuid().nullish(),
    triggeredByRuleSnapshotHashHex: z.string().nullish(),
    triggeredByRuleIndex: z.number().int().nullish(),
    engineVersion: z.string().nullish(),
  })
  .strict();
const IncidentUpdateDto = z
  .object({
    id: z.string().uuid(),
    incidentId: z.string().uuid(),
    oldStatus: z
      .enum(["WATCHING", "TRIGGERED", "CONFIRMED", "RESOLVED"])
      .nullish(),
    newStatus: z
      .enum(["WATCHING", "TRIGGERED", "CONFIRMED", "RESOLVED"])
      .nullish(),
    body: z.string().nullish(),
    createdBy: z.enum(["SYSTEM", "USER"]).nullish(),
    notifySubscribers: z.boolean(),
    createdAt: z.string().datetime({ offset: true }),
  })
  .strict();
const LinkedStatusPageIncidentDto = z
  .object({
    id: z.string().uuid(),
    statusPageId: z.string().uuid(),
    statusPageName: z.string(),
    statusPageSlug: z.string(),
    title: z.string(),
    status: z.enum(["INVESTIGATING", "IDENTIFIED", "MONITORING", "RESOLVED"]),
    impact: z.enum(["NONE", "MINOR", "MAJOR", "CRITICAL"]),
    scheduled: z.boolean(),
    publishedAt: z.string().datetime({ offset: true }).nullish(),
  })
  .strict();
const IncidentDetailDto = z
  .object({
    incident: IncidentDto,
    updates: z.array(IncidentUpdateDto),
    statusPageIncidents: z.array(LinkedStatusPageIncidentDto).nullish(),
  })
  .strict();
const IncidentFilterParams = z
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
const IncidentPolicyDto = z
  .object({
    id: z.string().uuid(),
    monitorId: z.string().uuid(),
    triggerRules: z.array(TriggerRule),
    confirmation: ConfirmationPolicy,
    recovery: RecoveryPolicy,
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
    monitorRegionCount: z.number().int().nullish(),
    checkFrequencySeconds: z.number().int().nullish(),
  })
  .strict();
const IncidentTimelineDto = z
  .object({
    transitions: z.array(IncidentStateTransitionDto),
    triggeringEvaluations: z.array(RuleEvaluationDto),
    policySnapshot: PolicySnapshotDto.nullish(),
  })
  .strict();
const IntegrationFieldDto = z
  .object({
    key: z.string(),
    label: z.string(),
    type: z.string(),
    required: z.boolean(),
    sensitive: z.boolean(),
    placeholder: z.string().nullish(),
    helpText: z.string().nullish(),
    options: z.array(z.string()).nullish(),
    default: z.string().nullish(),
  })
  .strict();
const IntegrationConfigSchemaDto = z
  .object({
    connectionFields: z.array(IntegrationFieldDto),
    channelFields: z.array(IntegrationFieldDto),
  })
  .strict();
const IntegrationDto = z
  .object({
    type: z.string(),
    name: z.string(),
    description: z.string(),
    logoUrl: z.string(),
    authType: z.string(),
    tierAvailability: z.enum([
      "FREE",
      "STARTER",
      "PRO",
      "TEAM",
      "BUSINESS",
      "ENTERPRISE",
    ]),
    lifecycle: z.string(),
    setupGuideUrl: z.string(),
    configSchema: IntegrationConfigSchemaDto,
  })
  .strict();
const InviteDto = z
  .object({
    inviteId: z.number().int(),
    email: z.string(),
    roleOffered: z.enum(["OWNER", "ADMIN", "MEMBER"]),
    expiresAt: z.string().datetime({ offset: true }),
    consumedAt: z.string().datetime({ offset: true }).nullish(),
    revokedAt: z.string().datetime({ offset: true }).nullish(),
  })
  .strict();
const MaintenanceComponentRef = z
  .object({ id: z.string().uuid(), name: z.string(), status: z.string() })
  .strict();
const MaintenanceUpdateDto = z
  .object({
    id: z.string().uuid(),
    status: z.string(),
    body: z.string().nullish(),
    displayAt: z.string().datetime({ offset: true }).nullish(),
  })
  .strict();
const MaintenanceWindowDto = z
  .object({
    id: z.string().uuid(),
    monitorId: z.string().uuid().nullish(),
    organizationId: z.number().int(),
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
    repeatRule: z.string().nullish(),
    reason: z.string().nullish(),
    suppressAlerts: z.boolean(),
    createdAt: z.string().datetime({ offset: true }),
  })
  .strict();
const MemberDto = z
  .object({
    userId: z.number().int(),
    email: z.string(),
    name: z.string().nullish(),
    orgRole: z.enum(["OWNER", "ADMIN", "MEMBER"]),
    status: z.enum([
      "INVITED",
      "ACTIVE",
      "SUSPENDED",
      "LEFT",
      "REMOVED",
      "DECLINED",
    ]),
    createdAt: z.string().datetime({ offset: true }),
  })
  .strict();
const MonitorAssertionDto = z
  .object({
    id: z.string().uuid(),
    monitorId: z.string().uuid(),
    assertionType: z.enum([
      "status_code",
      "response_time",
      "body_contains",
      "json_path",
      "header_value",
      "regex_body",
      "dns_resolves",
      "dns_response_time",
      "dns_expected_ips",
      "dns_expected_cname",
      "dns_record_contains",
      "dns_record_equals",
      "dns_txt_contains",
      "dns_min_answers",
      "dns_max_answers",
      "dns_response_time_warn",
      "dns_ttl_low",
      "dns_ttl_high",
      "mcp_connects",
      "mcp_response_time",
      "mcp_has_capability",
      "mcp_tool_available",
      "mcp_min_tools",
      "mcp_protocol_version",
      "mcp_response_time_warn",
      "mcp_tool_count_changed",
      "ssl_expiry",
      "response_size",
      "redirect_count",
      "redirect_target",
      "response_time_warn",
      "tcp_connects",
      "tcp_response_time",
      "tcp_response_time_warn",
      "icmp_reachable",
      "icmp_response_time",
      "icmp_response_time_warn",
      "icmp_packet_loss",
      "heartbeat_received",
      "heartbeat_max_interval",
      "heartbeat_interval_drift",
      "heartbeat_payload_contains",
    ]),
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
    severity: z.enum(["fail", "warn"]),
  })
  .strict();
const MonitorAuthDto = z
  .object({
    id: z.string().uuid(),
    monitorId: z.string().uuid(),
    authType: z.enum(["bearer", "basic", "header", "api_key"]),
    config: z.discriminatedUnion("type", [ApiKeyAuthConfig, BasicAuthConfig, BearerAuthConfig, HeaderAuthConfig]),
  })
  .strict();
const TagDto = z
  .object({
    id: z.string().uuid(),
    organizationId: z.number().int(),
    name: z.string().min(1),
    color: z.string().min(1),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();
const Summary = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1),
    slug: z.string().min(1),
  })
  .strict();
const MonitorDto = z
  .object({
    id: z.string().uuid(),
    organizationId: z.number().int(),
    name: z.string().min(1),
    type: z.enum(["HTTP", "DNS", "MCP_SERVER", "TCP", "ICMP", "HEARTBEAT"]),
    config: z.union([
      DnsMonitorConfig,
      HeartbeatMonitorConfig,
      HttpMonitorConfig,
      IcmpMonitorConfig,
      McpServerMonitorConfig,
      TcpMonitorConfig,
    ]),
    frequencySeconds: z.number().int(),
    enabled: z.boolean(),
    regions: z.array(z.string()),
    managedBy: z.enum(["DASHBOARD", "CLI", "TERRAFORM", "MCP", "API"]),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
    assertions: z.array(MonitorAssertionDto).nullish(),
    tags: z.array(TagDto).nullish(),
    pingUrl: z.string().nullish(),
    environment: Summary.nullish(),
    auth: MonitorAuthConfig.nullish(),
    incidentPolicy: IncidentPolicyDto.nullish(),
    alertChannelIds: z.array(z.string().uuid()).nullish(),
  })
  .strict();
const MonitorReference = z
  .object({ id: z.string().uuid(), name: z.string() })
  .strict();
const MonitorTestResultDto = z
  .object({
    passed: z.boolean(),
    error: z.string().nullish(),
    statusCode: z.number().int().nullish(),
    responseTimeMs: z.number().int().nullish(),
    responseHeaders: z
      .record(z.array(z.string().nullable()).nullable())
      .nullish(),
    bodyPreview: z.string().nullish(),
    responseSizeBytes: z.number().int().nullish(),
    redirectCount: z.number().int().nullish(),
    finalUrl: z.string().nullish(),
    assertionResults: z.array(AssertionTestResultDto),
    warnings: z.array(z.string()).nullish(),
  })
  .strict();
const MonitorVersionDto = z
  .object({
    id: z.string().uuid(),
    monitorId: z.string().uuid(),
    version: z.number().int(),
    snapshot: MonitorDto,
    changedById: z.number().int().nullish(),
    changedVia: z.enum(["API", "DASHBOARD", "CLI", "TERRAFORM"]),
    changeSummary: z.string().nullish(),
    createdAt: z.string().datetime({ offset: true }),
  })
  .strict();
const NotificationDispatchDto = z
  .object({
    id: z.string().uuid(),
    incidentId: z.string().uuid(),
    policyId: z.string().uuid(),
    policyName: z.string().nullish(),
    status: z.enum([
      "PENDING",
      "DISPATCHING",
      "DELIVERED",
      "ESCALATING",
      "ACKNOWLEDGED",
      "COMPLETED",
    ]),
    completionReason: z.enum(["EXHAUSTED", "RESOLVED", "NO_STEPS"]).nullish(),
    currentStep: z.number().int(),
    totalSteps: z.number().int().nullish(),
    acknowledgedAt: z.string().datetime({ offset: true }).nullish(),
    nextEscalationAt: z.string().datetime({ offset: true }).nullish(),
    lastNotifiedAt: z.string().datetime({ offset: true }).nullish(),
    deliveries: z.array(AlertDeliveryDto),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();
const NotificationDto = z
  .object({
    id: z.number().int(),
    type: z.string(),
    title: z.string(),
    body: z.string().nullish(),
    resourceType: z.string().nullish(),
    resourceId: z.string().nullish(),
    read: z.boolean(),
    createdAt: z.string().datetime({ offset: true }),
  })
  .strict();
const NotificationPolicyDto = z
  .object({
    id: z.string().uuid(),
    organizationId: z.number().int(),
    name: z.string().min(1),
    matchRules: z.array(MatchRule),
    escalation: EscalationChain,
    enabled: z.boolean(),
    priority: z.number().int(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();
const OrganizationDto = z
  .object({
    id: z.number().int(),
    name: z.string(),
    email: z.string().nullable(),
    size: z.string().nullish(),
    industry: z.string().nullish(),
    websiteUrl: z.string().nullish(),
  })
  .strict();
const Pageable = z
  .object({
    page: z.number().int().gte(0),
    size: z.number().int().gte(1),
    sort: z.array(z.string()),
  })
  .strict();
const PollChartBucketDto = z
  .object({
    bucket: z.string().datetime({ offset: true }),
    uptimePercent: z.number().nullish(),
    avgResponseTimeMs: z.number().nullish(),
    totalPolls: z.number().int(),
  })
  .strict();
const RegionStatusDto = z
  .object({
    region: z.string(),
    passed: z.boolean(),
    responseTimeMs: z.number().int().nullish(),
    timestamp: z.string().datetime({ offset: true }),
    severityHint: z.string().nullish(),
  })
  .strict();
const ResourceGroupHealthDto = z
  .object({
    status: z.enum(["operational", "maintenance", "degraded", "down"]),
    totalMembers: z.number().int(),
    operationalCount: z.number().int(),
    activeIncidents: z.number().int(),
    thresholdStatus: z.enum(["healthy", "degraded", "down"]).nullish(),
    failingCount: z.number().int().nullish(),
  })
  .strict();
const ResourceGroupMemberDto = z
  .object({
    id: z.string().uuid(),
    groupId: z.string().uuid(),
    memberType: z.string(),
    monitorId: z.string().uuid().nullish(),
    serviceId: z.string().uuid().nullish(),
    name: z.string().nullish(),
    slug: z.string().nullish(),
    subscriptionId: z.string().uuid().nullish(),
    status: z.enum(["operational", "maintenance", "degraded", "down"]),
    effectiveFrequency: z.string().nullish(),
    createdAt: z.string().datetime({ offset: true }),
    uptime24h: z.number().nullish(),
    chartData: z.array(z.number()).nullish(),
    avgLatencyMs: z.number().nullish(),
    p95LatencyMs: z.number().nullish(),
    lastCheckedAt: z.string().datetime({ offset: true }).nullish(),
    monitorType: z.string().nullish(),
    environmentName: z.string().nullish(),
  })
  .strict();
const ResourceGroupDto = z
  .object({
    id: z.string().uuid(),
    organizationId: z.number().int(),
    name: z.string().min(1),
    slug: z.string().min(1),
    description: z.string().nullish(),
    alertPolicyId: z.string().uuid().nullish(),
    defaultFrequency: z.number().int().nullish(),
    defaultRegions: z.array(z.string()).nullish(),
    defaultRetryStrategy: RetryStrategy.nullish(),
    defaultAlertChannels: z.array(z.string().uuid()).nullish(),
    defaultEnvironmentId: z.string().uuid().nullish(),
    healthThresholdType: z.enum(["COUNT", "PERCENTAGE"]).nullish(),
    healthThresholdValue: z.number().nullish(),
    suppressMemberAlerts: z.boolean(),
    confirmationDelaySeconds: z.number().int().nullish(),
    recoveryCooldownMinutes: z.number().int().nullish(),
    health: ResourceGroupHealthDto,
    members: z.array(ResourceGroupMemberDto).nullish(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();
const ResultSummaryDto = z
  .object({
    currentStatus: z.enum(["up", "degraded", "down", "unknown"]),
    latestPerRegion: z.array(RegionStatusDto),
    chartData: z.array(ChartBucketDto),
    uptime24h: z.number().nullish(),
    uptimeWindow: z.number().nullish(),
  })
  .strict();
const ScheduledMaintenanceDto = z
  .object({
    id: z.string().uuid(),
    externalId: z.string(),
    title: z.string(),
    status: z.string(),
    impact: z.string().nullish(),
    shortlink: z.string().nullish(),
    scheduledFor: z.string().datetime({ offset: true }).nullish(),
    scheduledUntil: z.string().datetime({ offset: true }).nullish(),
    startedAt: z.string().datetime({ offset: true }).nullish(),
    completedAt: z.string().datetime({ offset: true }).nullish(),
    affectedComponents: z.array(MaintenanceComponentRef),
    updates: z.array(MaintenanceUpdateDto),
  })
  .strict();
const SecretDto = z
  .object({
    id: z.string().uuid(),
    key: z.string(),
    dekVersion: z.number().int(),
    valueHash: z.string(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
    usedByMonitors: z.array(MonitorReference).nullish(),
  })
  .strict();
const SeoMetadataDto = z
  .object({
    shortDescription: z.string().nullable(),
    description: z.string().nullable(),
    about: z.string().nullable(),
  })
  .partial()
  .strict();
const ServiceComponentDto = z
  .object({
    id: z.string().uuid(),
    externalId: z.string(),
    name: z.string(),
    status: z.string(),
    description: z.string().nullish(),
    groupId: z.string().uuid().nullish(),
    position: z.number().int().nullish(),
    showcase: z.boolean(),
    onlyShowIfDegraded: z.boolean(),
    startDate: z.string().datetime({ offset: true }).nullish(),
    vendorCreatedAt: z.string().datetime({ offset: true }).nullish(),
    lifecycleStatus: z.string(),
    dataType: z.string(),
    hasUptime: z.boolean(),
    region: z.string().nullish(),
    groupName: z.string().nullish(),
    displayAggregatedUptime: z.boolean(),
    childCount: z.number().int().nullish(),
    uptime: ComponentUptimeSummaryDto.nullish(),
    statusChangedAt: z.string().datetime({ offset: true }).nullish(),
    firstSeenAt: z.string().datetime({ offset: true }),
    lastSeenAt: z.string().datetime({ offset: true }),
    isGroup: z.boolean(),
  })
  .strict();
const ServiceDayDetailDto = z
  .object({
    date: z.string(),
    overallUptimePercentage: z.number().nullish(),
    totalPartialOutageSeconds: z.number().int(),
    totalMajorOutageSeconds: z.number().int(),
    totalDegradedSeconds: z.number().int(),
    components: z.array(ComponentImpact),
    incidents: z.array(DayIncident),
  })
  .strict();
const ServiceStatusDto = z
  .object({
    overallStatus: z.string(),
    lastPolledAt: z.string().datetime({ offset: true }).nullish(),
  })
  .strict();
const ServiceIncidentDto = z
  .object({
    id: z.string().uuid(),
    serviceId: z.string().uuid(),
    serviceSlug: z.string().nullish(),
    serviceName: z.string().nullish(),
    externalId: z.string().nullish(),
    title: z.string(),
    status: z.string(),
    impact: z.string().nullish(),
    startedAt: z.string().datetime({ offset: true }).nullish(),
    resolvedAt: z.string().datetime({ offset: true }).nullish(),
    updatedAt: z.string().datetime({ offset: true }).nullish(),
    shortlink: z.string().nullish(),
    detectedAt: z.string().datetime({ offset: true }).nullish(),
    vendorCreatedAt: z.string().datetime({ offset: true }).nullish(),
  })
  .strict();
const ServiceDetailDto = z
  .object({
    id: z.string().uuid(),
    slug: z.string(),
    name: z.string(),
    category: z.string().nullish(),
    officialStatusUrl: z.string().nullish(),
    developerContext: z.string().nullish(),
    logoUrl: z.string().nullish(),
    adapterType: z.string(),
    pollingIntervalSeconds: z.number().int(),
    enabled: z.boolean(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
    currentStatus: ServiceStatusDto.nullish(),
    recentIncidents: z.array(ServiceIncidentDto),
    components: z.array(ServiceComponentDto),
    componentsSummary: ComponentsSummaryDto.nullish(),
    uptime: ComponentUptimeSummaryDto.nullish(),
    activeMaintenances: z.array(ScheduledMaintenanceDto),
    dataCompleteness: z.string(),
    seoMetadata: SeoMetadataDto.nullish(),
    relatedServices: z.array(ServiceCatalogDto).nullish(),
  })
  .strict();
const ServiceIncidentUpdateDto = z
  .object({
    status: z.string(),
    body: z.string().nullish(),
    displayAt: z.string().datetime({ offset: true }).nullish(),
  })
  .strict();
const ServiceIncidentDetailDto = z
  .object({
    id: z.string().uuid(),
    title: z.string(),
    status: z.string(),
    impact: z.string().nullish(),
    startedAt: z.string().datetime({ offset: true }).nullish(),
    resolvedAt: z.string().datetime({ offset: true }).nullish(),
    detectedAt: z.string().datetime({ offset: true }).nullish(),
    shortlink: z.string().nullish(),
    affectedComponents: z.array(z.string()).nullish(),
    updates: z.array(ServiceIncidentUpdateDto),
  })
  .strict();
const ServiceLiveStatusDto = z
  .object({
    overallStatus: z.string().nullish(),
    componentStatuses: z.array(ComponentStatusDto),
    activeIncidentCount: z.number().int(),
    lastPolledAt: z.string().nullish(),
  })
  .strict();
const ServicePollSummaryDto = z
  .object({
    uptimePercentage: z.number().nullish(),
    totalPolls: z.number().int(),
    passedPolls: z.number().int(),
    avgResponseTimeMs: z.number().nullish(),
    p95ResponseTimeMs: z.number().nullish(),
    window: z.string(),
    chartData: z.array(PollChartBucketDto),
  })
  .strict();
const ServiceSubscriptionDto = z
  .object({
    subscriptionId: z.string().uuid(),
    serviceId: z.string().uuid(),
    slug: z.string().min(1),
    name: z.string().min(1),
    category: z.string().nullish(),
    officialStatusUrl: z.string().nullish(),
    adapterType: z.string().min(1),
    pollingIntervalSeconds: z.number().int(),
    enabled: z.boolean(),
    logoUrl: z.string().nullish(),
    overallStatus: z.string().nullish(),
    componentId: z.string().uuid().nullish(),
    component: ServiceComponentDto.nullish(),
    alertSensitivity: z.enum(["ALL", "INCIDENTS_ONLY", "MAJOR_ONLY"]),
    subscribedAt: z.string().datetime({ offset: true }),
  })
  .strict();
const UptimeBucketDto = z
  .object({
    timestamp: z.string().datetime({ offset: true }),
    uptimePct: z.number().nullish(),
    totalPolls: z.number().int(),
  })
  .strict();
const ServiceUptimeResponse = z
  .object({
    overallUptimePct: z.number().nullish(),
    period: z.string(),
    granularity: z.string(),
    buckets: z.array(UptimeBucketDto),
    source: z.string().nullish(),
  })
  .strict();
const SingleValueResponseAlertChannelDto = z
  .object({ data: AlertChannelDto })
  .strict();
const SingleValueResponseAlertDeliveryDto = z
  .object({ data: AlertDeliveryDto })
  .strict();
const SingleValueResponseApiKeyCreateResponse = z
  .object({ data: ApiKeyCreateResponse })
  .strict();
const SingleValueResponseApiKeyDto = z.object({ data: ApiKeyDto }).strict();
const SingleValueResponseAuthMeResponse = z
  .object({ data: AuthMeResponse })
  .strict();
const SingleValueResponseBatchComponentUptimeDto = z
  .object({ data: BatchComponentUptimeDto })
  .strict();
const SingleValueResponseBulkMonitorActionResult = z
  .object({ data: BulkMonitorActionResult })
  .strict();
const SingleValueResponseCheckTraceDto = z
  .object({ data: CheckTraceDto })
  .strict();
const SingleValueResponseDashboardOverviewDto = z
  .object({ data: DashboardOverviewDto })
  .strict();
const SingleValueResponseDekRotationResultDto = z
  .object({ data: DekRotationResultDto })
  .strict();
const SingleValueResponseDeployLockDto = z
  .object({ data: DeployLockDto })
  .strict();
const SingleValueResponseEnvironmentDto = z
  .object({ data: EnvironmentDto })
  .strict();
const SingleValueResponseGlobalStatusSummaryDto = z
  .object({ data: GlobalStatusSummaryDto })
  .strict();
const SingleValueResponseIncidentDetailDto = z
  .object({ data: IncidentDetailDto })
  .strict();
const SingleValueResponseIncidentPolicyDto = z
  .object({ data: IncidentPolicyDto })
  .strict();
const SingleValueResponseIncidentTimelineDto = z
  .object({ data: IncidentTimelineDto })
  .strict();
const SingleValueResponseInviteDto = z.object({ data: InviteDto }).strict();
const SingleValueResponseListUUID = z
  .object({ data: z.array(z.string().uuid()) })
  .strict();
const SingleValueResponseLong = z.object({ data: z.number().int() }).strict();
const SingleValueResponseMaintenanceWindowDto = z
  .object({ data: MaintenanceWindowDto })
  .strict();
const SingleValueResponseMonitorAssertionDto = z
  .object({ data: MonitorAssertionDto })
  .strict();
const SingleValueResponseMonitorAuthDto = z
  .object({ data: MonitorAuthDto })
  .strict();
const SingleValueResponseMonitorDto = z.object({ data: MonitorDto }).strict();
const SingleValueResponseMonitorTestResultDto = z
  .object({ data: MonitorTestResultDto })
  .strict();
const SingleValueResponseMonitorVersionDto = z
  .object({ data: MonitorVersionDto })
  .strict();
const SingleValueResponseNotificationDispatchDto = z
  .object({ data: NotificationDispatchDto })
  .strict();
const SingleValueResponseNotificationPolicyDto = z
  .object({ data: NotificationPolicyDto })
  .strict();
const SingleValueResponseOrganizationDto = z
  .object({ data: OrganizationDto })
  .strict();
const SingleValueResponsePolicySnapshotDto = z
  .object({ data: PolicySnapshotDto.nullable() })
  .strict();
const SingleValueResponseResourceGroupDto = z
  .object({ data: ResourceGroupDto })
  .strict();
const SingleValueResponseResourceGroupHealthDto = z
  .object({ data: ResourceGroupHealthDto })
  .strict();
const SingleValueResponseResourceGroupMemberDto = z
  .object({ data: ResourceGroupMemberDto })
  .strict();
const SingleValueResponseResultSummaryDto = z
  .object({ data: ResultSummaryDto })
  .strict();
const SingleValueResponseSecretDto = z.object({ data: SecretDto }).strict();
const SingleValueResponseServiceDayDetailDto = z
  .object({ data: ServiceDayDetailDto })
  .strict();
const SingleValueResponseServiceDetailDto = z
  .object({ data: ServiceDetailDto })
  .strict();
const SingleValueResponseServiceIncidentDetailDto = z
  .object({ data: ServiceIncidentDetailDto })
  .strict();
const SingleValueResponseServiceLiveStatusDto = z
  .object({ data: ServiceLiveStatusDto })
  .strict();
const SingleValueResponseServicePollSummaryDto = z
  .object({ data: ServicePollSummaryDto })
  .strict();
const SingleValueResponseServiceSubscriptionDto = z
  .object({ data: ServiceSubscriptionDto })
  .strict();
const SingleValueResponseServiceUptimeResponse = z
  .object({ data: ServiceUptimeResponse })
  .strict();
const StatusPageComponentDto = z
  .object({
    id: z.string().uuid(),
    statusPageId: z.string().uuid(),
    groupId: z.string().uuid().nullish(),
    name: z.string().min(1),
    description: z.string().nullish(),
    type: z.enum(["MONITOR", "GROUP", "STATIC"]),
    monitorId: z.string().uuid().nullish(),
    resourceGroupId: z.string().uuid().nullish(),
    currentStatus: z.enum([
      "OPERATIONAL",
      "DEGRADED_PERFORMANCE",
      "PARTIAL_OUTAGE",
      "MAJOR_OUTAGE",
      "UNDER_MAINTENANCE",
    ]),
    showUptime: z.boolean(),
    displayOrder: z.number().int(),
    pageOrder: z.number().int(),
    excludeFromOverall: z.boolean(),
    startDate: z.string().datetime({ offset: true }).nullish(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();
const SingleValueResponseStatusPageComponentDto = z
  .object({ data: StatusPageComponentDto })
  .strict();
const StatusPageComponentGroupDto = z
  .object({
    id: z.string().uuid(),
    statusPageId: z.string().uuid(),
    name: z.string(),
    description: z.string().nullish(),
    displayOrder: z.number().int(),
    pageOrder: z.number().int(),
    defaultOpen: z.boolean(),
    components: z.array(StatusPageComponentDto).nullish(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();
const SingleValueResponseStatusPageComponentGroupDto = z
  .object({ data: StatusPageComponentGroupDto })
  .strict();
const StatusPageCustomDomainDto = z
  .object({
    id: z.string().uuid(),
    hostname: z.string(),
    status: z.enum([
      "PENDING_VERIFICATION",
      "VERIFICATION_FAILED",
      "VERIFIED",
      "SSL_PENDING",
      "ACTIVE",
      "FAILED",
      "REMOVED",
    ]),
    verificationMethod: z.enum(["CNAME", "TXT"]),
    verificationToken: z.string(),
    verificationCnameTarget: z.string(),
    verifiedAt: z.string().datetime({ offset: true }).nullish(),
    verificationError: z.string().nullish(),
    cfCustomHostnameId: z.string().nullish(),
    cfSslStatus: z.string().nullish(),
    sslActiveAt: z.string().datetime({ offset: true }).nullish(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
    primary: z.boolean(),
  })
  .strict();
const SingleValueResponseStatusPageCustomDomainDto = z
  .object({ data: StatusPageCustomDomainDto })
  .strict();
const StatusPageDto = z
  .object({
    id: z.string().uuid(),
    organizationId: z.number().int(),
    workspaceId: z.number().int(),
    name: z.string().min(1),
    slug: z.string().min(1),
    description: z.string().nullish(),
    branding: StatusPageBranding,
    visibility: z.enum(["PUBLIC", "PASSWORD", "IP_RESTRICTED"]),
    enabled: z.boolean(),
    incidentMode: z.enum(["MANUAL", "REVIEW", "AUTOMATIC"]),
    componentCount: z.number().int().nullish(),
    subscriberCount: z.number().int().nullish(),
    overallStatus: z
      .enum([
        "OPERATIONAL",
        "DEGRADED_PERFORMANCE",
        "PARTIAL_OUTAGE",
        "MAJOR_OUTAGE",
        "UNDER_MAINTENANCE",
      ])
      .nullish(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();
const SingleValueResponseStatusPageDto = z
  .object({ data: StatusPageDto })
  .strict();
const StatusPageIncidentComponentDto = z
  .object({
    statusPageComponentId: z.string().uuid(),
    componentStatus: z.enum([
      "OPERATIONAL",
      "DEGRADED_PERFORMANCE",
      "PARTIAL_OUTAGE",
      "MAJOR_OUTAGE",
      "UNDER_MAINTENANCE",
    ]),
    componentName: z.string(),
  })
  .strict();
const StatusPageIncidentUpdateDto = z
  .object({
    id: z.string().uuid(),
    status: z.enum(["INVESTIGATING", "IDENTIFIED", "MONITORING", "RESOLVED"]),
    body: z.string(),
    createdBy: z.enum(["USER", "SYSTEM"]).nullish(),
    createdByUserId: z.number().int().nullish(),
    notifySubscribers: z.boolean(),
    createdAt: z.string().datetime({ offset: true }),
  })
  .strict();
const StatusPageIncidentDto = z
  .object({
    id: z.string().uuid(),
    statusPageId: z.string().uuid(),
    title: z.string().min(1),
    status: z.enum(["INVESTIGATING", "IDENTIFIED", "MONITORING", "RESOLVED"]),
    impact: z.enum(["NONE", "MINOR", "MAJOR", "CRITICAL"]),
    scheduled: z.boolean(),
    scheduledFor: z.string().datetime({ offset: true }).nullish(),
    scheduledUntil: z.string().datetime({ offset: true }).nullish(),
    autoResolve: z.boolean(),
    incidentId: z.string().uuid().nullish(),
    startedAt: z.string().datetime({ offset: true }),
    publishedAt: z.string().datetime({ offset: true }).nullish(),
    resolvedAt: z.string().datetime({ offset: true }).nullish(),
    createdByUserId: z.number().int().nullish(),
    postmortemBody: z.string().nullish(),
    postmortemUrl: z.string().nullish(),
    affectedComponents: z.array(StatusPageIncidentComponentDto).nullish(),
    updates: z.array(StatusPageIncidentUpdateDto).nullish(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();
const SingleValueResponseStatusPageIncidentDto = z
  .object({ data: StatusPageIncidentDto })
  .strict();
const StatusPageSubscriberDto = z
  .object({
    id: z.string().uuid(),
    email: z.string(),
    confirmed: z.boolean(),
    createdAt: z.string().datetime({ offset: true }),
  })
  .strict();
const SingleValueResponseStatusPageSubscriberDto = z
  .object({ data: StatusPageSubscriberDto })
  .strict();
const SingleValueResponseString = z.object({ data: z.string() }).strict();
const SingleValueResponseTagDto = z.object({ data: TagDto }).strict();
const TestChannelResult = z
  .object({ success: z.boolean(), message: z.string() })
  .strict();
const SingleValueResponseTestChannelResult = z
  .object({ data: TestChannelResult })
  .strict();
const TestMatchResult = z
  .object({
    matched: z.boolean(),
    matchedRules: z.array(z.string()),
    unmatchedRules: z.array(z.string()),
  })
  .strict();
const SingleValueResponseTestMatchResult = z
  .object({ data: TestMatchResult })
  .strict();
const UptimeDto = z
  .object({
    uptimePercentage: z.number().nullish(),
    totalChecks: z.number().int(),
    passedChecks: z.number().int(),
    avgLatencyMs: z.number().nullish(),
    p95LatencyMs: z.number().nullish(),
  })
  .strict();
const SingleValueResponseUptimeDto = z.object({ data: UptimeDto }).strict();
const WebhookEndpointDto = z
  .object({
    id: z.string().uuid(),
    url: z.string(),
    description: z.string().nullish(),
    subscribedEvents: z.array(z.string()),
    enabled: z.boolean(),
    consecutiveFailures: z.number().int(),
    disabledReason: z.string().nullish(),
    disabledAt: z.string().datetime({ offset: true }).nullish(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();
const SingleValueResponseWebhookEndpointDto = z
  .object({ data: WebhookEndpointDto })
  .strict();
const WebhookSigningSecretDto = z
  .object({ configured: z.boolean(), maskedSecret: z.string().nullish() })
  .strict();
const SingleValueResponseWebhookSigningSecretDto = z
  .object({ data: WebhookSigningSecretDto })
  .strict();
const WebhookTestResult = z
  .object({
    success: z.boolean(),
    statusCode: z.number().int().nullish(),
    message: z.string(),
    durationMs: z.number().int().nullish(),
  })
  .strict();
const SingleValueResponseWebhookTestResult = z
  .object({ data: WebhookTestResult })
  .strict();
const WorkspaceDto = z
  .object({
    id: z.number().int(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
    name: z.string().min(1),
    orgId: z.number().int(),
  })
  .strict();
const SingleValueResponseWorkspaceDto = z
  .object({ data: WorkspaceDto })
  .strict();
const TableValueResultAlertChannelDto = z
  .object({
    data: z.array(AlertChannelDto),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
    totalElements: z.number().int().nullish(),
    totalPages: z.number().int().nullish(),
  })
  .strict();
const TableValueResultAlertDeliveryDto = z
  .object({
    data: z.array(AlertDeliveryDto),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
    totalElements: z.number().int().nullish(),
    totalPages: z.number().int().nullish(),
  })
  .strict();
const TableValueResultApiKeyDto = z
  .object({
    data: z.array(ApiKeyDto),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
    totalElements: z.number().int().nullish(),
    totalPages: z.number().int().nullish(),
  })
  .strict();
const TableValueResultAuditEventDto = z
  .object({
    data: z.array(AuditEventDto),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
    totalElements: z.number().int().nullish(),
    totalPages: z.number().int().nullish(),
  })
  .strict();
const TableValueResultCategoryDto = z
  .object({
    data: z.array(CategoryDto),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
    totalElements: z.number().int().nullish(),
    totalPages: z.number().int().nullish(),
  })
  .strict();
const TableValueResultComponentUptimeDayDto = z
  .object({
    data: z.array(ComponentUptimeDayDto),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
    totalElements: z.number().int().nullish(),
    totalPages: z.number().int().nullish(),
  })
  .strict();
const TableValueResultDeliveryAttemptDto = z
  .object({
    data: z.array(DeliveryAttemptDto),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
    totalElements: z.number().int().nullish(),
    totalPages: z.number().int().nullish(),
  })
  .strict();
const TableValueResultEnvironmentDto = z
  .object({
    data: z.array(EnvironmentDto),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
    totalElements: z.number().int().nullish(),
    totalPages: z.number().int().nullish(),
  })
  .strict();
const TableValueResultIncidentDto = z
  .object({
    data: z.array(IncidentDto),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
    totalElements: z.number().int().nullish(),
    totalPages: z.number().int().nullish(),
  })
  .strict();
const TableValueResultIncidentStateTransitionDto = z
  .object({
    data: z.array(IncidentStateTransitionDto),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
    totalElements: z.number().int().nullish(),
    totalPages: z.number().int().nullish(),
  })
  .strict();
const TableValueResultIntegrationDto = z
  .object({
    data: z.array(IntegrationDto),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
    totalElements: z.number().int().nullish(),
    totalPages: z.number().int().nullish(),
  })
  .strict();
const TableValueResultInviteDto = z
  .object({
    data: z.array(InviteDto),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
    totalElements: z.number().int().nullish(),
    totalPages: z.number().int().nullish(),
  })
  .strict();
const TableValueResultMaintenanceWindowDto = z
  .object({
    data: z.array(MaintenanceWindowDto),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
    totalElements: z.number().int().nullish(),
    totalPages: z.number().int().nullish(),
  })
  .strict();
const TableValueResultMemberDto = z
  .object({
    data: z.array(MemberDto),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
    totalElements: z.number().int().nullish(),
    totalPages: z.number().int().nullish(),
  })
  .strict();
const TableValueResultMonitorDto = z
  .object({
    data: z.array(MonitorDto),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
    totalElements: z.number().int().nullish(),
    totalPages: z.number().int().nullish(),
  })
  .strict();
const TableValueResultMonitorVersionDto = z
  .object({
    data: z.array(MonitorVersionDto),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
    totalElements: z.number().int().nullish(),
    totalPages: z.number().int().nullish(),
  })
  .strict();
const TableValueResultNotificationDispatchDto = z
  .object({
    data: z.array(NotificationDispatchDto),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
    totalElements: z.number().int().nullish(),
    totalPages: z.number().int().nullish(),
  })
  .strict();
const TableValueResultNotificationDto = z
  .object({
    data: z.array(NotificationDto),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
    totalElements: z.number().int().nullish(),
    totalPages: z.number().int().nullish(),
  })
  .strict();
const TableValueResultNotificationPolicyDto = z
  .object({
    data: z.array(NotificationPolicyDto),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
    totalElements: z.number().int().nullish(),
    totalPages: z.number().int().nullish(),
  })
  .strict();
const TableValueResultResourceGroupDto = z
  .object({
    data: z.array(ResourceGroupDto),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
    totalElements: z.number().int().nullish(),
    totalPages: z.number().int().nullish(),
  })
  .strict();
const TableValueResultRuleEvaluationDto = z
  .object({
    data: z.array(RuleEvaluationDto),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
    totalElements: z.number().int().nullish(),
    totalPages: z.number().int().nullish(),
  })
  .strict();
const TableValueResultScheduledMaintenanceDto = z
  .object({
    data: z.array(ScheduledMaintenanceDto),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
    totalElements: z.number().int().nullish(),
    totalPages: z.number().int().nullish(),
  })
  .strict();
const TableValueResultSecretDto = z
  .object({
    data: z.array(SecretDto),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
    totalElements: z.number().int().nullish(),
    totalPages: z.number().int().nullish(),
  })
  .strict();
const TableValueResultServiceComponentDto = z
  .object({
    data: z.array(ServiceComponentDto),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
    totalElements: z.number().int().nullish(),
    totalPages: z.number().int().nullish(),
  })
  .strict();
const TableValueResultServiceIncidentDto = z
  .object({
    data: z.array(ServiceIncidentDto),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
    totalElements: z.number().int().nullish(),
    totalPages: z.number().int().nullish(),
  })
  .strict();
const TableValueResultServiceSubscriptionDto = z
  .object({
    data: z.array(ServiceSubscriptionDto),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
    totalElements: z.number().int().nullish(),
    totalPages: z.number().int().nullish(),
  })
  .strict();
const TableValueResultStatusPageComponentDto = z
  .object({
    data: z.array(StatusPageComponentDto),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
    totalElements: z.number().int().nullish(),
    totalPages: z.number().int().nullish(),
  })
  .strict();
const TableValueResultStatusPageComponentGroupDto = z
  .object({
    data: z.array(StatusPageComponentGroupDto),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
    totalElements: z.number().int().nullish(),
    totalPages: z.number().int().nullish(),
  })
  .strict();
const TableValueResultStatusPageCustomDomainDto = z
  .object({
    data: z.array(StatusPageCustomDomainDto),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
    totalElements: z.number().int().nullish(),
    totalPages: z.number().int().nullish(),
  })
  .strict();
const TableValueResultStatusPageDto = z
  .object({
    data: z.array(StatusPageDto),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
    totalElements: z.number().int().nullish(),
    totalPages: z.number().int().nullish(),
  })
  .strict();
const TableValueResultStatusPageIncidentDto = z
  .object({
    data: z.array(StatusPageIncidentDto),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
    totalElements: z.number().int().nullish(),
    totalPages: z.number().int().nullish(),
  })
  .strict();
const TableValueResultStatusPageSubscriberDto = z
  .object({
    data: z.array(StatusPageSubscriberDto),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
    totalElements: z.number().int().nullish(),
    totalPages: z.number().int().nullish(),
  })
  .strict();
const TableValueResultTagDto = z
  .object({
    data: z.array(TagDto),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
    totalElements: z.number().int().nullish(),
    totalPages: z.number().int().nullish(),
  })
  .strict();
const WebhookDeliveryDto = z
  .object({
    id: z.string().uuid(),
    endpointId: z.string().uuid(),
    eventId: z.string(),
    eventType: z.string(),
    status: z.string(),
    attemptCount: z.number().int(),
    maxAttempts: z.number().int(),
    responseStatus: z.number().int().nullish(),
    responseLatencyMs: z.number().int().nullish(),
    errorMessage: z.string().nullish(),
    deliveredAt: z.string().datetime({ offset: true }).nullish(),
    failedAt: z.string().datetime({ offset: true }).nullish(),
    nextRetryAt: z.string().datetime({ offset: true }).nullish(),
    createdAt: z.string().datetime({ offset: true }),
  })
  .strict();
const TableValueResultWebhookDeliveryDto = z
  .object({
    data: z.array(WebhookDeliveryDto),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
    totalElements: z.number().int().nullish(),
    totalPages: z.number().int().nullish(),
  })
  .strict();
const TableValueResultWebhookEndpointDto = z
  .object({
    data: z.array(WebhookEndpointDto),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
    totalElements: z.number().int().nullish(),
    totalPages: z.number().int().nullish(),
  })
  .strict();
const TableValueResultWorkspaceDto = z
  .object({
    data: z.array(WorkspaceDto),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
    totalElements: z.number().int().nullish(),
    totalPages: z.number().int().nullish(),
  })
  .strict();
const WebhookEventCatalogEntry = z
  .object({ type: z.string(), surface: z.string(), description: z.string() })
  .strict();
const WebhookEventCatalogResponse = z
  .object({ data: z.array(WebhookEventCatalogEntry) })
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
  AlertChannelDisplayConfig,
  AlertChannelDto,
  AlertDeliveryDto,
  ApiKeyCreateResponse,
  ApiKeyDto,
  AssertionResultDto,
  AssertionTestResultDto,
  MemberRoleChangedMetadata,
  AuditMetadata,
  AuditEventDto,
  KeyInfo,
  OrgInfo,
  EntitlementDto,
  PlanInfo,
  RateLimitInfo,
  AuthMeResponse,
  IncidentRef,
  ComponentUptimeDayDto,
  BatchComponentUptimeDto,
  FailureDetail,
  BulkMonitorActionResult,
  CategoryDto,
  ChartBucketDto,
  TlsInfoDto,
  TimingPhasesDto,
  Http,
  Tcp,
  Icmp,
  Dns,
  McpServer,
  CheckTypeDetailsDto,
  CheckResultDetailsDto,
  CheckResultDto,
  RuleEvaluationDto,
  StateTransitionDetails,
  IncidentStateTransitionDto,
  PolicySnapshotDto,
  CheckTraceDto,
  ComponentImpact,
  ComponentsSummaryDto,
  ComponentStatusDto,
  ComponentUptimeSummaryDto,
  CursorPageCheckResultDto,
  ServiceCatalogDto,
  CursorPageServiceCatalogDto,
  ServicePollResultDto,
  CursorPageServicePollResultDto,
  MonitorsSummaryDto,
  IncidentsSummaryDto,
  DashboardOverviewDto,
  DayIncident,
  DekRotationResultDto,
  DeleteChannelResult,
  DeliveryAttemptDto,
  DeployLockDto,
  EnvironmentDto,
  GlobalStatusSummaryDto,
  HeartbeatPingResponse,
  IncidentDto,
  IncidentUpdateDto,
  LinkedStatusPageIncidentDto,
  IncidentDetailDto,
  IncidentFilterParams,
  IncidentPolicyDto,
  IncidentTimelineDto,
  IntegrationFieldDto,
  IntegrationConfigSchemaDto,
  IntegrationDto,
  InviteDto,
  MaintenanceComponentRef,
  MaintenanceUpdateDto,
  MaintenanceWindowDto,
  MemberDto,
  MonitorAssertionDto,
  MonitorAuthDto,
  TagDto,
  Summary,
  MonitorDto,
  MonitorReference,
  MonitorTestResultDto,
  MonitorVersionDto,
  NotificationDispatchDto,
  NotificationDto,
  NotificationPolicyDto,
  OrganizationDto,
  Pageable,
  PollChartBucketDto,
  RegionStatusDto,
  ResourceGroupHealthDto,
  ResourceGroupMemberDto,
  ResourceGroupDto,
  ResultSummaryDto,
  ScheduledMaintenanceDto,
  SecretDto,
  SeoMetadataDto,
  ServiceComponentDto,
  ServiceDayDetailDto,
  ServiceStatusDto,
  ServiceIncidentDto,
  ServiceDetailDto,
  ServiceIncidentUpdateDto,
  ServiceIncidentDetailDto,
  ServiceLiveStatusDto,
  ServicePollSummaryDto,
  ServiceSubscriptionDto,
  UptimeBucketDto,
  ServiceUptimeResponse,
  SingleValueResponseAlertChannelDto,
  SingleValueResponseAlertDeliveryDto,
  SingleValueResponseApiKeyCreateResponse,
  SingleValueResponseApiKeyDto,
  SingleValueResponseAuthMeResponse,
  SingleValueResponseBatchComponentUptimeDto,
  SingleValueResponseBulkMonitorActionResult,
  SingleValueResponseCheckTraceDto,
  SingleValueResponseDashboardOverviewDto,
  SingleValueResponseDekRotationResultDto,
  SingleValueResponseDeployLockDto,
  SingleValueResponseEnvironmentDto,
  SingleValueResponseGlobalStatusSummaryDto,
  SingleValueResponseIncidentDetailDto,
  SingleValueResponseIncidentPolicyDto,
  SingleValueResponseIncidentTimelineDto,
  SingleValueResponseInviteDto,
  SingleValueResponseListUUID,
  SingleValueResponseLong,
  SingleValueResponseMaintenanceWindowDto,
  SingleValueResponseMonitorAssertionDto,
  SingleValueResponseMonitorAuthDto,
  SingleValueResponseMonitorDto,
  SingleValueResponseMonitorTestResultDto,
  SingleValueResponseMonitorVersionDto,
  SingleValueResponseNotificationDispatchDto,
  SingleValueResponseNotificationPolicyDto,
  SingleValueResponseOrganizationDto,
  SingleValueResponsePolicySnapshotDto,
  SingleValueResponseResourceGroupDto,
  SingleValueResponseResourceGroupHealthDto,
  SingleValueResponseResourceGroupMemberDto,
  SingleValueResponseResultSummaryDto,
  SingleValueResponseSecretDto,
  SingleValueResponseServiceDayDetailDto,
  SingleValueResponseServiceDetailDto,
  SingleValueResponseServiceIncidentDetailDto,
  SingleValueResponseServiceLiveStatusDto,
  SingleValueResponseServicePollSummaryDto,
  SingleValueResponseServiceSubscriptionDto,
  SingleValueResponseServiceUptimeResponse,
  StatusPageComponentDto,
  SingleValueResponseStatusPageComponentDto,
  StatusPageComponentGroupDto,
  SingleValueResponseStatusPageComponentGroupDto,
  StatusPageCustomDomainDto,
  SingleValueResponseStatusPageCustomDomainDto,
  StatusPageDto,
  SingleValueResponseStatusPageDto,
  StatusPageIncidentComponentDto,
  StatusPageIncidentUpdateDto,
  StatusPageIncidentDto,
  SingleValueResponseStatusPageIncidentDto,
  StatusPageSubscriberDto,
  SingleValueResponseStatusPageSubscriberDto,
  SingleValueResponseString,
  SingleValueResponseTagDto,
  TestChannelResult,
  SingleValueResponseTestChannelResult,
  TestMatchResult,
  SingleValueResponseTestMatchResult,
  UptimeDto,
  SingleValueResponseUptimeDto,
  WebhookEndpointDto,
  SingleValueResponseWebhookEndpointDto,
  WebhookSigningSecretDto,
  SingleValueResponseWebhookSigningSecretDto,
  WebhookTestResult,
  SingleValueResponseWebhookTestResult,
  WorkspaceDto,
  SingleValueResponseWorkspaceDto,
  TableValueResultAlertChannelDto,
  TableValueResultAlertDeliveryDto,
  TableValueResultApiKeyDto,
  TableValueResultAuditEventDto,
  TableValueResultCategoryDto,
  TableValueResultComponentUptimeDayDto,
  TableValueResultDeliveryAttemptDto,
  TableValueResultEnvironmentDto,
  TableValueResultIncidentDto,
  TableValueResultIncidentStateTransitionDto,
  TableValueResultIntegrationDto,
  TableValueResultInviteDto,
  TableValueResultMaintenanceWindowDto,
  TableValueResultMemberDto,
  TableValueResultMonitorDto,
  TableValueResultMonitorVersionDto,
  TableValueResultNotificationDispatchDto,
  TableValueResultNotificationDto,
  TableValueResultNotificationPolicyDto,
  TableValueResultResourceGroupDto,
  TableValueResultRuleEvaluationDto,
  TableValueResultScheduledMaintenanceDto,
  TableValueResultSecretDto,
  TableValueResultServiceComponentDto,
  TableValueResultServiceIncidentDto,
  TableValueResultServiceSubscriptionDto,
  TableValueResultStatusPageComponentDto,
  TableValueResultStatusPageComponentGroupDto,
  TableValueResultStatusPageCustomDomainDto,
  TableValueResultStatusPageDto,
  TableValueResultStatusPageIncidentDto,
  TableValueResultStatusPageSubscriberDto,
  TableValueResultTagDto,
  WebhookDeliveryDto,
  TableValueResultWebhookDeliveryDto,
  TableValueResultWebhookEndpointDto,
  TableValueResultWorkspaceDto,
  WebhookEventCatalogEntry,
  WebhookEventCatalogResponse,
};

