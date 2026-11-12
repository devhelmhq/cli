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
| `notifySubscribers` | boolean |  | ✓ | Whether to email confirmed subscribers about this incident (default: true) |
| `monitoringIncidentId` | string (uuid) |  | ✓ | Monitoring incident ID to link this status page incident to; null for standalone |
| `templateId` | string (uuid) |  | ✓ | Incident template the incident is created from; null for none |
| `backfill` | boolean |  | ✓ | Import a past incident with its original dates: requires startedAt and resolvedAt, never notifies subscribers and leaves component statuses alone |
| `startedAt` | string (date-time) |  | ✓ | Backfill only: when the incident started |
| `resolvedAt` | string (date-time) |  | ✓ | Backfill only: when the incident was resolved |

## `UpdateStatusPageIncidentRequest`

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `title` | string |  | ✓ | New title; null preserves current |
| `status` | "INVESTIGATING" \| "IDENTIFIED" \| "MONITORING" \| "RESOLVED" |  | ✓ | New status; null preserves current |
| `impact` | "NONE" \| "MINOR" \| "MAJOR" \| "CRITICAL" |  | ✓ | New impact level; null preserves current |
| `affectedComponents` | AffectedComponent[] |  | ✓ | Updated affected components; null preserves current |
| `postmortemBody` | string |  | ✓ | Postmortem body in markdown; empty string clears |
| `postmortemUrl` | string |  | ✓ | URL to an external postmortem document; empty string clears |
| `published` | boolean |  | ✓ | Whether the incident is published on the public page; null preserves current. true publishes (sets publishedAt); false unpublishes (clears publishedAt) |
| `scheduledFor` | string (date-time) |  | ✓ | New maintenance window start; null preserves current. Only for scheduled incidents |
| `scheduledUntil` | string (date-time) |  | ✓ | New maintenance window end; null preserves current. Only for scheduled incidents |
| `autoResolve` | boolean |  | ✓ | Whether the window auto-completes at scheduledUntil; null preserves current |
| `reminderLeadMinutes` | integer (int32)[] |  | ✓ | Maintenance only: minutes before the window to remind subscribers (5–20160 each, distinct); null preserves current, an empty list removes the reminders still to come |
| `notifySubscribersOfPostmortem` | boolean |  | ✓ | Email the postmortem to subscribers (resolved incidents with a postmortem only). Sending the same text again is a no-op; changed text is sent again |

## `StatusPageIncidentDto` (response shape)

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `id` | string (uuid) | ✓ |  |  |
| `statusPageId` | string (uuid) | ✓ |  |  |
| `title` | string | ✓ |  |  |
| `status` | string | ✓ |  |  |
| `impact` | string | ✓ |  |  |
| `scheduled` | boolean | ✓ |  |  |
| `scheduledFor` | string (date-time) |  | ✓ |  |
| `scheduledUntil` | string (date-time) |  | ✓ |  |
| `autoResolve` | boolean | ✓ |  |  |
| `incidentId` | string (uuid) |  | ✓ |  |
| `templateId` | string (uuid) |  | ✓ | Template the incident or maintenance window was created from; null for none |
| `reminderLeadMinutes` | integer (int32)[] |  | ✓ | Maintenance only: minutes before the window that subscribers are reminded; null for incidents |
| `backfilled` | boolean |  |  | Imported after the fact with its original dates; nobody was notified (default: false) |
| `postmortemPublishedAt` | string (date-time) |  | ✓ | When the postmortem was first published to subscribers; null if never |
| `postmortemNotifiedAt` | string (date-time) |  | ✓ | When subscribers were last emailed the postmortem; null if never |
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

