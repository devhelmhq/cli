import {describe, it, expect, vi, beforeEach} from 'vitest'
import {apply} from '../../src/lib/yaml/applier.js'
import {ResolvedRefs} from '../../src/lib/yaml/resolver.js'
import type {Changeset, Change} from '../../src/lib/yaml/differ.js'

vi.mock('../../src/lib/typed-api.js', () => ({
  typedGet: vi.fn(),
  typedPost: vi.fn(),
  typedPut: vi.fn(),
  typedPatch: vi.fn(),
  typedDelete: vi.fn(),
  fetchPaginated: vi.fn(),
}))

import {typedPost, typedPut, typedPatch, typedDelete} from '../../src/lib/typed-api.js'
const mockPost = vi.mocked(typedPost)
const mockPut = vi.mocked(typedPut)
const mockPatch = vi.mocked(typedPatch)
const mockDelete = vi.mocked(typedDelete)

function emptyChangeset(): Changeset {
  return {creates: [], updates: [], deletes: [], memberships: []}
}

function emptyRefs(): ResolvedRefs {
  return new ResolvedRefs()
}

const fakeClient = {} as Parameters<typeof apply>[2]

describe('applier', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('creates', () => {
    it('creates a tag', async () => {
      mockPost.mockResolvedValueOnce({data: {id: 'tag-new'}})
      const changeset: Changeset = {
        ...emptyChangeset(),
        creates: [{action: 'create', resourceType: 'tag', refKey: 'prod', desired: {name: 'prod', color: '#FF0000'}}],
      }
      const result = await apply(changeset, emptyRefs(), fakeClient)
      expect(result.succeeded).toHaveLength(1)
      expect(result.succeeded[0].id).toBe('tag-new')
      expect(result.failed).toHaveLength(0)
      expect(mockPost).toHaveBeenCalledWith(fakeClient, '/api/v1/tags', {name: 'prod', color: '#FF0000'})
    })

    it('creates an environment', async () => {
      mockPost.mockResolvedValueOnce({data: {id: 'env-new'}})
      const changeset: Changeset = {
        ...emptyChangeset(),
        creates: [{action: 'create', resourceType: 'environment', refKey: 'staging', desired: {name: 'Staging', slug: 'staging'}}],
      }
      const result = await apply(changeset, emptyRefs(), fakeClient)
      expect(result.succeeded).toHaveLength(1)
      expect(mockPost).toHaveBeenCalledWith(fakeClient, '/api/v1/environments', expect.objectContaining({name: 'Staging', slug: 'staging'}))
    })

    it('creates a secret', async () => {
      mockPost.mockResolvedValueOnce({data: {id: 'sec-new'}})
      const changeset: Changeset = {
        ...emptyChangeset(),
        creates: [{action: 'create', resourceType: 'secret', refKey: 'api-key', desired: {key: 'api-key', value: 'secret123'}}],
      }
      const result = await apply(changeset, emptyRefs(), fakeClient)
      expect(result.succeeded).toHaveLength(1)
      expect(mockPost).toHaveBeenCalledWith(fakeClient, '/api/v1/secrets', {key: 'api-key', value: 'secret123'})
    })

    it('creates an alert channel', async () => {
      mockPost.mockResolvedValueOnce({data: {id: 'ch-new'}})
      const changeset: Changeset = {
        ...emptyChangeset(),
        creates: [{action: 'create', resourceType: 'alertChannel', refKey: 'slack', desired: {name: 'slack', type: 'slack', config: {webhookUrl: 'url'}}}],
      }
      const result = await apply(changeset, emptyRefs(), fakeClient)
      expect(result.succeeded).toHaveLength(1)
      expect(mockPost).toHaveBeenCalledWith(fakeClient, '/api/v1/alert-channels', expect.objectContaining({name: 'slack'}))
    })

    it('creates a monitor', async () => {
      mockPost.mockResolvedValueOnce({data: {id: 'mon-new'}})
      const changeset: Changeset = {
        ...emptyChangeset(),
        creates: [{action: 'create', resourceType: 'monitor', refKey: 'API', desired: {
          name: 'API', type: 'HTTP', config: {url: 'https://x.com', method: 'GET'},
        }}],
      }
      const result = await apply(changeset, emptyRefs(), fakeClient)
      expect(result.succeeded).toHaveLength(1)
      expect(result.succeeded[0].id).toBe('mon-new')
      expect(result.stateEntries).toHaveLength(1)
      expect(result.stateEntries[0].resourceType).toBe('monitor')
      expect(result.stateEntries[0].id).toBe('mon-new')
    })

    it('injects ref after create for downstream resolution', async () => {
      mockPost.mockResolvedValueOnce({data: {id: 'tag-99'}})
      const refs = emptyRefs()
      const changeset: Changeset = {
        ...emptyChangeset(),
        creates: [{action: 'create', resourceType: 'tag', refKey: 'new-tag', desired: {name: 'new-tag'}}],
      }
      await apply(changeset, refs, fakeClient)
      expect(refs.resolve('tags', 'new-tag')).toBe('tag-99')
    })

    it('creates a notification policy with channel refs resolved in escalation', async () => {
      mockPost.mockResolvedValueOnce({data: {id: 'np-new'}})
      const refs = emptyRefs()
      refs.set('alertChannels', 'slack', {id: 'ch-1', refKey: 'slack', raw: {}})
      const changeset: Changeset = {
        ...emptyChangeset(),
        creates: [{
          action: 'create', resourceType: 'notificationPolicy', refKey: 'default',
          desired: {
            name: 'default',
            escalation: {steps: [{channels: ['slack'], delayMinutes: 0}]},
          },
        }],
      }
      const result = await apply(changeset, refs, fakeClient)
      expect(result.succeeded).toHaveLength(1)
      expect(mockPost).toHaveBeenCalledWith(
        fakeClient,
        '/api/v1/notification-policies',
        expect.objectContaining({
          name: 'default',
          escalation: expect.objectContaining({
            steps: [expect.objectContaining({channelIds: ['ch-1']})],
          }),
        }),
      )
    })

    it('creates a webhook', async () => {
      mockPost.mockResolvedValueOnce({data: {id: 'wh-new'}})
      const changeset: Changeset = {
        ...emptyChangeset(),
        creates: [{
          action: 'create', resourceType: 'webhook', refKey: 'hook1',
          desired: {url: 'https://hook.com', events: ['monitor.down']},
        }],
      }
      const result = await apply(changeset, emptyRefs(), fakeClient)
      expect(result.succeeded).toHaveLength(1)
      expect(mockPost).toHaveBeenCalledWith(fakeClient, '/api/v1/webhooks', {
        url: 'https://hook.com',
        subscribedEvents: ['monitor.down'],
        description: undefined,
      })
    })

    it('creates a resource group', async () => {
      mockPost.mockResolvedValueOnce({data: {id: 'rg-new'}})
      const changeset: Changeset = {
        ...emptyChangeset(),
        creates: [{action: 'create', resourceType: 'resourceGroup', refKey: 'API', desired: {name: 'API Group'}}],
      }
      const result = await apply(changeset, emptyRefs(), fakeClient)
      expect(result.succeeded).toHaveLength(1)
      expect(mockPost).toHaveBeenCalledWith(
        fakeClient,
        '/api/v1/resource-groups',
        expect.objectContaining({name: 'API Group'}),
      )
    })

    it('creates a dependency (service subscription)', async () => {
      mockPost.mockResolvedValueOnce({data: {subscriptionId: 'sub-gh'}})
      const changeset: Changeset = {
        ...emptyChangeset(),
        creates: [{
          action: 'create', resourceType: 'dependency', refKey: 'github',
          desired: {service: 'github', alertSensitivity: 'ALL'},
        }],
      }
      const result = await apply(changeset, emptyRefs(), fakeClient)
      expect(result.succeeded).toHaveLength(1)
      expect(mockPost).toHaveBeenCalledWith(fakeClient, '/api/v1/service-subscriptions/github', {
        alertSensitivity: 'ALL',
        componentId: null,
      })
    })
  })

  describe('updates', () => {
    it('updates a tag via PUT', async () => {
      mockPut.mockResolvedValueOnce(undefined)
      const changeset: Changeset = {
        ...emptyChangeset(),
        updates: [{
          action: 'update', resourceType: 'tag', refKey: 'prod', existingId: 'tag-1',
          desired: {name: 'prod', color: '#00FF00'}, current: {},
        }],
      }
      const result = await apply(changeset, emptyRefs(), fakeClient)
      expect(result.succeeded).toHaveLength(1)
      expect(mockPut).toHaveBeenCalledWith(fakeClient, '/api/v1/tags/tag-1', {name: 'prod', color: '#00FF00'})
    })

    it('updates a monitor via PUT', async () => {
      mockPut.mockResolvedValueOnce(undefined)
      const changeset: Changeset = {
        ...emptyChangeset(),
        updates: [{
          action: 'update', resourceType: 'monitor', refKey: 'API', existingId: 'mon-1',
          desired: {name: 'API', type: 'HTTP', config: {url: 'https://x.com', method: 'GET'}, frequency: 30},
          current: {},
        }],
      }
      const result = await apply(changeset, emptyRefs(), fakeClient)
      expect(result.succeeded).toHaveLength(1)
      expect(result.stateEntries).toHaveLength(1)
      expect(result.stateEntries[0].id).toBe('mon-1')
    })

    it('updates a dependency via PATCH', async () => {
      mockPatch.mockResolvedValueOnce(undefined)
      const changeset: Changeset = {
        ...emptyChangeset(),
        updates: [{
          action: 'update', resourceType: 'dependency', refKey: 'github', existingId: 'dep-1',
          desired: {service: 'github', alertSensitivity: 'ALL'}, current: {},
        }],
      }
      const result = await apply(changeset, emptyRefs(), fakeClient)
      expect(result.succeeded).toHaveLength(1)
      expect(mockPatch).toHaveBeenCalledWith(
        fakeClient, '/api/v1/service-subscriptions/dep-1/alert-sensitivity',
        {alertSensitivity: 'ALL'},
      )
    })

    it('updates an environment via PUT using environment id in path', async () => {
      mockPut.mockResolvedValueOnce(undefined)
      const changeset: Changeset = {
        ...emptyChangeset(),
        updates: [{
          action: 'update', resourceType: 'environment', refKey: 'prod', existingId: 'env-42',
          desired: {name: 'Prod', slug: 'prod', variables: {KEY: 'val'}}, current: {},
        }],
      }
      const result = await apply(changeset, emptyRefs(), fakeClient)
      expect(result.succeeded).toHaveLength(1)
      expect(mockPut).toHaveBeenCalledWith(fakeClient, '/api/v1/environments/env-42', {
        name: 'Prod',
        variables: {KEY: 'val'},
        isDefault: undefined,
      })
    })

    it('updates a secret via PUT keyed by secret key', async () => {
      mockPut.mockResolvedValueOnce(undefined)
      const changeset: Changeset = {
        ...emptyChangeset(),
        updates: [{
          action: 'update', resourceType: 'secret', refKey: 'k', existingId: 'sec-1',
          desired: {key: 'k', value: 'newval'}, current: {},
        }],
      }
      const result = await apply(changeset, emptyRefs(), fakeClient)
      expect(result.succeeded).toHaveLength(1)
      expect(mockPut).toHaveBeenCalledWith(fakeClient, '/api/v1/secrets/k', {value: 'newval'})
    })

    it('updates an alert channel via PUT', async () => {
      mockPut.mockResolvedValueOnce(undefined)
      const changeset: Changeset = {
        ...emptyChangeset(),
        updates: [{
          action: 'update', resourceType: 'alertChannel', refKey: 'slack', existingId: 'ch-1',
          desired: {name: 'slack', type: 'slack', config: {webhookUrl: 'url'}}, current: {},
        }],
      }
      const result = await apply(changeset, emptyRefs(), fakeClient)
      expect(result.succeeded).toHaveLength(1)
      expect(mockPut).toHaveBeenCalledWith(
        fakeClient,
        '/api/v1/alert-channels/ch-1',
        expect.objectContaining({
          name: 'slack',
          config: expect.objectContaining({channelType: 'SlackChannelConfig', webhookUrl: 'url'}),
        }),
      )
    })

    it('updates a notification policy via PUT', async () => {
      mockPut.mockResolvedValueOnce(undefined)
      const refs = emptyRefs()
      refs.set('alertChannels', 'slack', {id: 'ch-1', refKey: 'slack', raw: {}})
      const changeset: Changeset = {
        ...emptyChangeset(),
        updates: [{
          action: 'update', resourceType: 'notificationPolicy', refKey: 'pol', existingId: 'np-1',
          desired: {
            name: 'pol',
            escalation: {steps: [{channels: ['slack']}]},
          },
          current: {},
        }],
      }
      const result = await apply(changeset, refs, fakeClient)
      expect(result.succeeded).toHaveLength(1)
      expect(mockPut).toHaveBeenCalledWith(
        fakeClient,
        '/api/v1/notification-policies/np-1',
        expect.objectContaining({
          name: 'pol',
          escalation: expect.objectContaining({
            steps: [expect.objectContaining({channelIds: ['ch-1']})],
          }),
        }),
      )
    })

    it('updates a webhook via PUT', async () => {
      mockPut.mockResolvedValueOnce(undefined)
      const changeset: Changeset = {
        ...emptyChangeset(),
        updates: [{
          action: 'update', resourceType: 'webhook', refKey: 'w', existingId: 'wh-1',
          desired: {url: 'https://hook.com', events: ['monitor.up']}, current: {},
        }],
      }
      const result = await apply(changeset, emptyRefs(), fakeClient)
      expect(result.succeeded).toHaveLength(1)
      expect(mockPut).toHaveBeenCalledWith(fakeClient, '/api/v1/webhooks/wh-1', {
        url: 'https://hook.com',
        subscribedEvents: ['monitor.up'],
        description: undefined,
      })
    })

    it('updates a resource group via PUT', async () => {
      mockPut.mockResolvedValueOnce(undefined)
      const changeset: Changeset = {
        ...emptyChangeset(),
        updates: [{
          action: 'update', resourceType: 'resourceGroup', refKey: 'G', existingId: 'rg-9',
          desired: {name: 'Renamed'}, current: {},
        }],
      }
      const result = await apply(changeset, emptyRefs(), fakeClient)
      expect(result.succeeded).toHaveLength(1)
      expect(mockPut).toHaveBeenCalledWith(
        fakeClient,
        '/api/v1/resource-groups/rg-9',
        expect.objectContaining({name: 'Renamed'}),
      )
    })

    it('updates dependency component via PATCH to subscription', async () => {
      mockPatch.mockResolvedValueOnce(undefined)
      const changeset: Changeset = {
        ...emptyChangeset(),
        updates: [{
          action: 'update', resourceType: 'dependency', refKey: 'gh', existingId: 'dep-2',
          desired: {service: 'gh', component: 'api'}, current: {},
        }],
      }
      const result = await apply(changeset, emptyRefs(), fakeClient)
      expect(result.succeeded).toHaveLength(1)
      expect(mockPatch).toHaveBeenCalledTimes(1)
      expect(mockPatch).toHaveBeenCalledWith(fakeClient, '/api/v1/service-subscriptions/dep-2', {
        componentId: 'api',
      })
    })

    it('does not PATCH alert-sensitivity when dependency update omits alertSensitivity', async () => {
      const changeset: Changeset = {
        ...emptyChangeset(),
        updates: [{
          action: 'update', resourceType: 'dependency', refKey: 'gh', existingId: 'dep-3',
          desired: {service: 'gh'}, current: {},
        }],
      }
      const result = await apply(changeset, emptyRefs(), fakeClient)
      expect(result.succeeded).toHaveLength(1)
      expect(mockPatch).not.toHaveBeenCalled()
    })
  })

  describe('deletes', () => {
    it('deletes a tag', async () => {
      mockDelete.mockResolvedValueOnce(undefined)
      const changeset: Changeset = {
        ...emptyChangeset(),
        deletes: [{action: 'delete', resourceType: 'tag', refKey: 'old', existingId: 'tag-1', current: {}}],
      }
      const result = await apply(changeset, emptyRefs(), fakeClient)
      expect(result.succeeded).toHaveLength(1)
      expect(mockDelete).toHaveBeenCalledWith(fakeClient, '/api/v1/tags/tag-1')
    })

    it('deletes a monitor', async () => {
      mockDelete.mockResolvedValueOnce(undefined)
      const changeset: Changeset = {
        ...emptyChangeset(),
        deletes: [{action: 'delete', resourceType: 'monitor', refKey: 'old', existingId: 'mon-1', current: {}}],
      }
      const result = await apply(changeset, emptyRefs(), fakeClient)
      expect(result.succeeded).toHaveLength(1)
      expect(mockDelete).toHaveBeenCalledWith(fakeClient, '/api/v1/monitors/mon-1')
    })

    it('deletes an environment', async () => {
      mockDelete.mockResolvedValueOnce(undefined)
      const changeset: Changeset = {
        ...emptyChangeset(),
        deletes: [{action: 'delete', resourceType: 'environment', refKey: 'stg', existingId: 'env-7', current: {}}],
      }
      const result = await apply(changeset, emptyRefs(), fakeClient)
      expect(result.succeeded).toHaveLength(1)
      expect(mockDelete).toHaveBeenCalledWith(fakeClient, '/api/v1/environments/env-7')
    })

    it('deletes a secret', async () => {
      mockDelete.mockResolvedValueOnce(undefined)
      const changeset: Changeset = {
        ...emptyChangeset(),
        deletes: [{action: 'delete', resourceType: 'secret', refKey: 'k', existingId: 'sec-x', current: {}}],
      }
      const result = await apply(changeset, emptyRefs(), fakeClient)
      expect(result.succeeded).toHaveLength(1)
      expect(mockDelete).toHaveBeenCalledWith(fakeClient, '/api/v1/secrets/sec-x')
    })

    it('deletes an alert channel', async () => {
      mockDelete.mockResolvedValueOnce(undefined)
      const changeset: Changeset = {
        ...emptyChangeset(),
        deletes: [{action: 'delete', resourceType: 'alertChannel', refKey: 's', existingId: 'ch-9', current: {}}],
      }
      const result = await apply(changeset, emptyRefs(), fakeClient)
      expect(result.succeeded).toHaveLength(1)
      expect(mockDelete).toHaveBeenCalledWith(fakeClient, '/api/v1/alert-channels/ch-9')
    })

    it('deletes a notification policy', async () => {
      mockDelete.mockResolvedValueOnce(undefined)
      const changeset: Changeset = {
        ...emptyChangeset(),
        deletes: [{action: 'delete', resourceType: 'notificationPolicy', refKey: 'p', existingId: 'np-2', current: {}}],
      }
      const result = await apply(changeset, emptyRefs(), fakeClient)
      expect(result.succeeded).toHaveLength(1)
      expect(mockDelete).toHaveBeenCalledWith(fakeClient, '/api/v1/notification-policies/np-2')
    })

    it('deletes a webhook', async () => {
      mockDelete.mockResolvedValueOnce(undefined)
      const changeset: Changeset = {
        ...emptyChangeset(),
        deletes: [{action: 'delete', resourceType: 'webhook', refKey: 'w', existingId: 'wh-3', current: {}}],
      }
      const result = await apply(changeset, emptyRefs(), fakeClient)
      expect(result.succeeded).toHaveLength(1)
      expect(mockDelete).toHaveBeenCalledWith(fakeClient, '/api/v1/webhooks/wh-3')
    })

    it('deletes a resource group', async () => {
      mockDelete.mockResolvedValueOnce(undefined)
      const changeset: Changeset = {
        ...emptyChangeset(),
        deletes: [{action: 'delete', resourceType: 'resourceGroup', refKey: 'G', existingId: 'rg-4', current: {}}],
      }
      const result = await apply(changeset, emptyRefs(), fakeClient)
      expect(result.succeeded).toHaveLength(1)
      expect(mockDelete).toHaveBeenCalledWith(fakeClient, '/api/v1/resource-groups/rg-4')
    })

    it('deletes a dependency', async () => {
      mockDelete.mockResolvedValueOnce(undefined)
      const changeset: Changeset = {
        ...emptyChangeset(),
        deletes: [{action: 'delete', resourceType: 'dependency', refKey: 'gh', existingId: 'dep-z', current: {}}],
      }
      const result = await apply(changeset, emptyRefs(), fakeClient)
      expect(result.succeeded).toHaveLength(1)
      expect(mockDelete).toHaveBeenCalledWith(fakeClient, '/api/v1/service-subscriptions/dep-z')
    })
  })

  describe('memberships', () => {
    it('creates group membership', async () => {
      mockPost.mockResolvedValueOnce(undefined)
      const refs = new ResolvedRefs()
      refs.set('resourceGroups', 'API', {id: 'rg-1', refKey: 'API', raw: {}})
      refs.set('monitors', 'Health', {id: 'mon-1', refKey: 'Health', raw: {}})
      const changeset: Changeset = {
        ...emptyChangeset(),
        memberships: [{
          action: 'create', resourceType: 'groupMembership', refKey: 'API → Health',
          desired: {groupName: 'API', memberType: 'monitor', memberRef: 'Health'},
        }],
      }
      const result = await apply(changeset, refs, fakeClient)
      expect(result.succeeded).toHaveLength(1)
      expect(mockPost).toHaveBeenCalledWith(fakeClient, '/api/v1/resource-groups/rg-1/members', {
        memberType: 'monitor', memberId: 'mon-1',
      })
    })

    it('creates service membership', async () => {
      mockPost.mockResolvedValueOnce(undefined)
      const refs = new ResolvedRefs()
      refs.set('resourceGroups', 'G', {id: 'rg-1', refKey: 'G', raw: {}})
      refs.set('dependencies', 'github', {id: 'dep-1', refKey: 'github', raw: {}})
      const changeset: Changeset = {
        ...emptyChangeset(),
        memberships: [{
          action: 'create', resourceType: 'groupMembership', refKey: 'G → github',
          desired: {groupName: 'G', memberType: 'service', memberRef: 'github'},
        }],
      }
      const result = await apply(changeset, refs, fakeClient)
      expect(result.succeeded).toHaveLength(1)
      expect(mockPost).toHaveBeenCalledWith(fakeClient, '/api/v1/resource-groups/rg-1/members', {
        memberType: 'service', memberId: 'dep-1',
      })
    })
  })

  describe('error handling', () => {
    it('continues after create failure', async () => {
      mockPost
        .mockRejectedValueOnce(new Error('API error on first'))
        .mockResolvedValueOnce({data: {id: 'tag-2'}})
      const changeset: Changeset = {
        ...emptyChangeset(),
        creates: [
          {action: 'create', resourceType: 'tag', refKey: 'fail', desired: {name: 'fail'}},
          {action: 'create', resourceType: 'tag', refKey: 'ok', desired: {name: 'ok'}},
        ],
      }
      const result = await apply(changeset, emptyRefs(), fakeClient)
      expect(result.succeeded).toHaveLength(1)
      expect(result.failed).toHaveLength(1)
      expect(result.failed[0].refKey).toBe('fail')
      expect(result.failed[0].error).toContain('API error on first')
      expect(result.succeeded[0].refKey).toBe('ok')
    })

    it('continues after update failure', async () => {
      mockPut.mockRejectedValueOnce(new Error('update failed'))
      const changeset: Changeset = {
        ...emptyChangeset(),
        updates: [{action: 'update', resourceType: 'tag', refKey: 'T', existingId: 't-1', desired: {name: 'T'}, current: {}}],
      }
      const result = await apply(changeset, emptyRefs(), fakeClient)
      expect(result.failed).toHaveLength(1)
      expect(result.failed[0].error).toContain('update failed')
    })

    it('continues after delete failure', async () => {
      mockDelete.mockRejectedValueOnce(new Error('delete failed'))
      const changeset: Changeset = {
        ...emptyChangeset(),
        deletes: [{action: 'delete', resourceType: 'monitor', refKey: 'M', existingId: 'm-1', current: {}}],
      }
      const result = await apply(changeset, emptyRefs(), fakeClient)
      expect(result.failed).toHaveLength(1)
    })

    it('continues after membership failure', async () => {
      const refs = new ResolvedRefs()
      refs.set('resourceGroups', 'G', {id: 'rg-1', refKey: 'G', raw: {}})
      refs.set('monitors', 'M', {id: 'mon-1', refKey: 'M', raw: {}})
      mockPost.mockRejectedValueOnce(new Error('membership failed'))
      const changeset: Changeset = {
        ...emptyChangeset(),
        memberships: [{
          action: 'create', resourceType: 'groupMembership', refKey: 'G → M',
          desired: {groupName: 'G', memberType: 'monitor', memberRef: 'M'},
        }],
      }
      const result = await apply(changeset, refs, fakeClient)
      expect(result.failed).toHaveLength(1)
    })

    it('fails create when API returns no extractable id', async () => {
      mockPost.mockResolvedValueOnce({data: {}})
      const changeset: Changeset = {
        ...emptyChangeset(),
        creates: [{action: 'create', resourceType: 'tag', refKey: 'T', desired: {name: 'T'}}],
      }
      const result = await apply(changeset, emptyRefs(), fakeClient)
      expect(result.succeeded).toHaveLength(0)
      expect(result.failed).toHaveLength(1)
      expect(result.failed[0].error).toBe('Create succeeded but API returned no resource ID')
    })

    it('records unknown resourceType on create as failure', async () => {
      const changeset: Changeset = {
        ...emptyChangeset(),
        creates: [{action: 'create', resourceType: 'bogus', refKey: 'x', desired: {}} as Change],
      }
      const result = await apply(changeset, emptyRefs(), fakeClient)
      expect(result.failed).toHaveLength(1)
      expect(result.failed[0].error).toContain('Unknown resource type for create')
    })

    it('records unknown resourceType on delete as failure', async () => {
      const changeset: Changeset = {
        ...emptyChangeset(),
        deletes: [{action: 'delete', resourceType: 'bogus', refKey: 'x', existingId: '1', current: {}} as Change],
      }
      const result = await apply(changeset, emptyRefs(), fakeClient)
      expect(result.failed).toHaveLength(1)
      expect(result.failed[0].error).toContain('Unknown resource type for delete')
    })

    it('string rejection becomes error message via String()', async () => {
      mockPost.mockRejectedValueOnce('plain string failure')
      const changeset: Changeset = {
        ...emptyChangeset(),
        creates: [{action: 'create', resourceType: 'tag', refKey: 'T', desired: {name: 'T'}}],
      }
      const result = await apply(changeset, emptyRefs(), fakeClient)
      expect(result.failed).toHaveLength(1)
      expect(result.failed[0].error).toBe('plain string failure')
    })
  })

  describe('typed response extraction', () => {
    it('extracts id from typed tag response', async () => {
      mockPost.mockResolvedValueOnce({data: {id: 'wrapped-id'}})
      const changeset: Changeset = {
        ...emptyChangeset(),
        creates: [{action: 'create', resourceType: 'tag', refKey: 'T', desired: {name: 'T'}}],
      }
      const result = await apply(changeset, emptyRefs(), fakeClient)
      expect(result.succeeded[0].id).toBe('wrapped-id')
    })

    it('extracts subscriptionId from dependency response', async () => {
      mockPost.mockResolvedValueOnce({data: {subscriptionId: 'sub-123'}})
      const changeset: Changeset = {
        ...emptyChangeset(),
        creates: [{action: 'create', resourceType: 'dependency', refKey: 'gh', desired: {service: 'gh'}}],
      }
      const result = await apply(changeset, emptyRefs(), fakeClient)
      expect(result.succeeded[0].id).toBe('sub-123')
    })

    it('extracts id from secret response', async () => {
      mockPost.mockResolvedValueOnce({data: {id: 'sec-uuid'}})
      const changeset: Changeset = {
        ...emptyChangeset(),
        creates: [{action: 'create', resourceType: 'secret', refKey: 'my-key', desired: {key: 'my-key', value: 'v'}}],
      }
      const result = await apply(changeset, emptyRefs(), fakeClient)
      expect(result.succeeded[0].id).toBe('sec-uuid')
    })
  })

  describe('empty changeset', () => {
    it('returns empty result for no-op changeset', async () => {
      const result = await apply(emptyChangeset(), emptyRefs(), fakeClient)
      expect(result.succeeded).toHaveLength(0)
      expect(result.failed).toHaveLength(0)
      expect(result.stateEntries).toHaveLength(0)
    })
  })
})
