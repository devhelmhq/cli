/**
 * Pagination helpers for Spring Boot Pageable and cursor-based endpoints.
 *
 * Uses `apiGet` from api-client (which centralizes the dynamic-path cast)
 * to iterate through pages until exhausted or a max-items cap is reached.
 */
import type {ApiClient} from './api-client.js'
import {apiGet} from './api-client.js'

const DEFAULT_PAGE_SIZE = 200

// ── Spring-style page/size pagination (hasNext / hasPrev) ───────────

interface PageResponse<T> {
  data?: T[]
  hasNext?: boolean
}

export async function fetchPaginated<TItem>(
  client: ApiClient,
  path: string,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<TItem[]> {
  const results: TItem[] = []
  let page = 0

  while (true) {
    const resp = (await apiGet(client, path, {query: {page, size: pageSize}})) as PageResponse<TItem>
    results.push(...(resp.data ?? []))
    if (resp.hasNext !== true) break
    page++
  }

  return results
}

// ── Cursor-based pagination (nextCursor / hasMore) ──────────────────

interface CursorResponse<T> {
  data?: T[]
  nextCursor?: string | null
  hasMore?: boolean
}

export async function fetchCursorPaginated<TItem>(
  client: ApiClient,
  path: string,
  opts: {query?: Record<string, unknown>; pageSize?: number; maxItems?: number} = {},
): Promise<TItem[]> {
  const {query = {}, pageSize = DEFAULT_PAGE_SIZE, maxItems} = opts
  const results: TItem[] = []
  let cursor: string | undefined

  while (true) {
    const effectiveLimit = maxItems ? Math.min(pageSize, maxItems - results.length) : pageSize
    const resp = (await apiGet(client, path, {
      query: {...query, cursor, limit: effectiveLimit},
    })) as CursorResponse<TItem>
    results.push(...(resp.data ?? []))

    if (maxItems && results.length >= maxItems) break
    if (resp.hasMore !== true || !resp.nextCursor) break
    cursor = resp.nextCursor
  }

  return maxItems ? results.slice(0, maxItems) : results
}
