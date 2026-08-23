# incidents — field reference

> Auto-generated from the DevHelm OpenAPI spec. Do not edit by hand.
> Regenerate with `node scripts/generate-skill-references.mjs`.

## `UpdateIncidentRequest`

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `title` | string |  | ✓ | New title; null preserves current (min 1 char if present) |
| `severity` | "DOWN" \| "DEGRADED" \| "MAINTENANCE" |  | ✓ | New severity: DOWN, DEGRADED, or MAINTENANCE; null preserves current |

## `IncidentDto` (response shape)

| Field | Type | Required | Nullable | Description |
|---|---|---|---|---|
| `id` | string (uuid) | ✓ |  | Unique incident identifier |
| `monitorId` | string (uuid) |  | ✓ | Monitor that triggered the incident; null for service or manual incidents |
| `organizationId` | integer (int32) | ✓ |  | Organization this incident belongs to |
| `source` | string | ✓ |  | Incident origin: MONITOR, SERVICE, or MANUAL |
| `status` | string | ✓ |  | Current lifecycle status (OPEN, RESOLVED, etc.) |
| `severity` | string | ✓ |  | Severity level: DOWN, DEGRADED, or MAINTENANCE |
| `title` | string |  | ✓ | Short summary of the incident; null for auto-generated incidents |
| `triggeredByRule` | string |  | ✓ | Human-readable description of the trigger rule that fired |
| `affectedRegions` | string[] | ✓ |  | Probe regions that observed the failure |
| `reopenCount` | integer (int32) | ✓ |  | Number of times this incident has been reopened |
| `createdByUserId` | integer (int32) |  | ✓ | User who created the incident (manual incidents only) |
| `statusPageVisible` | boolean | ✓ |  | Whether this incident is visible on the status page |
| `suppressDispatch` | boolean | ✓ |  | When true, alert channels are suppressed (AWARENESS silent tracking); false means Alerted |
| `serviceIncidentId` | string (uuid) |  | ✓ | Linked vendor service incident ID; null for monitor incidents |
| `serviceId` | string (uuid) |  | ✓ | Linked service catalog ID; null for monitor incidents |
| `externalRef` | string |  | ✓ | External reference ID (e.g. PagerDuty incident ID) |
| `affectedComponents` | string[] |  | ✓ | Service components affected by this incident |
| `shortlink` | string |  | ✓ | Short URL linking to the incident details |
| `resolutionReason` | string |  | ✓ | How the incident was resolved (AUTO_RECOVERED, MANUAL, etc.) |
| `resolutionNote` | string |  | ✓ | Body from the most recent resolve update; null when not currently resolved, auto-resolved without a note, or no resolve update body was provided |
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
| `displayKey` | string |  | ✓ | Org-scoped human-readable incident code, e.g. "ABC-42". Null on incidents created by pre-INC-keys API pods before the sweep; treat missing as unknown and fall back to the id |
| `alertCollapsedByResourceGroupIds` | string (uuid)[] |  | ✓ | Sticky union of resource-group IDs that suppressed a paging dispatch for this member incident; null when never written / legacy |
| `peakFailingMemberCount` | integer (int32) |  | ✓ | Peak non-operational member count while this RESOURCE_GROUP incident was open; null otherwise |
| `failingMembersAtPeak` | IncidentFailingMemberSnapshotDto[] |  | ✓ | Frozen failing members at peakFailingMemberCount; null when not a group incident or never snapshotted |

