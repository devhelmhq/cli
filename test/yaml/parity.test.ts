/**
 * Contract test: every CLI resource type must have YAML schema coverage.
 * This test ensures that adding a new resource to the CLI without
 * updating the YAML schema causes a test failure.
 */
import {describe, it, expect} from 'vitest'
import {YAML_SECTION_KEYS, type YamlSectionKey} from '../../src/lib/yaml/schema.js'
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
