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

/** Resource types that have a full ResourceHandler implementation. */
export type HandledResourceType = Exclude<ResourceType, 'groupMembership'>

export type RefType =
  | 'tags' | 'environments' | 'secrets' | 'alertChannels'
  | 'notificationPolicies' | 'webhooks' | 'resourceGroups'
  | 'monitors' | 'dependencies'

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
}

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
  pruneAll?: boolean
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
