import {afterEach, describe, expect, it} from 'vitest'
import {createApiClient} from '../../src/lib/api-client.js'

const savedWorkspace = process.env.DEVHELM_WORKSPACE_ID

afterEach(() => {
  if (savedWorkspace === undefined) delete process.env.DEVHELM_WORKSPACE_ID
  else process.env.DEVHELM_WORKSPACE_ID = savedWorkspace
})

async function captureHeaders(opts: {workspaceId?: string}): Promise<Headers> {
  const original = globalThis.fetch
  let captured: Headers | undefined
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(input, init)
    captured = req.headers
    return new Response('{}', {status: 200, headers: {'Content-Type': 'application/json'}})
  }
  try {
    const client = createApiClient({baseUrl: 'http://localhost:0', token: 't', ...opts})
    await (client as unknown as {GET: (path: string) => Promise<unknown>}).GET('/api/v1/_')
  } finally {
    globalThis.fetch = original
  }
  if (!captured) throw new Error('fetch was never called')
  return captured
}

describe('api client tenant headers', () => {
  it('omits the workspace header when neither flag nor env sets one', async () => {
    delete process.env.DEVHELM_WORKSPACE_ID
    const headers = await captureHeaders({})
    expect(headers.get('x-phelm-workspace-id')).toBeNull()
    expect(headers.get('x-phelm-org-id')).toBe('1')
  })

  it('sends the workspace header from the env when set', async () => {
    process.env.DEVHELM_WORKSPACE_ID = '7'
    const headers = await captureHeaders({})
    expect(headers.get('x-phelm-workspace-id')).toBe('7')
  })
})
