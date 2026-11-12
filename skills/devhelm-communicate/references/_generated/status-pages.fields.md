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
| `visibility` | "PUBLIC" \| "PASSWORD" \| "IP_RESTRICTED" \| "LOGIN_REQUIRED" |  | ✓ | Page visibility: PUBLIC, PASSWORD, or IP_RESTRICTED (default: PUBLIC) |
| `enabled` | boolean |  | ✓ | Whether the page is enabled (default: true) |
| `incidentMode` | "MANUAL" \| "REVIEW" \| "AUTOMATIC" |  | ✓ | Incident mode: MANUAL, REVIEW, or AUTOMATIC (default: AUTOMATIC) |
| `managedBy` | "DASHBOARD" \| "CLI" \| "TERRAFORM" \| "MCP" \| "API" \| "GIT" |  | ✓ | Source creating this page: DASHBOARD, GIT, TERRAFORM, MCP or API (CLI = GIT until 2027-01-31). Defaults to API when omitted. |

## `UpdateStatusPageRequest`

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `name` | string |  | ✓ | New name; null preserves current |
| `description` | string |  | ✓ | New description; null preserves current, empty string clears |
| `branding` | any |  | ✓ |  |
| `visibility` | "PUBLIC" \| "PASSWORD" \| "IP_RESTRICTED" \| "LOGIN_REQUIRED" |  | ✓ | Page visibility; null preserves current |
| `emailSignIn` | "PASSWORD" \| "MAGIC_LINK" |  | ✓ | Email sign-in method besides SSO: PASSWORD or MAGIC_LINK; null preserves current |
| `clearEmailSignIn` | boolean |  | ✓ | Set to true to turn email sign-in off |
| `enabled` | boolean |  | ✓ | Whether the page is enabled; null preserves current |
| `incidentMode` | "MANUAL" \| "REVIEW" \| "AUTOMATIC" |  | ✓ | Incident mode: MANUAL, REVIEW, or AUTOMATIC; null preserves current |
| `managedBy` | "DASHBOARD" \| "CLI" \| "TERRAFORM" \| "MCP" \| "API" \| "GIT" |  | ✓ | New attribution source: DASHBOARD, GIT, TERRAFORM, MCP or API (CLI = GIT until 2027-01-31); null preserves current value. |
| `subscriberChannels` | "EMAIL" \| "SMS" \| "WEBHOOK" \| "TEAMS"[] |  | ✓ | Channels visitors can subscribe with (EMAIL, TEAMS, WEBHOOK); null preserves current |
| `confirmPublic` | boolean |  | ✓ | Confirms making a sign-in page public, which signs out its viewers |
| `confirmConvertSubscribers` | boolean |  | ✓ | Confirms making a page private converts its email subscribers to invited end users |

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
| `visibility` | string | ✓ |  |  |
| `enabled` | boolean | ✓ |  |  |
| `emailSignIn` | string |  | ✓ | Email sign-in method besides SSO: PASSWORD or MAGIC_LINK; null when off |
| `incidentMode` | string | ✓ |  |  |
| `componentCount` | integer (int32) |  | ✓ |  |
| `subscriberCount` | integer (int64) |  | ✓ |  |
| `overallStatus` | string |  | ✓ |  |
| `openIncident` | any |  | ✓ |  |
| `managedBy` | string |  | ✓ | Source that created/owns this status page: DASHBOARD, GIT, TERRAFORM, MCP or API. Null on pages created before this attribution column existed. |
| `subscriberChannels` | string[] | ✓ |  | Channels visitors can subscribe with on the public page (EMAIL, TEAMS, WEBHOOK) |
| `createdAt` | string (date-time) | ✓ |  |  |
| `updatedAt` | string (date-time) | ✓ |  |  |

