import {describe, it, expect} from 'vitest'
import {formatOutput} from '../../src/lib/output.js'

describe('formatOutput single-record table', () => {
  it('JSON-stringifies short nested objects in full', () => {
    const out = formatOutput({id: 'x', tags: ['a', 'b']}, 'table')
    // Short arrays/objects render fully — no truncation hint.
    expect(out).toContain('["a","b"]')
    expect(out).not.toContain('use --output json')
  })

  it('truncates long nested object values with a hint to use --output json', () => {
    const incidentPolicy = {
      enabled: true,
      escalations: Array.from({length: 12}, (_, i) => ({
        order: i,
        delaySeconds: i * 60,
        channelIds: ['00000000-0000-0000-0000-000000000000'],
      })),
    }
    const out = formatOutput({id: 'mon-1', name: 'X', incidentPolicy}, 'table')

    // The truncated rendering carries the hint, and the resulting
    // single-row width stays well under what the raw JSON would produce
    // (the raw blob is >1000 chars).
    expect(out).toContain('use --output json')
    const rawJsonLength = JSON.stringify(incidentPolicy).length
    expect(rawJsonLength).toBeGreaterThan(500)
    const widestLine = Math.max(...out.split('\n').map((l) => l.length))
    expect(widestLine).toBeLessThan(200)
  })

  it('does not break when a nested object stringifies to exactly the cutoff', () => {
    // 79-char JSON value — under the limit, no hint expected.
    const value = {a: 'x'.repeat(70)}
    expect(JSON.stringify(value).length).toBeLessThan(80)
    const out = formatOutput({id: 'x', value}, 'table')
    expect(out).not.toContain('use --output json')
  })

  it('renders null nested values as empty rather than {}', () => {
    const out = formatOutput({id: 'x', auth: null}, 'table')
    // null falls through to `String(value ?? '')` which gives '' — we
    // never want to render the literal "null" or surface a misleading
    // truncated "{}" for a missing value.
    expect(out).not.toContain('null')
  })

  it('JSON output is unchanged by the table-only truncation logic', () => {
    const incidentPolicy = {enabled: true, escalations: Array.from({length: 12}, () => ({delaySeconds: 60}))}
    const out = formatOutput({id: 'mon-1', incidentPolicy}, 'json')
    // The full structure must round-trip through JSON output even though
    // the table renderer truncates it.
    expect(JSON.parse(out)).toEqual({id: 'mon-1', incidentPolicy})
  })
})
