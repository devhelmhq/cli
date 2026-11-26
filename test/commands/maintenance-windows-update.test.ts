import {afterAll, afterEach, beforeAll, describe, expect, test} from 'vitest'
import {FakeApi, runCli} from '../helpers/fake-api.js'

const WID = '33333333-3333-4333-8333-333333333333'
const MID = '11111111-1111-4111-8111-111111111111'
const PATH = `/api/v1/maintenance-windows/${WID}`
const EXISTING = {
  id: WID, monitorId: MID, organizationId: 1,
  startsAt: '2026-06-01T14:00:00Z', endsAt: '2026-06-01T14:30:00Z',
  repeatRule: 'FREQ=WEEKLY', reason: 'Deploy', suppressAlerts: false,
  createdAt: '2026-05-01T00:00:00Z',
}

describe('maintenance-windows update (command level)', () => {
  let api: FakeApi
  beforeAll(async () => {
    api = await new FakeApi().start()
  })
  afterAll(() => api.stop())
  afterEach(() => {
    api.captured = []
  })

  function mock(existing: Record<string, unknown> = EXISTING) {
    api.on('GET', PATH, {body: {data: existing}})
    api.on('PUT', PATH, (req) => ({body: {data: {...existing, ...(req.json as object)}}}))
  }

  test('GETs the existing window and PUTs it with monitorId and every unspecified field intact', async () => {
    mock()
    const r = await runCli(['maintenance-windows', 'update', WID, '--end', '2026-06-01T15:00:00Z', '-o', 'json'], {api})
    expect(r.code).toBe(0)
    expect(api.calls('GET', PATH)).toHaveLength(1)
    expect(api.calls('PUT', PATH)[0]!.json).toEqual({
      monitorId: MID,
      startsAt: EXISTING.startsAt,
      endsAt: '2026-06-01T15:00:00Z',
      repeatRule: 'FREQ=WEEKLY',
      reason: 'Deploy',
      suppressAlerts: false,
    })
  }, 60_000)

  test('--reason alone does not make a single-monitor window org-wide', async () => {
    mock()
    const r = await runCli(['maintenance-windows', 'update', WID, '--reason', 'Rescheduled', '-o', 'json'], {api})
    expect(r.code).toBe(0)
    const body = api.calls('PUT', PATH)[0]!.json as Record<string, unknown>
    expect(body.monitorId).toBe(MID)
    expect(body.reason).toBe('Rescheduled')
    expect(body.suppressAlerts).toBe(false)
    expect(body.repeatRule).toBe('FREQ=WEEKLY')
  }, 60_000)

  test('--org-wide sends monitorId null and --reason "" clears the reason', async () => {
    mock()
    const r = await runCli(['maintenance-windows', 'update', WID, '--org-wide', '--reason', '', '-o', 'json'], {api})
    expect(r.code).toBe(0)
    const body = api.calls('PUT', PATH)[0]!.json as Record<string, unknown>
    expect(body.monitorId).toBeNull()
    expect(body.reason).toBeNull()
    expect(body.repeatRule).toBe('FREQ=WEEKLY')
  }, 60_000)
})
