# revisions — field reference

> Auto-generated from the DevHelm OpenAPI spec. Do not edit by hand.
> Regenerate with `node scripts/generate-skill-references.mjs`.

## `CreateDraftRevisionRequest`

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `code` | MonitorCodeSpec | ✓ |  |  |

## `PublishRevisionRequest`

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `revisionId` | string (uuid) | ✓ |  | Revision to make live for this monitor's environment |
| `expectedLiveRevisionId` | string (uuid) |  | ✓ | Live revision this publish replaces; null skips the check |
| `requireTested` | boolean |  | ✓ | When true, require a passing test in this environment within 24 hours |
| `force` | boolean |  | ✓ | Skip the requireTested check; needs the publish-untested scope |
| `acknowledgeRollback` | string |  | ✓ | Rolled-back digest this publish re-applies on purpose |
| `note` | string |  | ✓ | Optional note describing this publish |

## `RollbackRevisionRequest`

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `revisionId` | string (uuid) |  | ✓ | Revision to restore; null restores the previous live revision |
| `reason` | string | ✓ |  | Why this rollback was performed (1–280 chars) |
| `emergency` | boolean |  | ✓ | Emergency rollback; requires a confirmed incident on this monitor |
| `expectedLiveRevisionId` | string (uuid) |  | ✓ | Live revision this rollback replaces; null skips the check |

## `RevisionDto`

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `id` | string (uuid) | ✓ |  | Revision identifier |
| `definitionId` | string (uuid) | ✓ |  | Parent definition |
| `number` | integer (int32) | ✓ |  | Monotonic revision number within the definition |
| `digest` | string | ✓ |  | Closure digest from POST /bundles (sha256:<hex>) |
| `entrypoint` | string | ✓ |  | Entrypoint file that runs |
| `files` | string[] | ✓ |  | Paths present in the zip |
| `keys` | string[] | ✓ |  | Secret key names the code demands |
| `downloadUntil` | string (date-time) |  | ✓ | When package bytes expire for download |
| `purgedAt` | string (date-time) |  | ✓ | When package bytes were purged |
| `gitSha` | string |  | ✓ | Git commit SHA when sourced from Git |
| `gitMessage` | string |  | ✓ | Git commit message |
| `gitFile` | string |  | ✓ | Declaring Git file path |
| `authoredBy` | string |  | ✓ | Who authored this package |
| `source` | any |  | ✓ |  |
| `createdAt` | string (date-time) | ✓ |  | When the revision was minted |
| `state` | string |  | ✓ | draft, tested_passed, tested_failed, live, previous, or discarded |
| `testRunId` | string (uuid) |  | ✓ | Latest validation run for this revision |
| `testOutcome` | string |  | ✓ | Latest test outcome; absent until a test finishes |
| `liveStats` | any |  | ✓ |  |
| `expiresAt` | string (date-time) |  | ✓ | When this draft expires; preserved after discard |
| `createdByKind` | string |  | ✓ | Tool that created this draft |
| `baseRevision` | any |  | ✓ |  |

