// Auto-generated from OpenAPI spec — do not edit manually.
// Regenerate with: node scripts/extract-descriptions.mjs

export const fieldDescriptions: Record<string, Record<string, string>> = 
{
  "CreateMonitorRequest": {
    "name": "Human-readable name for this monitor",
    "type": "Monitor protocol type",
    "frequencySeconds": "Check frequency in seconds (30–86400); null defaults to plan minimum (60s on most paid plans)",
    "enabled": "Whether the monitor is active (default: true)",
    "regions": "Probe regions to run checks from, e.g. us-east, eu-west",
    "managedBy": "Who manages this monitor: DASHBOARD or CLI",
    "environmentId": "Environment to associate with this monitor",
    "assertions": "Assertions to evaluate against each check result",
    "alertChannelIds": "Alert channels to notify when this monitor triggers"
  },
  "UpdateMonitorRequest": {
    "name": "New monitor name; null preserves current",
    "frequencySeconds": "New check frequency in seconds (30–86400); null preserves current",
    "enabled": "Enable or disable the monitor; null preserves current",
    "regions": "New probe regions; null preserves current",
    "managedBy": "New management source; null preserves current",
    "environmentId": "New environment ID; null preserves current (use clearEnvironmentId to unset)",
    "clearEnvironmentId": "Set to true to remove the environment association",
    "assertions": "Replace all assertions; null preserves current",
    "clearAuth": "Set to true to remove authentication",
    "alertChannelIds": "Replace alert channel list; null preserves current"
  },
  "CreateManualIncidentRequest": {
    "title": "Short summary of the incident",
    "severity": "Incident severity: DOWN, DEGRADED, or MAINTENANCE",
    "monitorId": "Monitor to associate with this incident",
    "body": "Detailed description or context for the incident"
  },
  "CreateAlertChannelRequest": {
    "name": "Human-readable name for this alert channel"
  },
  "UpdateAlertChannelRequest": {
    "name": "New channel name (full replacement, not partial update)"
  },
  "CreateNotificationPolicyRequest": {
    "name": "Human-readable name for this policy",
    "matchRules": "Match rules to evaluate (all must pass; omit or empty for catch-all)",
    "enabled": "Whether this policy is enabled (default true)",
    "priority": "Evaluation priority; higher value = evaluated first (default 0)"
  },
  "UpdateNotificationPolicyRequest": {
    "name": "Human-readable name for this policy; null preserves current",
    "matchRules": "Match rules to evaluate (all must pass; omit or empty for catch-all)",
    "enabled": "Whether this policy is enabled; null preserves current",
    "priority": "Evaluation priority; higher value = evaluated first; null preserves current"
  },
  "CreateEnvironmentRequest": {
    "name": "Human-readable environment name",
    "slug": "URL-safe identifier (lowercase alphanumeric, hyphens, underscores)",
    "variables": "Initial key-value variable pairs for this environment",
    "isDefault": "Whether this is the default environment for new monitors"
  },
  "UpdateEnvironmentRequest": {
    "name": "New environment name; null preserves current",
    "variables": "Replace all variables; null preserves current",
    "isDefault": "Whether this is the default environment; null preserves current"
  },
  "CreateSecretRequest": {
    "key": "Unique secret key within the workspace (max 255 chars)",
    "value": "Secret value, stored encrypted (max 32KB)"
  },
  "UpdateSecretRequest": {
    "value": "New secret value, stored encrypted (max 32KB)"
  },
  "CreateTagRequest": {
    "name": "Tag name, unique within the org",
    "color": "Hex color code (defaults to #6B7280 if omitted)"
  },
  "UpdateTagRequest": {
    "name": "New tag name",
    "color": "New hex color code"
  },
  "CreateResourceGroupRequest": {
    "name": "Human-readable name for this group",
    "description": "Optional description",
    "alertPolicyId": "Optional notification policy to apply for this group",
    "defaultFrequency": "Default check frequency in seconds applied to members (30–86400)",
    "defaultRegions": "Default regions applied to member monitors",
    "defaultAlertChannels": "Default alert channel IDs applied to member monitors",
    "defaultEnvironmentId": "Default environment ID applied to member monitors",
    "healthThresholdType": "Health threshold type: COUNT or PERCENTAGE",
    "healthThresholdValue": "Health threshold value: count (0+) or percentage (0–100)",
    "suppressMemberAlerts": "Suppress member-level alert notifications when group manages alerting",
    "confirmationDelaySeconds": "Confirmation delay in seconds before group incident creation (0–600)",
    "recoveryCooldownMinutes": "Recovery cooldown in minutes after group incident resolves (0–60)"
  },
  "UpdateResourceGroupRequest": {
    "name": "Human-readable name for this group",
    "description": "Optional description; null clears the existing value",
    "alertPolicyId": "Optional notification policy to apply for this group; null clears the existing value",
    "defaultFrequency": "Default check frequency in seconds for members (30–86400); null clears",
    "defaultRegions": "Default regions for member monitors; null clears",
    "defaultAlertChannels": "Default alert channel IDs for member monitors; null clears",
    "defaultEnvironmentId": "Default environment ID for member monitors; null clears",
    "healthThresholdType": "Health threshold type: COUNT or PERCENTAGE; null disables threshold",
    "healthThresholdValue": "Health threshold value; null disables threshold",
    "suppressMemberAlerts": "Suppress member-level alert notifications; null preserves current value",
    "confirmationDelaySeconds": "Confirmation delay in seconds; null clears",
    "recoveryCooldownMinutes": "Recovery cooldown in minutes; null clears"
  },
  "CreateWebhookEndpointRequest": {
    "url": "HTTPS endpoint that receives webhook event payloads",
    "description": "Optional human-readable description",
    "subscribedEvents": "Event types to deliver, e.g. monitor.created, incident.resolved"
  },
  "UpdateWebhookEndpointRequest": {
    "url": "New webhook URL; null preserves current",
    "description": "New description; null preserves current",
    "subscribedEvents": "Replace subscribed events; null preserves current",
    "enabled": "Enable or disable delivery; null preserves current"
  },
  "CreateApiKeyRequest": {
    "name": "Human-readable name to identify this API key",
    "expiresAt": "Optional expiration timestamp in ISO 8601 format"
  },
  "UpdateApiKeyRequest": {
    "name": "New name for this API key"
  },
  "ResolveIncidentRequest": {
    "body": "Optional resolution message or post-mortem notes"
  },
  "MonitorTestRequest": {
    "type": "Monitor protocol type to test",
    "assertions": "Optional assertions to evaluate against the test result"
  },
  "AcquireDeployLockRequest": {
    "lockedBy": "Identity of the lock requester (e.g. hostname, CI job ID)",
    "ttlMinutes": "Lock TTL in minutes (default: 30, max: 60)"
  },
  "HttpMonitorConfig": {
    "url": "Target URL to send requests to",
    "method": "HTTP method: GET, POST, PUT, PATCH, DELETE, or HEAD",
    "customHeaders": "Additional HTTP headers to include in requests",
    "requestBody": "Request body content for POST/PUT/PATCH methods",
    "contentType": "Content-Type header value for the request body",
    "verifyTls": "Whether to verify TLS certificates (default: true)"
  },
  "TcpMonitorConfig": {
    "host": "Target hostname or IP address",
    "port": "TCP port to connect to",
    "timeoutMs": "Connection timeout in milliseconds"
  },
  "DnsMonitorConfig": {
    "hostname": "Domain name to resolve",
    "recordTypes": "DNS record types to query: A, AAAA, CNAME, MX, NS, TXT, SRV, SOA, CAA, PTR",
    "nameservers": "Custom nameservers to query (uses system defaults if omitted)",
    "timeoutMs": "Per-query timeout in milliseconds",
    "totalTimeoutMs": "Total timeout for all queries in milliseconds"
  },
  "IcmpMonitorConfig": {
    "host": "Target hostname or IP address to ping",
    "packetCount": "Number of ICMP packets to send",
    "timeoutMs": "Ping timeout in milliseconds"
  },
  "HeartbeatMonitorConfig": {
    "expectedInterval": "Expected heartbeat interval in seconds",
    "gracePeriod": "Grace period in seconds before marking as down"
  },
  "McpServerMonitorConfig": {
    "command": "Command to execute to start the MCP server",
    "args": "Command-line arguments for the MCP server process",
    "env": "Environment variables to pass to the MCP server process"
  },
  "SlackChannelConfig": {
    "webhookUrl": "Slack incoming webhook URL",
    "mentionText": "Optional mention text included in notifications, e.g. @channel"
  },
  "DiscordChannelConfig": {
    "webhookUrl": "Discord webhook URL",
    "mentionRoleId": "Optional Discord role ID to mention in notifications"
  },
  "EmailChannelConfig": {
    "recipients": "Email addresses to send notifications to"
  },
  "WebhookChannelConfig": {
    "url": "Webhook endpoint URL that receives alert payloads",
    "signingSecret": "Optional HMAC signing secret for payload verification",
    "customHeaders": "Additional HTTP headers to include in webhook requests"
  },
  "PagerDutyChannelConfig": {
    "routingKey": "PagerDuty Events API v2 routing (integration) key",
    "severityOverride": "Override PagerDuty severity mapping"
  },
  "OpsGenieChannelConfig": {
    "apiKey": "OpsGenie API key for alert creation",
    "region": "OpsGenie API region: us or eu"
  },
  "TeamsChannelConfig": {
    "webhookUrl": "Microsoft Teams incoming webhook URL"
  },
  "EscalationChain": {
    "steps": "Ordered escalation steps, evaluated in sequence",
    "onResolve": "Action when the incident resolves",
    "onReopen": "Action when a resolved incident reopens"
  },
  "EscalationStep": {
    "delayMinutes": "Minutes to wait before executing this step (0 = immediate)",
    "channelIds": "Alert channel IDs to notify in this step",
    "requireAck": "Whether an acknowledgment is required before escalating",
    "repeatIntervalSeconds": "Repeat notification interval in seconds until acknowledged"
  },
  "MatchRule": {
    "type": "Rule type, e.g. severity_gte, monitor_id_in, region_in",
    "value": "Comparison value for single-value rules like severity_gte",
    "monitorIds": "Monitor UUIDs to match for monitor_id_in rules",
    "regions": "Region codes to match for region_in rules",
    "values": "Values list for multi-value rules like monitor_type_in"
  }
}
