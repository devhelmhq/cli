import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {mkdtempSync, writeFileSync, rmSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {ALERT_CHANNELS, MONITORS, STATUS_PAGES} from '../../src/lib/resources.js'

describe('ALERT_CHANNELS bodyBuilder --config validation', () => {
  it('accepts valid slack config JSON', () => {
    const body = ALERT_CHANNELS.bodyBuilder!({
      name: 'sl',
      type: 'slack',
      config: JSON.stringify({channelType: 'slack', webhookUrl: 'https://hooks.slack.com/services/AAA/BBB/CCC'}),
    })
    expect(body.name).toBe('sl')
    expect(body.config).toMatchObject({channelType: 'slack'})
  })

  it('throws clear error on malformed JSON', () => {
    expect(() =>
      ALERT_CHANNELS.bodyBuilder!({name: 'x', type: 'slack', config: '{not-json'}),
    ).toThrow(/Failed to parse --config as JSON/)
  })

  it('throws when --config is not an object', () => {
    expect(() =>
      ALERT_CHANNELS.bodyBuilder!({name: 'x', type: 'slack', config: '"hello"'}),
    ).toThrow(/--config must be a JSON object/)
  })

  it('throws when channelType is missing', () => {
    expect(() =>
      ALERT_CHANNELS.bodyBuilder!({name: 'x', type: 'slack', config: '{"webhookUrl":"https://x"}'}),
    ).toThrow(/must include "channelType"/)
  })

  it('throws on unknown channelType', () => {
    expect(() =>
      ALERT_CHANNELS.bodyBuilder!({name: 'x', type: 'slack', config: '{"channelType":"telegram"}'}),
    ).toThrow(/Unknown channelType "telegram"/)
  })

  it('throws when payload does not match the channelType schema', () => {
    expect(() =>
      ALERT_CHANNELS.bodyBuilder!({name: 'x', type: 'slack', config: '{"channelType":"slack"}'}),
    ).toThrow(/Invalid --config payload for channelType "slack"/)
  })

  it('still supports the --webhook-url shorthand without --config', () => {
    const body = ALERT_CHANNELS.bodyBuilder!({
      name: 'sl',
      type: 'slack',
      'webhook-url': 'https://hooks.slack.com/services/AAA/BBB/CCC',
    })
    expect(body.config).toMatchObject({channelType: 'slack', webhookUrl: expect.any(String)})
  })
})

describe('STATUS_PAGES bodyBuilder --branding-file validation', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'devhelm-branding-'))
  })

  afterEach(() => {
    rmSync(dir, {recursive: true, force: true})
  })

  function write(name: string, contents: string): string {
    const p = join(dir, name)
    writeFileSync(p, contents, 'utf8')
    return p
  }

  it('accepts a valid branding file', () => {
    const path = write('b.json', JSON.stringify({brandColor: '#4F46E5', logoUrl: 'https://example.com/logo.png'}))
    const body = STATUS_PAGES.bodyBuilder!({name: 'p', slug: 'p', 'branding-file': path})
    expect(body.branding).toMatchObject({brandColor: '#4F46E5'})
  })

  it('throws on malformed JSON', () => {
    const path = write('b.json', '{not-json')
    expect(() => STATUS_PAGES.bodyBuilder!({'branding-file': path})).toThrow(/Failed to parse branding file/)
  })

  it('rejects invalid hex colors', () => {
    const path = write('b.json', JSON.stringify({brandColor: 'red'}))
    expect(() => STATUS_PAGES.bodyBuilder!({'branding-file': path})).toThrow(/Invalid branding file/)
  })

  it('rejects non-http URLs', () => {
    const path = write('b.json', JSON.stringify({logoUrl: 'ftp://example.com/logo.png'}))
    expect(() => STATUS_PAGES.bodyBuilder!({'branding-file': path})).toThrow(/Invalid branding file/)
  })

  it('rejects unknown branding fields (strict)', () => {
    const path = write('b.json', JSON.stringify({brandColor: '#fff', mysteryField: 'x'}))
    expect(() => STATUS_PAGES.bodyBuilder!({'branding-file': path})).toThrow(/Invalid branding file/)
  })
})

describe('MONITORS bodyBuilder --regions defaulting (P1.Bug9)', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    stderrSpy.mockRestore()
  })

  it('defaults regions to [us-east] for HTTP without --regions', () => {
    const body = MONITORS.bodyBuilder({name: 'X', type: 'HTTP', url: 'https://x.com'}) as Record<string, unknown>
    expect(body.regions).toEqual(['us-east'])
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('defaulting --regions us-east'),
    )
  })

  it.each(['TCP', 'DNS', 'ICMP', 'HTTP_HEADLESS', 'HTTP_BROWSER'])(
    'defaults regions for %s without --regions',
    (type) => {
      const body = MONITORS.bodyBuilder({name: 'X', type, url: 'x.com'}) as Record<string, unknown>
      expect(body.regions).toEqual(['us-east'])
    },
  )

  it('respects an explicit --regions value (no default applied)', () => {
    const body = MONITORS.bodyBuilder({
      name: 'X', type: 'HTTP', url: 'https://x.com', regions: 'eu-west,ap-south',
    }) as Record<string, unknown>
    expect(body.regions).toEqual(['eu-west', 'ap-south'])
    expect(stderrSpy).not.toHaveBeenCalled()
  })

  it('does NOT default regions for HEARTBEAT (push monitor)', () => {
    const body = MONITORS.bodyBuilder({name: 'X', type: 'HEARTBEAT'}) as Record<string, unknown>
    expect(body.regions).toBeUndefined()
    expect(stderrSpy).not.toHaveBeenCalled()
  })

  it('does NOT default regions for MCP_SERVER (region semantics in flux)', () => {
    const body = MONITORS.bodyBuilder({name: 'X', type: 'MCP_SERVER', url: 'mcp-server'}) as Record<string, unknown>
    expect(body.regions).toBeUndefined()
    expect(stderrSpy).not.toHaveBeenCalled()
  })
})
