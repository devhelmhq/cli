# status-page-subscribers — field reference

> Auto-generated from the DevHelm OpenAPI spec. Do not edit by hand.
> Regenerate with `node scripts/generate-skill-references.mjs`.

## `StatusPageSubscriberDto` (response shape)

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `id` | string (uuid) | ✓ |  | Subscriber id |
| `email` | string |  | ✓ | Email when channel is EMAIL; null for other channels |
| `channel` | string | ✓ |  | Delivery channel (EMAIL, SMS, WEBHOOK, TEAMS) |
| `destination` | string | ✓ |  | Channel destination (email, phone, webhook URL or Teams webhook URL) |
| `componentIds` | string (uuid)[] |  | ✓ | Scoped component IDs; null with no component groups means the whole page |
| `componentGroupIds` | string (uuid)[] |  | ✓ | Component groups followed, including components added to them later; null for none |
| `confirmed` | boolean | ✓ |  | Whether the subscriber has confirmed opt-in |
| `source` | string |  | ✓ | How the subscriber was added (SELF, ADMIN, IMPORT); null if not recorded |
| `confirmationSent` | boolean |  | ✓ | True when this call sent a confirmation email; omitted on list reads |
| `createdAt` | string (date-time) | ✓ |  | When the subscriber was created |

