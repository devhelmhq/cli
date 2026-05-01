# resource-groups — field reference

> Auto-generated from the DevHelm OpenAPI spec. Do not edit by hand.
> Regenerate with `node scripts/generate-skill-references.mjs`.

## `CreateResourceGroupRequest`

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `name` | string | ✓ |  | Human-readable name for this group |
| `description` | string |  | ✓ | Optional description |
| `alertPolicyId` | string (uuid) |  | ✓ | Optional notification policy to apply for this group |
| `defaultFrequency` | integer (int32) |  | ✓ | Default check frequency in seconds applied to members (30–86400) |
| `defaultRegions` | string[] |  | ✓ | Default regions applied to member monitors |
| `defaultRetryStrategy` | any |  | ✓ |  |
| `defaultAlertChannels` | string (uuid)[] |  | ✓ | Default alert channel IDs applied to member monitors |
| `defaultEnvironmentId` | string (uuid) |  | ✓ | Default environment ID applied to member monitors |
| `healthThresholdType` | "COUNT" \| "PERCENTAGE" |  | ✓ | Health threshold type: COUNT or PERCENTAGE |
| `healthThresholdValue` | number |  | ✓ | Health threshold value: count (0+) or percentage (0–100) |
| `suppressMemberAlerts` | boolean |  | ✓ | Suppress member-level alert notifications when group manages alerting |
| `confirmationDelaySeconds` | integer (int32) |  | ✓ | Confirmation delay in seconds before group incident creation (0–600) |
| `recoveryCooldownMinutes` | integer (int32) |  | ✓ | Recovery cooldown in minutes after group incident resolves (0–60) |

## `UpdateResourceGroupRequest`

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `name` | string | ✓ |  | Human-readable name for this group |
| `description` | string |  | ✓ | Optional description; null clears the existing value |
| `alertPolicyId` | string (uuid) |  | ✓ | Optional notification policy to apply for this group; null clears the existing value |
| `defaultFrequency` | integer (int32) |  | ✓ | Default check frequency in seconds for members (30–86400); null clears |
| `defaultRegions` | string[] |  | ✓ | Default regions for member monitors; null clears |
| `defaultRetryStrategy` | any |  | ✓ |  |
| `defaultAlertChannels` | string (uuid)[] |  | ✓ | Default alert channel IDs for member monitors; null clears |
| `defaultEnvironmentId` | string (uuid) |  | ✓ | Default environment ID for member monitors; null clears |
| `healthThresholdType` | "COUNT" \| "PERCENTAGE" |  | ✓ | Health threshold type: COUNT or PERCENTAGE; null disables threshold |
| `healthThresholdValue` | number |  | ✓ | Health threshold value; null disables threshold |
| `suppressMemberAlerts` | boolean |  | ✓ | Suppress member-level alert notifications; null preserves current value |
| `confirmationDelaySeconds` | integer (int32) |  | ✓ | Confirmation delay in seconds; null clears |
| `recoveryCooldownMinutes` | integer (int32) |  | ✓ | Recovery cooldown in minutes; null clears |

## `ResourceGroupDto` (response shape)

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `id` | string (uuid) | ✓ |  | Unique resource group identifier |
| `organizationId` | integer (int32) | ✓ |  | Organization this group belongs to |
| `name` | string | ✓ |  | Human-readable group name |
| `slug` | string | ✓ |  | URL-safe group identifier |
| `description` | string |  | ✓ | Optional group description |
| `alertPolicyId` | string (uuid) |  | ✓ | Notification policy applied to this group |
| `defaultFrequency` | integer (int32) |  | ✓ | Default check frequency in seconds for member monitors |
| `defaultRegions` | string[] |  | ✓ | Default regions for member monitors |
| `defaultRetryStrategy` | any |  | ✓ |  |
| `defaultAlertChannels` | string (uuid)[] |  | ✓ | Default alert channel IDs for member monitors |
| `defaultEnvironmentId` | string (uuid) |  | ✓ | Default environment ID for member monitors |
| `healthThresholdType` | "COUNT" \| "PERCENTAGE" |  | ✓ | Health threshold type: COUNT or PERCENTAGE |
| `healthThresholdValue` | number |  | ✓ | Health threshold value |
| `suppressMemberAlerts` | boolean | ✓ |  | When true, member-level incidents skip notification dispatch; only group alerts fire |
| `confirmationDelaySeconds` | integer (int32) |  | ✓ | Seconds to wait after health threshold breach before creating group incident |
| `recoveryCooldownMinutes` | integer (int32) |  | ✓ | Cooldown minutes after group incident resolves before a new one can open |
| `health` | ResourceGroupHealthDto | ✓ |  |  |
| `members` | ResourceGroupMemberDto[] |  | ✓ | Member list with individual statuses; populated on detail GET only |
| `createdAt` | string (date-time) | ✓ |  | Timestamp when the group was created |
| `updatedAt` | string (date-time) | ✓ |  | Timestamp when the group was last updated |

