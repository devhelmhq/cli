# monitors — field reference

> Auto-generated from the DevHelm OpenAPI spec. Do not edit by hand.
> Regenerate with `node scripts/generate-skill-references.mjs`.

## `CreateMonitorRequest`

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `name` | string | ✓ |  | Human-readable name for this monitor |
| `type` | "HTTP" \| "DNS" \| "MCP_SERVER" \| "TCP" \| "ICMP" \| "HEARTBEAT" \| "BROWSER" \| "MULTI_STEP_API" | ✓ |  | Monitor protocol type |
| `config` | any | ✓ |  |  |
| `frequencySeconds` | integer (int32) |  | ✓ | Check frequency in seconds (10–86400); null defaults to plan minimum (60s on most paid plans) |
| `enabled` | boolean |  | ✓ | Whether the monitor is active (default: true) |
| `regions` | string[] |  | ✓ | Probe regions to run checks from. Allowed values are deployment-dependent; production: us-east, us-west, eu-west, ap-south. |
| `managedBy` | "DASHBOARD" \| "CLI" \| "TERRAFORM" \| "MCP" \| "API" |  | ✓ | Source that created/owns this monitor: DASHBOARD, CLI, TERRAFORM, MCP, or API. Defaults to API when omitted; set to your surface so audit logs, drift detection, and analytics attribute correctly. |
| `environmentId` | string (uuid) |  | ✓ | Environment to associate with this monitor |
| `assertions` | CreateAssertionRequest[] |  | ✓ | Assertions to evaluate against each check result |
| `auth` | any |  | ✓ |  |
| `incidentPolicy` | any |  | ✓ |  |
| `alertChannelIds` | string (uuid)[] |  | ✓ | Alert channels to notify when this monitor triggers |
| `tags` | any |  | ✓ |  |

## `UpdateMonitorRequest`

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `name` | string |  | ✓ | New monitor name; null preserves current |
| `config` | any |  | ✓ |  |
| `frequencySeconds` | integer (int32) |  | ✓ | New check frequency in seconds (10–86400); null preserves current |
| `enabled` | boolean |  | ✓ | Enable or disable the monitor; null preserves current |
| `regions` | string[] |  | ✓ | New probe regions; null preserves current. Allowed values are deployment-dependent. |
| `managedBy` | "DASHBOARD" \| "CLI" \| "TERRAFORM" \| "MCP" \| "API" |  | ✓ | New ownership source: DASHBOARD, CLI, TERRAFORM, MCP, or API; null preserves current value |
| `environmentId` | string (uuid) |  | ✓ | New environment ID; null preserves current (use clearEnvironmentId to unset) |
| `clearEnvironmentId` | boolean |  | ✓ | Set to true to remove the environment association |
| `assertions` | CreateAssertionRequest[] |  | ✓ | Replace all assertions; null preserves current |
| `auth` | any |  | ✓ |  |
| `clearAuth` | boolean |  | ✓ | Set to true to remove authentication |
| `incidentPolicy` | any |  | ✓ |  |
| `alertChannelIds` | string (uuid)[] |  | ✓ | Replace alert channel list; null preserves current |
| `tags` | any |  | ✓ |  |

## `MonitorDto` (response shape)

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `id` | string (uuid) | ✓ |  | Unique monitor identifier |
| `organizationId` | integer (int32) | ✓ |  | Organization this monitor belongs to |
| `name` | string | ✓ |  | Human-readable name for this monitor |
| `type` | string | ✓ |  |  |
| `config` | any | ✓ |  |  |
| `frequencySeconds` | integer (int32) | ✓ |  | Check frequency in seconds (30–86400) |
| `enabled` | boolean | ✓ |  | Whether the monitor is active |
| `regions` | string[] | ✓ |  | Probe regions where checks are executed |
| `managedBy` | string | ✓ |  | Source that created/owns this monitor: DASHBOARD, CLI, TERRAFORM, MCP, or API |
| `createdAt` | string (date-time) | ✓ |  | Timestamp when the monitor was created |
| `updatedAt` | string (date-time) | ✓ |  | Timestamp when the monitor was last updated |
| `assertions` | MonitorAssertionDto[] |  | ✓ | Assertions evaluated against each check result; null on list responses |
| `tags` | TagDto[] |  | ✓ | Tags applied to this monitor |
| `pingUrl` | string |  | ✓ | Heartbeat ping URL; populated for HEARTBEAT monitors only |
| `environment` | any |  | ✓ |  |
| `auth` | any |  | ✓ |  |
| `incidentPolicy` | any |  | ✓ |  |
| `alertChannelIds` | string (uuid)[] |  | ✓ | Alert channel IDs linked to this monitor; populated on single-monitor responses |
| `currentStatus` | string |  | ✓ | Current operational state — UP, DOWN, DEGRADED, PAUSED, or UNKNOWN if no probe data yet |

