import {describe, it, expect} from 'vitest'
import {DevhelmConfigSchema, formatZodErrors} from '../../src/lib/yaml/zod-schemas.js'

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
        defaults: {monitors: {frequency: 60, enabled: true}},
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
          frequency: 10,
        }],
      })
      expect(result.success).toBe(false)
    })

    it('rejects frequency above maximum', () => {
      const result = DevhelmConfigSchema.safeParse({
        monitors: [{
          name: 'X', type: 'HTTP',
          config: {url: 'https://x', method: 'GET'},
          frequency: 999_999,
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
          assertions: [{type: 'status_code', config: {expected: 200}}],
        }],
      })
      expect(result.success).toBe(true)
    })

    it('rejects an unknown assertion type', () => {
      const result = DevhelmConfigSchema.safeParse({
        monitors: [{
          name: 'X', type: 'HTTP',
          config: {url: 'https://x', method: 'GET'},
          assertions: [{type: 'totally_made_up'}],
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
          assertions: [{type: 'status_code'}],
        }],
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        const messages = formatZodErrors(result.error).join('\n')
        expect(messages).toMatch(/requires a non-empty "config"/)
      }
    })

    it('allows assertions that do not require config', () => {
      const result = DevhelmConfigSchema.safeParse({
        monitors: [{
          name: 'X', type: 'DNS',
          config: {hostname: 'example.com'},
          assertions: [{type: 'dns_resolves'}],
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
          type: 'slack',
          config: {webhookUrl: 'https://hooks.slack.com/...'},
        }],
      })
      expect(result.success).toBe(true)
    })

    it('rejects unknown channel type', () => {
      const result = DevhelmConfigSchema.safeParse({
        alertChannels: [{name: 'x', type: 'sms', config: {webhookUrl: 'x'}}],
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
