/**
 * Shared type definitions for the YAML engine.
 *
 * Extracted into a standalone module to avoid circular dependencies
 * between handlers, differ, resolver, and applier.
 */
import type {components} from '../api.generated.js'

type Schemas = components['schemas']

export type ChangeAction = 'create' | 'update' | 'delete'

export type ResourceType =
  | 'tag' | 'environment' | 'secret' | 'alertChannel'
  | 'notificationPolicy' | 'webhook' | 'resourceGroup'
  | 'monitor' | 'dependency' | 'groupMembership'
  | 'statusPage'

/** Resource types that have a full ResourceHandler implementation. */
export type HandledResourceType = Exclude<ResourceType, 'groupMembership'>

export type RefType =
  | 'tags' | 'environments' | 'secrets' | 'alertChannels'
  | 'notificationPolicies' | 'webhooks' | 'resourceGroups'
  | 'monitors' | 'dependencies' | 'statusPages'

/** Maps each RefType to the API DTO stored in RefEntry.raw. */
export interface RefTypeDtoMap {
  tags: Schemas['TagDto']
  environments: Schemas['EnvironmentDto']
  secrets: Schemas['SecretDto']
  alertChannels: Schemas['AlertChannelDto']
  notificationPolicies: Schemas['NotificationPolicyDto']
  webhooks: Schemas['WebhookEndpointDto']
  resourceGroups: Schemas['ResourceGroupDto']
  monitors: Schemas['MonitorDto']
  dependencies: Schemas['ServiceSubscriptionDto']
  statusPages: Schemas['StatusPageDto']
}

export interface AttributeDiff {
  field: string
  old: unknown
  new: unknown
}

export interface Change {
  action: ChangeAction
  resourceType: ResourceType
  refKey: string
  existingId?: string
  desired?: unknown
  current?: unknown
  /** Attribute-level diffs for update changes */
  attributeDiffs?: AttributeDiff[]
  /**
   * For `delete` actions only — which prune scope produced the change.
   * `state` means the resource was tracked in this config's
   * `.devhelm/state.json`; `org-cli` means it's CLI-managed elsewhere
   * in the org; `org-all` is anything else surfaced under `--prune-all`.
   * Drives the grouped output in `formatPlan` so multi-team users can
   * tell at a glance which destroys are theirs.
   */
  pruneScope?: PruneScope
}

export type PruneScope = 'state' | 'org-cli' | 'org-all'

export interface DiffOptions {
  /**
   * Delete resources tracked in `.devhelm/state.json` that are absent
   * from YAML. Safe in multi-config orgs because it only touches
   * resources THIS config previously created (DevEx P0.Bug1).
   */
  prune?: boolean
  /**
   * Delete CLI-managed resources org-wide that are absent from YAML —
   * the legacy `--prune` behaviour. Required to clean up resources
   * created from a different YAML file or by an earlier reset of the
   * local state. Use with caution in shared workspaces.
   */
  pruneOrgCli?: boolean
  /**
   * Delete ALL resources absent from YAML, including dashboard- and
   * Terraform-managed ones. The most destructive option; reserve for
   * single-tenant workspaces or scripted teardowns.
   */
  pruneAll?: boolean
}

export interface Changeset {
  creates: Change[]
  updates: Change[]
  deletes: Change[]
  memberships: Change[]
}

/** Dependency order for topological sort (creates ascending, deletes descending). */
// Resource ordering for create/update phase. Dependencies flow downward:
// each item may reference items above it but not below.
//
// `notificationPolicy` is placed *after* `monitor` because policy matchRules
// can reference monitor IDs (selecting which monitors a policy applies to).
// `monitor.incidentPolicy` does NOT reference a NotificationPolicy entity —
// it's an inline trigger/confirmation/recovery config — so there's no cycle.
export const RESOURCE_ORDER: ResourceType[] = [
  'tag', 'environment', 'secret', 'alertChannel',
  'webhook', 'resourceGroup',
  'monitor', 'notificationPolicy', 'dependency', 'groupMembership',
  'statusPage',
]
