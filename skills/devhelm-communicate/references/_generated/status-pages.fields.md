# status-pages — field reference

> Auto-generated from the DevHelm OpenAPI spec. Do not edit by hand.
> Regenerate with `node scripts/generate-skill-references.mjs`.

## `CreateStatusPageRequest`

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `name` | string | ✓ |  | Human-readable name for this status page |
| `slug` | string | ✓ |  | URL slug (lowercase, hyphens, globally unique) |
| `description` | string |  | ✓ | Optional description shown below the page header |
| `branding` | any |  | ✓ |  |
| `visibility` | "PUBLIC" \| "PASSWORD" \| "IP_RESTRICTED" |  | ✓ | Page visibility: PUBLIC, PASSWORD, or IP_RESTRICTED (default: PUBLIC) |
| `enabled` | boolean |  | ✓ | Whether the page is enabled (default: true) |
| `incidentMode` | "MANUAL" \| "REVIEW" \| "AUTOMATIC" |  | ✓ | Incident mode: MANUAL, REVIEW, or AUTOMATIC (default: AUTOMATIC) |
| `managedBy` | "DASHBOARD" \| "CLI" \| "TERRAFORM" \| "MCP" \| "API" |  | ✓ | Source creating this page: DASHBOARD, CLI, TERRAFORM, MCP, or API. Defaults to API when omitted. |

## `UpdateStatusPageRequest`

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `name` | string |  | ✓ | New name; null preserves current |
| `description` | string |  | ✓ | New description; null preserves current, empty string clears |
| `branding` | any |  | ✓ |  |
| `visibility` | "PUBLIC" \| "PASSWORD" \| "IP_RESTRICTED" |  | ✓ | Page visibility; null preserves current |
| `enabled` | boolean |  | ✓ | Whether the page is enabled; null preserves current |
| `incidentMode` | "MANUAL" \| "REVIEW" \| "AUTOMATIC" |  | ✓ | Incident mode: MANUAL, REVIEW, or AUTOMATIC; null preserves current |
| `managedBy` | "DASHBOARD" \| "CLI" \| "TERRAFORM" \| "MCP" \| "API" |  | ✓ | New attribution source: DASHBOARD, CLI, TERRAFORM, MCP, or API; null preserves current value. |

## `StatusPageDto` (response shape)

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `id` | string (uuid) | ✓ |  |  |
| `organizationId` | integer (int32) | ✓ |  |  |
| `workspaceId` | integer (int32) | ✓ |  |  |
| `name` | string | ✓ |  |  |
| `slug` | string | ✓ |  |  |
| `description` | string |  | ✓ |  |
| `branding` | StatusPageBranding | ✓ |  |  |
| `visibility` | "PUBLIC" \| "PASSWORD" \| "IP_RESTRICTED" | ✓ |  |  |
| `enabled` | boolean | ✓ |  |  |
| `incidentMode` | "MANUAL" \| "REVIEW" \| "AUTOMATIC" | ✓ |  |  |
| `componentCount` | integer (int32) |  | ✓ |  |
| `subscriberCount` | integer (int64) |  | ✓ |  |
| `overallStatus` | "OPERATIONAL" \| "DEGRADED_PERFORMANCE" \| "PARTIAL_OUTAGE" \| "MAJOR_OUTAGE" \| "UNDER_MAINTENANCE" |  | ✓ |  |
| `managedBy` | "DASHBOARD" \| "CLI" \| "TERRAFORM" \| "MCP" \| "API" |  | ✓ | Source that created/owns this status page: DASHBOARD, CLI, TERRAFORM, MCP, or API. Null on pages created before this attribution column existed. |
| `createdAt` | string (date-time) | ✓ |  |  |
| `updatedAt` | string (date-time) | ✓ |  |  |

