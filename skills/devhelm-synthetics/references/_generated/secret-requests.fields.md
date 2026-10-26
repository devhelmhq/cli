# secret-requests — field reference

> Auto-generated from the DevHelm OpenAPI spec. Do not edit by hand.
> Regenerate with `node scripts/generate-skill-references.mjs`.

## `MonitorSecretRequestsDto`

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `environment` | EnvironmentDto | ✓ |  |  |
| `requests` | SecretRequestDto[] | ✓ |  | Secret keys this monitor requires and their resolve state |
| `undemanded` | SecretRequestDto[] |  | ✓ | Keys retained outside the selected revision scanned demand |

## `SecretRequestDto`

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `key` | string | ✓ |  | Secret key this monitor requires |
| `secret` | any |  | ✓ |  |
| `readiness` | string | ✓ |  | Whether this key is resolved or missing |
| `fulfilledBy` | string |  | ✓ | Fulfilled from environment variables or a secret |
| `declaringFile` | string |  | ✓ | Declaring file path inside the package zip |
| `declaringLocation` | string |  | ✓ | Call site from package scan, e.g. signIn(…) · line 6 |
| `lastResolvedAt` | string (date-time) |  | ✓ | When a run last resolved this key |
| `lastResolvedRunId` | string (uuid) |  | ✓ | Run that last resolved this key |
| `demanded` | boolean |  | ✓ | Whether the selected revision statically declares this key |
| `attached` | boolean |  | ✓ | Whether this key is attached for vault resolution |
| `valueStamp` | any |  | ✓ |  |

