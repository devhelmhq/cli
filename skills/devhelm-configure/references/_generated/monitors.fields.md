# monitors — field reference

> Auto-generated from the DevHelm OpenAPI spec. Do not edit by hand.
> Regenerate with `node scripts/generate-skill-references.mjs`.

## `CreateMonitorRequest`

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `name` | string | ✓ |  | Human-readable name for this monitor |
| `type` | "HTTP" \| "DNS" \| "MCP_SERVER" \| "TCP" \| "ICMP" \| "HEARTBEAT" \| "BROWSER" \| "MULTI_STEP_API" | ✓ |  | Monitor protocol type |
| `config` | any |  | ✓ |  |
| `frequencySeconds` | integer (int32) |  | ✓ | Check frequency in seconds (10–86400). Null defaults to the plan minimum |
| `enabled` | boolean |  | ✓ | Whether the monitor is active (default: true) |
| `regions` | string[] |  | ✓ | Probe regions to run checks from. Allowed values are deployment-dependent. Production: us-east, us-west, eu-west, ap-south |
| `managedBy` | "DASHBOARD" \| "CLI" \| "TERRAFORM" \| "MCP" \| "API" |  | ✓ | Source that created this monitor: DASHBOARD, CLI, TERRAFORM, MCP, or API. Defaults to API |
| `environmentId` | string (uuid) |  | ✓ | Environment to associate with this monitor. Required for browser and multi-step monitors |
| `assertions` | CreateAssertionRequest[] |  | ✓ | Assertions to evaluate against each check result |
| `auth` | any |  | ✓ |  |
| `incidentPolicy` | any |  | ✓ |  |
| `alertChannelIds` | string (uuid)[] |  | ✓ | Alert channels to notify when this monitor triggers |
| `tags` | any |  | ✓ |  |
| `capturePolicy` | any |  | ✓ |  |
| `fastRetryMaxAttempts` | integer (int32) |  | ✓ | Fast-retry attempts after failure. Null or 0 disables |
| `runParallel` | boolean |  | ✓ | When multiple locations are set, run all of them each interval (default: true). false rotates one location per interval |
| `definitionId` | string (uuid) |  | ✓ | Existing definition to reuse for a sibling monitor |
| `package` | any |  | ✓ |  |

## `UpdateMonitorRequest`

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `name` | string |  | ✓ | New monitor name. Null preserves current |
| `config` | any |  | ✓ |  |
| `frequencySeconds` | integer (int32) |  | ✓ | New check frequency in seconds (10–86400). Null preserves current |
| `enabled` | boolean |  | ✓ | Enable or disable the monitor (pause or resume). Null preserves current |
| `regions` | string[] |  | ✓ | New probe regions. Null preserves current. Allowed values are deployment-dependent |
| `managedBy` | "DASHBOARD" \| "CLI" \| "TERRAFORM" \| "MCP" \| "API" |  | ✓ | New ownership source for probe monitors. Null preserves current. Code monitors use takeover |
| `environmentId` | string (uuid) |  | ✓ | New environment; null preserves current |
| `clearEnvironmentId` | boolean |  | ✓ | Set to true to remove the environment association |
| `assertions` | CreateAssertionRequest[] |  | ✓ | Replace all assertions. Null preserves current |
| `auth` | any |  | ✓ |  |
| `clearAuth` | boolean |  | ✓ | Set to true to remove authentication |
| `incidentPolicy` | any |  | ✓ |  |
| `alertChannelIds` | string (uuid)[] |  | ✓ | Replace alert channel list. Null preserves current |
| `tags` | any |  | ✓ |  |
| `capturePolicy` | any |  | ✓ |  |
| `fastRetryMaxAttempts` | integer (int32) |  | ✓ | Fast-retry attempts after failure. Null preserves current. 0 disables |
| `runParallel` | boolean |  | ✓ | Run every location each interval; false rotates one. Null preserves current |
| `package` | any |  | ✓ |  |
| `status` | string |  | ✓ | Not writable; use pause or resume |

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
| `boundStatusPageComponents` | StatusPageBoundComponentDto[] |  | ✓ | Status-page components that represent this monitor; omitted when none |
| `currentStatus` | string |  | ✓ | Current operational state. One of UP, DOWN, DEGRADED, PAUSED, or UNKNOWN |
| `displayHealth` | string |  | ✓ | List and header chip health; not currentStatus and not evaluation state |
| `bindingReadiness` | string |  | ✓ | Secret binding state: ready, blocked, or not_applicable |
| `needsAttention` | boolean |  | ✓ | True when the monitor needs operator attention |
| `openIncident` | string (uuid) |  | ✓ | Open confirmed incident id |
| `lastRunAt` | string (date-time) |  | ✓ | When the latest code run was enqueued |
| `lastRunId` | string (uuid) |  | ✓ | Latest code run id |
| `definitionId` | string (uuid) |  | ✓ | Definition id for a browser or multi-step monitor. Null on probe monitors |
| `capturePolicy` | any |  | ✓ |  |
| `fastRetryMaxAttempts` | integer (int32) |  | ✓ | Fast-retry max attempts; null/0 = off |
| `runParallel` | boolean |  | ✓ | When multiple locations are set, run all of them each interval. False rotates one location per interval |
| `muted` | boolean | ✓ |  | Whether alert delivery is muted |
| `mutedUntil` | string (date-time) |  | ✓ | Mute expiry; null means indefinite while muted |
| `muteReason` | string |  | ✓ | Optional mute reason |
| `pausedAt` | string (date-time) |  | ✓ | When the monitor was paused |
| `pauseReason` | string |  | ✓ | Optional pause reason |
| `pauseExpiresAt` | string (date-time) |  | ✓ | Pause expiry |
| `quarantineOwnerId` | string |  | ✓ | Quarantine person owner id |
| `quarantineUntil` | string (date-time) |  | ✓ | Quarantine expiry; non-null means quarantined |
| `quarantineReason` | string |  | ✓ | Quarantine reason |
| `upload` | any |  | ✓ |  |

