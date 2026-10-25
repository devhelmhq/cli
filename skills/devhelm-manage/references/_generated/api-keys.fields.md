# api-keys — field reference

> Auto-generated from the DevHelm OpenAPI spec. Do not edit by hand.
> Regenerate with `node scripts/generate-skill-references.mjs`.

## `CreateApiKeyRequest`

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `name` | string | ✓ |  | Human-readable name to identify this API key |
| `expiresAt` | string (date-time) |  | ✓ | Optional expiration timestamp in ISO 8601 format |
| `preset` | string |  | ✓ | Preset expanded into scopes: ci-pr, ci-deploy, agent-responder, agent-author |
| `scopes` | string[] |  | ✓ | Scopes to grant (default: full) |
| `tool` | "DASHBOARD" \| "CLI" \| "TERRAFORM" \| "MCP" \| "API" |  | ✓ | Tool this key writes as on owner-enforced monitors (default: API) |

## `UpdateApiKeyRequest`

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `name` | string | ✓ |  | New name for this API key |

## `ApiKeyDto` (response shape)

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `id` | integer (int32) | ✓ |  | Unique API key identifier |
| `name` | string | ✓ |  | Human-readable name for this API key |
| `key` | string | ✓ |  | Full API key value in dh_live_* format |
| `createdAt` | string (date-time) | ✓ |  | Timestamp when the key was created |
| `updatedAt` | string (date-time) | ✓ |  | Timestamp when the key was last updated |
| `lastUsedAt` | string (date-time) |  | ✓ | Timestamp of the most recent API call; null if never used |
| `revokedAt` | string (date-time) |  | ✓ | Timestamp when the key was revoked; null if active |
| `expiresAt` | string (date-time) |  | ✓ | Timestamp when the key expires; null if no expiration |
| `scopes` | string[] | ✓ |  | Scopes this key is allowed to call; full grants everything |
| `tool` | string |  | ✓ | Tool this key writes as on owner-enforced monitors; null means API |

