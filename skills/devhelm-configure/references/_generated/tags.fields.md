# tags — field reference

> Auto-generated from the DevHelm OpenAPI spec. Do not edit by hand.
> Regenerate with `node scripts/generate-skill-references.mjs`.

## `CreateTagRequest`

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `name` | string | ✓ |  | Tag name, unique within the org |
| `color` | string |  | ✓ | Hex color code (defaults to #6B7280 if omitted) |

## `UpdateTagRequest`

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `name` | string |  | ✓ | New tag name |
| `color` | string |  | ✓ | New hex color code |

## `TagDto` (response shape)

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `id` | string (uuid) | ✓ |  | Unique tag identifier |
| `organizationId` | integer (int32) | ✓ |  | Organization this tag belongs to |
| `name` | string | ✓ |  | Tag name, unique within the org |
| `color` | string | ✓ |  | Hex color code for display (e.g. #6B7280) |
| `createdAt` | string (date-time) | ✓ |  | Timestamp when the tag was created |
| `updatedAt` | string (date-time) | ✓ |  | Timestamp when the tag was last updated |

