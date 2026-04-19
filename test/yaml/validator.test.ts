import {describe, it, expect} from 'vitest'
import {join, dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {parseConfigFile, ParseError} from '../../src/lib/yaml/parser.js'
import {validate, validatePlanRefs} from '../../src/lib/yaml/validator.js'
import {ResolvedRefs} from '../../src/lib/yaml/resolver.js'
import type {DevhelmConfig} from '../../src/lib/yaml/schema.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixtures = join(__dirname, '..', 'fixtures', 'yaml')

describe('validator', () => {
  describe('valid configs', () => {
    it('passes minimal config', () => {
      const config = parseConfigFile(join(fixtures, 'valid', 'minimal.yml'))
      const result = validate(config)
      expect(result.errors).toHaveLength(0)
    })

    it('passes full-stack config', () => {
      const config = parseConfigFile(join(fixtures, 'valid', 'full-stack.yml'))
      const result = validate(config)
      expect(result.errors).toHaveLength(0)
    })

    it('passes all monitor types', () => {
      const config = parseConfigFile(join(fixtures, 'edge', 'all-monitor-types.yml'))
      const result = validate(config)
      expect(result.errors).toHaveLength(0)
    })

    it('passes all channel types', () => {
      const config = parseConfigFile(join(fixtures, 'edge', 'all-channel-types.yml'))
      const result = validate(config)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('invalid configs', () => {
    it('errors on missing monitor name', () => {
      const fn = () => parseConfigFile(join(fixtures, 'invalid', 'missing-name.yml'))
      expect(fn).toThrow(ParseError)
      expect(fn).toThrow(/name/)
    })

    it('errors on bad frequency', () => {
      const fn = () => parseConfigFile(join(fixtures, 'invalid', 'bad-frequency.yml'))
      expect(fn).toThrow(ParseError)
      expect(fn).toThrow(/frequency/i)
    })

    it('errors on invalid monitor type', () => {
      const fn = () => parseConfigFile(join(fixtures, 'invalid', 'bad-type.yml'))
      expect(fn).toThrow(ParseError)
      expect(fn).toThrow(/type/)
    })

    it('errors on invalid channel type', () => {
      const fn = () => parseConfigFile(join(fixtures, 'invalid', 'bad-channel-type.yml'))
      expect(fn).toThrow(ParseError)
      expect(fn).toThrow(/type/)
    })

    it('errors on duplicate names', () => {
      const config = parseConfigFile(join(fixtures, 'invalid', 'duplicate-names.yml'))
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('Duplicate'))).toBe(true)
    })

    it('errors on empty config', () => {
      const config = parseConfigFile(join(fixtures, 'invalid', 'empty.yml'))
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('no resource'))).toBe(true)
    })

    it('errors on empty escalation steps', () => {
      const fn = () => parseConfigFile(join(fixtures, 'invalid', 'bad-escalation.yml'))
      expect(fn).toThrow(ParseError)
      expect(fn).toThrow(/steps/)
    })
  })

  describe('monitor config validation', () => {
    it('errors when HTTP monitor missing url', () => {
      const config: DevhelmConfig = {
        monitors: [{name: 'test', type: 'HTTP', config: {method: 'GET'}}],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('url'))).toBe(true)
    })

    it('errors when DNS monitor missing hostname', () => {
      const config: DevhelmConfig = {
        monitors: [{name: 'test', type: 'DNS', config: {}}],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('hostname'))).toBe(true)
    })

    it('errors when TCP monitor missing host', () => {
      const config: DevhelmConfig = {
        monitors: [{name: 'test', type: 'TCP', config: {}}],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('host'))).toBe(true)
    })

    it('errors when ICMP monitor missing host', () => {
      const config: DevhelmConfig = {
        monitors: [{name: 'test', type: 'ICMP', config: {}}],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('host'))).toBe(true)
    })

    it('errors when HEARTBEAT monitor missing expectedInterval', () => {
      const config: DevhelmConfig = {
        monitors: [{name: 'test', type: 'HEARTBEAT', config: {gracePeriod: 60}}],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('expectedInterval'))).toBe(true)
    })

    it('errors when MCP_SERVER monitor missing command', () => {
      const config: DevhelmConfig = {
        monitors: [{name: 'test', type: 'MCP_SERVER', config: {}}],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('command'))).toBe(true)
    })

    it('errors on invalid HTTP method', () => {
      const config: DevhelmConfig = {
        monitors: [{name: 'test', type: 'HTTP', config: {url: 'https://x.com', method: 'INVALID'}}],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('HTTP method'))).toBe(true)
    })

    it('errors on invalid TCP port', () => {
      const config: DevhelmConfig = {
        monitors: [{name: 'test', type: 'TCP', config: {host: 'x.com', port: 99999}}],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('port'))).toBe(true)
    })

    it('errors when TCP port is 0', () => {
      const config: DevhelmConfig = {
        monitors: [{name: 'test', type: 'TCP', config: {host: 'x.com', port: 0}}],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('port'))).toBe(true)
    })

    it('errors when HEARTBEAT gracePeriod missing', () => {
      const config: DevhelmConfig = {
        monitors: [{name: 'test', type: 'HEARTBEAT', config: {expectedInterval: 60}}],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('gracePeriod'))).toBe(true)
    })

    it('errors on frequency above MAX_FREQUENCY (86400)', () => {
      const config: DevhelmConfig = {
        monitors: [{
          name: 't',
          type: 'HTTP',
          config: {url: 'u', method: 'GET'},
          frequencySeconds: 100_000,
        }],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('Frequency'))).toBe(true)
    })

    it('errors on invalid DNS recordType', () => {
      const config: DevhelmConfig = {
        monitors: [{
          name: 't',
          type: 'DNS',
          config: {hostname: 'x', recordTypes: ['INVALID']},
        }],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('DNS record type'))).toBe(true)
    })

    it('errors on missing monitor type', () => {
      const config: DevhelmConfig = {
        monitors: [{name: 't', config: {url: 'x'}} as DevhelmConfig['monitors'] extends (infer M)[] | undefined ? M : never],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('type'))).toBe(true)
    })

    it('errors when monitor regions is not an array', () => {
      const config: DevhelmConfig = {
        monitors: [{
          name: 't',
          type: 'HTTP',
          config: {url: 'https://x.com', method: 'GET'},
          regions: 'us-east' as unknown as string[],
        }],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('array'))).toBe(true)
    })
  })

  describe('channel config validation', () => {
    it('errors when slack missing webhookUrl', () => {
      const config: DevhelmConfig = {
        alertChannels: [{name: 'test', config: {channelType: 'slack'}}],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('webhookUrl'))).toBe(true)
    })

    it('errors when email missing recipients', () => {
      const config: DevhelmConfig = {
        alertChannels: [{name: 'test', config: {channelType: 'email'}}],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('recipients'))).toBe(true)
    })

    it('errors when pagerduty missing routingKey', () => {
      const config: DevhelmConfig = {
        alertChannels: [{name: 'test', config: {channelType: 'pagerduty'}}],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('routingKey'))).toBe(true)
    })

    it('errors when opsgenie missing apiKey', () => {
      const config: DevhelmConfig = {
        alertChannels: [{name: 'test', config: {channelType: 'opsgenie'}}],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('apiKey'))).toBe(true)
    })

    it('errors when webhook missing url', () => {
      const config: DevhelmConfig = {
        alertChannels: [{name: 'test', config: {channelType: 'webhook'}}],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('url'))).toBe(true)
    })

    it('errors when discord missing webhookUrl', () => {
      const config: DevhelmConfig = {
        alertChannels: [{name: 'test', config: {channelType: 'discord'}}],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('webhookUrl'))).toBe(true)
    })

    it('errors when teams missing webhookUrl', () => {
      const config: DevhelmConfig = {
        alertChannels: [{name: 'test', config: {channelType: 'teams'}}],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('webhookUrl'))).toBe(true)
    })

    it('errors when email recipients is empty array', () => {
      const config: DevhelmConfig = {
        alertChannels: [{name: 'test', config: {channelType: 'email', recipients: []}}],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('recipients'))).toBe(true)
    })
  })

  describe('webhook definition validation', () => {
    it('errors when events is empty', () => {
      const config: DevhelmConfig = {
        webhooks: [{url: 'https://x.com', subscribedEvents: []}],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('subscribedEvents'))).toBe(true)
    })

    it('errors when url is missing', () => {
      const config: DevhelmConfig = {
        webhooks: [{url: '', subscribedEvents: ['monitor.down']}],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('url'))).toBe(true)
    })
  })

  describe('resource group validation', () => {
    it('errors on invalid healthThresholdType', () => {
      const config: DevhelmConfig = {
        resourceGroups: [{name: 'test', healthThresholdType: 'INVALID' as string}],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('Must be one of'))).toBe(true)
    })

    it('validates defaultFrequency bounds', () => {
      const config: DevhelmConfig = {
        resourceGroups: [{name: 'test', defaultFrequency: 1}],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('Frequency'))).toBe(true)
    })

    it('warns on unresolved alertPolicy reference', () => {
      const config: DevhelmConfig = {
        resourceGroups: [{name: 'test', alertPolicy: 'nonexistent'}],
      }
      const result = validate(config)
      expect(result.warnings.some((w) => w.message.includes('nonexistent'))).toBe(true)
    })

    it('warns on unresolved defaultEnvironment reference', () => {
      const config: DevhelmConfig = {
        resourceGroups: [{name: 'test', defaultEnvironment: 'missing-env'}],
      }
      const result = validate(config)
      expect(result.warnings.some((w) => w.message.includes('missing-env'))).toBe(true)
    })

    it('warns on unresolved defaultAlertChannels reference', () => {
      const config: DevhelmConfig = {
        resourceGroups: [{name: 'test', defaultAlertChannels: ['missing-chan']}],
      }
      const result = validate(config)
      expect(result.warnings.some((w) => w.message.includes('missing-chan'))).toBe(true)
    })
  })

  describe('dependency validation', () => {
    it('errors on invalid alertSensitivity', () => {
      const config: DevhelmConfig = {
        dependencies: [{service: 'github', alertSensitivity: 'WRONG' as string}],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('Must be one of'))).toBe(true)
    })

    it('errors on missing service name', () => {
      const config: DevhelmConfig = {
        dependencies: [{service: ''}],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('service'))).toBe(true)
    })
  })

  describe('auth validation', () => {
    it('errors on invalid auth type', () => {
      const config: DevhelmConfig = {
        monitors: [{
          name: 'test', type: 'HTTP',
          config: {url: 'https://x.com', method: 'GET'},
          auth: {type: 'InvalidAuth' as string, secret: 'key'},
        }],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('Auth type'))).toBe(true)
    })

    it('errors when auth missing secret', () => {
      const config: DevhelmConfig = {
        monitors: [{
          name: 'test', type: 'HTTP',
          config: {url: 'https://x.com', method: 'GET'},
          auth: {type: 'BearerAuthConfig', secret: ''},
        }],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('secret'))).toBe(true)
    })

    it('errors when api_key auth missing headerName', () => {
      const config: DevhelmConfig = {
        secrets: [{key: 'my-key', value: 'val'}],
        monitors: [{
          name: 'test', type: 'HTTP',
          config: {url: 'https://x.com', method: 'GET'},
          auth: {type: 'api_key', secret: 'my-key'} as DevhelmConfig['monitors'] extends (infer M)[] | undefined ? NonNullable<M>['auth'] : never,
        }],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('headerName'))).toBe(true)
    })

    it('errors when header auth missing headerName', () => {
      const config: DevhelmConfig = {
        secrets: [{key: 'my-key', value: 'val'}],
        monitors: [{
          name: 'test', type: 'HTTP',
          config: {url: 'https://x.com', method: 'GET'},
          auth: {type: 'header', secret: 'my-key'} as DevhelmConfig['monitors'] extends (infer M)[] | undefined ? NonNullable<M>['auth'] : never,
        }],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('headerName'))).toBe(true)
    })

    it('passes when api_key auth has headerName', () => {
      const config: DevhelmConfig = {
        secrets: [{key: 'my-key', value: 'val'}],
        monitors: [{
          name: 'test', type: 'HTTP',
          config: {url: 'https://x.com', method: 'GET'},
          auth: {type: 'api_key', secret: 'my-key', headerName: 'X-API-Key'},
        }],
      }
      const result = validate(config)
      const authErrors = result.errors.filter((e) => e.path.includes('auth'))
      expect(authErrors).toHaveLength(0)
    })

    it('warns when auth secret not declared in YAML', () => {
      const config: DevhelmConfig = {
        monitors: [{
          name: 'test', type: 'HTTP',
          config: {url: 'https://x.com', method: 'GET'},
          auth: {type: 'BearerAuthConfig', secret: 'undeclared-secret'},
        }],
      }
      const result = validate(config)
      expect(result.warnings.some((w) => w.message.includes('undeclared-secret'))).toBe(true)
    })
  })

  describe('cross-reference warnings', () => {
    it('warns on unresolved tag reference', () => {
      const config: DevhelmConfig = {
        monitors: [{
          name: 'test', type: 'HTTP',
          config: {url: 'https://x.com', method: 'GET'},
          tags: ['nonexistent-tag'],
        }],
      }
      const result = validate(config)
      expect(result.warnings.some((w) => w.message.includes('nonexistent-tag'))).toBe(true)
    })

    it('warns on unresolved environment reference', () => {
      const config: DevhelmConfig = {
        monitors: [{
          name: 'test', type: 'HTTP',
          config: {url: 'https://x.com', method: 'GET'},
          environment: 'unknown-env',
        }],
      }
      const result = validate(config)
      expect(result.warnings.some((w) => w.message.includes('unknown-env'))).toBe(true)
    })

    it('no warning when tag is declared in same config', () => {
      const config: DevhelmConfig = {
        tags: [{name: 'production'}],
        monitors: [{
          name: 'test', type: 'HTTP',
          config: {url: 'https://x.com', method: 'GET'},
          tags: ['production'],
        }],
      }
      const result = validate(config)
      const tagWarnings = result.warnings.filter((w) => w.message.includes('production'))
      expect(tagWarnings).toHaveLength(0)
    })

    it('warns on unresolved resource group monitor reference', () => {
      const config: DevhelmConfig = {
        resourceGroups: [{name: 'group1', monitors: ['missing-monitor']}],
      }
      const result = validate(config)
      expect(result.warnings.some((w) => w.message.includes('missing-monitor'))).toBe(true)
    })

    it('warns on unresolved alertChannel reference in monitor', () => {
      const config: DevhelmConfig = {
        monitors: [{
          name: 'test', type: 'HTTP',
          config: {url: 'https://x.com', method: 'GET'},
          alertChannels: ['missing-channel'],
        }],
      }
      const result = validate(config)
      expect(result.warnings.some((w) => w.message.includes('missing-channel'))).toBe(true)
    })

    it('warns on unresolved service ref in resource group', () => {
      const config: DevhelmConfig = {
        resourceGroups: [{name: 'test', services: ['unknown-service']}],
      }
      const result = validate(config)
      expect(result.warnings.some((w) => w.message.includes('unknown-service'))).toBe(true)
    })
  })

  describe('incident policy validation', () => {
    it('errors on missing trigger rules', () => {
      const config: DevhelmConfig = {
        monitors: [{
          name: 'test', type: 'HTTP',
          config: {url: 'https://x.com', method: 'GET'},
          incidentPolicy: {triggerRules: [], confirmation: {type: 'multi_region'}, recovery: {}},
        }],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('trigger rule'))).toBe(true)
    })

    it('errors on invalid trigger type', () => {
      const config: DevhelmConfig = {
        monitors: [{
          name: 'test', type: 'HTTP',
          config: {url: 'https://x.com', method: 'GET'},
          incidentPolicy: {
            triggerRules: [{type: 'invalid' as string, scope: 'per_region', severity: 'down'}],
            confirmation: {type: 'multi_region'},
            recovery: {},
          },
        }],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('trigger type'))).toBe(true)
    })

    it('errors on invalid trigger scope', () => {
      const config: DevhelmConfig = {
        monitors: [{
          name: 'test', type: 'HTTP',
          config: {url: 'https://x.com', method: 'GET'},
          incidentPolicy: {
            triggerRules: [{type: 'consecutive_failures', scope: 'bad_scope' as string, severity: 'down'}],
            confirmation: {type: 'multi_region'},
            recovery: {},
          },
        }],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('scope'))).toBe(true)
    })

    it('errors on invalid trigger severity', () => {
      const config: DevhelmConfig = {
        monitors: [{
          name: 'test', type: 'HTTP',
          config: {url: 'https://x.com', method: 'GET'},
          incidentPolicy: {
            triggerRules: [{type: 'consecutive_failures', scope: 'per_region', severity: 'bad' as string}],
            confirmation: {type: 'multi_region'},
            recovery: {},
          },
        }],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('Must be one of'))).toBe(true)
    })

    it('errors on invalid aggregationType', () => {
      const config: DevhelmConfig = {
        monitors: [{
          name: 'test', type: 'HTTP',
          config: {url: 'https://x.com', method: 'GET'},
          incidentPolicy: {
            triggerRules: [{
              type: 'consecutive_failures',
              scope: 'per_region',
              severity: 'down',
              aggregationType: 'bad' as string,
            }],
            confirmation: {type: 'multi_region'},
            recovery: {},
          },
        }],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('Must be one of'))).toBe(true)
    })

    it('errors on missing confirmation in incident policy', () => {
      const config: DevhelmConfig = {
        monitors: [{
          name: 'test', type: 'HTTP',
          config: {url: 'https://x.com', method: 'GET'},
          incidentPolicy: {
            triggerRules: [{type: 'consecutive_failures', scope: 'per_region', severity: 'down'}],
            recovery: {},
          } as DevhelmConfig['monitors'] extends (infer M)[] | undefined ? NonNullable<M>['incidentPolicy'] : never,
        }],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('confirmation'))).toBe(true)
    })

    it('errors on wrong confirmation type', () => {
      const config: DevhelmConfig = {
        monitors: [{
          name: 'test', type: 'HTTP',
          config: {url: 'https://x.com', method: 'GET'},
          incidentPolicy: {
            triggerRules: [{type: 'consecutive_failures', scope: 'per_region', severity: 'down'}],
            confirmation: {type: 'wrong_type' as 'multi_region'},
            recovery: {},
          },
        }],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('Confirmation type'))).toBe(true)
    })

    it('errors on missing recovery in incident policy', () => {
      const config: DevhelmConfig = {
        monitors: [{
          name: 'test', type: 'HTTP',
          config: {url: 'https://x.com', method: 'GET'},
          incidentPolicy: {
            triggerRules: [{type: 'consecutive_failures', scope: 'per_region', severity: 'down'}],
            confirmation: {type: 'multi_region'},
          } as DevhelmConfig['monitors'] extends (infer M)[] | undefined ? NonNullable<M>['incidentPolicy'] : never,
        }],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('recovery'))).toBe(true)
    })
  })

  describe('notification policy validation', () => {
    it('errors on missing escalation', () => {
      const config: DevhelmConfig = {
        notificationPolicies: [{name: 'test'} as DevhelmConfig['notificationPolicies'] extends (infer T)[] | undefined ? T : never],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('escalation'))).toBe(true)
    })

    it('errors on negative priority', () => {
      const config: DevhelmConfig = {
        notificationPolicies: [{
          name: 'test', priority: -1,
          escalation: {steps: [{channels: ['chan'], delayMinutes: 0}]},
        }],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('non-negative'))).toBe(true)
    })

    it('warns on unresolved channel in escalation step', () => {
      const config: DevhelmConfig = {
        notificationPolicies: [{
          name: 'test',
          escalation: {steps: [{channels: ['nonexistent-channel']}]},
        }],
      }
      const result = validate(config)
      expect(result.warnings.some((w) => w.message.includes('nonexistent-channel'))).toBe(true)
    })

    it('errors on negative delayMinutes', () => {
      const config: DevhelmConfig = {
        alertChannels: [{name: 'ch', config: {channelType: 'slack', webhookUrl: 'url'}}],
        notificationPolicies: [{
          name: 'test',
          escalation: {steps: [{channels: ['ch'], delayMinutes: -5}]},
        }],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('delayMinutes'))).toBe(true)
    })
  })

  describe('environment validation', () => {
    it('errors on invalid slug', () => {
      const config: DevhelmConfig = {
        environments: [{name: 'Prod', slug: 'Bad Slug!'}],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('lowercase'))).toBe(true)
    })

    it('errors on missing environment name', () => {
      const config: DevhelmConfig = {
        environments: [{name: '', slug: 'prod'}],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('name'))).toBe(true)
    })
  })

  describe('tag validation', () => {
    it('warns on bad color hex', () => {
      const config: DevhelmConfig = {
        tags: [{name: 'test', color: 'red'}],
      }
      const result = validate(config)
      expect(result.warnings.some((w) => w.message.includes('hex'))).toBe(true)
    })

    it('no warning on valid hex color', () => {
      const config: DevhelmConfig = {
        tags: [{name: 'test', color: '#FF0000'}],
      }
      const result = validate(config)
      const colorWarnings = result.warnings.filter((w) => w.path.includes('color'))
      expect(colorWarnings).toHaveLength(0)
    })
  })

  describe('assertion validation', () => {
    it('errors on invalid assertion type', () => {
      const config: DevhelmConfig = {
        monitors: [{
          name: 'test', type: 'HTTP',
          config: {url: 'https://x.com', method: 'GET'},
          assertions: [{config: {type: 'InvalidAssertion'}, severity: 'error'}],
        }],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('assertion type'))).toBe(true)
    })

    it('errors on invalid assertion severity', () => {
      const config: DevhelmConfig = {
        monitors: [{
          name: 'test', type: 'HTTP',
          config: {url: 'https://x.com', method: 'GET'},
          assertions: [{config: {type: 'StatusCodeAssertion'}, severity: 'bad' as string}],
        }],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('severity'))).toBe(true)
    })

    it('errors on invalid operator in assertion config', () => {
      const config: DevhelmConfig = {
        monitors: [{
          name: 'test', type: 'HTTP',
          config: {url: 'https://x.com', method: 'GET'},
          assertions: [{severity: 'error', config: {type: 'status_code', operator: 'INVALID_OP'}}],
        }],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.message.includes('operator'))).toBe(true)
    })
  })

  describe('version validation', () => {
    it('warns on unknown config version', () => {
      const config: DevhelmConfig = {
        version: '99',
        monitors: [{name: 'test', type: 'HTTP', config: {url: 'https://x.com', method: 'GET'}}],
      }
      const result = validate(config)
      expect(result.warnings.some((w) => w.message.includes('Unknown config version'))).toBe(true)
    })

    it('no warning on version 1', () => {
      const config: DevhelmConfig = {
        version: '1',
        monitors: [{name: 'test', type: 'HTTP', config: {url: 'https://x.com', method: 'GET'}}],
      }
      const result = validate(config)
      const versionWarnings = result.warnings.filter((w) => w.path === 'version')
      expect(versionWarnings).toHaveLength(0)
    })
  })

  describe('statusPages', () => {
    it('accepts a minimal valid status page', () => {
      const config: DevhelmConfig = {
        statusPages: [{name: 'Public', slug: 'public'}],
      }
      const result = validate(config)
      expect(result.errors).toHaveLength(0)
    })

    it('errors when name is missing', () => {
      const config: DevhelmConfig = {
        statusPages: [{slug: 'public'} as never],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.path === 'statusPages[0].name')).toBe(true)
    })

    it('errors when slug is missing', () => {
      const config: DevhelmConfig = {
        statusPages: [{name: 'P'} as never],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.path === 'statusPages[0].slug')).toBe(true)
    })

    it('errors on invalid slug format', () => {
      const config: DevhelmConfig = {
        statusPages: [{name: 'P', slug: 'Not_Valid'}],
      }
      const result = validate(config)
      expect(result.errors.some((e) =>
        e.path === 'statusPages[0].slug' && /lowercase alphanumeric/.test(e.message),
      )).toBe(true)
    })

    it('errors on invalid visibility', () => {
      const config: DevhelmConfig = {
        statusPages: [{name: 'P', slug: 'p', visibility: 'SECRET' as never}],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.path === 'statusPages[0].visibility')).toBe(true)
    })

    it('errors on invalid incidentMode', () => {
      const config: DevhelmConfig = {
        statusPages: [{name: 'P', slug: 'p', incidentMode: 'MAGIC' as never}],
      }
      const result = validate(config)
      expect(result.errors.some((e) => e.path === 'statusPages[0].incidentMode')).toBe(true)
    })

    it('errors on duplicate status page slugs', () => {
      const config: DevhelmConfig = {
        statusPages: [
          {name: 'P1', slug: 'shared'},
          {name: 'P2', slug: 'shared'},
        ],
      }
      const result = validate(config)
      expect(result.errors.some((e) => /Duplicate statusPages/.test(e.message))).toBe(true)
    })

    it('errors on duplicate component group names within a page', () => {
      const config: DevhelmConfig = {
        statusPages: [{
          name: 'P', slug: 'p',
          componentGroups: [{name: 'API'}, {name: 'API'}],
        }],
      }
      const result = validate(config)
      expect(result.errors.some((e) =>
        /Duplicate component group name/.test(e.message),
      )).toBe(true)
    })

    it('accepts duplicate group names across different pages', () => {
      const config: DevhelmConfig = {
        statusPages: [
          {name: 'P1', slug: 'p1', componentGroups: [{name: 'API'}]},
          {name: 'P2', slug: 'p2', componentGroups: [{name: 'API'}]},
        ],
      }
      const result = validate(config)
      expect(result.errors).toHaveLength(0)
    })

    it('errors when MONITOR component lacks monitor reference', () => {
      const config: DevhelmConfig = {
        statusPages: [{
          name: 'P', slug: 'p',
          components: [{name: 'Web', type: 'MONITOR'}],
        }],
      }
      const result = validate(config)
      expect(result.errors.some((e) =>
        e.path === 'statusPages[0].components[0].monitor',
      )).toBe(true)
    })

    it('errors when GROUP component lacks resourceGroup reference', () => {
      const config: DevhelmConfig = {
        statusPages: [{
          name: 'P', slug: 'p',
          components: [{name: 'G', type: 'GROUP'}],
        }],
      }
      const result = validate(config)
      expect(result.errors.some((e) =>
        e.path === 'statusPages[0].components[0].resourceGroup',
      )).toBe(true)
    })

    it('accepts STATIC component without monitor or resourceGroup', () => {
      const config: DevhelmConfig = {
        statusPages: [{
          name: 'P', slug: 'p',
          components: [{name: 'Static', type: 'STATIC'}],
        }],
      }
      const result = validate(config)
      expect(result.errors).toHaveLength(0)
    })

    it('errors on invalid component type', () => {
      const config: DevhelmConfig = {
        statusPages: [{
          name: 'P', slug: 'p',
          components: [{name: 'X', type: 'WEIRD' as never}],
        }],
      }
      const result = validate(config)
      expect(result.errors.some((e) =>
        e.path === 'statusPages[0].components[0].type',
      )).toBe(true)
    })

    it('warns when component references non-existent monitor', () => {
      const config: DevhelmConfig = {
        statusPages: [{
          name: 'P', slug: 'p',
          components: [{name: 'Web', type: 'MONITOR', monitor: 'missing'}],
        }],
      }
      const result = validate(config)
      expect(result.warnings.some((w) =>
        w.path === 'statusPages[0].components[0].monitor',
      )).toBe(true)
    })

    it('warns when component references non-existent resourceGroup', () => {
      const config: DevhelmConfig = {
        statusPages: [{
          name: 'P', slug: 'p',
          components: [{name: 'G', type: 'GROUP', resourceGroup: 'missing'}],
        }],
      }
      const result = validate(config)
      expect(result.warnings.some((w) =>
        w.path === 'statusPages[0].components[0].resourceGroup',
      )).toBe(true)
    })

    it('no warning when component references defined monitor/resourceGroup', () => {
      const config: DevhelmConfig = {
        monitors: [{name: 'api', type: 'HTTP', config: {url: 'https://x', method: 'GET'}}],
        resourceGroups: [{name: 'core'}],
        statusPages: [{
          name: 'P', slug: 'p',
          components: [
            {name: 'Web', type: 'MONITOR', monitor: 'api'},
            {name: 'Core', type: 'GROUP', resourceGroup: 'core'},
          ],
        }],
      }
      const result = validate(config)
      expect(result.errors).toHaveLength(0)
      expect(result.warnings.filter((w) =>
        w.path.startsWith('statusPages[0]'),
      )).toHaveLength(0)
    })

    it('warns when component.group does not match any declared group', () => {
      const config: DevhelmConfig = {
        statusPages: [{
          name: 'P', slug: 'p',
          componentGroups: [{name: 'API'}],
          components: [{name: 'Static', type: 'STATIC', group: 'Not Declared'}],
        }],
      }
      const result = validate(config)
      expect(result.warnings.some((w) =>
        w.path === 'statusPages[0].components[0].group',
      )).toBe(true)
    })

    it('does not warn when component.group matches declared group', () => {
      const config: DevhelmConfig = {
        statusPages: [{
          name: 'P', slug: 'p',
          componentGroups: [{name: 'API'}],
          components: [{name: 'Static', type: 'STATIC', group: 'API'}],
        }],
      }
      const result = validate(config)
      const groupWarnings = result.warnings.filter((w) =>
        w.path === 'statusPages[0].components[0].group',
      )
      expect(groupWarnings).toHaveLength(0)
    })
  })
})

describe('validatePlanRefs', () => {
  function refsWithEnvironment(opts: {refKey: string; apiSlug: string; matchSource?: 'state' | 'name'}) {
    const refs = new ResolvedRefs()
    refs.set('environments', opts.refKey, {
      id: 'env-1',
      refKey: opts.refKey,
      raw: {id: 'env-1', name: 'X', slug: opts.apiSlug, isDefault: false, variables: null},
      matchSource: opts.matchSource ?? 'state',
    })
    return refs
  }

  it('errors when state-matched environment slug differs from YAML slug', () => {
    const config: DevhelmConfig = {
      environments: [{name: 'Production', slug: 'production'}],
    }
    const refs = refsWithEnvironment({refKey: 'production', apiSlug: 'prod'})
    const result = validatePlanRefs(config, refs)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].path).toBe('environments[0].slug')
    expect(result.errors[0].message).toMatch(/slug rename.*not supported/)
  })

  it('passes when YAML slug matches API slug', () => {
    const config: DevhelmConfig = {
      environments: [{name: 'Production', slug: 'production'}],
    }
    const refs = refsWithEnvironment({refKey: 'production', apiSlug: 'production'})
    const result = validatePlanRefs(config, refs)
    expect(result.errors).toHaveLength(0)
  })

  it('does not flag name-matched (non-state) environments', () => {
    // Without state-based matching the resolver wouldn't have placed a
    // mismatched-slug entry under this refKey at all, but we double-check
    // we don't false-positive when matchSource is 'name'.
    const config: DevhelmConfig = {
      environments: [{name: 'Production', slug: 'production'}],
    }
    const refs = refsWithEnvironment({refKey: 'production', apiSlug: 'prod', matchSource: 'name'})
    const result = validatePlanRefs(config, refs)
    expect(result.errors).toHaveLength(0)
  })

  it('passes when no environments are defined', () => {
    const config: DevhelmConfig = {monitors: []}
    const refs = new ResolvedRefs()
    const result = validatePlanRefs(config, refs)
    expect(result.errors).toHaveLength(0)
  })
})
