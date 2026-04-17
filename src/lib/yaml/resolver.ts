/**
 * Reference resolver: fetches existing resources from the API via typed
 * handler methods and builds name/slug → UUID maps for YAML reference resolution.
 *
 * In v2, the resolver also accepts the deploy state for identity-based matching:
 * when a resource was previously deployed, we look it up by API ID from state
 * first, falling back to name/slug match. This enables rename detection
 * (via `moved` blocks that update the state before diffing).
 */
import type {ApiClient} from '../api-client.js'
import type {RefType, RefTypeDtoMap, ResourceType} from './types.js'
import {allHandlers} from './handlers.js'
import type {DeployState} from './state.js'

export type {RefType}

export interface RefEntry<K extends RefType = RefType> {
  id: string
  refKey: string
  managedBy?: string
  raw: K extends keyof RefTypeDtoMap ? RefTypeDtoMap[K] : unknown
  /** State address this resource was matched from (set when state-based matching succeeded). */
  matchSource?: 'state' | 'name'
}

/** A refKey collision — two API resources map to the same reference key. */
export interface RefCollision {
  refType: RefType
  refKey: string
  /** API IDs that collided on this refKey (includes the winner). */
  apiIds: string[]
  /** API ID chosen as the authoritative entry. */
  winnerApiId: string
}

export class ResolvedRefs {
  private maps = new Map<RefType, Map<string, RefEntry>>()
  /** Collisions encountered during population (duplicate refKey for same refType). */
  readonly collisions: RefCollision[] = []

  get<K extends RefType>(type: K, refKey: string): RefEntry<K> | undefined {
    return this.maps.get(type)?.get(refKey) as RefEntry<K> | undefined
  }

  resolve(type: RefType, refKey: string): string | undefined {
    return this.maps.get(type)?.get(refKey)?.id
  }

  require(type: RefType, refKey: string): string {
    const id = this.resolve(type, refKey)
    if (!id) {
      throw new Error(`Cannot resolve ${type} reference "${refKey}" — not found in YAML or API`)
    }
    return id
  }

  /**
   * Set a ref entry. Detects collisions (same refKey already present) and
   * records them. State-matched entries always win over name-matched ones.
   * Two name-matched entries are a genuine duplicate-name situation in the
   * API; we keep the first and record the collision for the caller to
   * surface.
   */
  set<K extends RefType>(type: K, refKey: string, entry: RefEntry<K>): void {
    if (!this.maps.has(type)) this.maps.set(type, new Map())
    const map = this.maps.get(type)!
    const existing = map.get(refKey)
    if (existing && existing.id !== entry.id) {
      const existingIsState = existing.matchSource === 'state'
      const incomingIsState = entry.matchSource === 'state'
      if (incomingIsState && !existingIsState) {
        // State wins — promote the new entry, record collision against the old
        this.recordCollision(type, refKey, entry.id, [existing.id, entry.id])
        map.set(refKey, entry as RefEntry)
        return
      }
      if (!incomingIsState && existingIsState) {
        // Existing state-matched entry wins
        this.recordCollision(type, refKey, existing.id, [existing.id, entry.id])
        return
      }
      // Genuine duplicate — both state, or both name. Keep first deterministically.
      this.recordCollision(type, refKey, existing.id, [existing.id, entry.id])
      return
    }
    map.set(refKey, entry as RefEntry)
  }

  private recordCollision(type: RefType, refKey: string, winnerApiId: string, apiIds: string[]): void {
    const existing = this.collisions.find((c) => c.refType === type && c.refKey === refKey)
    if (existing) {
      for (const id of apiIds) if (!existing.apiIds.includes(id)) existing.apiIds.push(id)
      return
    }
    this.collisions.push({refType: type, refKey, apiIds: [...apiIds], winnerApiId})
  }

  all<K extends RefType>(type: K): Map<string, RefEntry<K>> {
    return (this.maps.get(type) ?? new Map()) as Map<string, RefEntry<K>>
  }

  allEntries<K extends RefType>(type: K): RefEntry<K>[] {
    return [...this.all(type).values()]
  }
}

/**
 * Fetch all resources from the API via handler.fetchAll() and build
 * reference maps using handler metadata (getApiRefKey, getApiId, etc.).
 *
 * When `state` is provided, performs state-aware matching:
 * for each YAML resource with a known state entry, the resolver checks
 * if the API resource's ID matches the state entry's API ID. This allows
 * matching even when the name has changed (post-moved-block processing).
 */
export async function fetchAllRefs(client: ApiClient, state?: DeployState): Promise<ResolvedRefs> {
  const refs = new ResolvedRefs()
  const handlers = allHandlers()

  const results = await Promise.all(handlers.map((h) => h.fetchAll(client)))

  if (state) {
    const apiIdIndex = buildApiIdIndex(state)

    for (let i = 0; i < handlers.length; i++) {
      const handler = handlers[i]
      for (const item of results[i]) {
        const apiId = handler.getApiId(item)
        const apiRefKey = handler.getApiRefKey(item)

        const stateMatch = apiIdIndex.get(apiId)
        const refKey = stateMatch?.refKey ?? apiRefKey
        const matchSource = stateMatch ? 'state' as const : 'name' as const

        refs.set(handler.refType, refKey, {
          id: apiId,
          refKey,
          managedBy: handler.getManagedBy?.(item),
          raw: item as RefEntry['raw'],
          matchSource,
        })
      }
    }
  } else {
    for (let i = 0; i < handlers.length; i++) {
      const handler = handlers[i]
      for (const item of results[i]) {
        const refKey = handler.getApiRefKey(item)
        refs.set(handler.refType, refKey, {
          id: handler.getApiId(item),
          refKey,
          managedBy: handler.getManagedBy?.(item),
          raw: item as RefEntry['raw'],
          matchSource: 'name',
        })
      }
    }
  }

  return refs
}

/**
 * Build a reverse index: API UUID → {resourceType, refKey} from the state file.
 * Used for fast lookup during resolution.
 */
function buildApiIdIndex(state: DeployState): Map<string, {resourceType: ResourceType; refKey: string}> {
  const index = new Map<string, {resourceType: ResourceType; refKey: string}>()
  for (const [address, entry] of Object.entries(state.resources)) {
    const dotIdx = address.indexOf('.')
    if (dotIdx > 0) {
      const refKey = address.slice(dotIdx + 1)
      index.set(entry.apiId, {resourceType: entry.resourceType, refKey})
    }
  }
  return index
}
