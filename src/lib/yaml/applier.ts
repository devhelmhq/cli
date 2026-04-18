/**
 * Executes a changeset against the API in dependency order.
 *
 * Delegates all per-resource-type create/update/delete operations to typed
 * handlers in handlers.ts — no switch/case or `as YamlFoo` casts here.
 */
import type {ApiClient} from '../api-client.js'
import {checkedFetch, apiDelete} from '../api-client.js'
import {HANDLER_MAP, normalizeCreateOutcome, normalizeUpdateOutcome} from './handlers.js'
import type {Changeset, Change, HandledResourceType, ResourceType} from './types.js'
import type {ResolvedRefs, RefEntry} from './resolver.js'
import type {ChildStateEntry, DeployState} from './state.js'
import {resourceAddress} from './state.js'

export interface AppliedStateEntry {
  resourceType: ResourceType
  refKey: string
  apiId: string
  attributes: Record<string, unknown>
  children: Record<string, ChildStateEntry>
}

export interface ApplyResult {
  succeeded: AppliedChange[]
  failed: FailedChange[]
  stateEntries: AppliedStateEntry[]
  deletedRefKeys: Array<{resourceType: ResourceType; refKey: string}>
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
 *
 * `priorState` is optional — when provided, children tracked in prior state
 * are forwarded to handlers that manage child collections (e.g. status pages)
 * so per-child identity and rename detection survive across deploys.
 */
export async function apply(
  changeset: Changeset,
  refs: ResolvedRefs,
  client: ApiClient,
  priorState?: DeployState,
): Promise<ApplyResult> {
  const succeeded: AppliedChange[] = []
  const failed: FailedChange[] = []
  const stateEntries: AppliedStateEntry[] = []
  const deletedRefKeys: Array<{resourceType: ResourceType; refKey: string}> = []

  function lookupPriorChildren(
    resourceType: ResourceType, refKey: string,
  ): Record<string, ChildStateEntry> {
    if (!priorState) return {}
    const addr = resourceAddress(resourceType, refKey)
    return priorState.resources[addr]?.children ?? {}
  }

  for (const change of changeset.creates) {
    try {
      const handler = lookupHandler(change.resourceType, 'create')
      const priorChildren = lookupPriorChildren(change.resourceType as ResourceType, change.refKey)
      const raw = await handler.applyCreate(change.desired, refs, client, priorChildren)
      const outcome = normalizeCreateOutcome(raw)
      const id = outcome?.id
      if (id) {
        // Store YAML as raw — this is acceptable because refs are only used
        // for ID resolution during the rest of the apply batch (creates,
        // updates, deletes, memberships look up by id). hasChanged() and
        // attribute diffs are computed in diff() *before* apply() runs, so
        // YAML-shaped raw here never participates in drift detection.
        refs.set(handler.refType, change.refKey, {
          id, refKey: change.refKey, raw: change.desired as RefEntry['raw'],
        })
        stateEntries.push({
          resourceType: change.resourceType as ResourceType,
          refKey: change.refKey,
          apiId: id,
          attributes: {name: change.refKey},
          children: outcome?.children ?? {},
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
      const priorChildren = lookupPriorChildren(change.resourceType as ResourceType, change.refKey)
      const raw = await handler.applyUpdate(change.desired, change.existingId!, refs, client, priorChildren)
      const outcome = normalizeUpdateOutcome(raw)
      succeeded.push({action: 'update', resourceType: change.resourceType, refKey: change.refKey, id: change.existingId})
      if (change.existingId) {
        stateEntries.push({
          resourceType: change.resourceType as ResourceType,
          refKey: change.refKey,
          apiId: change.existingId,
          attributes: {name: change.refKey},
          children: outcome.children ?? priorChildren,
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
      await apiDelete(client, handler.deletePath(change.existingId!, change.refKey))
      succeeded.push({action: 'delete', resourceType: change.resourceType, refKey: change.refKey})
      deletedRefKeys.push({resourceType: change.resourceType as ResourceType, refKey: change.refKey})
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
      const icon = change.action === 'delete' ? 'remove' : 'add'
      succeeded.push({action: icon, resourceType: 'groupMembership', refKey: change.refKey})
    } catch (err) {
      failed.push({
        action: change.action, resourceType: 'groupMembership',
        refKey: change.refKey, error: errorMessage(err),
      })
    }
  }

  return {succeeded, failed, stateEntries, deletedRefKeys}
}

interface MembershipCreatePayload {
  groupName: string
  memberType: string
  memberRef: string
}

interface MembershipDeletePayload {
  groupId: string
  memberId: string
}

async function applyMembership(change: Change, refs: ResolvedRefs, client: ApiClient): Promise<void> {
  if (change.action === 'delete') {
    const payload = change.desired as MembershipDeletePayload
    await apiDelete(client, `/api/v1/resource-groups/${payload.groupId}/members/${payload.memberId}`)
    return
  }

  const desired = change.desired as MembershipCreatePayload
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
