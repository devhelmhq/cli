// @ts-nocheck
// Auto-generated Zod schemas from OpenAPI spec. DO NOT EDIT.
import { z } from "zod";

const pageable = z
  .object({
    page: z.number().int().gte(0),
    size: z.number().int().gte(1),
    sort: z.array(z.string()),
  })
  .passthrough();
const ChannelConfig = z.object({ channelType: z.string() }).passthrough();
const DiscordChannelConfig = ChannelConfig.and(
  z
    .object({
      webhookUrl: z.string().min(1),
      mentionRoleId: z.string().nullish(),
    })
    .passthrough()
);
const EmailChannelConfig = ChannelConfig.and(
  z.object({ recipients: z.array(z.string().email()).min(1) }).passthrough()
);
const OpsGenieChannelConfig = ChannelConfig.and(
  z
    .object({ apiKey: z.string().min(1), region: z.string().nullish() })
    .passthrough()
);
const PagerDutyChannelConfig = ChannelConfig.and(
  z
    .object({
      routingKey: z.string().min(1),
      severityOverride: z.string().nullish(),
    })
    .passthrough()
);
const SlackChannelConfig = ChannelConfig.and(
  z
    .object({
      webhookUrl: z.string().min(1),
      mentionText: z.string().nullish(),
    })
    .passthrough()
);
const TeamsChannelConfig = ChannelConfig.and(
  z.object({ webhookUrl: z.string().min(1) }).passthrough()
);
const WebhookChannelConfig = ChannelConfig.and(
  z
    .object({
      url: z.string().min(1),
      signingSecret: z.string().nullish(),
      customHeaders: z.record(z.string().nullable()).nullish(),
    })
    .passthrough()
);
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
  .passthrough();
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
  .passthrough();
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
  .passthrough();
const CreateApiKeyRequest = z
  .object({
    name: z.string().min(0).max(200),
    expiresAt: z.string().datetime({ offset: true }).nullish(),
  })
  .passthrough();
const UpdateApiKeyRequest = z
  .object({ name: z.string().min(0).max(200) })
  .passthrough();
const AcquireDeployLockRequest = z
  .object({
    lockedBy: z.string().min(1),
    ttlMinutes: z.number().int().nullish(),
  })
  .passthrough();
const CreateEnvironmentRequest = z
  .object({
    name: z.string().min(0).max(100),
    slug: z
      .string()
      .min(0)
      .max(100)
      .regex(/^[a-z0-9][a-z0-9_-]*$/),
    variables: z.record(z.string().nullable()).nullish(),
    isDefault: z.boolean().optional(),
  })
  .passthrough();
const UpdateEnvironmentRequest = z
  .object({
    name: z.string().min(0).max(100).nullable(),
    variables: z.record(z.string().nullable()).nullable(),
    isDefault: z.boolean().nullable(),
  })
  .partial()
  .passthrough();
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
  .passthrough();
const CreateManualIncidentRequest = z
  .object({
    title: z.string().min(1),
    severity: z.enum(["DOWN", "DEGRADED", "MAINTENANCE"]),
    monitorId: z.string().uuid().nullish(),
    body: z.string().nullish(),
  })
  .passthrough();
const ResolveIncidentRequest = z.object({ body: z.string() }).passthrough();
const AddIncidentUpdateRequest = z
  .object({
    body: z.string().nullish(),
    newStatus: z
      .enum(["WATCHING", "TRIGGERED", "CONFIRMED", "RESOLVED"])
      .nullish(),
    notifySubscribers: z.boolean(),
  })
  .passthrough();
const CreateInviteRequest = z
  .object({
    email: z.string().min(1).email(),
    roleOffered: z.enum(["OWNER", "ADMIN", "MEMBER"]),
  })
  .passthrough();
const CreateMaintenanceWindowRequest = z
  .object({
    monitorId: z.string().uuid().nullish(),
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
    repeatRule: z.string().min(0).max(100).nullish(),
    reason: z.string().nullish(),
    suppressAlerts: z.boolean().nullish(),
  })
  .passthrough();
const UpdateMaintenanceWindowRequest = z
  .object({
    monitorId: z.string().uuid().nullish(),
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
    repeatRule: z.string().min(0).max(100).nullish(),
    reason: z.string().nullish(),
    suppressAlerts: z.boolean().nullish(),
  })
  .passthrough();
const ChangeRoleRequest = z
  .object({ orgRole: z.enum(["OWNER", "ADMIN", "MEMBER"]) })
  .passthrough();
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
  .passthrough();
const MonitorConfig = z.object({}).partial().passthrough();
const DnsMonitorConfig = MonitorConfig.and(
  z
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
    .passthrough()
);
const HeartbeatMonitorConfig = MonitorConfig.and(
  z
    .object({
      expectedInterval: z.number().int().gte(1).lte(86400),
      gracePeriod: z.number().int().gte(1),
    })
    .passthrough()
);
const HttpMonitorConfig = MonitorConfig.and(
  z
    .object({
      url: z.string().min(1),
      method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]),
      customHeaders: z.record(z.string().nullable()).nullish(),
      requestBody: z.string().nullish(),
      contentType: z.string().nullish(),
      verifyTls: z.boolean().nullish(),
    })
    .passthrough()
);
const IcmpMonitorConfig = MonitorConfig.and(
  z
    .object({
      host: z.string().min(1),
      packetCount: z.number().int().gte(1).lte(20).nullish(),
      timeoutMs: z.number().int().nullish(),
    })
    .passthrough()
);
const McpServerMonitorConfig = MonitorConfig.and(
  z
    .object({
      command: z.string().min(1),
      args: z.array(z.string().nullable()).nullish(),
      env: z.record(z.string().nullable()).nullish(),
    })
    .passthrough()
);
const TcpMonitorConfig = MonitorConfig.and(
  z
    .object({
      host: z.string().min(1),
      port: z.number().int().gte(1).lte(65535),
      timeoutMs: z.number().int().nullish(),
    })
    .passthrough()
);
const AssertionConfig = z.object({ type: z.string() }).passthrough();
const BodyContainsAssertion = AssertionConfig.and(
  z.object({ substring: z.string().min(1) }).passthrough()
);
const DnsExpectedCnameAssertion = AssertionConfig.and(
  z.object({ value: z.string().min(1) }).passthrough()
);
const DnsExpectedIpsAssertion = AssertionConfig.and(
  z.object({ ips: z.array(z.string()).min(1) }).passthrough()
);
const DnsMaxAnswersAssertion = AssertionConfig.and(
  z
    .object({ recordType: z.string().min(1), max: z.number().int() })
    .passthrough()
);
const DnsMinAnswersAssertion = AssertionConfig.and(
  z
    .object({ recordType: z.string().min(1), min: z.number().int() })
    .passthrough()
);
const DnsRecordContainsAssertion = AssertionConfig.and(
  z
    .object({ recordType: z.string().min(1), substring: z.string().min(1) })
    .passthrough()
);
const DnsRecordEqualsAssertion = AssertionConfig.and(
  z
    .object({ recordType: z.string().min(1), value: z.string().min(1) })
    .passthrough()
);
const DnsResolvesAssertion = AssertionConfig;
const DnsResponseTimeAssertion = AssertionConfig.and(
  z.object({ maxMs: z.number().int() }).passthrough()
);
const DnsResponseTimeWarnAssertion = AssertionConfig.and(
  z.object({ warnMs: z.number().int() }).passthrough()
);
const DnsTtlHighAssertion = AssertionConfig.and(
  z.object({ maxTtl: z.number().int() }).passthrough()
);
const DnsTtlLowAssertion = AssertionConfig.and(
  z.object({ minTtl: z.number().int() }).passthrough()
);
const DnsTxtContainsAssertion = AssertionConfig.and(
  z.object({ substring: z.string().min(1) }).passthrough()
);
const HeaderValueAssertion = AssertionConfig.and(
  z
    .object({
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
    .passthrough()
);
const HeartbeatIntervalDriftAssertion = AssertionConfig.and(
  z
    .object({ maxDeviationPercent: z.number().int().gte(1).lte(100) })
    .passthrough()
);
const HeartbeatMaxIntervalAssertion = AssertionConfig.and(
  z.object({ maxSeconds: z.number().int().gte(1) }).passthrough()
);
const HeartbeatPayloadContainsAssertion = AssertionConfig.and(
  z.object({ path: z.string().min(1), value: z.string() }).passthrough()
);
const HeartbeatReceivedAssertion = AssertionConfig;
const IcmpPacketLossAssertion = AssertionConfig.and(
  z.object({ maxPercent: z.number().gte(0).lte(100) }).passthrough()
);
const IcmpReachableAssertion = AssertionConfig;
const IcmpResponseTimeAssertion = AssertionConfig.and(
  z.object({ maxMs: z.number().int() }).passthrough()
);
const IcmpResponseTimeWarnAssertion = AssertionConfig.and(
  z.object({ warnMs: z.number().int() }).passthrough()
);
const JsonPathAssertion = AssertionConfig.and(
  z
    .object({
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
    .passthrough()
);
const McpConnectsAssertion = AssertionConfig;
const McpHasCapabilityAssertion = AssertionConfig.and(
  z.object({ capability: z.string().min(1) }).passthrough()
);
const McpMinToolsAssertion = AssertionConfig.and(
  z.object({ min: z.number().int() }).passthrough()
);
const McpProtocolVersionAssertion = AssertionConfig.and(
  z.object({ version: z.string().min(1) }).passthrough()
);
const McpResponseTimeAssertion = AssertionConfig.and(
  z.object({ maxMs: z.number().int() }).passthrough()
);
const McpResponseTimeWarnAssertion = AssertionConfig.and(
  z.object({ warnMs: z.number().int() }).passthrough()
);
const McpToolAvailableAssertion = AssertionConfig.and(
  z.object({ toolName: z.string().min(1) }).passthrough()
);
const McpToolCountChangedAssertion = AssertionConfig.and(
  z.object({ expectedCount: z.number().int() }).passthrough()
);
const RedirectCountAssertion = AssertionConfig.and(
  z.object({ maxCount: z.number().int() }).passthrough()
);
const RedirectTargetAssertion = AssertionConfig.and(
  z
    .object({
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
    .passthrough()
);
const RegexBodyAssertion = AssertionConfig.and(
  z.object({ pattern: z.string().min(1) }).passthrough()
);
const ResponseSizeAssertion = AssertionConfig.and(
  z.object({ maxBytes: z.number().int() }).passthrough()
);
const ResponseTimeAssertion = AssertionConfig.and(
  z.object({ thresholdMs: z.number().int() }).passthrough()
);
const ResponseTimeWarnAssertion = AssertionConfig.and(
  z.object({ warnMs: z.number().int() }).passthrough()
);
const SslExpiryAssertion = AssertionConfig.and(
  z.object({ minDaysRemaining: z.number().int() }).passthrough()
);
const StatusCodeAssertion = AssertionConfig.and(
  z
    .object({
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
    .passthrough()
);
const TcpConnectsAssertion = AssertionConfig;
const TcpResponseTimeAssertion = AssertionConfig.and(
  z.object({ maxMs: z.number().int() }).passthrough()
);
const TcpResponseTimeWarnAssertion = AssertionConfig.and(
  z.object({ warnMs: z.number().int() }).passthrough()
);
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
    severity: z.enum(["fail", "warn"]),
  })
  .passthrough();
const MonitorAuthConfig = z.object({ type: z.string() }).passthrough();
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
  .passthrough();
const ConfirmationPolicy = z
  .object({
    type: z.literal("multi_region"),
    minRegionsFailing: z.number().int().optional(),
    maxWaitSeconds: z.number().int().optional(),
  })
  .passthrough();
const RecoveryPolicy = z
  .object({
    consecutiveSuccesses: z.number().int(),
    minRegionsPassing: z.number().int(),
    cooldownMinutes: z.number().int(),
  })
  .passthrough();
const UpdateIncidentPolicyRequest = z
  .object({
    triggerRules: z.array(TriggerRule).min(1),
    confirmation: ConfirmationPolicy,
    recovery: RecoveryPolicy,
  })
  .passthrough();
const NewTagRequest = z
  .object({
    name: z.string().min(0).max(100),
    color: z
      .string()
      .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/)
      .nullish(),
  })
  .passthrough();
const AddMonitorTagsRequest = z
  .object({
    tagIds: z.array(z.string().uuid()).nullable(),
    newTags: z.array(NewTagRequest).nullable(),
  })
  .partial()
  .passthrough();
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
  .passthrough();
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
  .partial()
  .passthrough();
const RemoveMonitorTagsRequest = z
  .object({ tagIds: z.array(z.string().uuid()).min(1) })
  .passthrough();
const SetAlertChannelsRequest = z
  .object({ channelIds: z.array(z.string().uuid()) })
  .passthrough();
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
  .passthrough();
const ApiKeyAuthConfig = MonitorAuthConfig.and(
  z
    .object({
      headerName: z
        .string()
        .min(1)
        .regex(/^[A-Za-z0-9\-_]+$/),
      vaultSecretId: z.string().uuid().nullish(),
    })
    .passthrough()
);
const BasicAuthConfig = MonitorAuthConfig.and(
  z
    .object({ vaultSecretId: z.string().uuid().nullable() })
    .partial()
    .passthrough()
);
const BearerAuthConfig = MonitorAuthConfig.and(
  z
    .object({ vaultSecretId: z.string().uuid().nullable() })
    .partial()
    .passthrough()
);
const HeaderAuthConfig = MonitorAuthConfig.and(
  z
    .object({
      headerName: z
        .string()
        .min(1)
        .regex(/^[A-Za-z0-9\-_]+$/),
      vaultSecretId: z.string().uuid().nullish(),
    })
    .passthrough()
);
const UpdateMonitorAuthRequest = z
  .object({
    config: z.union([
      ApiKeyAuthConfig,
      BasicAuthConfig,
      BearerAuthConfig,
      HeaderAuthConfig,
    ]),
  })
  .passthrough();
const SetMonitorAuthRequest = z
  .object({
    config: z.union([
      ApiKeyAuthConfig,
      BasicAuthConfig,
      BearerAuthConfig,
      HeaderAuthConfig,
    ]),
  })
  .passthrough();
const BulkMonitorActionRequest = z
  .object({
    monitorIds: z.array(z.string().uuid()).max(200),
    action: z.enum(["PAUSE", "RESUME", "DELETE", "ADD_TAG", "REMOVE_TAG"]),
    tagIds: z.array(z.string().uuid()).nullish(),
    newTags: z.array(NewTagRequest).nullish(),
  })
  .passthrough();
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
  .passthrough();
const MatchRule = z
  .object({
    type: z.string(),
    value: z.string().nullish(),
    monitorIds: z.array(z.string().uuid()).nullish(),
    regions: z.array(z.string()).nullish(),
    values: z.array(z.string()).nullish(),
  })
  .passthrough();
const EscalationStep = z
  .object({
    delayMinutes: z.number().int().gte(0).optional(),
    channelIds: z.array(z.string().uuid()).min(1),
    requireAck: z.boolean().nullish(),
    repeatIntervalSeconds: z.number().int().gte(1).nullish(),
  })
  .passthrough();
const EscalationChain = z
  .object({
    steps: z.array(EscalationStep).min(1),
    onResolve: z.string().nullish(),
    onReopen: z.string().nullish(),
  })
  .passthrough();
const CreateNotificationPolicyRequest = z
  .object({
    name: z.string().min(0).max(255),
    matchRules: z.array(MatchRule),
    escalation: EscalationChain,
    enabled: z.boolean().default(true),
    priority: z.number().int().default(0),
  })
  .passthrough();
const UpdateNotificationPolicyRequest = z
  .object({
    name: z.string().min(0).max(255).nullable(),
    matchRules: z.array(MatchRule).nullable(),
    escalation: EscalationChain.nullable(),
    enabled: z.boolean().nullable(),
    priority: z.number().int().nullable(),
  })
  .partial()
  .passthrough();
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
  .passthrough();
const UpdateOrgDetailsRequest = z
  .object({
    name: z.string().min(0).max(200),
    email: z.string().min(1).email(),
    size: z.string().min(0).max(50).nullish(),
    industry: z.string().min(0).max(100).nullish(),
    websiteUrl: z.string().min(0).max(255).nullish(),
  })
  .passthrough();
const RetryStrategy = z
  .object({
    type: z.string(),
    maxRetries: z.number().int().optional(),
    interval: z.number().int().optional(),
  })
  .passthrough();
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
  .passthrough();
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
  .passthrough();
const AddResourceGroupMemberRequest = z
  .object({
    memberType: z
      .string()
      .min(1)
      .regex(/monitor|service/),
    memberId: z.string().uuid(),
  })
  .passthrough();
const CreateSecretRequest = z
  .object({
    key: z.string().min(0).max(255),
    value: z.string().min(0).max(32768),
  })
  .passthrough();
const UpdateSecretRequest = z
  .object({ value: z.string().min(0).max(32768) })
  .passthrough();
const UpdateAlertSensitivityRequest = z
  .object({
    alertSensitivity: z
      .string()
      .min(1)
      .regex(/ALL|INCIDENTS_ONLY|MAJOR_ONLY/),
  })
  .passthrough();
const ServiceSubscribeRequest = z
  .object({
    componentId: z.string().uuid().nullable(),
    alertSensitivity: z.string().nullable(),
  })
  .partial()
  .passthrough();
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
  .passthrough();
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
  .passthrough();
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
  .passthrough();
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
  .passthrough();
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
  .passthrough();
const ComponentPosition = z
  .object({
    componentId: z.string().uuid(),
    displayOrder: z.number().int().optional(),
    groupId: z.string().uuid().nullish(),
  })
  .passthrough();
const ReorderComponentsRequest = z
  .object({ positions: z.array(ComponentPosition).min(1) })
  .passthrough();
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
  .passthrough();
const CreateStatusPageComponentGroupRequest = z
  .object({
    name: z.string().min(0).max(255),
    description: z.string().min(0).max(500).nullish(),
    displayOrder: z.number().int().nullish(),
    collapsed: z.boolean().nullish(),
  })
  .passthrough();
const UpdateStatusPageComponentGroupRequest = z
  .object({
    name: z.string().min(0).max(255).nullable(),
    description: z.string().min(0).max(500).nullable(),
    displayOrder: z.number().int().nullable(),
    collapsed: z.boolean().nullable(),
  })
  .partial()
  .passthrough();
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
  .passthrough();
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
  .passthrough();
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
  .passthrough();
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
  .passthrough();
const CreateStatusPageIncidentUpdateRequest = z
  .object({
    status: z.enum(["INVESTIGATING", "IDENTIFIED", "MONITORING", "RESOLVED"]),
    body: z.string().min(1),
    notifySubscribers: z.boolean().nullish(),
    affectedComponents: z.array(AffectedComponent).nullish(),
  })
  .passthrough();
const PageSection = z
  .object({
    groupId: z.string().uuid().nullish(),
    componentId: z.string().uuid().nullish(),
    pageOrder: z.number().int(),
  })
  .passthrough();
const GroupComponentOrder = z
  .object({
    groupId: z.string().uuid(),
    positions: z.array(ComponentPosition).min(1),
  })
  .passthrough();
const ReorderPageLayoutRequest = z
  .object({
    sections: z.array(PageSection).min(1),
    groupOrders: z.array(GroupComponentOrder).nullish(),
  })
  .passthrough();
const AdminAddSubscriberRequest = z
  .object({ email: z.string().min(1).email() })
  .passthrough();
const CreateTagRequest = z
  .object({
    name: z.string().min(0).max(100),
    color: z
      .string()
      .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/)
      .nullish(),
  })
  .passthrough();
const UpdateTagRequest = z
  .object({
    name: z.string().min(0).max(100).nullable(),
    color: z
      .string()
      .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/)
      .nullable(),
  })
  .partial()
  .passthrough();
const CreateWebhookEndpointRequest = z
  .object({
    url: z.string().min(0).max(2048),
    description: z.string().min(0).max(255).nullish(),
    subscribedEvents: z.array(z.string().min(1)).min(1),
  })
  .passthrough();
const UpdateWebhookEndpointRequest = z
  .object({
    url: z.string().min(0).max(2048).nullable(),
    description: z.string().min(0).max(255).nullable(),
    subscribedEvents: z.array(z.string()).nullable(),
    enabled: z.boolean().nullable(),
  })
  .partial()
  .passthrough();
const TestWebhookEndpointRequest = z
  .object({ eventType: z.string().nullable() })
  .partial()
  .passthrough();
const CreateWorkspaceRequest = z
  .object({ name: z.string().min(1) })
  .passthrough();
const UpdateWorkspaceRequest = z
  .object({ name: z.string().min(0).max(200) })
  .passthrough();

export const schemas = {
  pageable,
  ChannelConfig,
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
  AssertionConfig,
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
  ApiKeyAuthConfig,
  BasicAuthConfig,
  BearerAuthConfig,
  HeaderAuthConfig,
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

