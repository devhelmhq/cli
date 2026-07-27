import {describe, expect, it} from 'vitest'
import {schemas} from '../../src/lib/api-zod.generated.js'

describe('AlertChannelDisplayConfig Postel tolerance', () => {
  it('accepts additive SMS/phone keys unknown to this CLI pin', () => {
    const parsed = schemas.AlertChannelDisplayConfig.parse({
      recipients: ['ops@example.com'],
      phoneNumber: '+14155550123',
      verifiedPhoneNumberId: 7,
      phoneNumbers: ['+14155550123'],
      voiceLanguage: 'en-US',
      preferredLanguage: 'de-DE',
      futureCarrierField: 'kept',
    })
    expect(parsed.recipients).toEqual(['ops@example.com'])
    expect((parsed as {phoneNumber?: string}).phoneNumber).toBe('+14155550123')
    expect((parsed as {futureCarrierField?: string}).futureCarrierField).toBe('kept')
  })
})
