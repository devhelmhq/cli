# secrets — field reference

> Auto-generated from the DevHelm OpenAPI spec. Do not edit by hand.
> Regenerate with `node scripts/generate-skill-references.mjs`.

## `CreateSecretRequest`

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `key` | string | ✓ |  | Unique secret key within the workspace (max 255 chars) |
| `value` | string | ✓ |  | Secret value, stored encrypted (max 32KB) |

## `UpdateSecretRequest`

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `value` | string | ✓ |  | New secret value, stored encrypted (max 32KB) |

## `SecretDto` (response shape)

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `id` | string (uuid) | ✓ |  | Unique secret identifier |
| `key` | string | ✓ |  | Secret key name, unique within the workspace |
| `dekVersion` | integer (int32) | ✓ |  | DEK version at the time of last encryption |
| `valueHash` | string | ✓ |  | SHA-256 hex digest of the current plaintext; use for change detection |
| `createdAt` | string (date-time) | ✓ |  | Timestamp when the secret was created |
| `updatedAt` | string (date-time) | ✓ |  | Timestamp when the secret was last updated |
| `usedByMonitors` | MonitorReference[] |  | ✓ | Monitors that reference this secret; null on create/update responses |

