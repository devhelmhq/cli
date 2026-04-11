/**
 * Pagination helper for Spring Boot Pageable endpoints.
 *
 * Uses `apiGet` from api-client (which centralizes the dynamic-path cast)
 * to iterate through pages until `hasNext` is false.
 */
import type {ApiClient} from './api-client.js'
import {apiGet} from './api-client.js'

interface PaginatedResponse<T> {
  data?: T[]
  hasNext?: boolean
}

const API_PAGE_SIZE = 200

export async function fetchPaginated<TItem>(
  client: ApiClient,
  path: string,
): Promise<TItem[]> {
  const results: TItem[] = []
  let page = 0

  while (true) {
    const resp = await apiGet<PaginatedResponse<TItem>>(client, path, {query: {page, size: API_PAGE_SIZE}})
    results.push(...(resp.data ?? []))
    if (!resp.hasNext) break
    page++
  }

  return results
}
