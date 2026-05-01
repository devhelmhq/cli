# status-page-components — field reference

> Auto-generated from the DevHelm OpenAPI spec. Do not edit by hand.
> Regenerate with `node scripts/generate-skill-references.mjs`.

## `CreateStatusPageComponentRequest`

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `name` | string | ✓ |  | Component display name |
| `description` | string |  | ✓ | Optional description shown on expand |
| `type` | "MONITOR" \| "GROUP" \| "STATIC" | ✓ |  | Component type: MONITOR, GROUP, or STATIC |
| `monitorId` | string (uuid) |  | ✓ | Monitor ID (required when type=MONITOR) |
| `resourceGroupId` | string (uuid) |  | ✓ | Resource group ID (required when type=GROUP) |
| `groupId` | string (uuid) |  | ✓ | Component group ID for visual grouping |
| `showUptime` | boolean |  | ✓ | Whether to show the uptime bar (default: true) |
| `displayOrder` | integer (int32) |  | ✓ | Position in the component list |
| `excludeFromOverall` | boolean |  | ✓ | Exclude from overall status calculation (default: false, use true for third-party deps) |
| `startDate` | string (date) |  | ✓ | Date from which to start showing uptime; defaults to component creation. Set earlier to backdate (e.g. launch day); clamped at the monitor's createdAt for MONITOR-type components |

## `UpdateStatusPageComponentRequest`

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `name` | string |  | ✓ | New component name; null preserves current |
| `description` | string |  | ✓ | New description; null preserves current, empty string clears |
| `groupId` | string (uuid) |  | ✓ | Move to a different group; null preserves current |
| `removeFromGroup` | boolean |  | ✓ | Remove the component from its group (default: false) |
| `showUptime` | boolean |  | ✓ | Whether to show the uptime bar; null preserves current |
| `displayOrder` | integer (int32) |  | ✓ | New position in the component list; null preserves current |
| `excludeFromOverall` | boolean |  | ✓ | Exclude from overall status calculation; null preserves current |
| `startDate` | string (date) |  | ✓ | Date from which to start showing uptime; null preserves current. Bars never extend earlier than the underlying monitor's createdAt regardless of value |

## `StatusPageComponentDto` (response shape)

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `id` | string (uuid) | ✓ |  |  |
| `statusPageId` | string (uuid) | ✓ |  |  |
| `groupId` | string (uuid) |  | ✓ |  |
| `name` | string | ✓ |  |  |
| `description` | string |  | ✓ |  |
| `type` | "MONITOR" \| "GROUP" \| "STATIC" | ✓ |  |  |
| `monitorId` | string (uuid) |  | ✓ |  |
| `resourceGroupId` | string (uuid) |  | ✓ |  |
| `currentStatus` | "OPERATIONAL" \| "DEGRADED_PERFORMANCE" \| "PARTIAL_OUTAGE" \| "MAJOR_OUTAGE" \| "UNDER_MAINTENANCE" | ✓ |  |  |
| `showUptime` | boolean | ✓ |  |  |
| `displayOrder` | integer (int32) | ✓ |  |  |
| `pageOrder` | integer (int32) | ✓ |  |  |
| `excludeFromOverall` | boolean | ✓ |  |  |
| `startDate` | string (date-time) |  | ✓ |  |
| `createdAt` | string (date-time) | ✓ |  |  |
| `updatedAt` | string (date-time) | ✓ |  |  |

