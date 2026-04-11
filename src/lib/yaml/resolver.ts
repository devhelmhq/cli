/**
 * Reference resolver: fetches existing resources from the API via typed
 * handler methods and builds name/slug → UUID maps for YAML reference resolution.
 */
import type {ApiClient} from '../api-client.js'
import type {RefType, RefTypeDtoMap} from './types.js'
import {allHandlers} from './handlers.js'

export type {RefType}

export interface RefEntry<K extends RefType = RefType> {
  id: string
  refKey: string
  managedBy?: string
  raw: K extends keyof RefTypeDtoMap ? RefTypeDtoMap[K] : unknown
}

export class ResolvedRefs {
  private maps = new Map<RefType, Map<string, RefEntry>>()

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

  set<K extends RefType>(type: K, refKey: string, entry: RefEntry<K>): void {
    if (!this.maps.has(type)) this.maps.set(type, new Map())
    this.maps.get(type)!.set(refKey, entry as RefEntry)
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
 */
export async function fetchAllRefs(client: ApiClient): Promise<ResolvedRefs> {
  const refs = new ResolvedRefs()
  const handlers = allHandlers()

  const results = await Promise.all(handlers.map((h) => h.fetchAll(client)))

  for (let i = 0; i < handlers.length; i++) {
    const handler = handlers[i]
    for (const item of results[i]) {
      const refKey = handler.getApiRefKey(item)
      // Handler.fetchAll() returns the correct DTO for its refType but TS
      // can't narrow the correlation.  The cast is safe — each handler's
      // fetchAll returns exactly RefTypeDtoMap[handler.refType].
      refs.set(handler.refType, refKey, {
        id: handler.getApiId(item),
        refKey,
        managedBy: handler.getManagedBy?.(item),
        raw: item as RefEntry['raw'],
      })
    }
  }

  return refs
}
