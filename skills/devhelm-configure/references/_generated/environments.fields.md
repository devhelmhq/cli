# environments — field reference

> Auto-generated from the DevHelm OpenAPI spec. Do not edit by hand.
> Regenerate with `node scripts/generate-skill-references.mjs`.

## `CreateEnvironmentRequest`

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `name` | string | ✓ |  | Human-readable environment name |
| `slug` | string | ✓ |  | URL-safe identifier (lowercase alphanumeric, hyphens, underscores) |
| `variables` | Map<string, string> |  | ✓ | Initial key-value variable pairs for this environment |
| `isDefault` | boolean |  | ✓ | Whether this is the default environment for new monitors (default: false) |

## `UpdateEnvironmentRequest`

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `name` | string |  | ✓ | New environment name; null preserves current |
| `variables` | Map<string, string> |  | ✓ | Replace all variables; null preserves current |
| `isDefault` | boolean |  | ✓ | Whether this is the default environment; null preserves current |

## `EnvironmentDto` (response shape)

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `id` | string (uuid) | ✓ |  | Unique environment identifier |
| `orgId` | integer (int32) | ✓ |  | Organization this environment belongs to |
| `name` | string | ✓ |  | Human-readable environment name |
| `slug` | string | ✓ |  | URL-safe identifier |
| `variables` | Map<string, string> | ✓ |  | Key-value variable pairs available for interpolation |
| `createdAt` | string (date-time) | ✓ |  | Timestamp when the environment was created |
| `updatedAt` | string (date-time) | ✓ |  | Timestamp when the environment was last updated |
| `monitorCount` | integer (int32) | ✓ |  | Number of monitors using this environment |
| `isDefault` | boolean | ✓ |  | Whether this is the default environment for new monitors |

