import {describe, it, expect} from 'vitest'
import {
  toCreateTagRequest, toCreateEnvironmentRequest, toCreateSecretRequest,
  toCreateAlertChannelRequest, toCreateNotificationPolicyRequest,
  toCreateWebhookRequest, toCreateResourceGroupRequest,
  toCreateMonitorRequest, toUpdateMonitorRequest,
  toCreateStatusPageRequest, toUpdateStatusPageRequest,
} from '../../src/lib/yaml/transform.js'
import {ResolvedRefs} from '../../src/lib/yaml/resolver.js'
import type {
  YamlTag, YamlEnvironment, YamlAlertChannel,
  YamlNotificationPolicy, YamlWebhook, YamlResourceGroup, YamlMonitor,
  YamlStatusPage,
} from '../../src/lib/yaml/schema.js'

function emptyRefs(): ResolvedRefs {
  return new ResolvedRefs()
}

function refsWithChannels(): ResolvedRefs {
  const refs = new ResolvedRefs()
  refs.set('alertChannels', 'ops-slack', {id: 'ch-123', refKey: 'ops-slack', raw: {}})
  refs.set('alertChannels', 'pagerduty', {id: 'ch-456', refKey: 'pagerduty', raw: {}})
  refs.set('tags', 'production', {id: 'tag-1', refKey: 'production', raw: {}})
  refs.set('environments', 'prod', {id: 'env-1', refKey: 'prod', raw: {}})
  refs.set('secrets', 'api-key', {id: 'sec-1', refKey: 'api-key', raw: {}})
  return refs
}

describe('transforms', () => {
  describe('toCreateTagRequest', () => {
    it('transforms basic tag', () => {
      const tag: YamlTag = {name: 'production', color: '#EF4444'}
      const req = toCreateTagRequest(tag)
      expect(req.name).toBe('production')
      expect(req.color).toBe('#EF4444')
    })

    it('defaults color to null', () => {
      const req = toCreateTagRequest({name: 'test'})
      expect(req.color).toBeNull()
    })
  })

  describe('toCreateEnvironmentRequest', () => {
    it('transforms environment', () => {
      const env: YamlEnvironment = {name: 'Production', slug: 'production', isDefault: true}
      const req = toCreateEnvironmentRequest(env)
      expect(req.name).toBe('Production')
      expect(req.slug).toBe('production')
      expect(req.isDefault).toBe(true)
    })

    it('handles variables', () => {
      const env: YamlEnvironment = {name: 'Dev', slug: 'dev', variables: {API_URL: 'http://localhost'}}
      const req = toCreateEnvironmentRequest(env)
      expect(req.variables).toEqual({API_URL: 'http://localhost'})
    })

    it('defaults variables to null', () => {
      const env: YamlEnvironment = {name: 'Staging', slug: 'staging'}
      const req = toCreateEnvironmentRequest(env)
      expect(req.variables).toBeNull()
    })

    it('defaults isDefault to undefined', () => {
      const env: YamlEnvironment = {name: 'CI', slug: 'ci'}
      const req = toCreateEnvironmentRequest(env)
      expect(req.isDefault).toBeUndefined()
    })
  })

  describe('toCreateSecretRequest', () => {
    it('transforms secret', () => {
      const req = toCreateSecretRequest({key: 'api-key', value: 'secret-123'})
      expect(req.key).toBe('api-key')
      expect(req.value).toBe('secret-123')
    })
  })

  describe('toCreateAlertChannelRequest', () => {
    it('transforms slack channel', () => {
      const channel: YamlAlertChannel = {
        name: 'ops', type: 'slack',
        config: {webhookUrl: 'https://hooks.slack.com/test'},
      }
      const req = toCreateAlertChannelRequest(channel)
      expect(req.name).toBe('ops')
      expect(req.config).toHaveProperty('channelType', 'slack')
      expect(req.config).toHaveProperty('webhookUrl', 'https://hooks.slack.com/test')
    })

    it('transforms email channel', () => {
      const channel: YamlAlertChannel = {
        name: 'eng', type: 'email',
        config: {recipients: ['a@test.com']},
      }
      const req = toCreateAlertChannelRequest(channel)
      expect(req.config).toHaveProperty('channelType', 'email')
      expect(req.config).toHaveProperty('recipients', ['a@test.com'])
    })

    it('transforms all 7 channel types', () => {
      const types = [
        {type: 'slack' as const, config: {webhookUrl: 'url'}, expected: 'slack'},
        {type: 'discord' as const, config: {webhookUrl: 'url'}, expected: 'discord'},
        {type: 'email' as const, config: {recipients: ['a@b.com']}, expected: 'email'},
        {type: 'pagerduty' as const, config: {routingKey: 'key'}, expected: 'pagerduty'},
        {type: 'opsgenie' as const, config: {apiKey: 'key'}, expected: 'opsgenie'},
        {type: 'teams' as const, config: {webhookUrl: 'url'}, expected: 'teams'},
        {type: 'webhook' as const, config: {url: 'url'}, expected: 'webhook'},
      ]
      for (const {type, config, expected} of types) {
        const req = toCreateAlertChannelRequest({name: 'test', type, config})
        expect(req.config).toHaveProperty('channelType', expected)
      }
    })

    it('preserves extra config fields', () => {
      const channel: YamlAlertChannel = {
        name: 'pg', type: 'pagerduty',
        config: {routingKey: 'r-key', severity: 'critical'},
      }
      const req = toCreateAlertChannelRequest(channel)
      expect(req.config).toHaveProperty('routingKey', 'r-key')
      expect(req.config).toHaveProperty('severity', 'critical')
    })
  })

  describe('toCreateNotificationPolicyRequest', () => {
    it('transforms with channel references', () => {
      const refs = refsWithChannels()
      const policy: YamlNotificationPolicy = {
        name: 'test', enabled: true, priority: 1,
        escalation: {
          steps: [{channels: ['ops-slack'], delayMinutes: 0}],
        },
      }
      const req = toCreateNotificationPolicyRequest(policy, refs)
      expect(req.name).toBe('test')
      expect(req.enabled).toBe(true)
      expect(req.priority).toBe(1)
      expect(req.escalation.steps[0].channelIds).toEqual(['ch-123'])
    })

    it('throws on unresolved channel', () => {
      const refs = emptyRefs()
      const policy: YamlNotificationPolicy = {
        name: 'test',
        escalation: {steps: [{channels: ['nonexistent']}]},
      }
      expect(() => toCreateNotificationPolicyRequest(policy, refs)).toThrow('Cannot resolve')
    })

    it('transforms match rules with monitor names', () => {
      const refs = new ResolvedRefs()
      refs.set('monitors', 'api', {id: 'mon-1', refKey: 'api', raw: {}})
      refs.set('alertChannels', 'ch', {id: 'ch-1', refKey: 'ch', raw: {}})
      const policy: YamlNotificationPolicy = {
        name: 'test',
        matchRules: [{type: 'monitor_id_in', monitorNames: ['api']}],
        escalation: {steps: [{channels: ['ch']}]},
      }
      const req = toCreateNotificationPolicyRequest(policy, refs)
      expect(req.matchRules![0].monitorIds).toEqual(['mon-1'])
    })

    it('defaults enabled to true', () => {
      const refs = refsWithChannels()
      const policy: YamlNotificationPolicy = {
        name: 'p',
        escalation: {steps: [{channels: ['ops-slack']}]},
      }
      const req = toCreateNotificationPolicyRequest(policy, refs)
      expect(req.enabled).toBe(true)
    })

    it('defaults priority to 0', () => {
      const refs = refsWithChannels()
      const policy: YamlNotificationPolicy = {
        name: 'p',
        escalation: {steps: [{channels: ['ops-slack']}]},
      }
      const req = toCreateNotificationPolicyRequest(policy, refs)
      expect(req.priority).toBe(0)
    })

    it('defaults requireAck to false (matches API persistence) for unspecified steps', () => {
      // Regression for the A1 BDD failure: pre-fix the transform sent
      // `requireAck: null`, but the API echoed back `false`, producing
      // phantom drift on every plan after a fresh deploy.
      const refs = refsWithChannels()
      const policy: YamlNotificationPolicy = {
        name: 'p',
        escalation: {steps: [{channels: ['ops-slack']}]},
      }
      const req = toCreateNotificationPolicyRequest(policy, refs)
      expect(req.escalation.steps[0].requireAck).toBe(false)
    })

    it('transforms multiple escalation steps with delays', () => {
      const refs = refsWithChannels()
      const policy: YamlNotificationPolicy = {
        name: 'esc',
        escalation: {
          steps: [
            {channels: ['ops-slack'], delayMinutes: 0},
            {channels: ['pagerduty'], delayMinutes: 15, requireAck: true},
          ],
        },
      }
      const req = toCreateNotificationPolicyRequest(policy, refs)
      expect(req.escalation.steps).toHaveLength(2)
      expect(req.escalation.steps[0].delayMinutes).toBe(0)
      expect(req.escalation.steps[1].delayMinutes).toBe(15)
      expect(req.escalation.steps[1].requireAck).toBe(true)
      expect(req.escalation.steps[1].channelIds).toEqual(['ch-456'])
    })

    it('transforms escalation onResolve/onReopen', () => {
      const refs = refsWithChannels()
      const policy: YamlNotificationPolicy = {
        name: 'p',
        escalation: {
          steps: [{channels: ['ops-slack']}],
          onResolve: 'notify_all',
          onReopen: 'notify_first',
        },
      }
      const req = toCreateNotificationPolicyRequest(policy, refs)
      expect(req.escalation.onResolve).toBe('notify_all')
      expect(req.escalation.onReopen).toBe('notify_first')
    })
  })

  describe('toCreateWebhookRequest', () => {
    it('transforms webhook', () => {
      const webhook: YamlWebhook = {
        url: 'https://hooks.example.com', events: ['monitor.down'], description: 'test',
      }
      const req = toCreateWebhookRequest(webhook)
      expect(req.url).toBe('https://hooks.example.com')
      expect(req.subscribedEvents).toEqual(['monitor.down'])
      expect(req.description).toBe('test')
    })

    it('transforms webhook without description', () => {
      const webhook: YamlWebhook = {url: 'https://x.com', events: ['a', 'b']}
      const req = toCreateWebhookRequest(webhook)
      expect(req.description).toBeUndefined()
      expect(req.subscribedEvents).toEqual(['a', 'b'])
    })
  })

  describe('toCreateResourceGroupRequest', () => {
    it('transforms with defaults', () => {
      const refs = refsWithChannels()
      refs.set('notificationPolicies', 'critical', {id: 'pol-1', refKey: 'critical', raw: {}})
      const group: YamlResourceGroup = {
        name: 'API',
        description: 'API services',
        defaultFrequency: 30,
        defaultRegions: ['us-east'],
        defaultAlertChannels: ['ops-slack'],
        defaultEnvironment: 'prod',
        alertPolicy: 'critical',
        healthThresholdType: 'PERCENTAGE',
        healthThresholdValue: 80,
      }
      const req = toCreateResourceGroupRequest(group, refs)
      expect(req.name).toBe('API')
      expect(req.description).toBe('API services')
      expect(req.defaultFrequency).toBe(30)
      expect(req.defaultRegions).toEqual(['us-east'])
      expect(req.alertPolicyId).toBe('pol-1')
      expect(req.defaultEnvironmentId).toBe('env-1')
      expect(req.healthThresholdType).toBe('PERCENTAGE')
      expect(req.healthThresholdValue).toBe(80)
    })

    it('transforms minimal group with null defaults', () => {
      const refs = emptyRefs()
      const group: YamlResourceGroup = {name: 'Minimal'}
      const req = toCreateResourceGroupRequest(group, refs)
      expect(req.name).toBe('Minimal')
      expect(req.description).toBeNull()
      expect(req.alertPolicyId).toBeNull()
      expect(req.defaultFrequency).toBeNull()
      expect(req.defaultRegions).toBeNull()
    })

    it('transforms retry strategy', () => {
      const refs = emptyRefs()
      const group: YamlResourceGroup = {
        name: 'G',
        defaultRetryStrategy: {type: 'LINEAR', maxRetries: 3, interval: 10},
      }
      const req = toCreateResourceGroupRequest(group, refs)
      expect(req.defaultRetryStrategy).toEqual({type: 'LINEAR', maxRetries: 3, interval: 10})
    })
  })

  describe('toCreateMonitorRequest', () => {
    it('transforms HTTP monitor', () => {
      const refs = refsWithChannels()
      const monitor: YamlMonitor = {
        name: 'Test', type: 'HTTP',
        config: {url: 'https://x.com', method: 'GET'},
        frequency: 60,
        regions: ['us-east'],
        tags: ['production'],
        alertChannels: ['ops-slack'],
        environment: 'prod',
      }
      const req = toCreateMonitorRequest(monitor, refs)
      expect(req.name).toBe('Test')
      expect(req.type).toBe('HTTP')
      expect(req.managedBy).toBe('CLI')
      expect(req.frequencySeconds).toBe(60)
      expect(req.regions).toEqual(['us-east'])
      expect(req.alertChannelIds).toEqual(['ch-123'])
      expect(req.environmentId).toBe('env-1')
      expect(req.tags!.tagIds).toEqual(['tag-1'])
    })

    it('creates new tags when not resolved', () => {
      const refs = emptyRefs()
      refs.set('alertChannels', 'ch', {id: 'ch-1', refKey: 'ch', raw: {}})
      const monitor: YamlMonitor = {
        name: 'Test', type: 'HTTP',
        config: {url: 'https://x.com', method: 'GET'},
        tags: ['new-tag'],
        alertChannels: ['ch'],
      }
      const req = toCreateMonitorRequest(monitor, refs)
      expect(req.tags!.newTags).toEqual([{name: 'new-tag'}])
    })

    it('mixes existing and new tags', () => {
      const refs = new ResolvedRefs()
      refs.set('tags', 'existing', {id: 'tag-1', refKey: 'existing', raw: {}})
      const monitor: YamlMonitor = {
        name: 'Test', type: 'HTTP',
        config: {url: 'https://x.com', method: 'GET'},
        tags: ['existing', 'brand-new'],
      }
      const req = toCreateMonitorRequest(monitor, refs)
      expect(req.tags!.tagIds).toEqual(['tag-1'])
      expect(req.tags!.newTags).toEqual([{name: 'brand-new'}])
    })

    it('transforms all 4 auth types', () => {
      const refs = refsWithChannels()
      const authTypes = [
        {type: 'bearer' as const, expectedType: 'bearer'},
        {type: 'basic' as const, expectedType: 'basic'},
        {type: 'api_key' as const, expectedType: 'api_key', headerName: 'X-Key'},
        {type: 'header' as const, expectedType: 'header', headerName: 'Authorization'},
      ]
      for (const at of authTypes) {
        const monitor: YamlMonitor = {
          name: 'Test', type: 'HTTP',
          config: {url: 'https://x.com', method: 'GET'},
          auth: {type: at.type, secret: 'api-key', headerName: at.headerName},
        }
        const req = toCreateMonitorRequest(monitor, refs)
        expect(req.auth).toHaveProperty('type', at.expectedType)
        expect(req.auth).toHaveProperty('vaultSecretId', 'sec-1')
      }
    })

    it('transforms incident policy', () => {
      const refs = emptyRefs()
      const monitor: YamlMonitor = {
        name: 'Test', type: 'HTTP',
        config: {url: 'https://x.com', method: 'GET'},
        incidentPolicy: {
          triggerRules: [{type: 'consecutive_failures', count: 3, scope: 'per_region', severity: 'down'}],
          confirmation: {type: 'multi_region', minRegionsFailing: 2},
          recovery: {consecutiveSuccesses: 2},
        },
      }
      const req = toCreateMonitorRequest(monitor, refs)
      expect(req.incidentPolicy!.triggerRules[0].type).toBe('consecutive_failures')
      expect(req.incidentPolicy!.triggerRules[0].count).toBe(3)
      expect(req.incidentPolicy!.confirmation.minRegionsFailing).toBe(2)
      expect(req.incidentPolicy!.recovery.consecutiveSuccesses).toBe(2)
    })

    it('transforms monitor without frequency (undefined)', () => {
      const refs = emptyRefs()
      const monitor: YamlMonitor = {
        name: 'NoFreq', type: 'HTTP',
        config: {url: 'https://x.com', method: 'GET'},
      }
      const req = toCreateMonitorRequest(monitor, refs)
      expect(req.frequencySeconds).toBeUndefined()
    })

    it('transforms monitor without tags (undefined)', () => {
      const refs = emptyRefs()
      const monitor: YamlMonitor = {
        name: 'NoTags', type: 'HTTP',
        config: {url: 'https://x.com', method: 'GET'},
      }
      const req = toCreateMonitorRequest(monitor, refs)
      expect(req.tags).toBeUndefined()
    })

    it('transforms monitor without alertChannels', () => {
      const refs = emptyRefs()
      const monitor: YamlMonitor = {
        name: 'Bare', type: 'HTTP',
        config: {url: 'https://x.com', method: 'GET'},
      }
      const req = toCreateMonitorRequest(monitor, refs)
      expect(req.alertChannelIds).toBeNull()
    })
  })

  describe('toUpdateMonitorRequest', () => {
    it('includes managedBy CLI', () => {
      const refs = emptyRefs()
      const monitor: YamlMonitor = {
        name: 'Test', type: 'HTTP',
        config: {url: 'https://x.com', method: 'GET'},
      }
      const req = toUpdateMonitorRequest(monitor, refs)
      expect(req.managedBy).toBe('CLI')
    })

    it('preserves all fields same as create', () => {
      const refs = refsWithChannels()
      const monitor: YamlMonitor = {
        name: 'Test', type: 'HTTP',
        config: {url: 'https://x.com', method: 'GET'},
        frequency: 30, regions: ['eu-west'],
        tags: ['production'], alertChannels: ['ops-slack'],
      }
      const req = toUpdateMonitorRequest(monitor, refs)
      expect(req.name).toBe('Test')
      expect(req.frequencySeconds).toBe(30)
      expect(req.regions).toEqual(['eu-west'])
      expect(req.tags!.tagIds).toEqual(['tag-1'])
      expect(req.alertChannelIds).toEqual(['ch-123'])
    })

    it('emits clearAuth when YAML auth is null', () => {
      const refs = emptyRefs()
      const monitor: YamlMonitor = {
        name: 'Test', type: 'HTTP',
        config: {url: 'https://x.com', method: 'GET'},
        auth: null,
      }
      const req = toUpdateMonitorRequest(monitor, refs)
      expect(req.clearAuth).toBe(true)
      expect(req.auth).toBeUndefined()
    })

    it('does not emit clearAuth when YAML auth is omitted', () => {
      const refs = emptyRefs()
      const monitor: YamlMonitor = {
        name: 'Test', type: 'HTTP',
        config: {url: 'https://x.com', method: 'GET'},
      }
      const req = toUpdateMonitorRequest(monitor, refs)
      expect(req.clearAuth).toBeUndefined()
    })

    it('emits clearEnvironmentId when YAML environment is null', () => {
      const refs = emptyRefs()
      const monitor: YamlMonitor = {
        name: 'Test', type: 'HTTP',
        config: {url: 'https://x.com', method: 'GET'},
        environment: null,
      }
      const req = toUpdateMonitorRequest(monitor, refs)
      expect(req.clearEnvironmentId).toBe(true)
      expect(req.environmentId).toBeNull()
    })

    it('does not emit clearEnvironmentId when YAML environment is omitted', () => {
      const refs = emptyRefs()
      const monitor: YamlMonitor = {
        name: 'Test', type: 'HTTP',
        config: {url: 'https://x.com', method: 'GET'},
      }
      const req = toUpdateMonitorRequest(monitor, refs)
      expect(req.clearEnvironmentId).toBeUndefined()
    })
  })

  describe('toCreateStatusPageRequest', () => {
    it('transforms required fields', () => {
      const page: YamlStatusPage = {name: 'Public Status', slug: 'public'}
      const req = toCreateStatusPageRequest(page)
      expect(req.name).toBe('Public Status')
      expect(req.slug).toBe('public')
    })

    it('defaults optional fields to null', () => {
      const page: YamlStatusPage = {name: 'S', slug: 's'}
      const req = toCreateStatusPageRequest(page)
      expect(req.description).toBeNull()
      expect(req.visibility).toBeNull()
      expect(req.enabled).toBeNull()
      expect(req.incidentMode).toBeNull()
    })

    it('passes through visibility, enabled, incidentMode', () => {
      const page: YamlStatusPage = {
        name: 'Internal', slug: 'internal',
        description: 'Company internal dashboard',
        visibility: 'PUBLIC',
        enabled: false,
        incidentMode: 'MANUAL',
      }
      const req = toCreateStatusPageRequest(page)
      expect(req.description).toBe('Company internal dashboard')
      expect(req.visibility).toBe('PUBLIC')
      expect(req.enabled).toBe(false)
      expect(req.incidentMode).toBe('MANUAL')
    })

    it('sends branding when provided (hidePoweredBy defaults to false)', () => {
      const page: YamlStatusPage = {
        name: 'S', slug: 's',
        branding: {logoUrl: 'https://example.com/logo.png', brandColor: '#4F46E5'},
      }
      const req = toCreateStatusPageRequest(page)
      expect(req.branding).toMatchObject({
        logoUrl: 'https://example.com/logo.png',
        brandColor: '#4F46E5',
        hidePoweredBy: false,
      })
    })

    it('sends branding as null when omitted (preserves current on create)', () => {
      const page: YamlStatusPage = {name: 'S', slug: 's'}
      const req = toCreateStatusPageRequest(page)
      expect(req.branding).toBeNull()
    })

    it('does not include children in create request', () => {
      const page: YamlStatusPage = {
        name: 'S', slug: 's',
        componentGroups: [{name: 'API'}],
        components: [{name: 'Web', type: 'STATIC'}],
      }
      const req = toCreateStatusPageRequest(page) as unknown as Record<string, unknown>
      expect(req.componentGroups).toBeUndefined()
      expect(req.components).toBeUndefined()
    })
  })

  describe('toUpdateStatusPageRequest', () => {
    it('includes name and passes through visibility', () => {
      const page: YamlStatusPage = {
        name: 'Updated Name', slug: 'public',
        visibility: 'PUBLIC', enabled: true,
      }
      const req = toUpdateStatusPageRequest(page)
      expect(req.name).toBe('Updated Name')
      expect(req.visibility).toBe('PUBLIC')
      expect(req.enabled).toBe(true)
    })

    it('sends branding as null when omitted (null preserves current server-side)', () => {
      const page: YamlStatusPage = {name: 'S', slug: 's'}
      const req = toUpdateStatusPageRequest(page)
      expect(req.branding).toBeNull()
    })

    it('serializes branding when provided in YAML', () => {
      const page: YamlStatusPage = {
        name: 'S', slug: 's',
        branding: {
          brandColor: '#000000',
          hidePoweredBy: true,
          customCss: '.x { color: red; }',
        },
      }
      const req = toUpdateStatusPageRequest(page)
      expect(req.branding).toMatchObject({
        brandColor: '#000000',
        hidePoweredBy: true,
        customCss: '.x { color: red; }',
        // Unspecified fields are emitted as null, matching server-side
        // "null = use design-system default" semantics.
        logoUrl: null,
        faviconUrl: null,
      })
    })

    it('does not include slug (not updatable post-create)', () => {
      const page: YamlStatusPage = {name: 'S', slug: 's'}
      const req = toUpdateStatusPageRequest(page) as unknown as Record<string, unknown>
      expect(req.slug).toBeUndefined()
    })

    it('sends null for omitted optional fields (API: null preserves current)', () => {
      const page: YamlStatusPage = {name: 'S', slug: 's'}
      const req = toUpdateStatusPageRequest(page)
      expect(req.description).toBeNull()
      expect(req.visibility).toBeNull()
      expect(req.enabled).toBeNull()
      expect(req.incidentMode).toBeNull()
    })
  })
})
