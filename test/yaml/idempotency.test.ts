import {describe, it, expect} from 'vitest'
import {diff} from '../../src/lib/yaml/differ.js'
import {ResolvedRefs} from '../../src/lib/yaml/resolver.js'
import {sha256Hex, stableStringify} from '../../src/lib/yaml/handlers.js'
import type {DevhelmConfig} from '../../src/lib/yaml/schema.js'

function buildRefs(entries: Array<{type: Parameters<ResolvedRefs['set']>[0]; key: string; id: string; raw: Record<string, unknown>; managedBy?: string}>): ResolvedRefs {
  const refs = new ResolvedRefs()
  for (const e of entries) {
    refs.set(e.type, e.key, {id: e.id, refKey: e.key, raw: e.raw, managedBy: e.managedBy})
  }
  return refs
}

describe('idempotency', () => {
  it('same YAML + same API state for tags → zero changes', () => {
    const config: DevhelmConfig = {
      tags: [{name: 'prod', color: '#EF4444'}, {name: 'staging', color: '#3B82F6'}],
    }
    const refs = buildRefs([
      {type: 'tags', key: 'prod', id: 't1', raw: {name: 'prod', color: '#EF4444'}},
      {type: 'tags', key: 'staging', id: 't2', raw: {name: 'staging', color: '#3B82F6'}},
    ])
    const cs = diff(config, refs)
    expect(cs.creates).toHaveLength(0)
    expect(cs.updates).toHaveLength(0)
    expect(cs.deletes).toHaveLength(0)
  })

  it('same YAML + same API state for environments → zero changes', () => {
    const config: DevhelmConfig = {
      environments: [{name: 'Production', slug: 'production', isDefault: true}],
    }
    const refs = buildRefs([
      {type: 'environments', key: 'production', id: 'e1', raw: {name: 'Production', slug: 'production', isDefault: true}},
    ])
    const cs = diff(config, refs)
    expect(cs.creates).toHaveLength(0)
    expect(cs.updates).toHaveLength(0)
  })

  it('same YAML + same API state for secrets (hash match) → zero changes', () => {
    const secretValue = 'super-secret-123'
    const config: DevhelmConfig = {
      secrets: [{key: 'API_KEY', value: secretValue}],
    }
    const refs = buildRefs([
      {type: 'secrets', key: 'API_KEY', id: 's1', raw: {key: 'API_KEY', valueHash: sha256Hex(secretValue)}},
    ])
    const cs = diff(config, refs)
    expect(cs.creates).toHaveLength(0)
    expect(cs.updates).toHaveLength(0)
  })

  it('changed secret value (different hash) → one update', () => {
    const config: DevhelmConfig = {
      secrets: [{key: 'API_KEY', value: 'new-secret-456'}],
    }
    const refs = buildRefs([
      {type: 'secrets', key: 'API_KEY', id: 's1', raw: {key: 'API_KEY', valueHash: sha256Hex('old-secret-123')}},
    ])
    const cs = diff(config, refs)
    expect(cs.creates).toHaveLength(0)
    expect(cs.updates).toHaveLength(1)
    expect(cs.updates[0].refKey).toBe('API_KEY')
  })

  it('same YAML + same API state for alert channels (hash match) → zero changes', () => {
    const channelConfig = {channelType: 'slack', webhookUrl: 'https://hooks.slack.com/test'}
    const configHash = sha256Hex(stableStringify(channelConfig))

    const config: DevhelmConfig = {
      alertChannels: [{
        name: 'Slack Alerts',
        config: {channelType: 'slack', webhookUrl: 'https://hooks.slack.com/test'},
      }],
    }
    const refs = buildRefs([
      {type: 'alertChannels', key: 'Slack Alerts', id: 'ac1', raw: {
        name: 'Slack Alerts', channelType: 'slack', configHash,
      }},
    ])
    const cs = diff(config, refs)
    expect(cs.creates).toHaveLength(0)
    expect(cs.updates).toHaveLength(0)
  })

  it('alert channel config change (different hash) → one update', () => {
    const oldConfig = {channelType: 'slack', webhookUrl: 'https://hooks.slack.com/old'}
    const oldHash = sha256Hex(stableStringify(oldConfig))

    const config: DevhelmConfig = {
      alertChannels: [{
        name: 'Slack Alerts',
        config: {channelType: 'slack', webhookUrl: 'https://hooks.slack.com/new'},
      }],
    }
    const refs = buildRefs([
      {type: 'alertChannels', key: 'Slack Alerts', id: 'ac1', raw: {
        name: 'Slack Alerts', channelType: 'slack', configHash: oldHash,
      }},
    ])
    const cs = diff(config, refs)
    expect(cs.creates).toHaveLength(0)
    expect(cs.updates).toHaveLength(1)
    expect(cs.updates[0].refKey).toBe('Slack Alerts')
  })

  it('YAML tags: [] + API monitor with no tags → zero changes (regression)', () => {
    // apiTagsToSnapshot used to return {tagIds: null, newTags: []}, while
    // the desired snapshot built from `tags: []` produced {tagIds: [], ...},
    // causing a perpetual update on every plan.
    const config: DevhelmConfig = {
      monitors: [{
        name: 'API', type: 'HTTP',
        config: {url: 'https://api.example.com', method: 'GET'},
        tags: [],
      }],
    }
    const refs = buildRefs([
      {type: 'monitors', key: 'API', id: 'm1', raw: {
        name: 'API', type: 'HTTP', config: {url: 'https://api.example.com', method: 'GET'},
        enabled: true, frequencySeconds: undefined, managedBy: 'CLI', regions: null,
        environmentId: null, assertionIds: null, authType: null, incidentPolicy: null,
        alertChannelIds: null, tags: null,
      }, managedBy: 'CLI'},
    ])
    const cs = diff(config, refs)
    expect(cs.creates).toHaveLength(0)
    expect(cs.updates).toHaveLength(0)
  })

  it('adding one monitor to existing set → only that monitor in creates', () => {
    const config: DevhelmConfig = {
      monitors: [
        {name: 'API', type: 'HTTP', config: {url: 'https://api.example.com', method: 'GET'}},
        {name: 'Web', type: 'HTTP', config: {url: 'https://web.example.com', method: 'GET'}},
      ],
    }
    const refs = buildRefs([
      {type: 'monitors', key: 'API', id: 'm1', raw: {
        name: 'API', type: 'HTTP', config: {url: 'https://api.example.com', method: 'GET'},
        enabled: true, frequencySeconds: undefined, managedBy: 'CLI', regions: null,
        environmentId: null, assertionIds: null, authType: null, incidentPolicy: null,
        alertChannelIds: null, tagIds: null,
      }, managedBy: 'CLI'},
    ])
    const cs = diff(config, refs)
    expect(cs.creates).toHaveLength(1)
    expect(cs.creates[0].refKey).toBe('Web')
    expect(cs.updates).toHaveLength(0)
  })

  it('removing one monitor → that monitor in deletes (with prune)', () => {
    const config: DevhelmConfig = {
      monitors: [
        {name: 'API', type: 'HTTP', config: {url: 'https://api.example.com', method: 'GET'}},
      ],
    }
    const refs = buildRefs([
      {type: 'monitors', key: 'API', id: 'm1', raw: {
        name: 'API', type: 'HTTP', config: {url: 'https://api.example.com', method: 'GET'},
        enabled: true, frequencySeconds: undefined, managedBy: 'CLI',
        regions: null, environmentId: null, assertionIds: null, authType: null,
        incidentPolicy: null, alertChannelIds: null, tagIds: null,
      }, managedBy: 'CLI'},
      {type: 'monitors', key: 'Web', id: 'm2', raw: {
        name: 'Web', type: 'HTTP', config: {url: 'https://web.example.com', method: 'GET'},
        managedBy: 'CLI',
      }, managedBy: 'CLI'},
    ])
    const cs = diff(config, refs, {prune: true})
    expect(cs.deletes).toHaveLength(1)
    expect(cs.deletes[0].refKey).toBe('Web')
    expect(cs.creates).toHaveLength(0)
  })

  it('same webhooks → zero changes', () => {
    const config: DevhelmConfig = {
      webhooks: [{url: 'https://example.com/webhook', subscribedEvents: ['monitor.down', 'monitor.up']}],
    }
    const refs = buildRefs([
      {type: 'webhooks', key: 'https://example.com/webhook', id: 'w1', raw: {
        url: 'https://example.com/webhook', subscribedEvents: ['monitor.down', 'monitor.up'],
        description: null, enabled: true,
      }},
    ])
    const cs = diff(config, refs)
    expect(cs.creates).toHaveLength(0)
    expect(cs.updates).toHaveLength(0)
  })

  it('same resource groups → zero changes', () => {
    const config: DevhelmConfig = {
      resourceGroups: [{name: 'Backend', description: 'Backend services'}],
    }
    const refs = buildRefs([
      {type: 'resourceGroups', key: 'Backend', id: 'rg1', raw: {
        name: 'Backend', description: 'Backend services',
        alertPolicyId: null, defaultFrequency: null, defaultRegions: null,
        defaultRetryStrategy: null, defaultAlertChannels: null, defaultEnvironmentId: null,
        healthThresholdType: null, healthThresholdValue: null,
        suppressMemberAlerts: undefined, confirmationDelaySeconds: null,
        recoveryCooldownMinutes: null,
      }},
    ])
    const cs = diff(config, refs)
    expect(cs.creates).toHaveLength(0)
    expect(cs.updates).toHaveLength(0)
  })

  it('same dependencies → zero changes', () => {
    const config: DevhelmConfig = {
      dependencies: [{service: 'aws-ec2', alertSensitivity: 'ALL'}],
    }
    const refs = buildRefs([
      {type: 'dependencies', key: 'aws-ec2', id: 'd1', raw: {
        slug: 'aws-ec2', alertSensitivity: 'ALL', componentId: null,
      }},
    ])
    const cs = diff(config, refs)
    expect(cs.creates).toHaveLength(0)
    expect(cs.updates).toHaveLength(0)
  })

  it('full stack config unchanged → zero changes across all resource types', () => {
    const secretValue = 'my-api-token'
    const channelConfig = {channelType: 'slack', webhookUrl: 'https://hooks.slack.com/test'}
    const channelHash = sha256Hex(stableStringify(channelConfig))

    const config: DevhelmConfig = {
      tags: [{name: 'critical', color: '#EF4444'}],
      environments: [{name: 'Production', slug: 'production'}],
      secrets: [{key: 'TOKEN', value: secretValue}],
      alertChannels: [{name: 'Slack', config: {channelType: 'slack', webhookUrl: 'https://hooks.slack.com/test'}}],
      webhooks: [{url: 'https://example.com/hook', subscribedEvents: ['monitor.down']}],
      monitors: [{
        name: 'API', type: 'HTTP',
        config: {url: 'https://api.example.com', method: 'GET'},
      }],
    }

    const refs = buildRefs([
      {type: 'tags', key: 'critical', id: 't1', raw: {name: 'critical', color: '#EF4444'}},
      {type: 'environments', key: 'production', id: 'e1', raw: {name: 'Production', slug: 'production', isDefault: undefined, variables: null}},
      {type: 'secrets', key: 'TOKEN', id: 's1', raw: {key: 'TOKEN', valueHash: sha256Hex(secretValue)}},
      {type: 'alertChannels', key: 'Slack', id: 'ac1', raw: {name: 'Slack', channelType: 'slack', configHash: channelHash}},
      {type: 'webhooks', key: 'https://example.com/hook', id: 'w1', raw: {
        url: 'https://example.com/hook', subscribedEvents: ['monitor.down'], description: null, enabled: true,
      }},
      {type: 'monitors', key: 'API', id: 'm1', raw: {
        name: 'API', type: 'HTTP', config: {url: 'https://api.example.com', method: 'GET'},
        enabled: true, frequencySeconds: undefined, managedBy: 'CLI', regions: null,
        environmentId: null, assertionIds: null, authType: null, incidentPolicy: null,
        alertChannelIds: null, tagIds: null,
      }, managedBy: 'CLI'},
    ])

    const cs = diff(config, refs)
    expect(cs.creates).toHaveLength(0)
    expect(cs.updates).toHaveLength(0)
    expect(cs.deletes).toHaveLength(0)
  })

  it('monitor with API-expanded null config fields → zero changes (snapshot null-strip)', () => {
    // Regression for the A1 BDD failure: API echoes back JSONB monitor
    // configs with every optional HttpMonitorConfig field expanded to null
    // (customHeaders, requestBody, contentType, verifyTls). The user's YAML
    // only specifies url+method. Pre-fix: phantom drift on every plan.
    const config: DevhelmConfig = {
      monitors: [{
        name: 'API', type: 'HTTP',
        config: {url: 'https://api.example.com/health', method: 'GET'},
      }],
    }
    const refs = buildRefs([
      {type: 'monitors', key: 'API', id: 'm1', raw: {
        name: 'API', type: 'HTTP',
        config: {
          url: 'https://api.example.com/health', method: 'GET',
          customHeaders: null, requestBody: null, contentType: null, verifyTls: null,
        },
        enabled: undefined, frequencySeconds: undefined, managedBy: 'CLI',
        regions: null, environmentId: null, assertionIds: null, authType: null,
        incidentPolicy: null, alertChannelIds: null, tagIds: null,
      }, managedBy: 'CLI'},
    ])
    const cs = diff(config, refs)
    expect(cs.updates.filter(c => c.resourceType === 'monitor')).toHaveLength(0)
  })

  it('notification policy with matching escalation → zero changes', () => {
    const refs = buildRefs([
      {type: 'alertChannels', key: 'Slack', id: 'ac-1', raw: {name: 'Slack', channelType: 'slack'}},
      {type: 'notificationPolicies', key: 'Default', id: 'np1', raw: {
        name: 'Default', enabled: true, priority: 0,
        // Real API echoes `requireAck: false` for unset boolean (Jackson
        // serializes Boolean.FALSE for null on the response side). The CLI
        // sends `false` explicitly to match — see toEscalationStep.
        escalation: {
          steps: [{channelIds: ['ac-1'], delayMinutes: 0, requireAck: false, repeatIntervalSeconds: null}],
          onResolve: null, onReopen: null,
        },
        matchRules: null,
      }},
    ])
    const config: DevhelmConfig = {
      alertChannels: [{name: 'Slack', config: {channelType: 'slack', webhookUrl: 'https://hooks.slack.com/test'}}],
      notificationPolicies: [{
        name: 'Default',
        escalation: {steps: [{channels: ['Slack'], delayMinutes: 0}]},
      }],
    }
    const cs = diff(config, refs)
    expect(cs.updates.filter(c => c.resourceType === 'notificationPolicy')).toHaveLength(0)
  })
})
