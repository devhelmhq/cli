# alert-channels — field reference

> Auto-generated from the DevHelm OpenAPI spec. Do not edit by hand.
> Regenerate with `node scripts/generate-skill-references.mjs`.

## `CreateAlertChannelRequest`

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `name` | string | ✓ |  | Human-readable name for this alert channel |
| `config` | any | ✓ |  |  |

## `UpdateAlertChannelRequest`

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `name` | string | ✓ |  | New channel name (full replacement, not partial update) |
| `config` | any | ✓ |  |  |

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
| `lastDeliveryAt` | string (date-time) |  | ✓ | Timestamp of the most recent delivery attempt |
| `lastDeliveryStatus` | string |  | ✓ | Outcome of the most recent delivery (SUCCESS, FAILED, etc.) |

