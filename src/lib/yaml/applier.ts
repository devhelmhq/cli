/**
 * Executes a changeset against the API in dependency order.
 *
 * Delegates all per-resource-type create/update/delete operations to typed
 * handlers in handlers.ts — no switch/case or `as YamlFoo` casts here.
 */
import type {ApiClient} from '../api-client.js'
import {checkedFetch, apiDelete} from '../api-client.js'
import {HANDLER_MAP} from './handlers.js'
import type {Changeset, Change, HandledResourceType} from './types.js'
import type {ResolvedRefs} from './resolver.js'
import type {StateEntry} from './state.js'

export interface ApplyResult {
  succeeded: AppliedChange[]
  failed: FailedChange[]
  stateEntries: StateEntry[]
}

export interface AppliedChange {
  action: string
  resourceType: string
  refKey: string
  id?: string
}

export interface FailedChange {
  action: string
  resourceType: string
  refKey: string
  error: string
}

/**
 * Apply the changeset to the API. Returns results with successes/failures.
 * Updates refs in-place as new resources are created (for downstream refs).
 */
export async function apply(
  changeset: Changeset,
  refs: ResolvedRefs,
  client: ApiClient,
): Promise<ApplyResult> {
  const succeeded: AppliedChange[] = []
  const failed: FailedChange[] = []
  const stateEntries: StateEntry[] = []

  for (const change of changeset.creates) {
    try {
      const handler = lookupHandler(change.resourceType, 'create')
      const id = await handler.applyCreate(change.desired, refs, client)
      if (id) {
        refs.set(handler.refType, change.refKey, {
          id, refKey: change.refKey, raw: change.desired as Record<string, unknown>,
        })
        stateEntries.push({
          resourceType: change.resourceType,
          refKey: change.refKey,
          id,
          createdAt: new Date().toISOString(),
        })
        succeeded.push({action: 'create', resourceType: change.resourceType, refKey: change.refKey, id})
      } else {
        failed.push({
          action: 'create', resourceType: change.resourceType,
          refKey: change.refKey, error: 'Create succeeded but API returned no resource ID',
        })
      }
    } catch (err) {
      failed.push({
        action: 'create', resourceType: change.resourceType,
        refKey: change.refKey, error: errorMessage(err),
      })
    }
  }

  for (const change of changeset.updates) {
    try {
      const handler = lookupHandler(change.resourceType, 'update')
      await handler.applyUpdate(change.desired, change.existingId!, refs, client)
      succeeded.push({action: 'update', resourceType: change.resourceType, refKey: change.refKey, id: change.existingId})
      if (change.existingId) {
        stateEntries.push({
          resourceType: change.resourceType,
          refKey: change.refKey,
          id: change.existingId,
          createdAt: new Date().toISOString(),
        })
      }
    } catch (err) {
      failed.push({
        action: 'update', resourceType: change.resourceType,
        refKey: change.refKey, error: errorMessage(err),
      })
    }
  }

  for (const change of changeset.deletes) {
    try {
      const handler = lookupHandler(change.resourceType, 'delete')
      await apiDelete(client, handler.deletePath(change.existingId!))
      succeeded.push({action: 'delete', resourceType: change.resourceType, refKey: change.refKey})
    } catch (err) {
      failed.push({
        action: 'delete', resourceType: change.resourceType,
        refKey: change.refKey, error: errorMessage(err),
      })
    }
  }

  for (const change of changeset.memberships) {
    try {
      await applyMembership(change, refs, client)
      succeeded.push({action: 'membership', resourceType: 'groupMembership', refKey: change.refKey})
    } catch (err) {
      failed.push({
        action: 'membership', resourceType: 'groupMembership',
        refKey: change.refKey, error: errorMessage(err),
      })
    }
  }

  return {succeeded, failed, stateEntries}
}

interface MembershipPayload {
  groupName: string
  memberType: string
  memberRef: string
}

async function applyMembership(change: Change, refs: ResolvedRefs, client: ApiClient): Promise<void> {
  const desired = change.desired as MembershipPayload
  const groupId = refs.require('resourceGroups', desired.groupName)
  const memberType = desired.memberType

  let memberId: string
  if (memberType === 'monitor') {
    memberId = refs.require('monitors', desired.memberRef)
  } else {
    memberId = refs.require('dependencies', desired.memberRef)
  }

  await checkedFetch(client.POST('/api/v1/resource-groups/{id}/members', {params: {path: {id: groupId}}, body: {memberType, memberId}}))
}

function lookupHandler(resourceType: string, action: string) {
  const handler = HANDLER_MAP[resourceType as HandledResourceType]
  if (!handler) throw new Error(`Unknown resource type for ${action}: ${resourceType}`)
  return handler
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
