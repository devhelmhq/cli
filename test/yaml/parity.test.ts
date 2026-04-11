/**
 * Contract test: every CLI resource type must have YAML schema coverage,
 * every YAML section must have a handler, and every handler must implement
 * the full snapshot-based change detection interface.
 */
import {describe, it, expect} from 'vitest'
import {YAML_SECTION_KEYS} from '../../src/lib/yaml/schema.js'
import {allHandlers, HANDLER_MAP} from '../../src/lib/yaml/handlers.js'
import {RESOURCE_ORDER} from '../../src/lib/yaml/types.js'
import * as resources from '../../src/lib/resources.js'

const CLI_RESOURCE_CONFIGS = [
  {config: resources.MONITORS, yamlKey: 'monitors'},
  {config: resources.INCIDENTS, yamlKey: null},
  {config: resources.ALERT_CHANNELS, yamlKey: 'alertChannels'},
  {config: resources.NOTIFICATION_POLICIES, yamlKey: 'notificationPolicies'},
  {config: resources.ENVIRONMENTS, yamlKey: 'environments'},
  {config: resources.SECRETS, yamlKey: 'secrets'},
  {config: resources.TAGS, yamlKey: 'tags'},
  {config: resources.RESOURCE_GROUPS, yamlKey: 'resourceGroups'},
  {config: resources.WEBHOOKS, yamlKey: 'webhooks'},
  {config: resources.API_KEYS, yamlKey: null},
  {config: resources.DEPENDENCIES, yamlKey: 'dependencies'},
] as const

describe('CLI ↔ YAML parity', () => {
  it('all deployable CLI resources have a YAML section key', () => {
    const deployable = CLI_RESOURCE_CONFIGS.filter((r) => r.yamlKey !== null)
    for (const {config, yamlKey} of deployable) {
      expect(
        (YAML_SECTION_KEYS as readonly string[]).includes(yamlKey),
        `CLI resource "${config.name}" maps to YAML key "${yamlKey}" which is not in YAML_SECTION_KEYS`,
      ).toBe(true)
    }
  })

  it('YAML section keys all have a CLI resource', () => {
    const coveredKeys = new Set(CLI_RESOURCE_CONFIGS.map((r) => r.yamlKey).filter(Boolean))
    for (const key of YAML_SECTION_KEYS) {
      expect(
        coveredKeys.has(key),
        `YAML section "${key}" has no corresponding CLI resource mapping`,
      ).toBe(true)
    }
  })

  it('non-deployable resources (incidents, API keys) are excluded from YAML', () => {
    const excluded = CLI_RESOURCE_CONFIGS.filter((r) => r.yamlKey === null)
    expect(excluded.length).toBe(2)
    expect(excluded.map((r) => r.config.name)).toContain('incident')
    expect(excluded.map((r) => r.config.name)).toContain('API key')
  })
})

describe('handler ↔ YAML parity', () => {
  it('every YAML section key has a handler with matching configKey', () => {
    const handlers = allHandlers()
    const handlerConfigKeys = new Set(handlers.map((h) => h.configKey))
    for (const key of YAML_SECTION_KEYS) {
      expect(
        handlerConfigKeys.has(key),
        `YAML section "${key}" has no handler with configKey="${key}"`,
      ).toBe(true)
    }
  })

  it('every handler configKey is a valid YAML section key', () => {
    for (const handler of allHandlers()) {
      expect(
        (YAML_SECTION_KEYS as readonly string[]).includes(handler.configKey),
        `Handler "${handler.resourceType}" has configKey="${handler.configKey}" which is not a YAML section key`,
      ).toBe(true)
    }
  })

  it('every handler has hasChanged, fetchAll, applyCreate, applyUpdate, deletePath', () => {
    for (const handler of allHandlers()) {
      expect(typeof handler.hasChanged, `${handler.resourceType} missing hasChanged`).toBe('function')
      expect(typeof handler.fetchAll, `${handler.resourceType} missing fetchAll`).toBe('function')
      expect(typeof handler.applyCreate, `${handler.resourceType} missing applyCreate`).toBe('function')
      expect(typeof handler.applyUpdate, `${handler.resourceType} missing applyUpdate`).toBe('function')
      expect(typeof handler.deletePath, `${handler.resourceType} missing deletePath`).toBe('function')
    }
  })

  it('RESOURCE_ORDER contains all handled resource types + groupMembership', () => {
    const handlerTypes = new Set(allHandlers().map((h) => h.resourceType))
    for (const type of handlerTypes) {
      expect(
        RESOURCE_ORDER.includes(type),
        `Handler type "${type}" is not in RESOURCE_ORDER`,
      ).toBe(true)
    }
    expect(RESOURCE_ORDER.includes('groupMembership')).toBe(true)
  })

  it('HANDLER_MAP keys match exactly the set of handler resourceTypes', () => {
    const mapKeys = new Set(Object.keys(HANDLER_MAP))
    const handlerTypes = new Set(allHandlers().map((h) => h.resourceType))
    expect(mapKeys).toEqual(handlerTypes)
  })

  it('no handler has the same refType as another handler', () => {
    const seen = new Map<string, string>()
    for (const handler of allHandlers()) {
      const existing = seen.get(handler.refType)
      expect(
        existing,
        `Handlers "${existing}" and "${handler.resourceType}" share refType="${handler.refType}"`,
      ).toBeUndefined()
      seen.set(handler.refType, handler.resourceType)
    }
  })

  it('no handler has the same listPath as another handler', () => {
    const seen = new Map<string, string>()
    for (const handler of allHandlers()) {
      const existing = seen.get(handler.listPath)
      expect(
        existing,
        `Handlers "${existing}" and "${handler.resourceType}" share listPath="${handler.listPath}"`,
      ).toBeUndefined()
      seen.set(handler.listPath, handler.resourceType)
    }
  })
})
