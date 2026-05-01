# workspaces — field reference

> Auto-generated from the DevHelm OpenAPI spec. Do not edit by hand.
> Regenerate with `node scripts/generate-skill-references.mjs`.

## `WorkspaceDto` (response shape)

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `id` | integer (int32) | ✓ |  | Unique workspace identifier |
| `createdAt` | string (date-time) | ✓ |  | Timestamp when the workspace was created |
| `updatedAt` | string (date-time) | ✓ |  | Timestamp when the workspace was last updated |
| `name` | string | ✓ |  | Workspace name |
| `orgId` | integer (int32) | ✓ |  | Organization this workspace belongs to |

