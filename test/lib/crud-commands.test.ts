import {describe, expect, it} from 'vitest'
import {aOrAn} from '../../src/lib/crud-commands.js'

describe('aOrAn (P1.Bug8)', () => {
  it.each([
    ['monitor', 'a'],
    ['secret', 'a'],
    ['tag', 'a'],
    ['notification policy', 'a'],
    ['resource group', 'a'],
    ['webhook', 'a'],
    ['dependency', 'a'],
    ['status page', 'a'],
  ])('"%s" → "%s"', (word, expected) => {
    expect(aOrAn(word)).toBe(expected)
  })

  it.each([
    ['alert channel', 'an'],
    ['API key', 'an'],
    ['environment', 'an'],
    ['incident', 'an'],
    ['organization', 'an'],
  ])('"%s" → "%s"', (word, expected) => {
    expect(aOrAn(word)).toBe(expected)
  })

  it('strips leading whitespace before checking', () => {
    expect(aOrAn('   alert channel')).toBe('an')
  })
})
