/**
 * Shared type definitions for the YAML engine.
 *
 * Extracted into a standalone module to avoid circular dependencies
 * between handlers, differ, resolver, and applier.
 */

export type ChangeAction = 'create' | 'update' | 'delete'

export type ResourceType =
  | 'tag' | 'environment' | 'secret' | 'alertChannel'
  | 'notificationPolicy' | 'webhook' | 'resourceGroup'
  | 'monitor' | 'dependency' | 'groupMembership'

/** Resource types that have a full ResourceHandler implementation. */
export type HandledResourceType = Exclude<ResourceType, 'groupMembership'>

export type RefType =
  | 'tags' | 'environments' | 'secrets' | 'alertChannels'
  | 'notificationPolicies' | 'webhooks' | 'resourceGroups'
  | 'monitors' | 'dependencies'

export interface Change {
  action: ChangeAction
  resourceType: ResourceType
  refKey: string
  existingId?: string
  desired?: unknown
  current?: unknown
}

export interface DiffOptions {
  prune?: boolean
}

export interface Changeset {
  creates: Change[]
  updates: Change[]
  deletes: Change[]
  memberships: Change[]
}

/** Dependency order for topological sort (creates ascending, deletes descending). */
export const RESOURCE_ORDER: ResourceType[] = [
  'tag', 'environment', 'secret', 'alertChannel',
  'notificationPolicy', 'webhook', 'resourceGroup',
  'monitor', 'dependency', 'groupMembership',
]
