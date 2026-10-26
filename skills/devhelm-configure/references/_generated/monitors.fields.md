# monitors — field reference

> Auto-generated from the DevHelm OpenAPI spec. Do not edit by hand.
> Regenerate with `node scripts/generate-skill-references.mjs`.

## `CreateMonitorRequest`

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `name` | string | ✓ |  | Human-readable name for this monitor |
| `type` | "HTTP" \| "DNS" \| "MCP_SERVER" \| "TCP" \| "ICMP" \| "HEARTBEAT" \| "BROWSER" \| "MULTI_STEP_API" | ✓ |  | Monitor protocol type |
| `config` | any |  | ✓ |  |
| `frequencySeconds` | integer (int32) |  | ✓ | Check frequency in seconds; minimum depends on plan (default: plan minimum) |
| `enabled` | boolean |  | ✓ | Whether the monitor is active (default: true) |
| `regions` | string[] |  | ✓ | Probe regions to run checks from. Allowed values are deployment-dependent. Production: us-east, us-west, eu-west, ap-south |
| `managedBy` | "DASHBOARD" \| "CLI" \| "TERRAFORM" \| "MCP" \| "API" \| "GIT" |  | ✓ | Source that created this monitor: DASHBOARD, GIT, TERRAFORM, MCP or API (CLI = GIT until 2027-01-31). Defaults to API |
| `ownerEnforced` | boolean |  | ✓ | Only the managedBy tool may change configuration (default: false) |
| `ownerProject` | string |  | ✓ | Project the owning tool declares for this monitor, e.g. acme/web |
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
| `code` | any |  | ✓ |  |
| `ownerDeclaration` | any |  | ✓ |  |
| `secretKeys` | string[] |  | ✓ | Secret keys to attach; null starts with the scanned set |

## `UpdateMonitorRequest`

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `name` | string |  | ✓ | New monitor name. Null preserves current |
| `config` | any |  | ✓ |  |
| `frequencySeconds` | integer (int32) |  | ✓ | Check frequency in seconds; minimum depends on plan. Null preserves current |
| `enabled` | boolean |  | ✓ | Enable or disable the monitor (pause or resume). Null preserves current |
| `regions` | string[] |  | ✓ | New probe regions. Null preserves current. Allowed values are deployment-dependent |
| `managedBy` | "DASHBOARD" \| "CLI" \| "TERRAFORM" \| "MCP" \| "API" \| "GIT" |  | ✓ | New ownership source for probe monitors. Null preserves current. Code monitors use takeover |
| `ownerEnforced` | boolean |  | ✓ | Only the managedBy tool may change configuration. Null preserves current |
| `ownerProject` | string |  | ✓ | Project the owning tool declares; null preserves current |
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
| `code` | any |  | ✓ |  |
| `acknowledgeRollback` | string |  | ✓ | Rolled-back digest this code publish re-applies on purpose |
| `status` | string |  | ✓ | Not writable; use pause or resume |
| `expectedUpdatedAt` | string (date-time) |  | ✓ | Last updatedAt this edit was based on; null skips the check |
| `secretKeys` | string[] |  | ✓ | Replace attached secret keys; null preserves current |

## `MonitorDto` (response shape)

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `id` | string (uuid) | ✓ |  | Unique monitor identifier |
| `organizationId` | integer (int32) | ✓ |  | Organization this monitor belongs to |
| `name` | string | ✓ |  | Human-readable name for this monitor |
| `type` | string | ✓ |  |  |
| `config` | any | ✓ |  |  |
| `frequencySeconds` | integer (int32) | ✓ |  | Check frequency in seconds; minimum depends on plan |
| `enabled` | boolean | ✓ |  | Whether the monitor is active |
| `regions` | string[] | ✓ |  | Probe regions where checks are executed |
| `managedBy` | string | ✓ |  | Source that created/owns this monitor: DASHBOARD, GIT, TERRAFORM, MCP or API |
| `ownerEnforced` | boolean | ✓ |  | Whether only the managedBy tool may change this monitor's configuration |
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
| `resumesAt` | string (date-time) |  | ✓ | When a capped monitor resumes |
| `capped` | any |  | ✓ |  |
| `missingKeys` | string[] |  | ✓ | Secret keys missing while the monitor is blocked |
| `blockedKeys` | string[] |  | ✓ | Secret keys missing while the monitor is blocked |
| `owner` | any |  | ✓ |  |
| `flakyRate` | number (double) |  | ✓ | Share of recent cycles that passed only after a retry, 0–1; null when not flaky |
| `flakySince` | string (date-time) |  | ✓ | When the first retry-passed cycle in the last 7 days finished |
| `flakySeverity` | string |  | ✓ | How flaky the monitor is: LOW, MEDIUM, or HIGH |
| `lastCheckOutcome` | string |  | ✓ | Result of the most recent check in any region: PASSED, DEGRADED, or FAILED |
| `lastCheckRegion` | string |  | ✓ | Region of the most recent check |
| `lastFailureSummary` | string |  | ✓ | Why the latest failing region failed |
| `lastStateChangeAt` | string (date-time) |  | ✓ | When the monitor last changed state: paused, evaluation change, or incident open or resolve |
| `regionHealth` | MonitorRegionHealthDto[] |  | ✓ | Latest verdict per region the monitor runs from; null while paused |
| `definitionId` | string (uuid) |  | ✓ | Definition id for a browser or multi-step monitor. Null on probe monitors |
| `capturePolicy` | any |  | ✓ |  |
| `secretKeys` | string[] |  | ✓ | Explicit attached secret keys; null uses scanned demand |
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
| `usageProjection` | any |  | ✓ |  |
| `liveRevisionId` | string (uuid) |  | ✓ | Revision scheduled runs execute |
| `liveRevisionDigest` | string |  | ✓ | Closure digest of the revision scheduled runs execute |
| `triage` | any |  | ✓ |  |
| `deletedAt` | string (date-time) |  | ✓ | When the monitor was moved to Trash |
| `deletedBy` | any |  | ✓ |  |
| `createdVia` | string |  | ✓ | Client that originally created the monitor |

