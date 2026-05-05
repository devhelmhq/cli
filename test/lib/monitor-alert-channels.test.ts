import {describe, expect, it, vi, beforeEach} from 'vitest'
import {
  attachAlertChannelsOrRollback,
  parseAlertChannelsFlag,
  setAlertChannels,
} from '../../src/lib/monitor-alert-channels.js'

describe('parseAlertChannelsFlag (P1.Bug3)', () => {
  it('returns undefined when the flag was not provided', () => {
    expect(parseAlertChannelsFlag(undefined)).toBeUndefined()
  })

  it('returns an empty array for the empty string (clears all channels)', () => {
    expect(parseAlertChannelsFlag('')).toEqual([])
  })

  it('splits a comma-separated list and trims each entry', () => {
    expect(parseAlertChannelsFlag('a, b , c')).toEqual(['a', 'b', 'c'])
  })

  it('drops empty entries from trailing commas', () => {
    expect(parseAlertChannelsFlag('a,,b,')).toEqual(['a', 'b'])
  })
})

describe('setAlertChannels / attachAlertChannelsOrRollback', () => {
  type Outcome = {ok: true; data?: unknown} | {ok: false; status: number; message: string}

  function fakeClient(outcomes: Record<string, Outcome>) {
    const calls: Array<{method: string; path: string; body?: unknown}> = []
    function makeResponse(method: string, path: string, body?: unknown) {
      calls.push({method, path, body})
      const o = outcomes[`${method} ${path}`] ?? outcomes[method] ?? {ok: true}
      const response = {
        ok: o.ok, status: o.ok ? 200 : o.status,
        statusText: o.ok ? 'OK' : 'ERR',
        headers: new Headers(),
      } as Response
      return Promise.resolve(o.ok ? {data: o.data ?? {}, response} : {error: {message: o.message}, response})
    }
    return {
      client: {
        PUT: vi.fn((path: string, opts?: {body?: unknown}) => makeResponse('PUT', path, opts?.body)),
        DELETE: vi.fn((path: string) => makeResponse('DELETE', path)),
      },
      calls,
    }
  }

  let stderr: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  })

  it('PUTs the channel list to the alert-channels endpoint', async () => {
    const {client, calls} = fakeClient({})
    await setAlertChannels('mon-1', ['ch-1', 'ch-2'], client as never)
    expect(calls).toHaveLength(1)
    expect(calls[0].path).toBe('/api/v1/monitors/mon-1/alert-channels')
    expect(calls[0].body).toEqual({channelIds: ['ch-1', 'ch-2']})
  })

  it('attachAlertChannelsOrRollback skips the PUT when the list is empty', async () => {
    const {client, calls} = fakeClient({})
    await attachAlertChannelsOrRollback('mon-1', [], client as never)
    expect(calls).toHaveLength(0)
  })

  it('rolls back the monitor on a failed PUT', async () => {
    const {client, calls} = fakeClient({PUT: {ok: false, status: 400, message: 'bad'}})
    await expect(
      attachAlertChannelsOrRollback('mon-1', ['ch-1'], client as never),
    ).rejects.toThrow(/Failed to attach --alert-channels.*Monitor was rolled back/s)
    expect(calls.find((c) => c.method === 'DELETE')?.path).toBe('/api/v1/monitors/mon-1')
    expect(stderr).not.toHaveBeenCalled()
  })

  it('reports both errors when the rollback DELETE itself fails', async () => {
    const {client} = fakeClient({
      PUT: {ok: false, status: 500, message: 'boom'},
      DELETE: {ok: false, status: 500, message: 'oh no'},
    })
    await expect(
      attachAlertChannelsOrRollback('mon-1', ['ch-1'], client as never),
    ).rejects.toThrow(/could NOT be rolled back automatically/)
  })
})
