/**
 * Reference resolver: fetches existing resources from the API via typed
 * handler methods and builds name/slug → UUID maps for YAML reference resolution.
 */
import type {ApiClient} from '../api-client.js'
import type {RefType} from './types.js'
import {allHandlers} from './handlers.js'

export type {RefType}

interface RefEntry {
  id: string
  refKey: string
  managedBy?: string
  raw: Record<string, unknown>
}

export class ResolvedRefs {
  private maps = new Map<RefType, Map<string, RefEntry>>()

  get(type: RefType, refKey: string): RefEntry | undefined {
    return this.maps.get(type)?.get(refKey)
  }

  resolve(type: RefType, refKey: string): string | undefined {
    return this.get(type, refKey)?.id
  }

  require(type: RefType, refKey: string): string {
    const id = this.resolve(type, refKey)
    if (!id) {
      throw new Error(`Cannot resolve ${type} reference "${refKey}" — not found in YAML or API`)
    }
    return id
  }

  set(type: RefType, refKey: string, entry: RefEntry): void {
    if (!this.maps.has(type)) this.maps.set(type, new Map())
    this.maps.get(type)!.set(refKey, entry)
  }

  all(type: RefType): Map<string, RefEntry> {
    return this.maps.get(type) ?? new Map()
  }

  allEntries(type: RefType): RefEntry[] {
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
      refs.set(handler.refType, refKey, {
        id: handler.getApiId(item),
        refKey,
        managedBy: handler.getManagedBy?.(item),
        raw: item as Record<string, unknown>,
      })
    }
  }

  return refs
}
