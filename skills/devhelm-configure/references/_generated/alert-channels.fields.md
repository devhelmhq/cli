# alert-channels — field reference

> Auto-generated from the DevHelm OpenAPI spec. Do not edit by hand.
> Regenerate with `node scripts/generate-skill-references.mjs`.

## `CreateAlertChannelRequest`

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `name` | string | ✓ |  | Human-readable name for this alert channel |
| `config` | any | ✓ |  |  |
| `managedBy` | "DASHBOARD" \| "CLI" \| "TERRAFORM" \| "MCP" \| "API" |  | ✓ | Source creating this channel: DASHBOARD, CLI, TERRAFORM, MCP, or API. Defaults to API when omitted. |

## `UpdateAlertChannelRequest`

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `name` | string | ✓ |  | New channel name (full replacement, not partial update) |
| `config` | any | ✓ |  |  |
| `managedBy` | "DASHBOARD" \| "CLI" \| "TERRAFORM" \| "MCP" \| "API" |  | ✓ | New attribution source: DASHBOARD, CLI, TERRAFORM, MCP, or API; null preserves current value. |

## `AlertChannelDto` (response shape)

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `id` | string (uuid) | ✓ |  | Unique alert channel identifier |
| `name` | string | ✓ |  | Human-readable channel name |
| `channelType` | "email" \| "webhook" \| "slack" \| "pagerduty" \| "opsgenie" \| "teams" \| "discord" | ✓ |  | Channel integration type (e.g. SLACK, PAGERDUTY, EMAIL) |
| `displayConfig` | any |  | ✓ |  |
| `createdAt` | string (date-time) | ✓ |  | Timestamp when the channel was created |
| `updatedAt` | string (date-time) | ✓ |  | Timestamp when the channel was last updated |
| `configHash` | string |  | ✓ | SHA-256 hash of the channel config; use for change detection |
| `managedBy` | "DASHBOARD" \| "CLI" \| "TERRAFORM" \| "MCP" \| "API" |  | ✓ | Source that created/owns this channel: DASHBOARD, CLI, TERRAFORM, MCP, or API. Null on channels created before this attribution column existed. |
| `lastDeliveryAt` | string (date-time) |  | ✓ | Timestamp of the most recent delivery attempt |
| `lastDeliveryStatus` | string |  | ✓ | Outcome of the most recent delivery (SUCCESS, FAILED, etc.) |

