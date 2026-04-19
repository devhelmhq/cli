import {describe, it, expect} from 'vitest'
import {DevhelmConfigSchema, formatZodErrors, _ZOD_ENUMS} from '../../src/lib/yaml/zod-schemas.js'
import * as schema from '../../src/lib/yaml/schema.js'

describe('DevhelmConfigSchema', () => {
  describe('top-level', () => {
    it('accepts an empty config', () => {
      const result = DevhelmConfigSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('rejects unknown top-level keys', () => {
      const result = DevhelmConfigSchema.safeParse({bogus: true})
      expect(result.success).toBe(false)
    })

    it('accepts version and defaults', () => {
      const result = DevhelmConfigSchema.safeParse({
        version: '2',
        defaults: {monitors: {frequencySeconds: 60, enabled: true}},
      })
      expect(result.success).toBe(true)
    })
  })

  describe('monitors', () => {
    it('accepts a valid HTTP monitor', () => {
      const result = DevhelmConfigSchema.safeParse({
        monitors: [{
          name: 'API',
          type: 'HTTP',
          config: {url: 'https://example.com', method: 'GET'},
        }],
      })
      expect(result.success).toBe(true)
    })

    it('rejects unknown monitor type', () => {
      const result = DevhelmConfigSchema.safeParse({
        monitors: [{name: 'X', type: 'FTP', config: {}}],
      })
      expect(result.success).toBe(false)
    })

    it('rejects frequency below minimum', () => {
      const result = DevhelmConfigSchema.safeParse({
        monitors: [{
          name: 'X', type: 'HTTP',
          config: {url: 'https://x', method: 'GET'},
          frequencySeconds: 10,
        }],
      })
      expect(result.success).toBe(false)
    })

    it('rejects frequency above maximum', () => {
      const result = DevhelmConfigSchema.safeParse({
        monitors: [{
          name: 'X', type: 'HTTP',
          config: {url: 'https://x', method: 'GET'},
          frequencySeconds: 999_999,
        }],
      })
      expect(result.success).toBe(false)
    })

    it('rejects extra fields on monitor (strict)', () => {
      const result = DevhelmConfigSchema.safeParse({
        monitors: [{
          name: 'X', type: 'HTTP',
          config: {url: 'https://x', method: 'GET'},
          extraField: 'nope',
        }],
      })
      expect(result.success).toBe(false)
    })
  })

  describe('assertions', () => {
    it('accepts a valid assertion with config', () => {
      const result = DevhelmConfigSchema.safeParse({
        monitors: [{
          name: 'X', type: 'HTTP',
          config: {url: 'https://x', method: 'GET'},
          assertions: [{config: {type: 'status_code', expected: '200', operator: 'equals'}}],
        }],
      })
      expect(result.success).toBe(true)
    })

    it('rejects an unknown assertion type', () => {
      const result = DevhelmConfigSchema.safeParse({
        monitors: [{
          name: 'X', type: 'HTTP',
          config: {url: 'https://x', method: 'GET'},
          assertions: [{config: {type: 'totally_made_up'}}],
        }],
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const messages = formatZodErrors(result.error).join('\n')
        expect(messages).toContain('Unknown assertion type')
      }
    })

    it('requires non-empty config for config-required assertions', () => {
      const result = DevhelmConfigSchema.safeParse({
        monitors: [{
          name: 'X', type: 'HTTP',
          config: {url: 'https://x', method: 'GET'},
          assertions: [{config: {type: 'status_code'}}],
        }],
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const messages = formatZodErrors(result.error).join('\n')
        expect(messages).toContain('Required')
      }
    })

    it('allows assertions that do not require config', () => {
      const result = DevhelmConfigSchema.safeParse({
        monitors: [{
          name: 'X', type: 'DNS',
          config: {hostname: 'example.com'},
          assertions: [{config: {type: 'dns_resolves'}}],
        }],
      })
      expect(result.success).toBe(true)
    })
  })

  describe('auth', () => {
    it('accepts bearer auth', () => {
      const result = DevhelmConfigSchema.safeParse({
        monitors: [{
          name: 'X', type: 'HTTP',
          config: {url: 'https://x', method: 'GET'},
          auth: {type: 'bearer', secret: 'tok'},
        }],
      })
      expect(result.success).toBe(true)
    })

    it('rejects auth missing required fields', () => {
      const result = DevhelmConfigSchema.safeParse({
        monitors: [{
          name: 'X', type: 'HTTP',
          config: {url: 'https://x', method: 'GET'},
          auth: {type: 'api_key', secret: 'tok'},
        }],
      })
      expect(result.success).toBe(false)
    })

    it('rejects unknown auth type', () => {
      const result = DevhelmConfigSchema.safeParse({
        monitors: [{
          name: 'X', type: 'HTTP',
          config: {url: 'https://x', method: 'GET'},
          auth: {type: 'mutual_tls', secret: 'x'},
        }],
      })
      expect(result.success).toBe(false)
    })
  })

  describe('alertChannels', () => {
    it('accepts slack channel', () => {
      const result = DevhelmConfigSchema.safeParse({
        alertChannels: [{
          name: 'ops',
          config: {channelType: 'slack', webhookUrl: 'https://hooks.slack.com/...'},
        }],
      })
      expect(result.success).toBe(true)
    })

    it('rejects unknown channel type', () => {
      const result = DevhelmConfigSchema.safeParse({
        alertChannels: [{name: 'x', config: {channelType: 'sms', webhookUrl: 'x'}}],
      })
      expect(result.success).toBe(false)
    })
  })

  describe('notificationPolicies', () => {
    it('accepts a valid policy', () => {
      const result = DevhelmConfigSchema.safeParse({
        notificationPolicies: [{
          name: 'critical',
          escalation: {
            steps: [{channels: ['ops']}],
          },
        }],
      })
      expect(result.success).toBe(true)
    })

    it('rejects policy with zero escalation steps', () => {
      const result = DevhelmConfigSchema.safeParse({
        notificationPolicies: [{
          name: 'critical',
          escalation: {steps: []},
        }],
      })
      expect(result.success).toBe(false)
    })

    it('rejects escalation step with empty channels', () => {
      const result = DevhelmConfigSchema.safeParse({
        notificationPolicies: [{
          name: 'critical',
          escalation: {steps: [{channels: []}]},
        }],
      })
      expect(result.success).toBe(false)
    })
  })

  describe('statusPages', () => {
    it('accepts a minimal status page', () => {
      const result = DevhelmConfigSchema.safeParse({
        statusPages: [{name: 'Public', slug: 'public'}],
      })
      expect(result.success).toBe(true)
    })

    it('accepts components and component groups', () => {
      const result = DevhelmConfigSchema.safeParse({
        statusPages: [{
          name: 'Public', slug: 'public',
          componentGroups: [{name: 'API'}],
          components: [
            {name: 'Web', type: 'MONITOR', monitor: 'api'},
            {name: 'All', type: 'GROUP', resourceGroup: 'services'},
            {name: 'Static', type: 'STATIC'},
          ],
        }],
      })
      expect(result.success).toBe(true)
    })

    it('rejects unknown component type', () => {
      const result = DevhelmConfigSchema.safeParse({
        statusPages: [{
          name: 'Public', slug: 'public',
          components: [{name: 'X', type: 'UNKNOWN'}],
        }],
      })
      expect(result.success).toBe(false)
    })

    it('rejects unknown visibility', () => {
      const result = DevhelmConfigSchema.safeParse({
        statusPages: [{name: 'P', slug: 'p', visibility: 'SECRET'}],
      })
      expect(result.success).toBe(false)
    })

    it('rejects PASSWORD / IP_RESTRICTED (not yet supported server-side)', () => {
      for (const v of ['PASSWORD', 'IP_RESTRICTED']) {
        const result = DevhelmConfigSchema.safeParse({
          statusPages: [{name: 'P', slug: 'p', visibility: v}],
        })
        expect(result.success).toBe(false)
      }
    })

    it('accepts branding with hex colors and http(s) URLs', () => {
      const result = DevhelmConfigSchema.safeParse({
        statusPages: [{
          name: 'P', slug: 'p',
          branding: {
            logoUrl: 'https://cdn.example.com/logo.png',
            brandColor: '#4F46E5',
            theme: 'dark',
            hidePoweredBy: true,
            customCss: '.accent { color: red; }',
          },
        }],
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid branding hex color', () => {
      const result = DevhelmConfigSchema.safeParse({
        statusPages: [{
          name: 'P', slug: 'p',
          branding: {brandColor: 'not-a-color'},
        }],
      })
      expect(result.success).toBe(false)
    })

    it('rejects non-http(s) logoUrl', () => {
      const result = DevhelmConfigSchema.safeParse({
        statusPages: [{
          name: 'P', slug: 'p',
          branding: {logoUrl: 'javascript:alert(1)'},
        }],
      })
      expect(result.success).toBe(false)
    })

    it('rejects unknown branding field (strict)', () => {
      const result = DevhelmConfigSchema.safeParse({
        statusPages: [{
          name: 'P', slug: 'p',
          branding: {bogus: 'field'},
        }],
      })
      expect(result.success).toBe(false)
    })

    it('accepts component excludeFromOverall and startDate', () => {
      const result = DevhelmConfigSchema.safeParse({
        statusPages: [{
          name: 'P', slug: 'p',
          components: [{
            name: 'Third-party API', type: 'STATIC',
            excludeFromOverall: true,
            startDate: '2024-01-15',
          }],
        }],
      })
      expect(result.success).toBe(true)
    })

    it('rejects malformed component startDate', () => {
      const result = DevhelmConfigSchema.safeParse({
        statusPages: [{
          name: 'P', slug: 'p',
          components: [{name: 'X', type: 'STATIC', startDate: '01/15/2024'}],
        }],
      })
      expect(result.success).toBe(false)
    })

    it('rejects unknown incidentMode', () => {
      const result = DevhelmConfigSchema.safeParse({
        statusPages: [{name: 'P', slug: 'p', incidentMode: 'MAGIC'}],
      })
      expect(result.success).toBe(false)
    })

    it('rejects extra fields on status page (strict)', () => {
      const result = DevhelmConfigSchema.safeParse({
        statusPages: [{name: 'P', slug: 'p', extra: 'nope'}],
      })
      expect(result.success).toBe(false)
    })
  })

  describe('resourceGroups', () => {
    it('accepts a group with monitors and services', () => {
      const result = DevhelmConfigSchema.safeParse({
        resourceGroups: [{
          name: 'core',
          monitors: ['api', 'web'],
          services: ['github'],
        }],
      })
      expect(result.success).toBe(true)
    })

    it('rejects defaultFrequency below minimum', () => {
      const result = DevhelmConfigSchema.safeParse({
        resourceGroups: [{name: 'x', defaultFrequency: 5}],
      })
      expect(result.success).toBe(false)
    })
  })

  describe('moved blocks', () => {
    it('accepts moved blocks with from/to', () => {
      const result = DevhelmConfigSchema.safeParse({
        moved: [{from: 'monitors.old', to: 'monitors.new'}],
      })
      expect(result.success).toBe(true)
    })

    it('rejects moved block with extra fields', () => {
      const result = DevhelmConfigSchema.safeParse({
        moved: [{from: 'a', to: 'b', reason: 'rename'}],
      })
      expect(result.success).toBe(false)
    })

    it('rejects moved block missing to', () => {
      const result = DevhelmConfigSchema.safeParse({
        moved: [{from: 'a'}],
      })
      expect(result.success).toBe(false)
    })
  })

  describe('dependencies', () => {
    it('accepts minimal dependency', () => {
      const result = DevhelmConfigSchema.safeParse({
        dependencies: [{service: 'github'}],
      })
      expect(result.success).toBe(true)
    })

    it('accepts all alertSensitivities', () => {
      for (const sensitivity of ['ALL', 'INCIDENTS_ONLY', 'MAJOR_ONLY']) {
        const result = DevhelmConfigSchema.safeParse({
          dependencies: [{service: 'github', alertSensitivity: sensitivity}],
        })
        expect(result.success).toBe(true)
      }
    })

    it('rejects unknown alertSensitivity', () => {
      const result = DevhelmConfigSchema.safeParse({
        dependencies: [{service: 'github', alertSensitivity: 'NONE'}],
      })
      expect(result.success).toBe(false)
    })
  })
})

describe('enum-parity (zod-schemas vs schema.ts)', () => {
  // The Zod layer keeps its own `as const` tuples because z.enum requires
  // literal tuples. This test guarantees those tuples never drift from the
  // canonical lists in schema.ts.
  const cases: Array<[keyof typeof _ZOD_ENUMS, readonly string[] | number]> = [
    ['MONITOR_TYPES', schema.MONITOR_TYPES],
    ['HTTP_METHODS', schema.HTTP_METHODS],
    ['DNS_RECORD_TYPES', schema.DNS_RECORD_TYPES],
    ['ASSERTION_SEVERITIES', schema.ASSERTION_SEVERITIES],
    ['CHANNEL_TYPES', schema.CHANNEL_TYPES],
    ['TRIGGER_RULE_TYPES', schema.TRIGGER_RULE_TYPES],
    ['TRIGGER_SCOPES', schema.TRIGGER_SCOPES],
    ['TRIGGER_SEVERITIES', schema.TRIGGER_SEVERITIES],
    ['TRIGGER_AGGREGATIONS', schema.TRIGGER_AGGREGATIONS],
    ['ALERT_SENSITIVITIES', schema.ALERT_SENSITIVITIES],
    ['HEALTH_THRESHOLD_TYPES', schema.HEALTH_THRESHOLD_TYPES],
    ['STATUS_PAGE_VISIBILITIES', schema.STATUS_PAGE_VISIBILITIES],
    ['STATUS_PAGE_INCIDENT_MODES', schema.STATUS_PAGE_INCIDENT_MODES],
    ['STATUS_PAGE_COMPONENT_TYPES', schema.STATUS_PAGE_COMPONENT_TYPES],
    ['MIN_FREQUENCY', schema.MIN_FREQUENCY],
    ['MAX_FREQUENCY', schema.MAX_FREQUENCY],
  ]

  for (const [name, expected] of cases) {
    it(`zod ${name} matches schema.ts (order + values)`, () => {
      expect(_ZOD_ENUMS[name]).toEqual(expected)
    })
  }
})

describe('formatZodErrors', () => {
  it('includes field path and message', () => {
    const result = DevhelmConfigSchema.safeParse({
      monitors: [{name: 'X', type: 'FTP', config: {}}],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = formatZodErrors(result.error)
      expect(messages.length).toBeGreaterThan(0)
      const joined = messages.join('\n')
      expect(joined).toMatch(/monitors/)
    }
  })

  it('uses (root) for root-level errors', () => {
    const result = DevhelmConfigSchema.safeParse(null)
    if (!result.success) {
      const messages = formatZodErrors(result.error)
      expect(messages[0]).toMatch(/^\(root\):/)
    }
  })
})
