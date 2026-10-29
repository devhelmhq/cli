# runs — field reference

> Auto-generated from the DevHelm OpenAPI spec. Do not edit by hand.
> Regenerate with `node scripts/generate-skill-references.mjs`.

## `RunDto`

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `id` | string (uuid) | ✓ |  | Unique run identifier |
| `organizationId` | integer (int32) | ✓ |  | Organization this run belongs to |
| `monitorId` | string (uuid) |  | ✓ | Monitor this run belongs to; null for an ad-hoc validation run |
| `monitorName` | string |  | ✓ | Monitor display name |
| `monitorType` | string |  | ✓ | Monitor type |
| `host` | string |  | ✓ | Target host from the environment BASE_URL |
| `environmentId` | string (uuid) |  | ✓ | Environment this run executed in |
| `environmentName` | string |  | ✓ | Environment display name |
| `revisionId` | string (uuid) | ✓ |  | Revision this run executed |
| `revision` | any |  | ✓ |  |
| `region` | string | ✓ |  | Probe region for this run |
| `source` | string | ✓ |  | What triggered this run |
| `countsTowardHealth` | boolean | ✓ |  | Whether this run votes on monitor health |
| `enqueuedAt` | string (date-time) | ✓ |  | When this run was enqueued |
| `startDeadlineAt` | string (date-time) |  | ✓ | When this queued run must start |
| `evaluationCycleId` | string (uuid) |  | ✓ | Evaluation cycle grouping this run with retries |
| `retryOfRunId` | string (uuid) |  | ✓ | Parent run when this is a fast retry |
| `retriedFromRunId` | string (uuid) |  | ✓ | Fast-retry parent run |
| `phase` | string | ✓ |  | Current run phase |
| `cancelRequested` | boolean | ✓ |  | Whether cancel was requested |
| `outcome` | string |  | ✓ | Outcome; null until the run is finished |
| `flaky` | boolean | ✓ |  | Whether the run passed only after at least one fast retry |
| `headline` | string |  | ✓ | Last control headline |
| `executionLine` | string |  | ✓ | Live execution one-liner |
| `metaLine` | string |  | ✓ | Server-composed header meta line |
| `bundleDigest` | string | ✓ |  | Package digest frozen at create |
| `startedAt` | string (date-time) |  | ✓ | When execution claimed a seat |
| `finishedAt` | string (date-time) |  | ✓ | When the run finished |
| `updatedAt` | string (date-time) |  | ✓ | When the run row last changed |
| `lastHeartbeatAt` | string (date-time) |  | ✓ | Last supervisor heartbeat |
| `cancelledBy` | string |  | ✓ | Who requested cancel |
| `artifactsExpiredAt` | string (date-time) |  | ✓ | When artifact bytes expired |
| `pinnedAt` | string (date-time) |  | ✓ | When this run was pinned past retention |
| `purgedAt` | string (date-time) |  | ✓ | When stored evidence was purged |
| `capturePolicySnapshot` | CapturePolicy | ✓ |  |  |
| `bindingVersionSnapshot` | BindingVersionSnapshot | ✓ |  |  |
| `durationMs` | integer (int64) |  | ✓ | Wall time from claim to finish |
| `queueWaitMs` | integer (int64) |  | ✓ | Time spent waiting for a seat |
| `queuePosition` | integer (int32) |  | ✓ | Live queue position; null when not queued |
| `heartbeatAgeMs` | integer (int64) |  | ✓ | Milliseconds since the last supervisor heartbeat |
| `stream` | boolean | ✓ |  | True while the run is still live and clients may stream |
| `evidence` | RunEvidenceDto[] | ✓ |  | List evidence chips in SHOT → TRACE → VIDEO → NET order |
| `tabCounts` | any | ✓ |  |  |
| `live` | any |  | ✓ |  |
| `attempt` | integer (int32) | ✓ |  | Selected in-check attempt (1-based) |
| `attemptOf` | integer (int32) | ✓ |  | In-check attempt count |
| `attempts` | RunAttemptDto[] | ✓ |  | In-check attempts |
| `incidentId` | string (uuid) |  | ✓ | Open incident for this monitor |
| `execution` | any |  | ✓ |  |
| `executionAttempts` | RunExecutionAttemptDto[] | ✓ |  | Persisted worker execution attempts |
| `url` | string |  | ✓ | Dashboard URL for this run |
| `triggerId` | string (uuid) |  | ✓ | Groups runs started by one manual trigger; null for other runs |
| `session` | any |  | ✓ |  |
| `runtimeId` | string |  | ✓ | Runtime profile that executed this run |
| `cause` | string |  | ✓ | Platform cause for an execution error, inconclusive finish, or network failure |
| `billable` | boolean | ✓ |  | Whether a finished run counts against the included run pool |
| `failure` | any |  | ✓ |  |
| `artifactsExpireAt` | string (date-time) |  | ✓ | When artifact bytes will expire |

## `RunStepDto`

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `id` | string (uuid) | ✓ |  | Step identifier |
| `organizationId` | integer (int32) | ✓ |  | Organization this step belongs to |
| `runId` | string (uuid) | ✓ |  | Run this step belongs to |
| `caseId` | string (uuid) | ✓ |  | Case this step belongs to |
| `attempt` | integer (int32) | ✓ |  | Playwright in-case attempt number |
| `index` | integer (int32) | ✓ |  | Zero-based index within the case attempt |
| `title` | string | ✓ |  | Step title |
| `category` | string | ✓ |  | Step category |
| `status` | string | ✓ |  | Step status |
| `startedAt` | string (date-time) |  | ✓ | When the step started |
| `finishedAt` | string (date-time) |  | ✓ | When the step finished |
| `durationMs` | integer (int32) |  | ✓ | Reporter duration in milliseconds |
| `error` | string |  | ✓ | Error when the step failed |
| `assertion` | Map<string, object> |  | ✓ | Assertion or safe wait-result metadata |

## `RunFailureDto`

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `kind` | string | ✓ |  | Failure category |
| `step` | string |  | ✓ | Step title that failed; null when the run failed before a step |
| `message` | string |  | ✓ | Reporter message, trimmed |
| `file` | string |  | ✓ | User source file; null when the reporter did not capture one |
| `line` | integer (int32) |  | ✓ | 1-based line in the user source file |
| `index` | integer (int32) |  | ✓ | 0-based index of the failed step |

## `TriggerRunRequest`

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `regions` | string[] |  | ✓ | Regions to run; empty or omitted runs every configured region |
| `signal` | boolean |  | ✓ | Count these runs toward health and incidents (default: false) |
| `session` | any |  | ✓ |  |

## `TriggerRunsResponse`

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `triggerId` | string (uuid) | ✓ |  | Groups every run started by this trigger; scheduled runs group by evaluation cycle instead |
| `billedRuns` | integer (int32) | ✓ |  | Runs billed for this trigger, one per region |
| `runs` | TriggerRunRef[] | ✓ |  | Queued runs, one per region |

