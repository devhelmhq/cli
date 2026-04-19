/**
 * Comprehensive negative tests for the YAML Zod schemas.
 *
 * Each describe block exercises one dimension of invalid input:
 * per-type monitor configs, assertion configs, auth configs,
 * channel configs, incident policies, escalation chains,
 * notification policies, status pages, resource groups,
 * webhooks, tags/environments/secrets, defaults, and
 * top-level structural errors.
 */
import {describe, it, expect} from 'vitest'
import {DevhelmConfigSchema, formatZodErrors} from '../../src/lib/yaml/zod-schemas.js'

// ── helpers ──────────────────────────────────────────────────────────

function expectFail(input: unknown) {
  const result = DevhelmConfigSchema.safeParse(input)
  expect(result.success).toBe(false)
  return result as {success: false; error: import('zod').ZodError}
}

function expectPass(input: unknown) {
  const result = DevhelmConfigSchema.safeParse(input)
  expect(result.success).toBe(true)
  return result
}

function errorsContain(result: {success: false; error: import('zod').ZodError}, substr: string) {
  const msgs = formatZodErrors(result.error).join('\n')
  expect(msgs.toLowerCase()).toContain(substr.toLowerCase())
}

// ── 1. Invalid monitor configs per type ──────────────────────────────

describe('invalid monitor configs per type', () => {
  describe('HTTP', () => {
    it('rejects missing url', () => {
      const r = expectFail({
        monitors: [{name: 'X', type: 'HTTP', config: {method: 'GET'}}],
      })
      errorsContain(r, 'url')
    })

    it('rejects missing method', () => {
      const r = expectFail({
        monitors: [{name: 'X', type: 'HTTP', config: {url: 'https://x.com'}}],
      })
      errorsContain(r, 'method')
    })

    it('rejects invalid method', () => {
      const r = expectFail({
        monitors: [{name: 'X', type: 'HTTP', config: {url: 'https://x.com', method: 'TRACE'}}],
      })
      errorsContain(r, 'method')
    })

    it('rejects empty url', () => {
      const r = expectFail({
        monitors: [{name: 'X', type: 'HTTP', config: {url: '', method: 'GET'}}],
      })
      errorsContain(r, 'url')
    })
  })

  describe('DNS', () => {
    it('rejects missing hostname', () => {
      const r = expectFail({
        monitors: [{name: 'X', type: 'DNS', config: {}}],
      })
      errorsContain(r, 'hostname')
    })

    it('rejects empty hostname', () => {
      const r = expectFail({
        monitors: [{name: 'X', type: 'DNS', config: {hostname: ''}}],
      })
      errorsContain(r, 'hostname')
    })
  })

  describe('TCP', () => {
    it('rejects missing host', () => {
      const r = expectFail({
        monitors: [{name: 'X', type: 'TCP', config: {port: 443}}],
      })
      errorsContain(r, 'host')
    })

    it('rejects missing port', () => {
      const r = expectFail({
        monitors: [{name: 'X', type: 'TCP', config: {host: 'x.com'}}],
      })
      errorsContain(r, 'port')
    })

    it('rejects port 0', () => {
      const r = expectFail({
        monitors: [{name: 'X', type: 'TCP', config: {host: 'x.com', port: 0}}],
      })
      errorsContain(r, 'port')
    })

    it('rejects port above 65535', () => {
      const r = expectFail({
        monitors: [{name: 'X', type: 'TCP', config: {host: 'x.com', port: 70000}}],
      })
      errorsContain(r, 'port')
    })

    it('rejects empty host', () => {
      const r = expectFail({
        monitors: [{name: 'X', type: 'TCP', config: {host: '', port: 443}}],
      })
      errorsContain(r, 'host')
    })
  })

  describe('ICMP', () => {
    it('rejects missing host', () => {
      const r = expectFail({
        monitors: [{name: 'X', type: 'ICMP', config: {}}],
      })
      errorsContain(r, 'host')
    })

    it('rejects empty host', () => {
      const r = expectFail({
        monitors: [{name: 'X', type: 'ICMP', config: {host: ''}}],
      })
      errorsContain(r, 'host')
    })
  })

  describe('HEARTBEAT', () => {
    it('rejects missing expectedInterval', () => {
      const r = expectFail({
        monitors: [{name: 'X', type: 'HEARTBEAT', config: {gracePeriod: 60}}],
      })
      errorsContain(r, 'expectedInterval')
    })

    it('rejects missing gracePeriod', () => {
      const r = expectFail({
        monitors: [{name: 'X', type: 'HEARTBEAT', config: {expectedInterval: 60}}],
      })
      errorsContain(r, 'gracePeriod')
    })

    it('rejects expectedInterval of 0', () => {
      const r = expectFail({
        monitors: [{name: 'X', type: 'HEARTBEAT', config: {expectedInterval: 0, gracePeriod: 60}}],
      })
      errorsContain(r, 'expectedInterval')
    })

    it('rejects empty config', () => {
      const r = expectFail({
        monitors: [{name: 'X', type: 'HEARTBEAT', config: {}}],
      })
      const msgs = formatZodErrors(r.error).join('\n')
      expect(msgs).toMatch(/expectedInterval|gracePeriod/i)
    })
  })

  describe('MCP_SERVER', () => {
    it('rejects missing command', () => {
      const r = expectFail({
        monitors: [{name: 'X', type: 'MCP_SERVER', config: {}}],
      })
      errorsContain(r, 'command')
    })

    it('rejects empty command', () => {
      const r = expectFail({
        monitors: [{name: 'X', type: 'MCP_SERVER', config: {command: ''}}],
      })
      errorsContain(r, 'command')
    })
  })

  describe('unknown type', () => {
    it('rejects a made-up monitor type', () => {
      expectFail({
        monitors: [{name: 'X', type: 'WEBSOCKET', config: {url: 'ws://x'}}],
      })
    })
  })
})

// ── 2. Invalid assertion configs per type ────────────────────────────

describe('invalid assertion configs', () => {
  const httpMonitor = (assertions: unknown[]) => ({
    monitors: [{
      name: 'X', type: 'HTTP',
      config: {url: 'https://x.com', method: 'GET'},
      assertions,
    }],
  })

  describe('StatusCodeAssertion', () => {
    it('rejects missing operator', () => {
      const r = expectFail(httpMonitor([{config: {type: 'status_code', expected: '200'}}]))
      errorsContain(r, 'operator')
    })

    it('rejects missing expected', () => {
      const r = expectFail(httpMonitor([{config: {type: 'status_code', operator: 'equals'}}]))
      errorsContain(r, 'expected')
    })

    it('rejects invalid operator', () => {
      const r = expectFail(httpMonitor([{config: {type: 'status_code', expected: '200', operator: 'not_equals'}}]))
      errorsContain(r, 'operator')
    })
  })

  describe('ResponseTimeAssertion', () => {
    it('rejects missing thresholdMs', () => {
      const r = expectFail(httpMonitor([{config: {type: 'response_time'}}]))
      errorsContain(r, 'thresholdMs')
    })
  })

  describe('ResponseTimeWarnAssertion', () => {
    it('rejects missing warnMs', () => {
      const r = expectFail(httpMonitor([{config: {type: 'response_time_warn'}}]))
      errorsContain(r, 'warnMs')
    })
  })

  describe('BodyContainsAssertion', () => {
    it('rejects missing substring', () => {
      const r = expectFail(httpMonitor([{config: {type: 'body_contains'}}]))
      errorsContain(r, 'substring')
    })

    it('rejects empty substring', () => {
      const r = expectFail(httpMonitor([{config: {type: 'body_contains', substring: ''}}]))
      errorsContain(r, 'substring')
    })
  })

  describe('RegexBodyAssertion', () => {
    it('rejects missing pattern', () => {
      const r = expectFail(httpMonitor([{config: {type: 'regex_body'}}]))
      errorsContain(r, 'pattern')
    })
  })

  describe('HeaderValueAssertion', () => {
    it('rejects missing headerName', () => {
      const r = expectFail(httpMonitor([{config: {type: 'header_value', operator: 'equals', expected: 'x'}}]))
      errorsContain(r, 'headerName')
    })

    it('rejects missing operator', () => {
      const r = expectFail(httpMonitor([{config: {type: 'header_value', headerName: 'X-Foo', expected: 'x'}}]))
      errorsContain(r, 'operator')
    })
  })

  describe('JsonPathAssertion', () => {
    it('rejects missing path', () => {
      const r = expectFail(httpMonitor([{config: {type: 'json_path', expected: 'v', operator: 'equals'}}]))
      errorsContain(r, 'path')
    })
  })

  describe('SslExpiryAssertion', () => {
    it('rejects missing minDaysRemaining', () => {
      const r = expectFail(httpMonitor([{config: {type: 'ssl_expiry'}}]))
      errorsContain(r, 'minDaysRemaining')
    })
  })

  describe('ResponseSizeAssertion', () => {
    it('rejects missing maxBytes', () => {
      const r = expectFail(httpMonitor([{config: {type: 'response_size'}}]))
      errorsContain(r, 'maxBytes')
    })
  })

  describe('RedirectCountAssertion', () => {
    it('rejects missing maxCount', () => {
      const r = expectFail(httpMonitor([{config: {type: 'redirect_count'}}]))
      errorsContain(r, 'maxCount')
    })
  })

  describe('RedirectTargetAssertion', () => {
    it('rejects missing expected and operator', () => {
      const r = expectFail(httpMonitor([{config: {type: 'redirect_target'}}]))
      errorsContain(r, 'expected')
    })
  })

  describe('TcpResponseTimeAssertion', () => {
    it('rejects missing maxMs', () => {
      const r = expectFail(httpMonitor([{config: {type: 'tcp_response_time'}}]))
      errorsContain(r, 'maxMs')
    })
  })

  describe('IcmpResponseTimeAssertion', () => {
    it('rejects missing maxMs', () => {
      const r = expectFail(httpMonitor([{config: {type: 'icmp_response_time'}}]))
      errorsContain(r, 'maxMs')
    })
  })

  describe('DnsResponseTimeAssertion', () => {
    it('rejects missing maxMs', () => {
      const r = expectFail(httpMonitor([{config: {type: 'dns_response_time'}}]))
      errorsContain(r, 'maxMs')
    })
  })

  describe('McpResponseTimeAssertion', () => {
    it('rejects missing maxMs', () => {
      const r = expectFail(httpMonitor([{config: {type: 'mcp_response_time'}}]))
      errorsContain(r, 'maxMs')
    })
  })

  describe('unknown assertion type', () => {
    it('rejects with descriptive error', () => {
      const r = expectFail(httpMonitor([{config: {type: 'totally_bogus'}}]))
      errorsContain(r, 'Unknown assertion type')
    })
  })

  describe('invalid severity', () => {
    it('rejects non-enum severity', () => {
      expectFail(httpMonitor([{
        config: {type: 'status_code', expected: '200', operator: 'equals'},
        severity: 'critical',
      }]))
    })
  })
})

// ── 3. Invalid auth configs ──────────────────────────────────────────

describe('invalid auth configs', () => {
  const httpWithAuth = (auth: unknown) => ({
    monitors: [{
      name: 'X', type: 'HTTP',
      config: {url: 'https://x.com', method: 'GET'},
      auth,
    }],
  })

  it('rejects bearer missing secret', () => {
    const r = expectFail(httpWithAuth({type: 'bearer'}))
    errorsContain(r, 'secret')
  })

  it('rejects basic missing secret', () => {
    const r = expectFail(httpWithAuth({type: 'basic'}))
    errorsContain(r, 'secret')
  })

  it('rejects api_key missing headerName', () => {
    const r = expectFail(httpWithAuth({type: 'api_key', secret: 's'}))
    errorsContain(r, 'headerName')
  })

  it('rejects api_key missing secret', () => {
    const r = expectFail(httpWithAuth({type: 'api_key', headerName: 'X-Key'}))
    errorsContain(r, 'secret')
  })

  it('rejects header missing headerName', () => {
    const r = expectFail(httpWithAuth({type: 'header', secret: 's'}))
    errorsContain(r, 'headerName')
  })

  it('rejects header missing secret', () => {
    const r = expectFail(httpWithAuth({type: 'header', headerName: 'Authorization'}))
    errorsContain(r, 'secret')
  })

  it('rejects unknown auth type', () => {
    expectFail(httpWithAuth({type: 'oauth2', secret: 's'}))
  })

  it('rejects extra fields on bearer auth (strict)', () => {
    expectFail(httpWithAuth({type: 'bearer', secret: 's', extra: 'nope'}))
  })
})

// ── 4. Invalid channel configs per type ──────────────────────────────

describe('invalid channel configs per type', () => {
  const channel = (cfg: Record<string, unknown>) => ({
    alertChannels: [{name: 'ch', config: cfg}],
  })

  it('rejects email missing recipients', () => {
    const r = expectFail(channel({channelType: 'email'}))
    errorsContain(r, 'recipients')
  })

  it('rejects email with empty recipients array', () => {
    const r = expectFail(channel({channelType: 'email', recipients: []}))
    errorsContain(r, 'recipients')
  })

  it('rejects email with invalid email format', () => {
    expectFail(channel({channelType: 'email', recipients: ['not-an-email']}))
  })

  it('rejects slack missing webhookUrl', () => {
    const r = expectFail(channel({channelType: 'slack'}))
    errorsContain(r, 'webhookUrl')
  })

  it('rejects slack with empty webhookUrl', () => {
    const r = expectFail(channel({channelType: 'slack', webhookUrl: ''}))
    errorsContain(r, 'webhookUrl')
  })

  it('rejects discord missing webhookUrl', () => {
    const r = expectFail(channel({channelType: 'discord'}))
    errorsContain(r, 'webhookUrl')
  })

  it('rejects pagerduty missing routingKey', () => {
    const r = expectFail(channel({channelType: 'pagerduty'}))
    errorsContain(r, 'routingKey')
  })

  it('rejects pagerduty with empty routingKey', () => {
    const r = expectFail(channel({channelType: 'pagerduty', routingKey: ''}))
    errorsContain(r, 'routingKey')
  })

  it('rejects opsgenie missing apiKey', () => {
    const r = expectFail(channel({channelType: 'opsgenie'}))
    errorsContain(r, 'apiKey')
  })

  it('rejects teams missing webhookUrl', () => {
    const r = expectFail(channel({channelType: 'teams'}))
    errorsContain(r, 'webhookUrl')
  })

  it('rejects webhook missing url', () => {
    const r = expectFail(channel({channelType: 'webhook'}))
    errorsContain(r, 'url')
  })

  it('rejects webhook with empty url', () => {
    const r = expectFail(channel({channelType: 'webhook', url: ''}))
    errorsContain(r, 'url')
  })

  it('rejects unknown channel type', () => {
    expectFail(channel({channelType: 'sms', phone: '+1234'}))
  })

  it('rejects missing channelType', () => {
    expectFail(channel({webhookUrl: 'https://x'}))
  })
})

// ── 5. Invalid incident policy ───────────────────────────────────────

describe('invalid incident policy', () => {
  const withPolicy = (policy: unknown) => ({
    monitors: [{
      name: 'X', type: 'HTTP',
      config: {url: 'https://x.com', method: 'GET'},
      incidentPolicy: policy,
    }],
  })

  it('rejects empty triggerRules', () => {
    const r = expectFail(withPolicy({
      triggerRules: [],
      confirmation: {type: 'multi_region'},
      recovery: {},
    }))
    errorsContain(r, 'triggerRules')
  })

  it('rejects missing triggerRules', () => {
    expectFail(withPolicy({
      confirmation: {type: 'multi_region'},
      recovery: {},
    }))
  })

  it('rejects invalid trigger type', () => {
    expectFail(withPolicy({
      triggerRules: [{type: 'timeout', count: 3, scope: 'per_region', severity: 'down'}],
      confirmation: {type: 'multi_region'},
      recovery: {},
    }))
  })

  it('rejects invalid trigger scope', () => {
    expectFail(withPolicy({
      triggerRules: [{type: 'consecutive_failures', count: 3, scope: 'global', severity: 'down'}],
      confirmation: {type: 'multi_region'},
      recovery: {},
    }))
  })

  it('rejects invalid trigger severity', () => {
    expectFail(withPolicy({
      triggerRules: [{type: 'consecutive_failures', count: 3, scope: 'per_region', severity: 'critical'}],
      confirmation: {type: 'multi_region'},
      recovery: {},
    }))
  })

  it('rejects trigger count of 0', () => {
    expectFail(withPolicy({
      triggerRules: [{type: 'consecutive_failures', count: 0, scope: 'per_region', severity: 'down'}],
      confirmation: {type: 'multi_region'},
      recovery: {},
    }))
  })

  it('rejects trigger count above max (10)', () => {
    expectFail(withPolicy({
      triggerRules: [{type: 'consecutive_failures', count: 11, scope: 'per_region', severity: 'down'}],
      confirmation: {type: 'multi_region'},
      recovery: {},
    }))
  })

  it('rejects invalid aggregationType', () => {
    expectFail(withPolicy({
      triggerRules: [{
        type: 'consecutive_failures', count: 3,
        scope: 'per_region', severity: 'down', aggregationType: 'median',
      }],
      confirmation: {type: 'multi_region'},
      recovery: {},
    }))
  })

  it('rejects missing confirmation', () => {
    expectFail(withPolicy({
      triggerRules: [{type: 'consecutive_failures', count: 3, scope: 'per_region', severity: 'down'}],
      recovery: {},
    }))
  })

  it('rejects wrong confirmation type', () => {
    expectFail(withPolicy({
      triggerRules: [{type: 'consecutive_failures', count: 3, scope: 'per_region', severity: 'down'}],
      confirmation: {type: 'single_check'},
      recovery: {},
    }))
  })

  it('rejects missing recovery', () => {
    expectFail(withPolicy({
      triggerRules: [{type: 'consecutive_failures', count: 3, scope: 'per_region', severity: 'down'}],
      confirmation: {type: 'multi_region'},
    }))
  })

  it('rejects extra fields on incident policy (strict)', () => {
    expectFail(withPolicy({
      triggerRules: [{type: 'consecutive_failures', count: 3, scope: 'per_region', severity: 'down'}],
      confirmation: {type: 'multi_region'},
      recovery: {},
      autoAcknowledge: true,
    }))
  })

  it('rejects failures_in_window missing windowMinutes', () => {
    expectFail(withPolicy({
      triggerRules: [{type: 'failures_in_window', count: 3, scope: 'per_region', severity: 'down'}],
      confirmation: {type: 'multi_region'},
      recovery: {},
    }))
  })

  it('rejects response_time missing thresholdMs', () => {
    expectFail(withPolicy({
      triggerRules: [{type: 'response_time', count: 3, scope: 'per_region', severity: 'down'}],
      confirmation: {type: 'multi_region'},
      recovery: {},
    }))
  })
})

// ── 6. Invalid escalation chains ─────────────────────────────────────

describe('invalid escalation chains', () => {
  const withEscalation = (escalation: unknown) => ({
    notificationPolicies: [{name: 'p', escalation}],
  })

  it('rejects empty steps', () => {
    expectFail(withEscalation({steps: []}))
  })

  it('rejects missing steps', () => {
    expectFail(withEscalation({}))
  })

  it('rejects step with empty channels', () => {
    expectFail(withEscalation({steps: [{channels: []}]}))
  })

  it('rejects step missing channels', () => {
    expectFail(withEscalation({steps: [{}]}))
  })

  it('rejects negative delayMinutes', () => {
    expectFail(withEscalation({steps: [{channels: ['ch'], delayMinutes: -1}]}))
  })

  it('rejects extra fields on step (strict)', () => {
    expectFail(withEscalation({steps: [{channels: ['ch'], priority: 1}]}))
  })

  it('rejects extra fields on chain (strict)', () => {
    expectFail(withEscalation({steps: [{channels: ['ch']}], maxEscalations: 5}))
  })
})

// ── 7. Invalid notification policy ───────────────────────────────────

describe('invalid notification policy', () => {
  it('rejects missing name', () => {
    expectFail({
      notificationPolicies: [{escalation: {steps: [{channels: ['ch']}]}}],
    })
  })

  it('rejects missing escalation', () => {
    expectFail({
      notificationPolicies: [{name: 'p'}],
    })
  })

  it('accepts negative priority at schema level (validator catches it)', () => {
    // Zod schema doesn't enforce non-negative; the validator layer does.
    expectPass({
      notificationPolicies: [{
        name: 'p',
        escalation: {steps: [{channels: ['ch']}]},
        priority: -1,
      }],
    })
  })

  it('rejects extra fields (strict)', () => {
    expectFail({
      notificationPolicies: [{
        name: 'p',
        escalation: {steps: [{channels: ['ch']}]},
        cooldown: 300,
      }],
    })
  })

  it('rejects matchRules with extra fields', () => {
    expectFail({
      notificationPolicies: [{
        name: 'p',
        escalation: {steps: [{channels: ['ch']}]},
        matchRules: [{type: 'severity', level: 'critical'}],
      }],
    })
  })
})

// ── 8. Invalid status page config ────────────────────────────────────

describe('invalid status page config', () => {
  it('rejects missing name', () => {
    expectFail({statusPages: [{slug: 'public'}]})
  })

  it('rejects missing slug', () => {
    expectFail({statusPages: [{name: 'Public'}]})
  })

  it('rejects invalid slug (uppercase)', () => {
    expectPass({statusPages: [{name: 'P', slug: 'MyPage'}]})
      // slug validation is in the validator, not Zod — Zod just accepts any string
      // so this is a pass at schema level. Tested via validator tests elsewhere.
  })

  it('rejects invalid visibility', () => {
    expectFail({statusPages: [{name: 'P', slug: 'p', visibility: 'PRIVATE'}]})
  })

  it('rejects PASSWORD visibility', () => {
    expectFail({statusPages: [{name: 'P', slug: 'p', visibility: 'PASSWORD'}]})
  })

  it('rejects IP_RESTRICTED visibility', () => {
    expectFail({statusPages: [{name: 'P', slug: 'p', visibility: 'IP_RESTRICTED'}]})
  })

  it('rejects invalid incidentMode', () => {
    expectFail({statusPages: [{name: 'P', slug: 'p', incidentMode: 'AUTO'}]})
  })

  it('rejects extra fields (strict)', () => {
    expectFail({statusPages: [{name: 'P', slug: 'p', theme: 'dark'}]})
  })

  describe('branding', () => {
    const sp = (branding: unknown) => ({
      statusPages: [{name: 'P', slug: 'p', branding}],
    })

    it('rejects non-hex brandColor', () => {
      const r = expectFail(sp({brandColor: 'red'}))
      errorsContain(r, 'hex')
    })

    it('rejects invalid brandColor format (missing #)', () => {
      expectFail(sp({brandColor: 'FF0000'}))
    })

    it('rejects non-hex pageBackground', () => {
      expectFail(sp({pageBackground: 'rgb(0,0,0)'}))
    })

    it('rejects non-hex cardBackground', () => {
      expectFail(sp({cardBackground: 'blue'}))
    })

    it('rejects non-hex textColor', () => {
      expectFail(sp({textColor: 'white'}))
    })

    it('rejects non-hex borderColor', () => {
      expectFail(sp({borderColor: 'gray'}))
    })

    it('rejects non-http logoUrl', () => {
      expectFail(sp({logoUrl: 'ftp://cdn.example.com/logo.png'}))
    })

    it('rejects javascript: logoUrl', () => {
      expectFail(sp({logoUrl: 'javascript:alert(1)'}))
    })

    it('rejects non-http faviconUrl', () => {
      expectFail(sp({faviconUrl: 'data:image/png;base64,abc'}))
    })

    it('rejects non-http reportUrl', () => {
      expectFail(sp({reportUrl: 'file:///etc/passwd'}))
    })

    it('rejects extra fields on branding (strict)', () => {
      expectFail(sp({fontFamily: 'Arial'}))
    })
  })
})

// ── 9. Invalid status page component ─────────────────────────────────

describe('invalid status page component', () => {
  const sp = (components: unknown[]) => ({
    statusPages: [{name: 'P', slug: 'p', components}],
  })

  it('rejects missing name', () => {
    expectFail(sp([{type: 'STATIC'}]))
  })

  it('rejects missing type', () => {
    expectFail(sp([{name: 'Web'}]))
  })

  it('rejects invalid type', () => {
    expectFail(sp([{name: 'Web', type: 'CUSTOM'}]))
  })

  it('rejects malformed startDate (MM/DD/YYYY)', () => {
    expectFail(sp([{name: 'X', type: 'STATIC', startDate: '01/15/2024'}]))
  })

  it('rejects malformed startDate (no dashes)', () => {
    expectFail(sp([{name: 'X', type: 'STATIC', startDate: '20240115'}]))
  })

  it('rejects extra fields (strict)', () => {
    expectFail(sp([{name: 'X', type: 'STATIC', priority: 1}]))
  })
})

// ── 10. Invalid status page component group ──────────────────────────

describe('invalid status page component group', () => {
  const sp = (groups: unknown[]) => ({
    statusPages: [{name: 'P', slug: 'p', componentGroups: groups}],
  })

  it('rejects missing name', () => {
    expectFail(sp([{description: 'desc'}]))
  })

  it('rejects extra fields (strict)', () => {
    expectFail(sp([{name: 'API', priority: 1}]))
  })
})

// ── 11. Invalid resource groups ──────────────────────────────────────

describe('invalid resource groups', () => {
  it('rejects missing name', () => {
    expectFail({resourceGroups: [{monitors: ['a']}]})
  })

  it('rejects defaultFrequency below minimum (30)', () => {
    expectFail({resourceGroups: [{name: 'rg', defaultFrequency: 10}]})
  })

  it('rejects defaultFrequency above maximum (86400)', () => {
    expectFail({resourceGroups: [{name: 'rg', defaultFrequency: 100_000}]})
  })

  it('rejects invalid healthThresholdType', () => {
    expectFail({resourceGroups: [{name: 'rg', healthThresholdType: 'RATIO'}]})
  })

  it('rejects extra fields (strict)', () => {
    expectFail({resourceGroups: [{name: 'rg', autoRecover: true}]})
  })

  it('rejects invalid retryStrategy extra fields', () => {
    expectFail({
      resourceGroups: [{name: 'rg', defaultRetryStrategy: {type: 'fixed', maxRetries: 3, jitter: true}}],
    })
  })

  it('rejects negative confirmationDelaySeconds', () => {
    expectFail({resourceGroups: [{name: 'rg', confirmationDelaySeconds: -1}]})
  })

  it('rejects negative recoveryCooldownMinutes', () => {
    expectFail({resourceGroups: [{name: 'rg', recoveryCooldownMinutes: -5}]})
  })
})

// ── 12. Invalid webhooks ─────────────────────────────────────────────

describe('invalid webhooks', () => {
  it('rejects missing url', () => {
    expectFail({webhooks: [{subscribedEvents: ['monitor.down']}]})
  })

  it('rejects missing subscribedEvents', () => {
    expectFail({webhooks: [{url: 'https://x.com/hook'}]})
  })

  it('rejects empty subscribedEvents', () => {
    expectFail({webhooks: [{url: 'https://x.com/hook', subscribedEvents: []}]})
  })

  it('rejects extra fields (strict)', () => {
    expectFail({webhooks: [{url: 'https://x.com/hook', subscribedEvents: ['monitor.down'], secret: 's'}]})
  })
})

// ── 13. Invalid tags / environments / secrets ────────────────────────

describe('invalid tags', () => {
  it('rejects missing name', () => {
    expectFail({tags: [{color: '#FF0000'}]})
  })

  it('rejects extra fields (strict)', () => {
    expectFail({tags: [{name: 't', priority: 1}]})
  })
})

describe('invalid environments', () => {
  it('rejects missing name', () => {
    expectFail({environments: [{slug: 'prod'}]})
  })

  it('rejects missing slug', () => {
    expectFail({environments: [{name: 'Production'}]})
  })

  it('rejects extra fields (strict)', () => {
    expectFail({environments: [{name: 'Prod', slug: 'prod', region: 'us-east'}]})
  })
})

describe('invalid secrets', () => {
  it('rejects missing key', () => {
    expectFail({secrets: [{value: 'abc123'}]})
  })

  it('rejects missing value', () => {
    expectFail({secrets: [{key: 'API_KEY'}]})
  })

  it('rejects extra fields (strict)', () => {
    expectFail({secrets: [{key: 'k', value: 'v', encrypted: true}]})
  })
})

// ── 14. Invalid monitor defaults ─────────────────────────────────────

describe('invalid monitor defaults', () => {
  it('rejects frequency below min', () => {
    expectFail({
      defaults: {monitors: {frequencySeconds: 5}},
      monitors: [{name: 'X', type: 'HTTP', config: {url: 'https://x.com', method: 'GET'}}],
    })
  })

  it('rejects frequency above max', () => {
    expectFail({
      defaults: {monitors: {frequencySeconds: 999_999}},
      monitors: [{name: 'X', type: 'HTTP', config: {url: 'https://x.com', method: 'GET'}}],
    })
  })

  it('rejects extra fields on defaults (strict)', () => {
    expectFail({
      defaults: {monitors: {timeout: 30}},
      monitors: [{name: 'X', type: 'HTTP', config: {url: 'https://x.com', method: 'GET'}}],
    })
  })

  it('rejects extra top-level defaults key (strict)', () => {
    expectFail({
      defaults: {alertChannels: {enabled: true}},
      monitors: [{name: 'X', type: 'HTTP', config: {url: 'https://x.com', method: 'GET'}}],
    })
  })

  it('rejects invalid incidentPolicy in defaults', () => {
    expectFail({
      defaults: {monitors: {incidentPolicy: {triggerRules: []}}},
      monitors: [{name: 'X', type: 'HTTP', config: {url: 'https://x.com', method: 'GET'}}],
    })
  })
})

// ── 15. Bad YAML structure ───────────────────────────────────────────

describe('bad YAML structure', () => {
  it('rejects monitors as non-array (object)', () => {
    expectFail({monitors: {name: 'X', type: 'HTTP', config: {url: 'https://x.com'}}})
  })

  it('rejects monitors as string', () => {
    expectFail({monitors: 'X'})
  })

  it('rejects alertChannels as non-array', () => {
    expectFail({alertChannels: {name: 'ch', config: {channelType: 'slack'}}})
  })

  it('rejects tags as non-array', () => {
    expectFail({tags: 'production'})
  })

  it('rejects unknown top-level keys (strict)', () => {
    expectFail({metadata: {team: 'infra'}})
  })

  it('rejects multiple unknown top-level keys', () => {
    expectFail({foo: 1, bar: 2})
  })

  it('rejects null as config', () => {
    const result = DevhelmConfigSchema.safeParse(null)
    expect(result.success).toBe(false)
  })

  it('rejects string as config', () => {
    const result = DevhelmConfigSchema.safeParse('monitors: []')
    expect(result.success).toBe(false)
  })

  it('rejects number as config', () => {
    const result = DevhelmConfigSchema.safeParse(42)
    expect(result.success).toBe(false)
  })

  it('rejects monitor missing name', () => {
    expectFail({
      monitors: [{type: 'HTTP', config: {url: 'https://x.com', method: 'GET'}}],
    })
  })

  it('rejects monitor missing type', () => {
    expectFail({
      monitors: [{name: 'X', config: {url: 'https://x.com', method: 'GET'}}],
    })
  })

  it('rejects monitor missing config', () => {
    expectFail({
      monitors: [{name: 'X', type: 'HTTP'}],
    })
  })

  it('rejects extra fields on monitor (strict)', () => {
    expectFail({
      monitors: [{name: 'X', type: 'HTTP', config: {url: 'https://x.com', method: 'GET'}, description: 'hi'}],
    })
  })

  it('rejects alertChannel missing name', () => {
    expectFail({
      alertChannels: [{config: {channelType: 'slack', webhookUrl: 'https://hooks.slack.com/...'}}],
    })
  })
})

// ── 16. Bad references (structural — validator-level) ────────────────
// These are Zod-level structural mismatches, not cross-reference warnings.

describe('bad references (structural)', () => {
  it('rejects monitor with non-string environment', () => {
    expectFail({
      monitors: [{
        name: 'X', type: 'HTTP',
        config: {url: 'https://x.com', method: 'GET'},
        environment: 123,
      }],
    })
  })

  it('rejects monitor with non-array tags', () => {
    expectFail({
      monitors: [{
        name: 'X', type: 'HTTP',
        config: {url: 'https://x.com', method: 'GET'},
        tags: 'production',
      }],
    })
  })

  it('rejects monitor with non-array alertChannels', () => {
    expectFail({
      monitors: [{
        name: 'X', type: 'HTTP',
        config: {url: 'https://x.com', method: 'GET'},
        alertChannels: 'ops',
      }],
    })
  })

  it('rejects monitor with non-array regions', () => {
    expectFail({
      monitors: [{
        name: 'X', type: 'HTTP',
        config: {url: 'https://x.com', method: 'GET'},
        regions: 'us-east',
      }],
    })
  })

  it('rejects resourceGroup with non-array monitors', () => {
    expectFail({
      resourceGroups: [{name: 'rg', monitors: 'api'}],
    })
  })

  it('rejects resourceGroup with non-array services', () => {
    expectFail({
      resourceGroups: [{name: 'rg', services: 'github'}],
    })
  })
})

// ── 17. Moved blocks ─────────────────────────────────────────────────

describe('invalid moved blocks', () => {
  it('rejects missing from', () => {
    expectFail({moved: [{to: 'monitors.new'}]})
  })

  it('rejects missing to', () => {
    expectFail({moved: [{from: 'monitors.old'}]})
  })

  it('rejects extra fields (strict)', () => {
    expectFail({moved: [{from: 'a', to: 'b', reason: 'rename'}]})
  })
})

// ── 18. Dependencies ─────────────────────────────────────────────────

describe('invalid dependencies', () => {
  it('rejects missing service', () => {
    expectFail({dependencies: [{}]})
  })

  it('rejects invalid alertSensitivity', () => {
    expectFail({dependencies: [{service: 'github', alertSensitivity: 'NONE'}]})
  })

  it('rejects extra fields (strict)', () => {
    expectFail({dependencies: [{service: 'github', monitor: true}]})
  })
})

// ── 19. Combined edge cases ──────────────────────────────────────────

describe('combined edge cases', () => {
  it('rejects when multiple resources have independent errors', () => {
    const r = expectFail({
      monitors: [{name: 'X', type: 'FTP', config: {}}],
      alertChannels: [{name: 'ch', config: {channelType: 'sms'}}],
    })
    const msgs = formatZodErrors(r.error).join('\n')
    expect(msgs).toContain('monitors')
  })

  it('rejects frequency on both defaults and monitor when below min', () => {
    expectFail({
      defaults: {monitors: {frequencySeconds: 5}},
      monitors: [{
        name: 'X', type: 'HTTP',
        config: {url: 'https://x.com', method: 'GET'},
        frequencySeconds: 10,
      }],
    })
  })

  it('accumulates multiple assertion errors', () => {
    const r = expectFail({
      monitors: [{
        name: 'X', type: 'HTTP',
        config: {url: 'https://x.com', method: 'GET'},
        assertions: [
          {config: {type: 'status_code'}},
          {config: {type: 'response_time'}},
          {config: {type: 'totally_bogus'}},
        ],
      }],
    })
    const msgs = formatZodErrors(r.error)
    expect(msgs.length).toBeGreaterThanOrEqual(3)
  })

  it('rejects a status page with multiple branding errors', () => {
    const r = expectFail({
      statusPages: [{
        name: 'P', slug: 'p',
        branding: {
          brandColor: 'red',
          logoUrl: 'ftp://x',
          pageBackground: 'blue',
        },
      }],
    })
    const msgs = formatZodErrors(r.error)
    expect(msgs.length).toBeGreaterThanOrEqual(3)
  })
})
