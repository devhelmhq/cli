import {describe, expect, it} from 'vitest'
import {bucketTotal, otpColumn, responseHeaderMap, splitAddress} from '../../src/lib/inbound.js'
import {DevhelmValidationError} from '../../src/lib/errors.js'

describe('inbound helpers', () => {
  it('joins OTP values for the table column', () => {
    expect(otpColumn({otp: [{value: '123456'}, {value: '9999'}]})).toBe('123456, 9999')
    expect(otpColumn({})).toBe('')
  })

  it('splits a mailbox and rejects a bare local-part', () => {
    expect(splitAddress('signup@ws.devhelmmail.com')).toEqual({
      localPart: 'signup',
      domain: 'ws.devhelmmail.com',
    })
    expect(() => splitAddress('signup')).toThrow(DevhelmValidationError)
  })

  it('parses mock reply headers', () => {
    expect(responseHeaderMap(['X-Test: yes', 'Empty:'])).toEqual({'X-Test': 'yes', Empty: ''})
    expect(responseHeaderMap(undefined)).toBeUndefined()
    expect(() => responseHeaderMap(['nope'])).toThrow(DevhelmValidationError)
    expect(() => responseHeaderMap(['X-Test: a', 'X-Test: b'])).toThrow(/twice/)
  })

  it('sums hourly activity buckets', () => {
    expect(bucketTotal({buckets: [{eventCount: 2}, {eventCount: 5}]}, 'eventCount')).toBe('7')
    expect(bucketTotal({}, 'eventCount')).toBe('0')
  })
})
