import {describe, expect, it} from 'vitest'
import {schemas} from '../../src/lib/api-zod.generated.js'
import {parseSingle} from '../../src/lib/response-validation.js'

const page = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  organizationId: 1,
  workspaceId: 1,
  name: 'Test Page',
  slug: 'test-page',
  branding: {brandColor: '#6F00EF', noIndex: true, timeZone: 'America/New_York'},
  visibility: 'PUBLIC',
  enabled: true,
  incidentMode: 'MANUAL',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
}

describe('shared request and response schemas', () => {
  it('accepts and preserves additive fields in nested response branding', () => {
    const result = parseSingle(schemas.StatusPageDto, {data: page})
    expect(result.branding).toMatchObject({
      noIndex: true,
      timeZone: 'America/New_York',
    })
  })

  it('rejects unknown fields in request branding', () => {
    const result = schemas.CreateStatusPageRequest.safeParse({
      name: 'Test Page',
      slug: 'test-page',
      branding: {brandColor: '#6F00EF', noIndex: true},
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].code).toBe('unrecognized_keys')
    }
  })

  it('still rejects invalid known branding values in responses', () => {
    expect(() => parseSingle(schemas.StatusPageDto, {
      data: {...page, branding: {...page.branding, brandColor: 'purple'}},
    })).toThrow()
  })
})
