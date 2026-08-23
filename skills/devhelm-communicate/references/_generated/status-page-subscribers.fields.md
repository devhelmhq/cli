# status-page-subscribers — field reference

> Auto-generated from the DevHelm OpenAPI spec. Do not edit by hand.
> Regenerate with `node scripts/generate-skill-references.mjs`.

## `StatusPageSubscriberDto` (response shape)

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `id` | string (uuid) | ✓ |  | Subscriber id |
| `email` | string |  | ✓ | Email when channel is EMAIL; null for other channels |
| `channel` | string | ✓ |  | Delivery channel (EMAIL, SMS, WEBHOOK) |
| `destination` | string | ✓ |  | Channel destination (email, phone, or webhook URL) |
| `componentIds` | string (uuid)[] |  | ✓ | Scoped component IDs; null means whole page |
| `confirmed` | boolean | ✓ |  | Whether the subscriber has confirmed opt-in |
| `confirmationSent` | boolean |  | ✓ | True when this call sent a confirmation email; omitted on list reads |
| `createdAt` | string (date-time) | ✓ |  | When the subscriber was created |

