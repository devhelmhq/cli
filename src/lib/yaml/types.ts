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
}

export interface DiffOptions {
  prune?: boolean
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
