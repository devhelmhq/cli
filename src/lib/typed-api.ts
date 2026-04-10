/**
 * Typed API transport layer.
 *
 * The OpenAPI spec includes a required `actor` query parameter on every
 * operation — a Spring Security @AuthenticationPrincipal artefact. The
 * server resolves the actor from the auth token; clients never send it.
 * This forces `as any` casts when calling openapi-fetch methods.
 *
 * This module isolates those casts to ONE file while exposing fully-typed
 * generic responses. All handler / resolver / applier code specifies the
 * expected DTO type via the <T> generic, achieving compile-time safety
 * everywhere else.
 *
 * TODO(api): Add @Hidden to the @AuthenticationPrincipal parameter in API
 * controllers, regenerate the OpenAPI spec, then remove these casts and
 * call client.GET/POST/PUT/DELETE directly with full path-level types.
 */
import type {ApiClient} from './api-client.js'
import {checkedFetch} from './api-client.js'

/* eslint-disable @typescript-eslint/no-explicit-any */

export function typedGet<T>(client: ApiClient, path: string, query?: Record<string, unknown>): Promise<T> {
  return checkedFetch(client.GET(path as any, query ? {params: {query} as any} : (undefined as any)))
}

export function typedPost<T>(client: ApiClient, path: string, body?: unknown): Promise<T> {
  return checkedFetch(client.POST(path as any, body !== undefined ? ({body} as any) : (undefined as any)))
}

export function typedPut<T = void>(client: ApiClient, path: string, body?: unknown): Promise<T> {
  return checkedFetch(client.PUT(path as any, body !== undefined ? ({body} as any) : (undefined as any)))
}

export function typedPatch<T = void>(client: ApiClient, path: string, body?: unknown): Promise<T> {
  return checkedFetch(client.PATCH(path as any, body !== undefined ? ({body} as any) : (undefined as any)))
}

export function typedDelete<T = void>(client: ApiClient, path: string): Promise<T> {
  return checkedFetch(client.DELETE(path as any, undefined as any))
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Pagination helper ───────────────────────────────────────────────────

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
    const resp = await typedGet<PaginatedResponse<TItem>>(client, path, {page, size: API_PAGE_SIZE})
    results.push(...(resp.data ?? []))
    if (!resp.hasNext) break
    page++
  }

  return results
}
