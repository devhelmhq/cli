/**
 * Generic child collection reconciler.
 *
 * Replaces the delete-all/recreate-all approach in syncSubResources with
 * individual create/update/delete operations. Supports ordering changes
 * via an optional reorder callback.
 *
 * Used by status page groups/components and (future) resource group members.
 */
import isEqual from 'lodash-es/isEqual.js'
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

  /** Optional: batch reorder after individual mutations */
  applyReorder?(parentId: string, orderedIds: string[]): Promise<void>
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
  for (let i = 0; i < currentApi.length; i++) {
    const api = currentApi[i]
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

  for (let i = 0; i < desiredYaml.length; i++) {
    const yaml = desiredYaml[i]
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

  // `existingByKey` (built by diffChildren) is keyed by the YAML identity key
  // and reflects state-aware matching, so renames resolve correctly. We must
  // not rebuild this map from `currentApi` alone — that would key by the
  // *old* API name and miss any child whose YAML name has changed.
  const existingByKey = diffResult.existingByKey

  // Delete first (avoids name conflicts during create)
  for (const del of diffResult.deletes) {
    await def.applyDelete(parentId, del.childId)
    changes.push({action: 'delete', childKey: del.key, childId: del.childId})
  }

  // Create new children
  const newIds = new Map<string, string>()
  for (const create of diffResult.creates) {
    const yaml = desiredYaml[create.index]
    const newId = await def.applyCreate(parentId, yaml, create.index)
    newIds.set(create.key, newId)
    changes.push({action: 'create', childKey: create.key, childId: newId})
  }

  // Update existing children
  for (const update of diffResult.updates) {
    const yaml = desiredYaml[update.index]
    await def.applyUpdate(parentId, update.childId, yaml, update.index)
    changes.push({action: 'update', childKey: update.key, childId: update.childId})
  }

  // Reorder if needed and handler supports it
  if (diffResult.reorder && def.applyReorder) {
    const orderedIds: string[] = []
    for (const yaml of desiredYaml) {
      const key = def.identityKey(yaml)
      const id = newIds.get(key) ?? existingByKey[key]
      if (id) orderedIds.push(id)
    }
    if (orderedIds.length > 0) {
      await def.applyReorder(parentId, orderedIds)
    }
  }

  // Build child state for all desired children. Renamed children survive here
  // because `existingByKey` was populated by state-aware matching in diff.
  for (const yaml of desiredYaml) {
    const key = def.identityKey(yaml)
    const apiId = newIds.get(key) ?? existingByKey[key]
    if (apiId) {
      childState[`${def.name}.${key}`] = {
        apiId,
        attributes: def.toDesiredSnapshot(yaml),
      }
    }
  }

  return {changes, childState}
}
