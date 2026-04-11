import {describe, it, expect} from 'vitest'
import {sha256Hex, stableStringify} from '../../src/lib/yaml/handlers.js'

describe('stableStringify', () => {
  it('sorts object keys alphabetically', () => {
    const obj = {z: 1, a: 2, m: 3}
    expect(stableStringify(obj)).toBe('{"a":2,"m":3,"z":1}')
  })

  it('handles nested objects with sorted keys', () => {
    const obj = {b: {d: 1, c: 2}, a: 3}
    expect(stableStringify(obj)).toBe('{"a":3,"b":{"c":2,"d":1}}')
  })

  it('handles arrays (preserves element order)', () => {
    const obj = {items: [3, 1, 2]}
    expect(stableStringify(obj)).toBe('{"items":[3,1,2]}')
  })

  it('handles arrays of objects with sorted keys', () => {
    const obj = [{z: 1, a: 2}, {b: 3}]
    expect(stableStringify(obj)).toBe('[{"a":2,"z":1},{"b":3}]')
  })

  it('handles null', () => {
    expect(stableStringify(null)).toBe('null')
  })

  it('handles undefined as null', () => {
    expect(stableStringify(undefined)).toBe('null')
  })

  it('handles booleans', () => {
    expect(stableStringify(true)).toBe('true')
    expect(stableStringify(false)).toBe('false')
  })

  it('handles numbers', () => {
    expect(stableStringify(42)).toBe('42')
    expect(stableStringify(3.14)).toBe('3.14')
  })

  it('handles strings', () => {
    expect(stableStringify('hello')).toBe('"hello"')
  })

  it('is deterministic across calls', () => {
    const obj = {z: {y: {x: 1}}, a: [1, 2]}
    const first = stableStringify(obj)
    const second = stableStringify(obj)
    expect(first).toBe(second)
  })

  it('produces identical output regardless of key insertion order', () => {
    const a: Record<string, unknown> = {}
    a.z = 1; a.a = 2; a.m = 3
    const b: Record<string, unknown> = {}
    b.a = 2; b.m = 3; b.z = 1
    expect(stableStringify(a)).toBe(stableStringify(b))
  })

  it('handles empty object', () => {
    expect(stableStringify({})).toBe('{}')
  })

  it('handles empty array', () => {
    expect(stableStringify([])).toBe('[]')
  })

  it('handles deeply nested structures', () => {
    const obj = {c: {b: {a: 1}}}
    expect(stableStringify(obj)).toBe('{"c":{"b":{"a":1}}}')
  })

  it('handles mixed null values in objects', () => {
    const obj = {b: null, a: 'hello'}
    expect(stableStringify(obj)).toBe('{"a":"hello","b":null}')
  })
})

describe('sha256Hex', () => {
  it('produces correct hex for empty string', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })

  it('produces correct hex for known input', () => {
    expect(sha256Hex('hello')).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824')
  })

  it('different inputs produce different hashes', () => {
    const h1 = sha256Hex('input-a')
    const h2 = sha256Hex('input-b')
    expect(h1).not.toBe(h2)
  })

  it('produces 64-character hex string', () => {
    const hash = sha256Hex('test')
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic', () => {
    const input = '{"webhookUrl":"https://hooks.slack.com/test","channelType":"SlackChannelConfig"}'
    expect(sha256Hex(input)).toBe(sha256Hex(input))
  })
})

describe('stableStringify + sha256Hex integration', () => {
  it('produces consistent hash for reordered objects', () => {
    const a = {channelType: 'SlackChannelConfig', webhookUrl: 'https://hooks.slack.com/test'}
    const b = {webhookUrl: 'https://hooks.slack.com/test', channelType: 'SlackChannelConfig'}
    expect(sha256Hex(stableStringify(a))).toBe(sha256Hex(stableStringify(b)))
  })

  it('produces different hash for different content', () => {
    const a = {channelType: 'SlackChannelConfig', webhookUrl: 'https://hooks.slack.com/test1'}
    const b = {channelType: 'SlackChannelConfig', webhookUrl: 'https://hooks.slack.com/test2'}
    expect(sha256Hex(stableStringify(a))).not.toBe(sha256Hex(stableStringify(b)))
  })
})
