import {describe, expect, it} from 'vitest'
import {schemas} from '../../src/lib/api-zod.generated.js'

const DOMAIN_ID = '550e8400-e29b-41d4-a716-446655440000'
const PRODUCT_IDS = [
  '98180ebe-5205-90b3-8163-12b9b296a43f',
  '8e773758-ab32-706a-feb4-ce9948d54d91',
  'dae95c56-9672-f41e-e5a4-ee071ead735d',
]

function message(id: string, domainId = DOMAIN_ID) {
  return {
    id,
    domainId,
    receivedAt: '2026-09-24T12:00:00.000Z',
    sizeBytes: 1,
    headers: {},
    sha256: 'abc',
  }
}

describe('EmailMessageDto id', () => {
  it('accepts product-issued message ids and rejects an empty id', () => {
    for (const id of PRODUCT_IDS) {
      const parsed = schemas.EmailMessageDto.safeParse(message(id))
      expect(parsed.success).toBe(true)
      if (parsed.success) expect(parsed.data.id).toBe(id)
    }
    expect(schemas.EmailMessageDto.safeParse(message('')).success).toBe(false)
    expect(schemas.EmailMessageDto.safeParse(message(PRODUCT_IDS[0], 'not-a-uuid')).success).toBe(false)
  })
})
