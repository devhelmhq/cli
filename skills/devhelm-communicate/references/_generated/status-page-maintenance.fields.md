# status-page-maintenance — field reference

> Auto-generated from the DevHelm OpenAPI spec. Do not edit by hand.
> Regenerate with `node scripts/generate-skill-references.mjs`.

## `CreateStatusPageMaintenanceRequest`

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `title` | string | ✓ |  | Customer-facing maintenance title |
| `status` | "INVESTIGATING" \| "IDENTIFIED" \| "MONITORING" \| "RESOLVED" |  | ✓ | Initial status (default: INVESTIGATING) |
| `impact` | "NONE" \| "MINOR" \| "MAJOR" \| "CRITICAL" | ✓ |  | Impact level: NONE, MINOR, MAJOR, or CRITICAL |
| `body` | string | ✓ |  | Initial update body in markdown |
| `affectedComponents` | AffectedComponent[] |  | ✓ | Component IDs affected by this window |
| `scheduledFor` | string (date-time) | ✓ |  | Maintenance start time |
| `scheduledUntil` | string (date-time) |  | ✓ | Maintenance end time |
| `autoResolve` | boolean |  | ✓ | Auto-resolve at scheduledUntil (default: false) |
| `notifySubscribers` | boolean |  | ✓ | Whether to email confirmed subscribers about this window (default: true) |

