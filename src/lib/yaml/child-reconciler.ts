/**
 * Generic child collection reconciler.
 *
 * Replaces the delete-all/recreate-all approach in syncSubResources with
 * individual create/update/delete operations. Supports ordering changes
 * via an optional reorder callback.
 *
 * Used by status page groups/components and (future) resource group members.
 *
 * Partial-failure contract:
 *   Each delete/create/update is attempted in isolation. When an op
 *   throws, we record it as failed but keep going through the remaining
 *   ops in the same phase, so the user gets maximum forward progress per
 *   deploy. We accumulate the surviving child state map and, if any op
 *   failed, raise a `PartialApplyError` carrying that map so the caller
 *   (status page handler → applier) can persist the partial state and
 *   surface the error. See `apply-error.ts` for the rationale.
 */
import isEqual from 'lodash-es/isEqual.js'
import {PartialApplyError} from './apply-error.js'
import type {ChildStateEntry} from './state.js'

// ── Public interface ─────────────────────────────────────────────────────

export interface ChildCollectionDef<TYaml = unknown, TApi = unknown> {
  /** Collection name for logging/state keys (e.g. "groups", "components") */
  name: string

  /** Extract identity key from YAML child (e.g. component name) */
  identityKey(yaml: TYaml): string

  /** Extract identity key from API DTO */
  apiIdentityKey(api: TApi): string

  /** Extract API ID from DTO */
  apiId(api: TApi): string

  /** Build a comparable snapshot from YAML child */
  toDesiredSnapshot(yaml: TYaml): Record<string, unknown>

  /** Build a comparable snapshot from API DTO */
  toCurrentSnapshot(api: TApi): Record<string, unknown>

  /** Create a new child, return its API ID */
  applyCreate(parentId: string, yaml: TYaml, index: number): Promise<string>

  /** Update an existing child */
  applyUpdate(parentId: string, childId: string, yaml: TYaml, index: number): Promise<void>

  /** Delete a child */
  applyDelete(parentId: string, childId: string): Promise<void>

  /**
   * Optional: batch reorder after individual mutations. Receives both the
   * ordered API IDs and the corresponding desired YAML so handlers can
   * preserve other per-row attributes (e.g. component groupId) instead of
   * losing them when the server treats the reorder payload as a full
   * upsert.
   */
  applyReorder?(parentId: string, ordered: Array<{id: string; yaml: TYaml; index: number}>): Promise<void>
}

export interface ChildChange {
  action: 'create' | 'update' | 'delete'
  childKey: string
  childId?: string
}

export interface ChildDiffResult {
  creates: Array<{key: string; index: number}>
  updates: Array<{key: string; childId: string; index: number}>
  deletes: Array<{key: string; childId: string}>
  reorder: boolean
  /**
   * YAML identity key → existing API ID for every current child that survived
   * matching (state-aware or name-based). Apply uses this to resolve the
   * apiId of unchanged-and-renamed children that have no match in `currentApi`
   * keyed by their *new* YAML name.
   */
  existingByKey: Record<string, string>
}

export interface ChildApplyResult {
  changes: ChildChange[]
  /** Updated child state entries keyed by identity key */
  childState: Record<string, ChildStateEntry>
}

// ── Diff ─────────────────────────────────────────────────────────────────

/**
 * Compute the diff between desired children (from YAML) and current children
 * (from API), producing create/update/delete operations.
 */
export function diffChildren<TYaml, TApi>(
  def: ChildCollectionDef<TYaml, TApi>,
  desiredYaml: TYaml[],
  currentApi: TApi[],
  stateChildren: Record<string, ChildStateEntry> = {},
): ChildDiffResult {
  // Build lookup: identity key → {apiId, snapshot}
  const currentMap = new Map<string, {apiId: string; snapshot: Record<string, unknown>; index: number}>()
  for (const [i, api] of currentApi.entries()) {
    const apiId = def.apiId(api)
    const apiKey = def.apiIdentityKey(api)

    // Try state-based matching first: if we have state entries, find by API ID
    let identityKey = apiKey
    for (const [stateKey, stateEntry] of Object.entries(stateChildren)) {
      if (stateEntry.apiId === apiId) {
        // Strip the collection prefix (e.g. "groups.Platform" → "Platform")
        const dotIdx = stateKey.indexOf('.')
        identityKey = dotIdx >= 0 ? stateKey.slice(dotIdx + 1) : stateKey
        break
      }
    }

    currentMap.set(identityKey, {
      apiId,
      snapshot: def.toCurrentSnapshot(api),
      index: i,
    })
  }

  const creates: ChildDiffResult['creates'] = []
  const updates: ChildDiffResult['updates'] = []
  const matched = new Set<string>()

  for (const [i, yaml] of desiredYaml.entries()) {
    const key = def.identityKey(yaml)
    const desiredSnapshot = def.toDesiredSnapshot(yaml)

    const current = currentMap.get(key)
    if (current) {
      matched.add(key)
      if (!isEqual(desiredSnapshot, current.snapshot)) {
        updates.push({key, childId: current.apiId, index: i})
      }
    } else {
      creates.push({key, index: i})
    }
  }

  const deletes: ChildDiffResult['deletes'] = []
  for (const [key, current] of currentMap) {
    if (!matched.has(key)) {
      deletes.push({key, childId: current.apiId})
    }
  }

  // Detect reorder: even if all children match, order may have changed
  const desiredOrder = desiredYaml.map((y) => def.identityKey(y))
  const currentOrder = [...currentMap.entries()]
    .sort((a, b) => a[1].index - b[1].index)
    .map(([key]) => key)
    .filter((key) => matched.has(key))
  const reorder = creates.length > 0 || deletes.length > 0 || !isEqual(desiredOrder.filter((k) => matched.has(k)), currentOrder)

  // Expose the YAML-key → apiId map for matched survivors so the apply phase
  // can rebuild state correctly even when a child was renamed (its YAML
  // identity key differs from the current API name).
  const existingByKey: Record<string, string> = {}
  for (const key of matched) {
    const current = currentMap.get(key)
    if (current) existingByKey[key] = current.apiId
  }

  return {creates, updates, deletes, reorder, existingByKey}
}

/**
 * Check if a child collection has any changes.
 */
export function hasChildChanges(result: ChildDiffResult): boolean {
  return result.creates.length > 0 || result.updates.length > 0 || result.deletes.length > 0
}

// ── Apply ────────────────────────────────────────────────────────────────

/**
 * Apply child diff operations to the API and return updated state.
 *
 * On per-op failure: we keep going through the remaining ops in the same
 * phase (deletes, creates, updates) so a single transient error doesn't
 * block independent siblings. Successfully reconciled children land in
 * `childState`; failed creates are excluded so the next deploy retries
 * them as creates, and failed updates/deletes are recorded with empty
 * attributes so the next diff still sees drift and retries.
 *
 * If any op failed, we throw `PartialApplyError` carrying the accumulated
 * partial state — the caller persists it and surfaces the error.
 */
export async function applyChildDiff<TYaml, TApi>(
  def: ChildCollectionDef<TYaml, TApi>,
  parentId: string,
  desiredYaml: TYaml[],
  diffResult: ChildDiffResult,
  _currentApi: TApi[],
  _stateChildren: Record<string, ChildStateEntry> = {},
): Promise<ChildApplyResult> {
  const changes: ChildChange[] = []
  const childState: Record<string, ChildStateEntry> = {}
  const errors: string[] = []
  const failedKeys = new Set<string>()
  const newIds = new Map<string, string>()

  // `existingByKey` (built by diffChildren) is keyed by the YAML identity key
  // and reflects state-aware matching, so renames resolve correctly. We must
  // not rebuild this map from `currentApi` alone — that would key by the
  // *old* API name and miss any child whose YAML name has changed.
  const existingByKey = diffResult.existingByKey

  // Phase 1: deletes (avoid name conflicts during create). Continue on
  // failure: a stuck delete shouldn't block creates of unrelated siblings.
  for (const del of diffResult.deletes) {
    try {
      await def.applyDelete(parentId, del.childId)
      changes.push({action: 'delete', childKey: del.key, childId: del.childId})
    } catch (err) {
      errors.push(`delete ${def.name}.${del.key}: ${errorMessage(err)}`)
      // Carry the orphan forward in state so the next diff still sees it
      // (its YAML key is gone, so the next run re-queues the delete).
      // Empty attributes keep `hasChildChanges` indifferent — the diff
      // logic decides delete vs update from YAML presence, not attrs.
      childState[`${def.name}.${del.key}`] = {apiId: del.childId, attributes: {}}
    }
  }

  // Phase 2: creates
  for (const create of diffResult.creates) {
    const yaml = desiredYaml[create.index]
    if (yaml === undefined) continue
    try {
      const newId = await def.applyCreate(parentId, yaml, create.index)
      newIds.set(create.key, newId)
      changes.push({action: 'create', childKey: create.key, childId: newId})
    } catch (err) {
      errors.push(`create ${def.name}.${create.key}: ${errorMessage(err)}`)
      failedKeys.add(create.key)
    }
  }

  // Phase 3: updates
  for (const update of diffResult.updates) {
    const yaml = desiredYaml[update.index]
    if (yaml === undefined) continue
    try {
      await def.applyUpdate(parentId, update.childId, yaml, update.index)
      changes.push({action: 'update', childKey: update.key, childId: update.childId})
    } catch (err) {
      errors.push(`update ${def.name}.${update.key}: ${errorMessage(err)}`)
      // Record the apiId with empty attributes so the next diff sees the
      // child as still drifted (desired snapshot ≠ stored {}) and retries
      // the update. Critically, we do NOT store the desired snapshot here
      // — that would mark the child as in-sync and the retry would never
      // happen.
      childState[`${def.name}.${update.key}`] = {
        apiId: update.childId, attributes: {},
      }
      failedKeys.add(update.key)
    }
  }

  // Phase 4: reorder. Skip when any earlier op failed: the ordered set is
  // incomplete, so a partial reorder could move surviving children to wrong
  // positions. Re-run handles ordering once everything is in place.
  if (diffResult.reorder && def.applyReorder && errors.length === 0) {
    const ordered: Array<{id: string; yaml: TYaml; index: number}> = []
    for (const [index, yaml] of desiredYaml.entries()) {
      const key = def.identityKey(yaml)
      const id = newIds.get(key) ?? existingByKey[key]
      if (id) ordered.push({id, yaml, index})
    }
    if (ordered.length > 0) {
      try {
        await def.applyReorder(parentId, ordered)
      } catch (err) {
        errors.push(`reorder ${def.name}: ${errorMessage(err)}`)
      }
    }
  }

  // Build child state for every desired child whose identity is known.
  // - Skipped: failed creates (no apiId yet — re-run retries as create)
  // - Skipped: keys already populated above (failed updates/deletes) so we
  //   don't overwrite their attributes-empty marker with the desired snap.
  // Renamed children survive because `existingByKey` was populated by
  // state-aware matching in diff.
  for (const yaml of desiredYaml) {
    const key = def.identityKey(yaml)
    if (failedKeys.has(key) && !newIds.has(key)) continue
    const stateKey = `${def.name}.${key}`
    if (childState[stateKey] !== undefined) continue
    const apiId = newIds.get(key) ?? existingByKey[key]
    if (apiId) {
      childState[stateKey] = {
        apiId,
        attributes: def.toDesiredSnapshot(yaml),
      }
    }
  }

  if (errors.length > 0) {
    throw new PartialApplyError(
      `${def.name}: ${errors.length} operation(s) failed: ${errors.join('; ')}`,
      {children: childState},
    )
  }

  return {changes, childState}
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
