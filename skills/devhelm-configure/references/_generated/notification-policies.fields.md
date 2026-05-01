# notification-policies — field reference

> Auto-generated from the DevHelm OpenAPI spec. Do not edit by hand.
> Regenerate with `node scripts/generate-skill-references.mjs`.

## `CreateNotificationPolicyRequest`

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `name` | string | ✓ |  | Human-readable name for this policy |
| `matchRules` | MatchRule[] |  | ✓ | Match rules to evaluate (all must pass; omit or empty for catch-all) |
| `escalation` | EscalationChain | ✓ |  |  |
| `enabled` | boolean |  | ✓ | Whether this policy is enabled (default true) |
| `priority` | integer (int32) |  | ✓ | Evaluation priority; higher value = evaluated first (default 0) |

## `UpdateNotificationPolicyRequest`

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `name` | string |  | ✓ | Human-readable name for this policy; null preserves current |
| `matchRules` | MatchRule[] |  | ✓ | Match rules to evaluate (all must pass; omit or empty for catch-all) |
| `escalation` | any |  | ✓ |  |
| `enabled` | boolean |  | ✓ | Whether this policy is enabled; null preserves current |
| `priority` | integer (int32) |  | ✓ | Evaluation priority; higher value = evaluated first; null preserves current |

## `NotificationPolicyDto` (response shape)

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `id` | string (uuid) | ✓ |  | Unique notification policy identifier |
| `organizationId` | integer (int32) | ✓ |  | Organization this policy belongs to |
| `name` | string | ✓ |  | Human-readable name for this policy |
| `matchRules` | MatchRule[] | ✓ |  | Match rules (all must pass; empty = catch-all) |
| `escalation` | EscalationChain | ✓ |  |  |
| `enabled` | boolean | ✓ |  | Whether this policy is active |
| `priority` | integer (int32) | ✓ |  | Evaluation order; higher value = evaluated first |
| `createdAt` | string (date-time) | ✓ |  | Timestamp when the policy was created |
| `updatedAt` | string (date-time) | ✓ |  | Timestamp when the policy was last updated |

