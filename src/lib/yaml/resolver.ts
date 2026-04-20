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
import type {DevhelmConfig} from './schema.js'

/**
 * Sentinel ID prefix for resources that exist only in YAML and haven't been
 * created in the API yet. Used during diff-time snapshot computation so that
 * existing resources referencing a yet-to-be-created peer (e.g. a notification
 * policy escalation step pointing at a brand-new alert channel) can resolve
 * the reference and produce a stable snapshot.
 *
 * Pending IDs are deterministic (`__pending__:<refType>:<refKey>`), so two
 * runs with the same YAML produce identical snapshots — the existing-resource
 * snapshot will differ from the API current snapshot (which holds the OLD
 * channel ID), correctly triggering an update once the new channel is created.
 *
 * At apply time, creates execute first and overwrite the placeholder with the
 * real API ID before the dependent update runs.
 */
export const PENDING_REF_ID_PREFIX = '__pending__:'

export type {RefType}

export interface RefEntry<K extends RefType = RefType> {
  id: string
  refKey: string
  managedBy?: string
  raw: K extends keyof RefTypeDtoMap ? RefTypeDtoMap[K] : unknown
  /** State address this resource was matched from (set when state-based matching succeeded). */
  matchSource?: 'state' | 'name'
  /**
   * True when this entry represents a YAML resource that does not yet exist
   * in the API. Pending entries carry a placeholder `id` so dependent snapshot
   * computation can resolve refs, but they MUST NOT be treated as "existing"
   * by the differ — pending resources need a CREATE, not an UPDATE.
   */
  isPending?: boolean
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
      // A non-pending entry always replaces a pending placeholder. This is
      // how the applier swaps in a real API ID after a create, overwriting
      // the placeholder injected by registerYamlPendingRefs.
      if (existing.isPending && !entry.isPending) {
        map.set(refKey, entry as RefEntry)
        return
      }
      // Conversely, never let a pending placeholder overwrite a real entry.
      if (!existing.isPending && entry.isPending) {
        return
      }
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

  /**
   * Find a ref entry by API ID across the given refType. Used by handlers
   * that need access to the current API DTO at apply-time (e.g. monitor
   * handler emitting `clearAuth`/`clearEnvironmentId` based on whether the
   * existing resource has those fields populated).
   */
  findById<K extends RefType>(type: K, apiId: string): RefEntry<K> | undefined {
    for (const entry of this.allEntries(type)) {
      if (entry.id === apiId) return entry
    }
    return undefined
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
 * Pre-register YAML resources that don't yet exist in the API with deterministic
 * placeholder IDs. This lets `toDesiredSnapshot` for an *existing* resource
 * resolve references to *new* peers without throwing — the snapshot diff will
 * still see a difference (placeholder ID vs old API ID) and queue an update.
 *
 * Without this step, scenarios like "wire an existing notification policy to a
 * brand-new alert channel" would crash in `hasChanged` before the create even
 * runs.
 *
 * Safe to call after `fetchAllRefs`: for refKeys already populated by the API,
 * we don't overwrite. Only YAML-only refs receive placeholders.
 */
export function registerYamlPendingRefs(refs: ResolvedRefs, config: DevhelmConfig): void {
  for (const handler of allHandlers()) {
    // SAFETY: handler.configKey is a YamlSectionKey, so config[key] is one
    // of the typed arrays (YamlTag[] | YamlMonitor[] | ...). The handler's
    // getRefKey is type-erased to accept `unknown` in the registry, matching
    // the element type. We widen to unknown[] to iterate generically.
    const items = config[handler.configKey] as unknown[] | undefined
    if (!items) continue
    for (const item of items) {
      const refKey = handler.getRefKey(item)
      if (refs.get(handler.refType, refKey)) continue
      refs.set(handler.refType, refKey, {
        id: `${PENDING_REF_ID_PREFIX}${handler.refType}:${refKey}`,
        refKey,
        raw: item as RefEntry['raw'],
        matchSource: 'name',
        isPending: true,
      })
    }
  }
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
