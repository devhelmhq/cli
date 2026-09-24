import {describe, expect, it} from 'vitest'
import {otpColumn, splitAddress} from '../../src/lib/inbound.js'
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
})
