# incidents — field reference

> Auto-generated from the DevHelm OpenAPI spec. Do not edit by hand.
> Regenerate with `node scripts/generate-skill-references.mjs`.

## `IncidentDto` (response shape)

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `id` | string (uuid) | ✓ |  | Unique incident identifier |
| `monitorId` | string (uuid) |  | ✓ | Monitor that triggered the incident; null for service or manual incidents |
| `organizationId` | integer (int32) | ✓ |  | Organization this incident belongs to |
| `source` | "AUTOMATIC" \| "MANUAL" \| "MONITORS" \| "STATUS_DATA" \| "RESOURCE_GROUP" | ✓ |  | Incident origin: MONITOR, SERVICE, or MANUAL |
| `status` | "WATCHING" \| "TRIGGERED" \| "CONFIRMED" \| "RESOLVED" | ✓ |  | Current lifecycle status (OPEN, RESOLVED, etc.) |
| `severity` | "DOWN" \| "DEGRADED" \| "MAINTENANCE" | ✓ |  | Severity level: DOWN, DEGRADED, or MAINTENANCE |
| `title` | string |  | ✓ | Short summary of the incident; null for auto-generated incidents |
| `triggeredByRule` | string |  | ✓ | Human-readable description of the trigger rule that fired |
| `affectedRegions` | string[] | ✓ |  | Probe regions that observed the failure |
| `reopenCount` | integer (int32) | ✓ |  | Number of times this incident has been reopened |
| `createdByUserId` | integer (int32) |  | ✓ | User who created the incident (manual incidents only) |
| `statusPageVisible` | boolean | ✓ |  | Whether this incident is visible on the status page |
| `serviceIncidentId` | string (uuid) |  | ✓ | Linked vendor service incident ID; null for monitor incidents |
| `serviceId` | string (uuid) |  | ✓ | Linked service catalog ID; null for monitor incidents |
| `externalRef` | string |  | ✓ | External reference ID (e.g. PagerDuty incident ID) |
| `affectedComponents` | string[] |  | ✓ | Service components affected by this incident |
| `shortlink` | string |  | ✓ | Short URL linking to the incident details |
| `resolutionReason` | "MANUAL" \| "AUTO_RECOVERED" \| "AUTO_RESOLVED" |  | ✓ | How the incident was resolved (AUTO_RECOVERED, MANUAL, etc.) |
| `startedAt` | string (date-time) |  | ✓ | Timestamp when the incident was detected or created |
| `confirmedAt` | string (date-time) |  | ✓ | Timestamp when the incident was confirmed (multi-region confirmation) |
| `resolvedAt` | string (date-time) |  | ✓ | Timestamp when the incident was resolved |
| `cooldownUntil` | string (date-time) |  | ✓ | Cooldown window end; new incidents suppressed until this time |
| `createdAt` | string (date-time) | ✓ |  | Timestamp when the incident record was created |
| `updatedAt` | string (date-time) | ✓ |  | Timestamp when the incident was last updated |
| `monitorName` | string |  | ✓ | Name of the associated monitor; populated on list responses. Omitted from JSON (undefined to SDKs) on detail responses, treat missing as null. |
| `serviceName` | string |  | ✓ | Name of the associated service; populated on list responses. Omitted from JSON (undefined to SDKs) on detail responses, treat missing as null. |
| `serviceSlug` | string |  | ✓ | Slug of the associated service; populated on list responses. Omitted from JSON (undefined to SDKs) on detail responses, treat missing as null. |
| `monitorType` | string |  | ✓ | Type of the associated monitor; populated on list responses. Omitted from JSON (undefined to SDKs) on detail responses, treat missing as null. |
| `resourceGroupId` | string (uuid) |  | ✓ | Resource group that owns this incident; null when not group-managed |
| `resourceGroupName` | string |  | ✓ | Name of the resource group; populated on list responses. Omitted from JSON (undefined to SDKs) on detail responses, treat missing as null. |
| `triggeringCheckId` | string (uuid) |  | ✓ | Scheduler-minted check execution ID whose result confirmed this incident; joins to check_results, rule_evaluations, and incident_state_transitions. Omitted from JSON (undefined to SDKs) when null, treat missing as null. |
| `triggeredByRuleSnapshotHashHex` | string |  | ✓ | Hex SHA-256 of the canonical policy snapshot that fired; combined with triggeredByRuleIndex points to the exact TriggerRule. Omitted from JSON when null, treat missing as null. |
| `triggeredByRuleIndex` | integer (int32) |  | ✓ | Index of the fired rule inside the policy's trigger_rules array. Omitted from JSON when null, treat missing as null. |
| `engineVersion` | string |  | ✓ | Detection engine semver that evaluated the rule. Omitted from JSON when null, treat missing as null. |

