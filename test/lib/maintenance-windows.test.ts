import {describe, expect, it} from 'vitest'
import {buildMaintenanceWindowBody} from '../../src/lib/maintenance-windows.js'

describe('buildMaintenanceWindowBody', () => {
  it('produces a minimal create body when only start/end/monitor are given', () => {
    const body = buildMaintenanceWindowBody(
      {
        start: '2026-06-01T14:00:00Z',
        end: '2026-06-01T14:30:00Z',
        monitor: '11111111-1111-1111-1111-111111111111',
      },
      'create',
    )
    expect(body).toEqual({
      startsAt: '2026-06-01T14:00:00Z',
      endsAt: '2026-06-01T14:30:00Z',
      monitorId: '11111111-1111-1111-1111-111111111111',
    })
  })

  it('emits monitorId: null when --org-wide is set', () => {
    const body = buildMaintenanceWindowBody(
      {start: 's', end: 'e', orgWide: true},
      'create',
    )
    expect(body.monitorId).toBeNull()
  })

  it('translates an empty --reason into null on update (clears the field)', () => {
    const body = buildMaintenanceWindowBody({reason: ''}, 'update')
    expect(body.reason).toBeNull()
  })

  it('preserves non-empty --reason verbatim', () => {
    const body = buildMaintenanceWindowBody({reason: 'Planned deploy'}, 'create')
    expect(body.reason).toBe('Planned deploy')
  })

  it('omits keys that the user did not pass (partial-update semantics)', () => {
    const body = buildMaintenanceWindowBody({start: '2026-06-01T14:00:00Z'}, 'update')
    expect(Object.keys(body)).toEqual(['startsAt'])
  })

  it('clears repeatRule when an empty string is provided', () => {
    const body = buildMaintenanceWindowBody({repeatRule: ''}, 'update')
    expect(body.repeatRule).toBeNull()
  })

  it('passes suppressAlerts through as a boolean', () => {
    expect(buildMaintenanceWindowBody({suppressAlerts: false}, 'create').suppressAlerts).toBe(false)
    expect(buildMaintenanceWindowBody({suppressAlerts: true}, 'create').suppressAlerts).toBe(true)
  })

  it('does not coerce orgWide=false into a clearing monitorId', () => {
    // Passing --no-org-wide implicitly via orgWide:false should leave the
    // field unset so the API treats it as "no change". Only an explicit
    // --org-wide writes monitorId: null.
    const body = buildMaintenanceWindowBody({orgWide: false}, 'update')
    expect('monitorId' in body).toBe(false)
  })
})
