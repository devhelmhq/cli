# status-page-incidents — field reference

> Auto-generated from the DevHelm OpenAPI spec. Do not edit by hand.
> Regenerate with `node scripts/generate-skill-references.mjs`.

## `CreateStatusPageIncidentRequest`

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `title` | string | ✓ |  | Customer-facing incident title |
| `status` | "INVESTIGATING" \| "IDENTIFIED" \| "MONITORING" \| "RESOLVED" |  | ✓ | Initial status (default: INVESTIGATING) |
| `impact` | "NONE" \| "MINOR" \| "MAJOR" \| "CRITICAL" | ✓ |  | Impact level: NONE, MINOR, MAJOR, or CRITICAL |
| `body` | string | ✓ |  | Initial update body in markdown |
| `affectedComponents` | AffectedComponent[] |  | ✓ | Component IDs affected by this incident |
| `scheduled` | boolean |  | ✓ | Whether this is a scheduled maintenance (default: false) |
| `scheduledFor` | string (date-time) |  | ✓ | Maintenance start time (required when scheduled=true) |
| `scheduledUntil` | string (date-time) |  | ✓ | Maintenance end time |
| `autoResolve` | boolean |  | ✓ | Auto-resolve at scheduledUntil (default: false) |
| `notifySubscribers` | boolean |  | ✓ | Whether to email confirmed subscribers about this incident (default: true) |

## `UpdateStatusPageIncidentRequest`

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `title` | string |  | ✓ | New title; null preserves current |
| `status` | "INVESTIGATING" \| "IDENTIFIED" \| "MONITORING" \| "RESOLVED" |  | ✓ | New status; null preserves current |
| `impact` | "NONE" \| "MINOR" \| "MAJOR" \| "CRITICAL" |  | ✓ | New impact level; null preserves current |
| `affectedComponents` | AffectedComponent[] |  | ✓ | Updated affected components; null preserves current |
| `postmortemBody` | string |  | ✓ | Postmortem body in markdown; empty string clears |
| `postmortemUrl` | string |  | ✓ | URL to an external postmortem document; empty string clears |

## `StatusPageIncidentDto` (response shape)

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `id` | string (uuid) | ✓ |  |  |
| `statusPageId` | string (uuid) | ✓ |  |  |
| `title` | string | ✓ |  |  |
| `status` | "INVESTIGATING" \| "IDENTIFIED" \| "MONITORING" \| "RESOLVED" | ✓ |  |  |
| `impact` | "NONE" \| "MINOR" \| "MAJOR" \| "CRITICAL" | ✓ |  |  |
| `scheduled` | boolean | ✓ |  |  |
| `scheduledFor` | string (date-time) |  | ✓ |  |
| `scheduledUntil` | string (date-time) |  | ✓ |  |
| `autoResolve` | boolean | ✓ |  |  |
| `incidentId` | string (uuid) |  | ✓ |  |
| `startedAt` | string (date-time) | ✓ |  |  |
| `publishedAt` | string (date-time) |  | ✓ |  |
| `resolvedAt` | string (date-time) |  | ✓ |  |
| `createdByUserId` | integer (int32) |  | ✓ |  |
| `postmortemBody` | string |  | ✓ |  |
| `postmortemUrl` | string |  | ✓ |  |
| `affectedComponents` | StatusPageIncidentComponentDto[] |  | ✓ |  |
| `updates` | StatusPageIncidentUpdateDto[] |  | ✓ |  |
| `createdAt` | string (date-time) | ✓ |  |  |
| `updatedAt` | string (date-time) | ✓ |  |  |

