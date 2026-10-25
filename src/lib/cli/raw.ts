/**
 * Raw (non-JSON) GETs: runner logs (text/plain), run exports (zip) and
 * artifact content. Same headers, retries and typed errors as the
 * openapi-fetch client.
 */
import {baseHeaders, errorFromResponse, fetchWithRetry, type ApiClient} from '../api-client.js'

export async function getRaw(
  client: ApiClient,
  path: string,
  opts: {query?: Record<string, string | number | boolean | undefined>; accept?: string} = {},
): Promise<Response> {
  const url = new URL(`${client.options.baseUrl.replace(/\/$/, '')}${path}`)
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined) url.searchParams.set(k, String(v))
  }
  const headers: Record<string, string> = {...baseHeaders(client.options)}
  if (opts.accept) headers.Accept = opts.accept
  const res = await fetchWithRetry(new Request(url, {headers}))
  if (!res.ok) {
    let body: unknown
    try {
      body = await res.json()
    } catch {
      body = undefined
    }
    throw errorFromResponse(body, res)
  }
  return res
}

export async function getRawBytes(client: ApiClient, path: string, accept?: string): Promise<Uint8Array> {
  const res = await getRaw(client, path, {accept})
  return new Uint8Array(await res.arrayBuffer())
}
