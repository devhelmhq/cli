/**
 * Tests for the handler registry and handler completeness.
 * Verifies that:
 *   1. Every HandledResourceType has a registered handler
 *   2. Handler metadata (refType, listPath, configKey) is correct
 *   3. fetchAll, getRefKey, getApiRefKey, getApiId, deletePath return expected values
 */
import {describe, it, expect} from 'vitest'
import {
  HANDLER_MAP,
  getHandler,
  allHandlers,
  statusPageGroupDesiredSnapshot,
  statusPageGroupCurrentSnapshot,
  statusPageComponentDesiredSnapshot,
  statusPageComponentCurrentSnapshot,
} from '../../src/lib/yaml/handlers.js'
import type {HandledResourceType} from '../../src/lib/yaml/types.js'
import {YAML_SECTION_KEYS} from '../../src/lib/yaml/schema.js'
import {ResolvedRefs} from '../../src/lib/yaml/resolver.js'

const ALL_HANDLED_TYPES: HandledResourceType[] = [
  'tag', 'environment', 'secret', 'alertChannel',
  'notificationPolicy', 'webhook', 'resourceGroup',
  'monitor', 'dependency', 'statusPage',
]

describe('handler registry', () => {
  it('HANDLER_MAP has an entry for every HandledResourceType', () => {
    for (const type of ALL_HANDLED_TYPES) {
      expect(HANDLER_MAP[type], `missing handler for ${type}`).toBeDefined()
      expect(HANDLER_MAP[type].resourceType).toBe(type)
    }
  })

  it('getHandler returns the correct handler', () => {
    for (const type of ALL_HANDLED_TYPES) {
      const h = getHandler(type)
      expect(h.resourceType).toBe(type)
    }
  })

  it('allHandlers returns all 10 handlers', () => {
    const handlers = allHandlers()
    expect(handlers).toHaveLength(10)
    const types = new Set(handlers.map((h) => h.resourceType))
    for (const type of ALL_HANDLED_TYPES) {
      expect(types.has(type), `allHandlers() missing ${type}`).toBe(true)
    }
  })

  it('every handler configKey is a valid YAML_SECTION_KEY', () => {
    for (const handler of allHandlers()) {
      expect(
        (YAML_SECTION_KEYS as readonly string[]).includes(handler.configKey),
        `${handler.resourceType}.configKey="${handler.configKey}" is not in YAML_SECTION_KEYS`,
      ).toBe(true)
    }
  })

  it('every handler has a fetchAll method', () => {
    for (const handler of allHandlers()) {
      expect(typeof handler.fetchAll, `${handler.resourceType} missing fetchAll`).toBe('function')
    }
  })
})

describe('handler metadata', () => {
  it.each([
    ['tag', 'tags', 'tags', '/api/v1/tags'],
    ['environment', 'environments', 'environments', '/api/v1/environments'],
    ['secret', 'secrets', 'secrets', '/api/v1/secrets'],
    ['alertChannel', 'alertChannels', 'alertChannels', '/api/v1/alert-channels'],
    ['notificationPolicy', 'notificationPolicies', 'notificationPolicies', '/api/v1/notification-policies'],
    ['webhook', 'webhooks', 'webhooks', '/api/v1/webhooks'],
    ['resourceGroup', 'resourceGroups', 'resourceGroups', '/api/v1/resource-groups'],
    ['monitor', 'monitors', 'monitors', '/api/v1/monitors'],
    ['dependency', 'dependencies', 'dependencies', '/api/v1/service-subscriptions'],
    ['statusPage', 'statusPages', 'statusPages', '/api/v1/status-pages'],
  ] as const)('%s → refType=%s, configKey=%s, listPath=%s', (type, refType, configKey, listPath) => {
    const h = getHandler(type)
    expect(h.refType).toBe(refType)
    expect(h.configKey).toBe(configKey)
    expect(h.listPath).toBe(listPath)
  })
})

describe('handler getRefKey', () => {
  it('tag uses name', () => expect(getHandler('tag').getRefKey({name: 'prod'})).toBe('prod'))
  it('environment uses slug', () => expect(getHandler('environment').getRefKey({slug: 'staging', name: 'S'})).toBe('staging'))
  it('secret uses key', () => expect(getHandler('secret').getRefKey({key: 'api-key', value: 'x'})).toBe('api-key'))
  it('alertChannel uses name', () => expect(getHandler('alertChannel').getRefKey({name: 'slack'})).toBe('slack'))
  it('notificationPolicy uses name', () => expect(getHandler('notificationPolicy').getRefKey({name: 'p'})).toBe('p'))
  it('webhook uses url', () => expect(getHandler('webhook').getRefKey({url: 'https://x.com'})).toBe('https://x.com'))
  it('resourceGroup uses name', () => expect(getHandler('resourceGroup').getRefKey({name: 'API'})).toBe('API'))
  it('monitor uses name', () => expect(getHandler('monitor').getRefKey({name: 'M'})).toBe('M'))
  it('dependency uses service slug', () => expect(getHandler('dependency').getRefKey({service: 'gh'})).toBe('gh'))
  it('statusPage uses slug', () => expect(getHandler('statusPage').getRefKey({slug: 'my-page', name: 'My Page'})).toBe('my-page'))
})

describe('handler getApiRefKey + getApiId', () => {
  it('tag extracts name and id', () => {
    const h = getHandler('tag')
    expect(h.getApiRefKey({name: 'prod', id: 'tag-1'})).toBe('prod')
    expect(h.getApiId({id: 'tag-1'})).toBe('tag-1')
  })

  it('environment extracts slug and id', () => {
    const h = getHandler('environment')
    expect(h.getApiRefKey({slug: 'staging'})).toBe('staging')
    expect(h.getApiId({id: 'env-1'})).toBe('env-1')
  })

  it('monitor extracts name, id, and managedBy', () => {
    const h = getHandler('monitor')
    expect(h.getApiRefKey({name: 'M'})).toBe('M')
    expect(h.getApiId({id: 'mon-1'})).toBe('mon-1')
    expect(h.getManagedBy!({managedBy: 'CLI'})).toBe('CLI')
  })

  it('dependency extracts slug and subscriptionId', () => {
    const h = getHandler('dependency')
    expect(h.getApiRefKey({slug: 'gh'})).toBe('gh')
    expect(h.getApiId({subscriptionId: 'sub-1'})).toBe('sub-1')
  })
})

describe('handler deletePath', () => {
  it.each([
    ['tag', '/api/v1/tags/id-1'],
    ['environment', '/api/v1/environments/ref-1'],
    ['secret', '/api/v1/secrets/id-1'],
    ['alertChannel', '/api/v1/alert-channels/id-1'],
    ['notificationPolicy', '/api/v1/notification-policies/id-1'],
    ['webhook', '/api/v1/webhooks/id-1'],
    ['resourceGroup', '/api/v1/resource-groups/id-1'],
    ['monitor', '/api/v1/monitors/id-1'],
    ['dependency', '/api/v1/service-subscriptions/id-1'],
    ['statusPage', '/api/v1/status-pages/id-1'],
  ] as const)('%s → %s', (type, expectedPath) => {
    expect(getHandler(type).deletePath('id-1', 'ref-1')).toBe(expectedPath)
  })
})

// ── Snapshot parity (regression) ────────────────────────────────────────
//
// The YAML-side `*DesiredSnapshot` and the API-side `*CurrentSnapshot`
// MUST produce structurally identical objects when given equivalent
// inputs — otherwise `state pull` will write snapshots that don't match
// what the next deploy compares against, producing phantom diffs (or, as
// happened with `defaultOpen`, missing real drift entirely because the
// pulled snapshots only had `{name}` and the diff sub-object check
// triggered on EVERY field instead of just the changed ones).
//
// These tests guard against silent divergence: if anyone adds a field to
// one snapshot helper but not the other, this test fails first and loud.
describe('status-page child snapshot parity', () => {
  it('group: desired and current snapshots have identical key sets', () => {
    const yamlSnap = statusPageGroupDesiredSnapshot({name: 'Platform'})
    const apiSnap = statusPageGroupCurrentSnapshot({
      id: 'g-1', name: 'Platform', description: null, displayOrder: 0, defaultOpen: true,
    })
    expect(Object.keys(apiSnap).sort()).toEqual(Object.keys(yamlSnap).sort())
  })

  it('group: equivalent yaml + api inputs produce equal snapshots', () => {
    const yamlSnap = statusPageGroupDesiredSnapshot({
      name: 'Platform', description: 'Core infra', defaultOpen: false,
    })
    const apiSnap = statusPageGroupCurrentSnapshot({
      id: 'g-1', name: 'Platform', description: 'Core infra',
      displayOrder: 0, defaultOpen: false,
    })
    expect(apiSnap).toEqual(yamlSnap)
  })

  it('group: defaults align (defaultOpen=true, description=null)', () => {
    const yamlSnap = statusPageGroupDesiredSnapshot({name: 'Bare'})
    const apiSnap = statusPageGroupCurrentSnapshot({
      id: 'g-1', name: 'Bare', displayOrder: 0,
      // Both null and missing should normalize the same way:
      description: null, defaultOpen: true,
    })
    expect(apiSnap).toEqual(yamlSnap)
    expect(yamlSnap.defaultOpen).toBe(true)
    expect(yamlSnap.description).toBeNull()
  })

  it('component: desired and current snapshots have identical key sets', () => {
    const yamlSnap = statusPageComponentDesiredSnapshot({
      name: 'API', type: 'MONITOR', monitor: 'api',
    })
    const apiSnap = statusPageComponentCurrentSnapshot(
      {id: 'c-1', name: 'API', type: 'MONITOR'},
      new Map(),
      new ResolvedRefs(),
    )
    expect(Object.keys(apiSnap).sort()).toEqual(Object.keys(yamlSnap).sort())
  })

  it('component: equivalent inputs (with group/monitor refs) produce equal snapshots', () => {
    const refs = new ResolvedRefs()
    refs.set('monitors', 'api-monitor', {refKey: 'api-monitor', id: 'mon-uuid-1'})
    const groupNameToId = new Map([['Platform', 'g-uuid-1']])

    const yamlSnap = statusPageComponentDesiredSnapshot({
      name: 'API',
      type: 'MONITOR',
      description: 'Public REST',
      showUptime: true,
      excludeFromOverall: false,
      startDate: '2025-01-15',
      group: 'Platform',
      monitor: 'api-monitor',
    })
    const apiSnap = statusPageComponentCurrentSnapshot(
      {
        id: 'c-1',
        name: 'API',
        type: 'MONITOR',
        description: 'Public REST',
        showUptime: true,
        excludeFromOverall: false,
        // API returns ISO timestamp at start-of-day UTC; helper slices to YYYY-MM-DD
        startDate: '2025-01-15T00:00:00Z',
        groupId: 'g-uuid-1',
        monitorId: 'mon-uuid-1',
      },
      groupNameToId,
      refs,
    )
    expect(apiSnap).toEqual(yamlSnap)
  })

  it('component: unknown groupId/monitorId reverse-resolve to null (drift surfaces)', () => {
    const apiSnap = statusPageComponentCurrentSnapshot(
      {id: 'c-1', name: 'API', type: 'MONITOR', groupId: 'unknown-group', monitorId: 'unknown-mon'},
      new Map(),
      new ResolvedRefs(),
    )
    expect(apiSnap.group).toBeNull()
    expect(apiSnap.monitor).toBeNull()
  })
})
