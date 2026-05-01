# audit-events — field reference

> Auto-generated from the DevHelm OpenAPI spec. Do not edit by hand.
> Regenerate with `node scripts/generate-skill-references.mjs`.

## `AuditEventDto` (response shape)

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `id` | integer (int64) | ✓ |  | Unique audit event identifier |
| `actorId` | integer (int32) |  | ✓ | User ID who performed the action; null for system actions |
| `actorEmail` | string |  | ✓ | Email of the actor; null for system actions |
| `action` | string | ✓ |  | Audit action type (e.g. monitor.created, api_key.revoked) |
| `resourceType` | string |  | ✓ | Type of resource affected (e.g. monitor, api_key) |
| `resourceId` | string |  | ✓ | ID of the affected resource |
| `resourceName` | string |  | ✓ | Human-readable name of the affected resource |
| `metadata` | any |  | ✓ |  |
| `createdAt` | string (date-time) | ✓ |  | Timestamp when the action was performed |

