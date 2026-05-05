import {describe, it, expect} from 'vitest'
import {diff, formatPlan} from '../../src/lib/yaml/differ.js'
import {ResolvedRefs} from '../../src/lib/yaml/resolver.js'
import type {DevhelmConfig} from '../../src/lib/yaml/schema.js'

function emptyRefs(): ResolvedRefs {
  return new ResolvedRefs()
}

describe('differ', () => {
  describe('diff', () => {
    it('detects creates for new resources', async () => {
      const config: DevhelmConfig = {
        tags: [{name: 'production', color: '#EF4444'}],
        monitors: [{
          name: 'Test', type: 'HTTP',
          config: {url: 'https://x.com', method: 'GET'},
        }],
      }
      const changeset = await diff(config, emptyRefs())
      expect(changeset.creates).toHaveLength(2)
      expect(changeset.creates[0].resourceType).toBe('tag')
      expect(changeset.creates[1].resourceType).toBe('monitor')
    })

    it('detects updates when field changed', async () => {
      const refs = new ResolvedRefs()
      refs.set('tags', 'production', {id: 'tag-1', refKey: 'production', raw: {name: 'production', color: '#000000'}})
      const config: DevhelmConfig = {
        tags: [{name: 'production', color: '#EF4444'}],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(1)
      expect(changeset.updates[0].existingId).toBe('tag-1')
      expect(changeset.creates).toHaveLength(0)
    })

    it('skips update when tag unchanged', async () => {
      const refs = new ResolvedRefs()
      refs.set('tags', 'production', {id: 'tag-1', refKey: 'production', raw: {name: 'production', color: '#EF4444'}})
      const config: DevhelmConfig = {
        tags: [{name: 'production', color: '#EF4444'}],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(0)
    })

    it('skips update when monitor unchanged', async () => {
      const refs = new ResolvedRefs()
      refs.set('monitors', 'API', {id: 'mon-1', refKey: 'API', raw: {
        name: 'API', type: 'HTTP', enabled: true, frequencySeconds: 60,
        regions: ['us-east', 'eu-west'],
        config: {url: 'https://api.com', method: 'GET'},
      }})
      const config: DevhelmConfig = {
        monitors: [{
          name: 'API', type: 'HTTP', enabled: true, frequencySeconds: 60,
          regions: ['us-east', 'eu-west'],
          config: {url: 'https://api.com', method: 'GET'},
        }],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(0)
    })

    it('detects update when monitor frequency changed', async () => {
      const refs = new ResolvedRefs()
      refs.set('monitors', 'API', {id: 'mon-1', refKey: 'API', raw: {
        name: 'API', type: 'HTTP', frequencySeconds: 60,
        config: {url: 'https://api.com', method: 'GET'},
      }})
      const config: DevhelmConfig = {
        monitors: [{
          name: 'API', type: 'HTTP', frequencySeconds: 30,
          config: {url: 'https://api.com', method: 'GET'},
        }],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(1)
    })

    it('detects update when monitor config changed', async () => {
      const refs = new ResolvedRefs()
      refs.set('monitors', 'API', {id: 'mon-1', refKey: 'API', raw: {
        name: 'API', type: 'HTTP',
        config: {url: 'https://api.com', method: 'GET'},
      }})
      const config: DevhelmConfig = {
        monitors: [{
          name: 'API', type: 'HTTP',
          config: {url: 'https://api.com/v2', method: 'GET'},
        }],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(1)
    })

    it('detects update when monitor regions changed', async () => {
      const refs = new ResolvedRefs()
      refs.set('monitors', 'API', {id: 'mon-1', refKey: 'API', raw: {
        name: 'API', type: 'HTTP', regions: ['us-east'],
        config: {url: 'https://api.com', method: 'GET'},
      }})
      const config: DevhelmConfig = {
        monitors: [{
          name: 'API', type: 'HTTP', regions: ['us-east', 'eu-west'],
          config: {url: 'https://api.com', method: 'GET'},
        }],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(1)
    })

    it('skips update when webhook unchanged', async () => {
      const refs = new ResolvedRefs()
      refs.set('webhooks', 'https://hooks.com/x', {id: 'wh-1', refKey: 'https://hooks.com/x', raw: {
        url: 'https://hooks.com/x', subscribedEvents: ['monitor.down', 'monitor.recovered'], description: 'test', enabled: true,
      }})
      const config: DevhelmConfig = {
        webhooks: [{url: 'https://hooks.com/x', subscribedEvents: ['monitor.down', 'monitor.recovered'], description: 'test'}],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(0)
    })

    it('detects update when webhook events changed', async () => {
      const refs = new ResolvedRefs()
      refs.set('webhooks', 'https://hooks.com/x', {id: 'wh-1', refKey: 'https://hooks.com/x', raw: {
        url: 'https://hooks.com/x', subscribedEvents: ['monitor.down'],
      }})
      const config: DevhelmConfig = {
        webhooks: [{url: 'https://hooks.com/x', subscribedEvents: ['monitor.down', 'incident.created']}],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(1)
    })

    it('skips update when environment unchanged', async () => {
      const refs = new ResolvedRefs()
      refs.set('environments', 'production', {id: 'env-1', refKey: 'production', raw: {
        name: 'Production', slug: 'production', isDefault: true,
      }})
      const config: DevhelmConfig = {
        environments: [{name: 'Production', slug: 'production', isDefault: true}],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(0)
    })

    it('always updates secrets (value not visible in API)', async () => {
      const refs = new ResolvedRefs()
      refs.set('secrets', 'api-key', {id: 'sec-1', refKey: 'api-key', raw: {key: 'api-key'}})
      const config: DevhelmConfig = {
        secrets: [{key: 'api-key', value: 'same-or-different'}],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(1)
    })

    it('skips update when dependency unchanged', async () => {
      const refs = new ResolvedRefs()
      refs.set('dependencies', 'github', {id: 'dep-1', refKey: 'github', raw: {
        slug: 'github', alertSensitivity: 'INCIDENTS_ONLY',
      }})
      const config: DevhelmConfig = {
        dependencies: [{service: 'github', alertSensitivity: 'INCIDENTS_ONLY'}],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(0)
    })

    it('detects update when dependency alertSensitivity changed', async () => {
      const refs = new ResolvedRefs()
      refs.set('dependencies', 'github', {id: 'dep-1', refKey: 'github', raw: {
        slug: 'github', alertSensitivity: 'INCIDENTS_ONLY',
      }})
      const config: DevhelmConfig = {
        dependencies: [{service: 'github', alertSensitivity: 'ALL'}],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(1)
    })

    it('skips update when resource group unchanged', async () => {
      const refs = new ResolvedRefs()
      refs.set('resourceGroups', 'API', {id: 'rg-1', refKey: 'API', raw: {
        name: 'API', description: 'API services', defaultFrequency: 30,
      }})
      const config: DevhelmConfig = {
        resourceGroups: [{name: 'API', description: 'API services', defaultFrequency: 30}],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(0)
    })

    it('detects no changes for empty config sections', async () => {
      const config: DevhelmConfig = {}
      const changeset = await diff(config, emptyRefs())
      expect(changeset.creates).toHaveLength(0)
      expect(changeset.updates).toHaveLength(0)
      expect(changeset.deletes).toHaveLength(0)
    })

    it('--prune-org-cli detects deletes for CLI-managed monitors org-wide', async () => {
      const refs = new ResolvedRefs()
      refs.set('monitors', 'old-monitor', {
        id: 'mon-1', refKey: 'old-monitor', managedBy: 'CLI', raw: {managedBy: 'CLI'},
      })
      const config: DevhelmConfig = {monitors: []}
      const changeset = await diff(config, refs, {pruneOrgCli: true})
      expect(changeset.deletes).toHaveLength(1)
      expect(changeset.deletes[0].refKey).toBe('old-monitor')
      expect(changeset.deletes[0].pruneScope).toBe('org-cli')
    })

    it('skips non-CLI monitors during --prune-org-cli', async () => {
      const refs = new ResolvedRefs()
      refs.set('monitors', 'dashboard-monitor', {
        id: 'mon-1', refKey: 'dashboard-monitor', managedBy: 'DASHBOARD', raw: {managedBy: 'DASHBOARD'},
      })
      const config: DevhelmConfig = {monitors: []}
      const changeset = await diff(config, refs, {pruneOrgCli: true})
      expect(changeset.deletes).toHaveLength(0)
    })

    it('skips non-CLI monitors during plain --prune even when state is empty', async () => {
      const refs = new ResolvedRefs()
      refs.set('monitors', 'dashboard-monitor', {
        id: 'mon-1', refKey: 'dashboard-monitor', managedBy: 'DASHBOARD', raw: {managedBy: 'DASHBOARD'},
      })
      const config: DevhelmConfig = {monitors: []}
      const changeset = await diff(config, refs, {prune: true})
      expect(changeset.deletes).toHaveLength(0)
    })

    it('pruneAll deletes non-CLI monitors', async () => {
      const refs = new ResolvedRefs()
      refs.set('monitors', 'dashboard-monitor', {
        id: 'mon-1', refKey: 'dashboard-monitor', managedBy: 'DASHBOARD', raw: {managedBy: 'DASHBOARD'},
      })
      const config: DevhelmConfig = {monitors: []}
      const changeset = await diff(config, refs, {prune: true, pruneAll: true})
      expect(changeset.deletes).toHaveLength(1)
      expect(changeset.deletes[0].refKey).toBe('dashboard-monitor')
    })

    it('pruneAll deletes monitors with no managedBy', async () => {
      const refs = new ResolvedRefs()
      refs.set('monitors', 'orphan', {
        id: 'mon-1', refKey: 'orphan', raw: {},
      })
      const config: DevhelmConfig = {monitors: []}
      const changeset = await diff(config, refs, {prune: true, pruneAll: true})
      expect(changeset.deletes).toHaveLength(1)
    })

    it('prune: omitted section (undefined) does not delete', async () => {
      const refs = new ResolvedRefs()
      refs.set('tags', 'T', {id: '1', refKey: 'T', raw: {name: 'T'}})
      const config: DevhelmConfig = {}
      const changeset = await diff(config, refs, {prune: true})
      expect(changeset.deletes).toHaveLength(0)
    })

    it('--prune-org-cli: empty array deletes all existing tags', async () => {
      const refs = new ResolvedRefs()
      refs.set('tags', 'T', {id: '1', refKey: 'T', raw: {name: 'T'}})
      const config: DevhelmConfig = {tags: []}
      const changeset = await diff(config, refs, {pruneOrgCli: true})
      expect(changeset.deletes).toHaveLength(1)
      expect(changeset.deletes[0].pruneScope).toBe('org-cli')
    })

    it('does not delete without prune flag', async () => {
      const refs = new ResolvedRefs()
      refs.set('monitors', 'old', {id: 'mon-1', refKey: 'old', managedBy: 'CLI', raw: {}})
      const config: DevhelmConfig = {monitors: []}
      const changeset = await diff(config, refs, {prune: false})
      expect(changeset.deletes).toHaveLength(0)
    })
  })

  // ── --prune scope to state file (P0.Bug1, multi-team safety) ──────────
  describe('diff: --prune state-scoped (P0.Bug1)', () => {
    function stateWith(addresses: string[]): import('../../src/lib/yaml/state.js').DeployState {
      return {
        version: '3' as const, serial: 1, lastDeployedAt: '2026-05-05T00:00:00Z',
        resources: Object.fromEntries(
          addresses.map((addr) => [addr, {
            apiId: addr.split('.').slice(1).join('.') + '-id',
            resourceType: addr.split('.')[0] as never,
            children: {},
          }]),
        ),
      }
    }

    it('deletes a monitor that IS in this config\'s state file', async () => {
      const refs = new ResolvedRefs()
      refs.set('monitors', 'mine', {
        id: 'mon-1', refKey: 'mine', managedBy: 'CLI', raw: {managedBy: 'CLI'},
      })
      const state = stateWith(['monitors.mine'])
      const cs = await diff({monitors: []}, refs, {prune: true}, state)
      expect(cs.deletes).toHaveLength(1)
      expect(cs.deletes[0].refKey).toBe('mine')
      expect(cs.deletes[0].pruneScope).toBe('state')
    })

    it('does NOT delete a CLI monitor that is NOT in this state file (multi-team safety)', async () => {
      const refs = new ResolvedRefs()
      refs.set('monitors', 'theirs', {
        id: 'mon-2', refKey: 'theirs', managedBy: 'CLI', raw: {managedBy: 'CLI'},
      })
      const state = stateWith([]) // empty state — this config never created `theirs`
      const cs = await diff({monitors: []}, refs, {prune: true}, state)
      expect(cs.deletes).toHaveLength(0)
    })

    it('--prune-org-cli widens scope and deletes the other team\'s CLI monitor', async () => {
      const refs = new ResolvedRefs()
      refs.set('monitors', 'theirs', {
        id: 'mon-2', refKey: 'theirs', managedBy: 'CLI', raw: {managedBy: 'CLI'},
      })
      const cs = await diff({monitors: []}, refs, {pruneOrgCli: true}, stateWith([]))
      expect(cs.deletes).toHaveLength(1)
      expect(cs.deletes[0].pruneScope).toBe('org-cli')
    })

    it('reports state-tracked and org-cli deletes with their scope', async () => {
      const refs = new ResolvedRefs()
      refs.set('monitors', 'mine', {
        id: 'mon-1', refKey: 'mine', managedBy: 'CLI', raw: {managedBy: 'CLI'},
      })
      refs.set('monitors', 'theirs', {
        id: 'mon-2', refKey: 'theirs', managedBy: 'CLI', raw: {managedBy: 'CLI'},
      })
      const cs = await diff({monitors: []}, refs, {pruneOrgCli: true}, stateWith(['monitors.mine']))
      const byKey = Object.fromEntries(cs.deletes.map((d) => [d.refKey, d.pruneScope]))
      expect(byKey).toEqual({mine: 'state', theirs: 'org-cli'})
    })

    it('--prune-all picks up dashboard-managed monitors as scope=org-all', async () => {
      const refs = new ResolvedRefs()
      refs.set('monitors', 'dash', {
        id: 'mon-3', refKey: 'dash', managedBy: 'DASHBOARD', raw: {managedBy: 'DASHBOARD'},
      })
      const cs = await diff({monitors: []}, refs, {pruneAll: true}, stateWith([]))
      expect(cs.deletes).toHaveLength(1)
      expect(cs.deletes[0].pruneScope).toBe('org-all')
    })

    it('non-monitor resources outside state are NOT touched under plain --prune', async () => {
      const refs = new ResolvedRefs()
      refs.set('tags', 'shared', {id: 't-1', refKey: 'shared', raw: {name: 'shared'}})
      const cs = await diff({tags: []}, refs, {prune: true}, stateWith([]))
      expect(cs.deletes).toHaveLength(0)
    })

    it('non-monitor resources outside state ARE touched under --prune-org-cli', async () => {
      const refs = new ResolvedRefs()
      refs.set('tags', 'shared', {id: 't-1', refKey: 'shared', raw: {name: 'shared'}})
      const cs = await diff({tags: []}, refs, {pruneOrgCli: true}, stateWith([]))
      expect(cs.deletes).toHaveLength(1)
      expect(cs.deletes[0].pruneScope).toBe('org-cli')
    })

    it('creates in dependency order', async () => {
      const config: DevhelmConfig = {
        monitors: [{name: 'M', type: 'HTTP', config: {url: 'https://x.com', method: 'GET'}}],
        tags: [{name: 'T'}],
        alertChannels: [{name: 'C', config: {channelType: 'slack', webhookUrl: 'url'}}],
      }
      const changeset = await diff(config, emptyRefs())
      const types = changeset.creates.map((c) => c.resourceType)
      expect(types.indexOf('tag')).toBeLessThan(types.indexOf('alertChannel'))
      expect(types.indexOf('alertChannel')).toBeLessThan(types.indexOf('monitor'))
    })

    it('deletes in reverse dependency order', async () => {
      const refs = new ResolvedRefs()
      refs.set('tags', 'T', {id: '1', refKey: 'T', raw: {}})
      refs.set('monitors', 'M', {id: '2', refKey: 'M', managedBy: 'CLI', raw: {}})
      const config: DevhelmConfig = {tags: [], monitors: []}
      const changeset = await diff(config, refs, {pruneOrgCli: true})
      const types = changeset.deletes.map((c) => c.resourceType)
      expect(types.indexOf('monitor')).toBeLessThan(types.indexOf('tag'))
    })

    it('detects group memberships', async () => {
      const config: DevhelmConfig = {
        monitors: [{name: 'M', type: 'HTTP', config: {url: 'https://x.com', method: 'GET'}}],
        resourceGroups: [{name: 'G', monitors: ['M']}],
      }
      const changeset = await diff(config, emptyRefs())
      expect(changeset.memberships).toHaveLength(1)
      expect(changeset.memberships[0].refKey).toBe('G → M')
    })

    it('handles all resource types', async () => {
      const config: DevhelmConfig = {
        tags: [{name: 'T'}],
        environments: [{name: 'E', slug: 'e'}],
        secrets: [{key: 'K', value: 'V'}],
        alertChannels: [{name: 'C', config: {channelType: 'slack', webhookUrl: 'url'}}],
        notificationPolicies: [{name: 'P', escalation: {steps: [{channels: ['C']}]}}],
        webhooks: [{url: 'https://x.com', subscribedEvents: ['e']}],
        resourceGroups: [{name: 'G'}],
        monitors: [{name: 'M', type: 'HTTP', config: {url: 'https://x.com', method: 'GET'}}],
        dependencies: [{service: 'github'}],
        statusPages: [{
          name: 'Public Status',
          slug: 'public',
          branding: {},
          components: [{name: 'API', type: 'STATIC'}],
        }],
      }
      const changeset = await diff(config, emptyRefs())
      expect(changeset.creates).toHaveLength(10)
      const types = changeset.creates.map((c) => c.resourceType)
      expect(types).toContain('statusPage')
    })

    it('detects update when status page name changes', async () => {
      const refs = new ResolvedRefs()
      refs.set('statusPages', 'public', {id: 'sp-1', refKey: 'public', raw: {
        id: 'sp-1', name: 'Old Name', slug: 'public',
        branding: {},
        componentGroups: [],
        components: [],
      }})
      const config: DevhelmConfig = {
        statusPages: [{
          name: 'New Name',
          slug: 'public',
          branding: {},
          components: [],
        }],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(1)
      expect(changeset.updates[0].refKey).toBe('public')
    })

    // ── Status page branding + new component fields ────────────────────
    // These guard the snapshot logic added with branding & component
    // (excludeFromOverall, startDate) extensions. The diff engine drives
    // handler.toDesiredSnapshot / toCurrentSnapshot under the hood, so a
    // diff() round-trip is the cheapest way to assert end-to-end behavior.

    it('detects update when status page branding fields change', async () => {
      const refs = new ResolvedRefs()
      refs.set('statusPages', 'sp', {id: 'sp-1', refKey: 'sp', raw: {
        id: 'sp-1', name: 'P', slug: 'sp',
        branding: {brandColor: '#000000', theme: 'dark'},
        componentGroups: [], components: [],
      }})
      const config: DevhelmConfig = {
        statusPages: [{
          name: 'P', slug: 'sp',
          branding: {brandColor: '#FF0000', theme: 'dark'},
        }],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(1)
      expect(changeset.updates[0].refKey).toBe('sp')
    })

    it('does NOT update status page when YAML omits branding (preserve current)', async () => {
      const refs = new ResolvedRefs()
      refs.set('statusPages', 'sp', {id: 'sp-1', refKey: 'sp', raw: {
        id: 'sp-1', name: 'P', slug: 'sp',
        // API has branding values; YAML omits the section entirely.
        branding: {brandColor: '#FF0000', theme: 'light', hidePoweredBy: true},
        componentGroups: [], components: [],
      }})
      const config: DevhelmConfig = {
        statusPages: [{name: 'P', slug: 'sp'}],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(0)
    })

    it('detects update when YAML branding shrinks vs API (hidePoweredBy default)', async () => {
      // YAML has only brandColor; toBrandingRequest fills the rest with
      // null/false defaults, so diff against an API with theme=dark must fire.
      const refs = new ResolvedRefs()
      refs.set('statusPages', 'sp', {id: 'sp-1', refKey: 'sp', raw: {
        id: 'sp-1', name: 'P', slug: 'sp',
        branding: {brandColor: '#FF0000', theme: 'dark'},
        componentGroups: [], components: [],
      }})
      const config: DevhelmConfig = {
        statusPages: [{
          name: 'P', slug: 'sp',
          branding: {brandColor: '#FF0000'},
        }],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(1)
    })

    // ── Child-collection drift detection (RFC 0001 / Issue C) ─────────────
    //
    // statusPageHandler.hasChildChanges compares yaml.components /
    // componentGroups against the **live API** child snapshots that the
    // differ pre-fetches via `prefetchChildSnapshots`. State is no longer
    // consulted as a diff baseline — the live API is the source of truth.
    //
    // In production, plan/deploy call `prefetchChildSnapshots(config, refs,
    // client)` and pass the result as the 5th `diff()` arg. Tests inject
    // the same `ChildSnapshotMap` directly to avoid spinning up an HTTP
    // mock; the snapshot shape mirrors `statusPageComponentCurrentSnapshot`
    // (name, description, type, showUptime, excludeFromOverall, startDate,
    // group, monitor, resourceGroup).

    function makeStatusPageRefs() {
      const refs = new ResolvedRefs()
      refs.set('statusPages', 'sp', {id: 'sp-1', refKey: 'sp', raw: {
        id: 'sp-1', name: 'P', slug: 'sp',
        branding: {},
        componentGroups: [],
        components: [],
      }})
      return refs
    }

    function makeChildren(snapshot: Record<string, unknown>): Map<string, Record<string, {apiId: string; snapshot: Record<string, unknown>}>> {
      return new Map([['statusPages.sp', {
        'components.API': {apiId: 'c-1', snapshot},
      }]])
    }

    const baseApiComponent = {
      name: 'API', description: null, type: 'STATIC', showUptime: true,
      excludeFromOverall: false, startDate: null, group: null,
      monitor: null, resourceGroup: null,
    }

    it('FIXED: component added in YAML is detected as page-level update', async () => {
      const refs = makeStatusPageRefs()
      const config: DevhelmConfig = {
        statusPages: [{
          name: 'P', slug: 'sp',
          components: [
            {name: 'API', type: 'STATIC'},
            {name: 'Database', type: 'STATIC'},
          ],
        }],
      }
      const currentChildren = makeChildren(baseApiComponent)
      const changeset = await diff(config, refs, {}, undefined, currentChildren)
      expect(changeset.updates).toHaveLength(1)
    })

    it('FIXED: component excludeFromOverall change is detected via live API snapshot', async () => {
      const refs = makeStatusPageRefs()
      const config: DevhelmConfig = {
        statusPages: [{
          name: 'P', slug: 'sp',
          components: [{name: 'API', type: 'STATIC', excludeFromOverall: true}],
        }],
      }
      const currentChildren = makeChildren({...baseApiComponent, excludeFromOverall: false})
      const changeset = await diff(config, refs, {}, undefined, currentChildren)
      expect(changeset.updates).toHaveLength(1)
    })

    it('FIXED: component startDate change is detected via live API snapshot', async () => {
      const refs = makeStatusPageRefs()
      const config: DevhelmConfig = {
        statusPages: [{
          name: 'P', slug: 'sp',
          components: [{name: 'API', type: 'STATIC', startDate: '2024-06-01'}],
        }],
      }
      const currentChildren = makeChildren({...baseApiComponent, startDate: '2024-01-01'})
      const changeset = await diff(config, refs, {}, undefined, currentChildren)
      expect(changeset.updates).toHaveLength(1)
    })

    it('child-collection diff: live API snapshot matches YAML → no spurious update', async () => {
      const refs = makeStatusPageRefs()
      const config: DevhelmConfig = {
        statusPages: [{
          name: 'P', slug: 'sp',
          components: [{name: 'API', type: 'STATIC'}],
        }],
      }
      const currentChildren = makeChildren(baseApiComponent)
      const changeset = await diff(config, refs, {}, undefined, currentChildren)
      expect(changeset.updates).toHaveLength(0)
    })

    it('status page appears in handles all resource types in create ordering', async () => {
      const config: DevhelmConfig = {
        statusPages: [{
          name: 'SP', slug: 'sp', branding: {}, components: [],
        }],
        monitors: [{name: 'M', type: 'HTTP', config: {url: 'https://x.com', method: 'GET'}}],
      }
      const changeset = await diff(config, emptyRefs())
      const types = changeset.creates.map((c) => c.resourceType)
      // Status pages reference monitors through components → monitors must be
      // created before status pages in the default ordering.
      expect(types.indexOf('monitor')).toBeLessThan(types.indexOf('statusPage'))
    })

    it('monitor regions order does not matter', async () => {
      const refs = new ResolvedRefs()
      refs.set('monitors', 'API', {id: 'mon-1', refKey: 'API', raw: {
        name: 'API', type: 'HTTP', regions: ['eu-west', 'us-east'],
        config: {url: 'https://api.com', method: 'GET'},
      }})
      const config: DevhelmConfig = {
        monitors: [{
          name: 'API', type: 'HTTP', regions: ['us-east', 'eu-west'],
          config: {url: 'https://api.com', method: 'GET'},
        }],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(0)
    })

    it('webhook events order does not matter', async () => {
      const refs = new ResolvedRefs()
      refs.set('webhooks', 'https://x.com', {id: 'wh-1', refKey: 'https://x.com', raw: {
        url: 'https://x.com', subscribedEvents: ['b', 'a'], enabled: true,
      }})
      const config: DevhelmConfig = {
        webhooks: [{url: 'https://x.com', subscribedEvents: ['a', 'b']}],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(0)
    })

    it('always updates alert channels (discriminated union config)', async () => {
      const refs = new ResolvedRefs()
      refs.set('alertChannels', 'slack-ops', {id: 'ch-1', refKey: 'slack-ops', raw: {
        id: 'ch-1', name: 'slack-ops', channelType: 'slack',
        displayConfig: {}, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
      }})
      const config: DevhelmConfig = {
        alertChannels: [{name: 'slack-ops', config: {channelType: 'slack', webhookUrl: 'https://hooks.slack.com/test'}}],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(1)
    })

    it('detects update when notification policy escalation changes', async () => {
      const refs = new ResolvedRefs()
      refs.set('alertChannels', 'ch', {id: 'ch-1', refKey: 'ch', raw: {name: 'ch'}})
      refs.set('notificationPolicies', 'critical', {id: 'np-1', refKey: 'critical', raw: {
        name: 'critical', enabled: true, priority: 0,
        escalation: {steps: [{channelIds: ['ch-old'], delayMinutes: 0}]},
      }})
      const config: DevhelmConfig = {
        notificationPolicies: [{name: 'critical', enabled: true, priority: 0, escalation: {steps: [{channels: ['ch']}]}}],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(1)
    })

    it('mixed: only changed resources appear as updates', async () => {
      const refs = new ResolvedRefs()
      refs.set('tags', 'unchanged', {id: 'tag-1', refKey: 'unchanged', raw: {name: 'unchanged', color: '#FF0000'}})
      refs.set('tags', 'changed', {id: 'tag-2', refKey: 'changed', raw: {name: 'changed', color: '#000000'}})
      refs.set('webhooks', 'https://same.com', {id: 'wh-1', refKey: 'https://same.com', raw: {
        url: 'https://same.com', subscribedEvents: ['a'], description: 'same', enabled: true,
      }})
      const config: DevhelmConfig = {
        tags: [
          {name: 'unchanged', color: '#FF0000'},
          {name: 'changed', color: '#00FF00'},
          {name: 'brand-new'},
        ],
        webhooks: [{url: 'https://same.com', subscribedEvents: ['a'], description: 'same'}],
      }
      const changeset = await diff(config, refs)
      expect(changeset.creates).toHaveLength(1)
      expect(changeset.creates[0].refKey).toBe('brand-new')
      expect(changeset.updates).toHaveLength(1)
      expect(changeset.updates[0].refKey).toBe('changed')
    })

    it('detects update when monitor enabled toggled', async () => {
      const refs = new ResolvedRefs()
      refs.set('monitors', 'M', {id: 'mon-1', refKey: 'M', raw: {
        name: 'M', type: 'HTTP', enabled: true,
        config: {url: 'https://x.com', method: 'GET'},
      }})
      const config: DevhelmConfig = {
        monitors: [{
          name: 'M', type: 'HTTP', enabled: false,
          config: {url: 'https://x.com', method: 'GET'},
        }],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(1)
    })

    it('detects update when environment variables change', async () => {
      const refs = new ResolvedRefs()
      refs.set('environments', 'prod', {id: 'env-1', refKey: 'prod', raw: {
        name: 'Prod', slug: 'prod', variables: {A: '1'},
      }})
      const config: DevhelmConfig = {
        environments: [{name: 'Prod', slug: 'prod', variables: {A: '1', B: '2'}}],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(1)
    })

    it('skips update when environment variables same', async () => {
      const refs = new ResolvedRefs()
      refs.set('environments', 'prod', {id: 'env-1', refKey: 'prod', raw: {
        name: 'Prod', slug: 'prod', variables: {A: '1', B: '2'},
      }})
      const config: DevhelmConfig = {
        environments: [{name: 'Prod', slug: 'prod', variables: {B: '2', A: '1'}}],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(0)
    })

    it('detects update when resource group health threshold changes', async () => {
      const refs = new ResolvedRefs()
      refs.set('resourceGroups', 'G', {id: 'rg-1', refKey: 'G', raw: {
        name: 'G', healthThresholdType: 'PERCENTAGE', healthThresholdValue: 80,
      }})
      const config: DevhelmConfig = {
        resourceGroups: [{name: 'G', healthThresholdType: 'PERCENTAGE', healthThresholdValue: 50}],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(1)
    })

    it('detects update when resource group suppressMemberAlerts changes', async () => {
      const refs = new ResolvedRefs()
      refs.set('resourceGroups', 'G', {id: 'rg-1', refKey: 'G', raw: {
        name: 'G', suppressMemberAlerts: false,
      }})
      const config: DevhelmConfig = {
        resourceGroups: [{name: 'G', suppressMemberAlerts: true}],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(1)
    })

    it('tag without color ignores API color (undefined not compared)', async () => {
      const refs = new ResolvedRefs()
      refs.set('tags', 'T', {id: 'tag-1', refKey: 'T', raw: {name: 'T', color: '#FF0000'}})
      const config: DevhelmConfig = {
        tags: [{name: 'T'}],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(0)
    })

    it('config key ordering does not trigger false update', async () => {
      const refs = new ResolvedRefs()
      refs.set('monitors', 'M', {id: 'mon-1', refKey: 'M', raw: {
        name: 'M', type: 'HTTP',
        config: {method: 'GET', url: 'https://api.com', headers: {a: '1', b: '2'}},
      }})
      const config: DevhelmConfig = {
        monitors: [{
          name: 'M', type: 'HTTP',
          config: {url: 'https://api.com', method: 'GET', headers: {b: '2', a: '1'}},
        }],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(0)
    })

    it('monitor without frequency set ignores API frequencySeconds', async () => {
      const refs = new ResolvedRefs()
      refs.set('monitors', 'M', {id: 'mon-1', refKey: 'M', raw: {
        name: 'M', type: 'HTTP', frequencySeconds: 60,
        config: {url: 'https://x.com', method: 'GET'},
      }})
      const config: DevhelmConfig = {
        monitors: [{name: 'M', type: 'HTTP', config: {url: 'https://x.com', method: 'GET'}}],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(0)
    })

    it('monitor without regions set ignores API regions', async () => {
      const refs = new ResolvedRefs()
      refs.set('monitors', 'M', {id: 'mon-1', refKey: 'M', raw: {
        name: 'M', type: 'HTTP', regions: ['us-east', 'eu-west'],
        config: {url: 'https://x.com', method: 'GET'},
      }})
      const config: DevhelmConfig = {
        monitors: [{name: 'M', type: 'HTTP', config: {url: 'https://x.com', method: 'GET'}}],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(0)
    })

    // ── Monitor tags: YAML uses names, API returns TagDto[] ──────────

    it('detects update when monitor tags change', async () => {
      const refs = new ResolvedRefs()
      refs.set('tags', 'a', {id: 'tag-a', refKey: 'a', raw: {id: 'tag-a', name: 'a'}})
      refs.set('monitors', 'M', {id: 'mon-1', refKey: 'M', raw: {
        name: 'M', type: 'HTTP',
        tags: [{id: 'tag-a', name: 'a'}],
        config: {url: 'https://x.com', method: 'GET'},
      }})
      const config: DevhelmConfig = {
        monitors: [{
          name: 'M', type: 'HTTP', tags: ['a', 'b'],
          config: {url: 'https://x.com', method: 'GET'},
        }],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(1)
    })

    it('skips update when monitor tags unchanged', async () => {
      const refs = new ResolvedRefs()
      refs.set('tags', 'a', {id: 'tag-a', refKey: 'a', raw: {id: 'tag-a', name: 'a'}})
      refs.set('tags', 'b', {id: 'tag-b', refKey: 'b', raw: {id: 'tag-b', name: 'b'}})
      refs.set('monitors', 'M', {id: 'mon-1', refKey: 'M', raw: {
        name: 'M', type: 'HTTP',
        tags: [{id: 'tag-a', name: 'a'}, {id: 'tag-b', name: 'b'}],
        config: {url: 'https://x.com', method: 'GET'},
      }})
      const config: DevhelmConfig = {
        monitors: [{
          name: 'M', type: 'HTTP', tags: ['b', 'a'],
          config: {url: 'https://x.com', method: 'GET'},
        }],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(0)
    })

    it('monitor without tags set ignores API tags', async () => {
      const refs = new ResolvedRefs()
      refs.set('monitors', 'M', {id: 'mon-1', refKey: 'M', raw: {
        name: 'M', type: 'HTTP',
        tags: [{id: 'tag-x', name: 'x'}],
        config: {url: 'https://x.com', method: 'GET'},
      }})
      const config: DevhelmConfig = {
        monitors: [{name: 'M', type: 'HTTP', config: {url: 'https://x.com', method: 'GET'}}],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(0)
    })

    // ── Monitor alertChannels: YAML names → API alertChannelIds (UUIDs) ──

    it('detects update when monitor alertChannels change', async () => {
      const refs = new ResolvedRefs()
      refs.set('alertChannels', 'ch1', {id: 'ch-uuid-1', refKey: 'ch1', raw: {id: 'ch-uuid-1', name: 'ch1'}})
      refs.set('monitors', 'M', {id: 'mon-1', refKey: 'M', raw: {
        name: 'M', type: 'HTTP', alertChannelIds: ['ch-uuid-1'],
        config: {url: 'https://x.com', method: 'GET'},
      }})
      const config: DevhelmConfig = {
        monitors: [{
          name: 'M', type: 'HTTP', alertChannels: ['ch1', 'ch2'],
          config: {url: 'https://x.com', method: 'GET'},
        }],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(1)
    })

    it('skips update when monitor alertChannels unchanged', async () => {
      const refs = new ResolvedRefs()
      refs.set('alertChannels', 'ch1', {id: 'ch-uuid-1', refKey: 'ch1', raw: {}})
      refs.set('alertChannels', 'ch2', {id: 'ch-uuid-2', refKey: 'ch2', raw: {}})
      refs.set('monitors', 'M', {id: 'mon-1', refKey: 'M', raw: {
        name: 'M', type: 'HTTP', alertChannelIds: ['ch-uuid-1', 'ch-uuid-2'],
        config: {url: 'https://x.com', method: 'GET'},
      }})
      const config: DevhelmConfig = {
        monitors: [{
          name: 'M', type: 'HTTP', alertChannels: ['ch2', 'ch1'],
          config: {url: 'https://x.com', method: 'GET'},
        }],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(0)
    })

    // ── Monitor environment: YAML slug → API Summary { id, name, slug } ──

    it('detects update when monitor environment changes', async () => {
      const refs = new ResolvedRefs()
      refs.set('environments', 'prod', {id: 'env-prod', refKey: 'prod', raw: {}})
      refs.set('environments', 'staging', {id: 'env-stg', refKey: 'staging', raw: {}})
      refs.set('monitors', 'M', {id: 'mon-1', refKey: 'M', raw: {
        name: 'M', type: 'HTTP',
        environment: {id: 'env-prod', name: 'Production', slug: 'prod'},
        config: {url: 'https://x.com', method: 'GET'},
      }})
      const config: DevhelmConfig = {
        monitors: [{
          name: 'M', type: 'HTTP', environment: 'staging',
          config: {url: 'https://x.com', method: 'GET'},
        }],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(1)
    })

    it('skips update when monitor environment unchanged', async () => {
      const refs = new ResolvedRefs()
      refs.set('environments', 'prod', {id: 'env-prod', refKey: 'prod', raw: {}})
      refs.set('monitors', 'M', {id: 'mon-1', refKey: 'M', raw: {
        name: 'M', type: 'HTTP',
        environment: {id: 'env-prod', name: 'Production', slug: 'prod'},
        config: {url: 'https://x.com', method: 'GET'},
      }})
      const config: DevhelmConfig = {
        monitors: [{
          name: 'M', type: 'HTTP', environment: 'prod',
          config: {url: 'https://x.com', method: 'GET'},
        }],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(0)
    })

    // ── Monitor auth: YAML uses secret name, API uses MonitorAuthDto ──

    it('detects update when monitor auth type changes', async () => {
      const refs = new ResolvedRefs()
      refs.set('secrets', 'creds', {id: 'sec-1', refKey: 'creds', raw: {}})
      refs.set('monitors', 'M', {id: 'mon-1', refKey: 'M', raw: {
        name: 'M', type: 'HTTP',
        auth: {type: 'bearer', vaultSecretId: 'sec-1'},
        config: {url: 'https://x.com', method: 'GET'},
      }})
      const config: DevhelmConfig = {
        monitors: [{
          name: 'M', type: 'HTTP',
          auth: {type: 'basic', secret: 'creds'},
          config: {url: 'https://x.com', method: 'GET'},
        }],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(1)
    })

    it('skips update when monitor auth unchanged', async () => {
      const refs = new ResolvedRefs()
      refs.set('secrets', 'token', {id: 'sec-1', refKey: 'token', raw: {}})
      refs.set('monitors', 'M', {id: 'mon-1', refKey: 'M', raw: {
        name: 'M', type: 'HTTP',
        auth: {type: 'bearer', vaultSecretId: 'sec-1'},
        config: {url: 'https://x.com', method: 'GET'},
      }})
      const config: DevhelmConfig = {
        monitors: [{
          name: 'M', type: 'HTTP',
          auth: {type: 'bearer', secret: 'token'},
          config: {url: 'https://x.com', method: 'GET'},
        }],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(0)
    })

    // ── Monitor incidentPolicy ──────────────────────────────────────

    it('detects update when monitor incidentPolicy changes', async () => {
      const apiPolicy = {
        triggerRules: [{
          type: 'consecutive_failures', count: 2, scope: 'per_region', severity: 'down',
        }],
        confirmation: {type: 'multi_region', minRegionsFailing: 1},
        recovery: {consecutiveSuccesses: 2},
      }
      const yamlPolicy = {
        triggerRules: [{
          type: 'consecutive_failures' as const, count: 3, scope: 'per_region' as const, severity: 'down' as const,
        }],
        confirmation: {type: 'multi_region' as const, minRegionsFailing: 1},
        recovery: {consecutiveSuccesses: 2},
      }
      const refs = new ResolvedRefs()
      refs.set('monitors', 'M', {id: 'mon-1', refKey: 'M', raw: {
        name: 'M', type: 'HTTP',
        incidentPolicy: {id: 'ip-1', monitorId: 'mon-1', ...apiPolicy},
        config: {url: 'https://x.com', method: 'GET'},
      }})
      const config: DevhelmConfig = {
        monitors: [{
          name: 'M', type: 'HTTP', incidentPolicy: yamlPolicy,
          config: {url: 'https://x.com', method: 'GET'},
        }],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(1)
    })

    // ── Resource group: YAML names → API UUIDs ─────────────────────

    it('detects update when resource group alertPolicy changes', async () => {
      const refs = new ResolvedRefs()
      refs.set('notificationPolicies', 'old', {id: 'np-old-uuid', refKey: 'old', raw: {}})
      refs.set('notificationPolicies', 'new', {id: 'np-new-uuid', refKey: 'new', raw: {}})
      refs.set('resourceGroups', 'G', {id: 'rg-1', refKey: 'G', raw: {
        name: 'G', alertPolicyId: 'np-old-uuid',
      }})
      const config: DevhelmConfig = {
        resourceGroups: [{name: 'G', alertPolicy: 'new'}],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(1)
    })

    it('detects update when resource group defaultRegions change', async () => {
      const refs = new ResolvedRefs()
      refs.set('resourceGroups', 'G', {id: 'rg-1', refKey: 'G', raw: {
        name: 'G', defaultRegions: ['us-east'],
      }})
      const config: DevhelmConfig = {
        resourceGroups: [{name: 'G', defaultRegions: ['us-east', 'eu-west']}],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(1)
    })

    it('detects update when resource group defaultRetryStrategy changes', async () => {
      const refs = new ResolvedRefs()
      refs.set('resourceGroups', 'G', {id: 'rg-1', refKey: 'G', raw: {
        name: 'G', defaultRetryStrategy: {type: 'fixed', maxRetries: 2, interval: 5},
      }})
      const config: DevhelmConfig = {
        resourceGroups: [{name: 'G', defaultRetryStrategy: {type: 'fixed', maxRetries: 3, interval: 5}}],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(1)
    })

    it('detects update when resource group confirmationDelaySeconds changes', async () => {
      const refs = new ResolvedRefs()
      refs.set('resourceGroups', 'G', {id: 'rg-1', refKey: 'G', raw: {
        name: 'G', confirmationDelaySeconds: 30,
      }})
      const config: DevhelmConfig = {
        resourceGroups: [{name: 'G', confirmationDelaySeconds: 60}],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(1)
    })

    it('detects update when resource group recoveryCooldownMinutes changes', async () => {
      const refs = new ResolvedRefs()
      refs.set('resourceGroups', 'G', {id: 'rg-1', refKey: 'G', raw: {
        name: 'G', recoveryCooldownMinutes: 10,
      }})
      const config: DevhelmConfig = {
        resourceGroups: [{name: 'G', recoveryCooldownMinutes: 20}],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(1)
    })

    it('skips update when all resource group fields match (with resolved refs)', async () => {
      const refs = new ResolvedRefs()
      refs.set('notificationPolicies', 'critical', {id: 'np-uuid-1', refKey: 'critical', raw: {}})
      refs.set('alertChannels', 'ch1', {id: 'ch-uuid-1', refKey: 'ch1', raw: {}})
      refs.set('alertChannels', 'ch2', {id: 'ch-uuid-2', refKey: 'ch2', raw: {}})
      refs.set('environments', 'prod', {id: 'env-uuid-1', refKey: 'prod', raw: {}})
      refs.set('resourceGroups', 'G', {id: 'rg-1', refKey: 'G', raw: {
        name: 'G',
        description: 'desc',
        alertPolicyId: 'np-uuid-1',
        defaultFrequency: 30,
        defaultRegions: ['us-east', 'eu-west'],
        defaultRetryStrategy: {type: 'fixed', maxRetries: 3, interval: 10},
        defaultAlertChannels: ['ch-uuid-1', 'ch-uuid-2'],
        defaultEnvironmentId: 'env-uuid-1',
        confirmationDelaySeconds: 60,
        recoveryCooldownMinutes: 120,
        healthThresholdType: 'PERCENTAGE',
        healthThresholdValue: 80,
        suppressMemberAlerts: true,
      }})
      const config: DevhelmConfig = {
        resourceGroups: [{
          name: 'G',
          description: 'desc',
          alertPolicy: 'critical',
          defaultFrequency: 30,
          defaultRegions: ['eu-west', 'us-east'],
          defaultRetryStrategy: {type: 'fixed', maxRetries: 3, interval: 10},
          defaultAlertChannels: ['ch2', 'ch1'],
          defaultEnvironment: 'prod',
          confirmationDelaySeconds: 60,
          recoveryCooldownMinutes: 120,
          healthThresholdType: 'PERCENTAGE',
          healthThresholdValue: 80,
          suppressMemberAlerts: true,
        }],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(0)
    })

    it('detects update when webhook API has no subscribedEvents but YAML has events', async () => {
      const refs = new ResolvedRefs()
      refs.set('webhooks', 'https://hooks.com/nonevents', {id: 'wh-1', refKey: 'https://hooks.com/nonevents', raw: {
        url: 'https://hooks.com/nonevents',
      }})
      const config: DevhelmConfig = {
        webhooks: [{url: 'https://hooks.com/nonevents', subscribedEvents: ['e']}],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(1)
    })

    it('dependency without alertSensitivity is unchanged', async () => {
      const refs = new ResolvedRefs()
      refs.set('dependencies', 'gh', {id: 'dep-1', refKey: 'gh', raw: {
        slug: 'gh', alertSensitivity: 'ALL',
      }})
      const config: DevhelmConfig = {
        dependencies: [{service: 'gh'}],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(0)
    })

    // ── Dependency component: YAML uses componentId UUID, API has componentId ──

    it('detects update when dependency component changes', async () => {
      const refs = new ResolvedRefs()
      refs.set('dependencies', 'gh', {id: 'dep-1', refKey: 'gh', raw: {
        slug: 'gh', componentId: 'comp-api',
      }})
      const config: DevhelmConfig = {
        dependencies: [{service: 'gh', component: 'comp-actions'}],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(1)
    })

    it('skips update when dependency component unchanged', async () => {
      const refs = new ResolvedRefs()
      refs.set('dependencies', 'gh', {id: 'dep-1', refKey: 'gh', raw: {
        slug: 'gh', componentId: 'comp-api', alertSensitivity: 'ALL',
      }})
      const config: DevhelmConfig = {
        dependencies: [{service: 'gh', component: 'comp-api', alertSensitivity: 'ALL'}],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(0)
    })

    it('dependency without component set ignores API componentId', async () => {
      const refs = new ResolvedRefs()
      refs.set('dependencies', 'gh', {id: 'dep-1', refKey: 'gh', raw: {
        slug: 'gh', componentId: 'comp-actions',
      }})
      const config: DevhelmConfig = {
        dependencies: [{service: 'gh'}],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(0)
    })

    // ── attributeDiffs population ────────────────────────────────────

    it('populates attributeDiffs on updates (tag color change)', async () => {
      const refs = new ResolvedRefs()
      refs.set('tags', 'production', {id: 'tag-1', refKey: 'production', raw: {name: 'production', color: '#000000'}})
      const config: DevhelmConfig = {
        tags: [{name: 'production', color: '#EF4444'}],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(1)
      const update = changeset.updates[0]
      expect(update.attributeDiffs).toBeDefined()
      expect(update.attributeDiffs!.length).toBeGreaterThan(0)
      const colorDiff = update.attributeDiffs!.find((d) => d.field === 'color')
      expect(colorDiff).toMatchObject({field: 'color', old: '#000000', new: '#EF4444'})
    })

    it('populates attributeDiffs on updates (monitor frequency)', async () => {
      const refs = new ResolvedRefs()
      refs.set('monitors', 'API', {id: 'mon-1', refKey: 'API', raw: {
        name: 'API', type: 'HTTP', frequencySeconds: 60,
        config: {url: 'https://api.com', method: 'GET'},
      }})
      const config: DevhelmConfig = {
        monitors: [{
          name: 'API', type: 'HTTP', frequencySeconds: 30,
          config: {url: 'https://api.com', method: 'GET'},
        }],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(1)
      const update = changeset.updates[0]
      expect(update.attributeDiffs).toBeDefined()
      const freqDiff = update.attributeDiffs!.find((d) => d.field === 'frequencySeconds')
      expect(freqDiff).toBeDefined()
      expect(freqDiff!.old).toBe(60)
      expect(freqDiff!.new).toBe(30)
    })

    it('attributeDiffs is absent or empty for creates', async () => {
      const config: DevhelmConfig = {
        tags: [{name: 'new', color: '#FF0000'}],
      }
      const changeset = await diff(config, emptyRefs())
      expect(changeset.creates).toHaveLength(1)
      // Creates should not carry attributeDiffs (no "old" state to diff against)
      const create = changeset.creates[0] as unknown as {attributeDiffs?: unknown[]}
      if (create.attributeDiffs !== undefined) {
        expect(create.attributeDiffs).toHaveLength(0)
      }
    })

    it('attributeDiffs is present but only for fields that changed', async () => {
      const refs = new ResolvedRefs()
      refs.set('monitors', 'M', {id: 'mon-1', refKey: 'M', raw: {
        name: 'M', type: 'HTTP', enabled: true, frequencySeconds: 60,
        regions: ['us-east'],
        config: {url: 'https://api.com', method: 'GET'},
      }})
      const config: DevhelmConfig = {
        monitors: [{
          name: 'M', type: 'HTTP', enabled: true, frequencySeconds: 60,
          regions: ['us-east', 'eu-west'],
          config: {url: 'https://api.com', method: 'GET'},
        }],
      }
      const changeset = await diff(config, refs)
      expect(changeset.updates).toHaveLength(1)
      const diffs = changeset.updates[0].attributeDiffs ?? []
      const changedFields = diffs.map((d) => d.field)
      expect(changedFields).toContain('regions')
      expect(changedFields).not.toContain('name')
      expect(changedFields).not.toContain('frequencySeconds')
      expect(changedFields).not.toContain('enabled')
    })
  })

  describe('formatPlan', () => {
    it('shows no changes message', async () => {
      const result = formatPlan({creates: [], updates: [], deletes: [], memberships: []})
      expect(result).toContain('No changes')
    })

    it('shows create/update/delete counts', async () => {
      const changeset = {
        creates: [{action: 'create' as const, resourceType: 'monitor' as const, refKey: 'M'}],
        updates: [{action: 'update' as const, resourceType: 'tag' as const, refKey: 'T', existingId: '1'}],
        deletes: [{action: 'delete' as const, resourceType: 'tag' as const, refKey: 'X', existingId: '2'}],
        memberships: [],
      }
      const result = formatPlan(changeset)
      expect(result).toContain('1 to add')
      expect(result).toContain('1 to change')
      expect(result).toContain('1 to destroy')
      expect(result).toContain('+ monitor "M"')
      expect(result).toContain('~ tag "T"')
      expect(result).toContain('- tag "X"')
    })

    it('shows memberships', async () => {
      const changeset = {
        creates: [],
        updates: [],
        deletes: [],
        memberships: [{action: 'create' as const, resourceType: 'groupMembership' as const, refKey: 'API → Health Check'}],
      }
      const result = formatPlan(changeset)
      expect(result).toContain('→ API → Health Check')
    })

    it('creates-only plan snapshot', async () => {
      const changeset = {
        creates: [
          {action: 'create' as const, resourceType: 'tag' as const, refKey: 'prod'},
          {action: 'create' as const, resourceType: 'monitor' as const, refKey: 'API Health'},
        ],
        updates: [], deletes: [], memberships: [],
      }
      const result = formatPlan(changeset)
      expect(result).toContain('+ tag "prod"')
      expect(result).toContain('+ monitor "API Health"')
      expect(result).toContain('2 to add, 0 to change, 0 to destroy')
    })

    it('deletes-only plan snapshot', async () => {
      const changeset = {
        creates: [],
        updates: [],
        deletes: [
          {action: 'delete' as const, resourceType: 'monitor' as const, refKey: 'Old', existingId: 'm-1'},
          {action: 'delete' as const, resourceType: 'tag' as const, refKey: 'Unused', existingId: 't-1'},
        ],
        memberships: [],
      }
      const result = formatPlan(changeset)
      expect(result).toContain('- monitor "Old"')
      expect(result).toContain('- tag "Unused"')
      expect(result).toContain('0 to add, 0 to change, 2 to destroy')
    })

    it('mixed plan snapshot', async () => {
      const changeset = {
        creates: [{action: 'create' as const, resourceType: 'tag' as const, refKey: 'new-tag'}],
        updates: [{action: 'update' as const, resourceType: 'monitor' as const, refKey: 'API', existingId: 'm-1'}],
        deletes: [{action: 'delete' as const, resourceType: 'secret' as const, refKey: 'old-key', existingId: 's-1'}],
        memberships: [{action: 'create' as const, resourceType: 'groupMembership' as const, refKey: 'G → API'}],
      }
      const result = formatPlan(changeset)
      expect(result).toContain('+ tag "new-tag"')
      expect(result).toContain('~ monitor "API"')
      expect(result).toContain('- secret "old-key"')
      expect(result).toContain('→ G → API')
      expect(result).toContain('1 to add, 1 to change, 1 to destroy')
    })

    it('shows attribute diffs for updates', async () => {
      const changeset = {
        creates: [],
        updates: [{
          action: 'update' as const, resourceType: 'monitor' as const, refKey: 'API', existingId: 'm-1',
          attributeDiffs: [
            {field: 'name', old: 'API', new: 'Core API'},
            {field: 'frequencySeconds', old: 60, new: 30},
          ],
        }],
        deletes: [],
        memberships: [],
      }
      const result = formatPlan(changeset)
      expect(result).toContain('~ monitor "API"')
      expect(result).toContain('name: "API" → "Core API"')
      expect(result).toContain('frequencySeconds: 60 → 30')
    })

    it('groups destroys by prune scope when scopes differ (P0.Bug1)', async () => {
      const changeset = {
        creates: [], updates: [], memberships: [],
        deletes: [
          {action: 'delete' as const, resourceType: 'monitor' as const, refKey: 'mine', existingId: 'm-1', pruneScope: 'state' as const},
          {action: 'delete' as const, resourceType: 'monitor' as const, refKey: 'theirs', existingId: 'm-2', pruneScope: 'org-cli' as const},
        ],
      }
      const result = formatPlan(changeset)
      expect(result).toContain('Tracked by this config:')
      expect(result).toContain('Other CLI-managed resources:')
      expect(result).toContain('- monitor "mine"')
      expect(result).toContain('- monitor "theirs"')
    })

    it('omits destroy headers when every delete shares one scope', async () => {
      const changeset = {
        creates: [], updates: [], memberships: [],
        deletes: [
          {action: 'delete' as const, resourceType: 'monitor' as const, refKey: 'mine', existingId: 'm-1', pruneScope: 'state' as const},
        ],
      }
      const result = formatPlan(changeset)
      expect(result).not.toContain('Tracked by this config:')
      expect(result).toContain('- monitor "mine"')
    })
  })
})
