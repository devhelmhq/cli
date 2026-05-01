# check-results — field reference

> Auto-generated from the DevHelm OpenAPI spec. Do not edit by hand.
> Regenerate with `node scripts/generate-skill-references.mjs`.

## `CheckResultDto` (response shape)

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `id` | string (uuid) | ✓ |  | Unique identifier of the check result |
| `timestamp` | string (date-time) | ✓ |  | Timestamp when the check was executed (ISO 8601) |
| `region` | string | ✓ |  | Region where the check was executed |
| `responseTimeMs` | integer (int32) |  | ✓ | Response time in milliseconds |
| `passed` | boolean | ✓ |  | Whether the check passed |
| `failureReason` | string |  | ✓ | Reason for failure when passed=false |
| `severityHint` | string |  | ✓ | Severity hint: 'down' for hard failures, 'degraded' for warn-only failures, null when passing |
| `details` | any |  | ✓ |  |
| `checkId` | string (uuid) |  | ✓ | Unique execution trace ID for cross-service correlation |

