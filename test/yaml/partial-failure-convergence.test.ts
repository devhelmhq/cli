/**
 * Partial-failure convergence tests for `devhelm deploy`.
 *
 * These exercise the contract that the user-facing audit flagged: when an
 * apply phase partially succeeds (some resources created, some operations
 * fail), the on-disk state file must accurately reflect what actually
 * happened — and a re-deploy against the now-stable API must converge the
 * remaining work.
 *
 * Historical bug we are guarding against:
 *   The old applier wrote a "blanket success" state file even when a
 *   downstream operation (e.g. a membership add) had failed. That hid the
 *   partial state from the next deploy: diff() would treat the failed
 *   operation as already-done and never retry it.
 *
 * Scenarios covered:
 *   (a) Resource group + monitor created, but the membership add fails.
 *       Re-deploy must add the missing member without recreating the
 *       group or monitor.
 *   (b) Status page parent created, but a child component create fails.
 *       Re-deploy must add the missing component without recreating the
 *       page.
 *   (c) Status page parent created, but a child component_group create
 *       fails. Re-deploy must add the missing group without recreating
 *       the page.
 *
 * Test design: rather than spawn the full `devhelm deploy` binary, we
 * exercise the same library functions deploy/index.ts uses — fetchAllRefs
 * → diff → apply → buildStateV2 + state-merge — against an in-memory fake
 * API. That gives end-to-end coverage of the partial-failure contract
 * without requiring a real HTTP server.
 */
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {mkdirSync, rmSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {
  apply, buildStateV2, diff, emptyState, fetchAllRefs,
  readState, registerYamlPendingRefs, resourceAddress, validate, writeState,
  type ApplyResult,
  type DeployState,
  type DevhelmConfig,
} from '../../src/lib/yaml/index.js'

// ── checkedFetch / api-client mock ──────────────────────────────────────
//
// The handlers call `apiPost`, `apiPut`, `apiDelete`, `apiPatch`,
// `checkedFetch` which all internally call `client.METHOD(...)` and then
// unwrap the response. We mock the api-client module so:
//   - `checkedFetch(p)` simply awaits `p` (whatever the fake client returns
//     becomes the unwrapped body).
//   - `apiPost / apiPut / apiPatch` round-trip through the same fake client
//     and the mocked checkedFetch.
//   - `apiDelete` calls `client.DELETE(path, {params: {path: {}}})`.
//
// This is the same pattern as applier.test.ts and lets us inject failures
// at the response layer without booting a real HTTP server.

vi.mock('../../src/lib/api-client.js', () => {
  const passthrough = async (p: unknown) => p
  return {
    checkedFetch: vi.fn(passthrough),
    apiGet: vi.fn(async (client: FakeClient, path: string, params?: object) => {
      return client.GET(path, params ? {params} : {})
    }),
    apiPost: vi.fn(async (client: FakeClient, path: string, body?: object) => {
      return client.POST(path, body ? {body} : {})
    }),
    apiPut: vi.fn(async (client: FakeClient, path: string, body: object) => {
      return client.PUT(path, {body})
    }),
    apiPatch: vi.fn(async (client: FakeClient, path: string, body: object) => {
      return client.PATCH(path, {body})
    }),
    apiDelete: vi.fn(async (client: FakeClient, path: string) => {
      return client.DELETE(path, {params: {path: {}}})
    }),
  }
})

// ── In-memory fake API ──────────────────────────────────────────────────

interface PathParams {
  path?: Record<string, string>
  query?: Record<string, unknown>
}

interface RequestOptions {
  body?: unknown
  params?: PathParams
}

interface FakeClient {
  GET(path: string, opts?: RequestOptions): Promise<unknown>
  POST(path: string, opts?: RequestOptions): Promise<unknown>
  PUT(path: string, opts: RequestOptions): Promise<unknown>
  PATCH(path: string, opts: RequestOptions): Promise<unknown>
  DELETE(path: string, opts?: RequestOptions): Promise<unknown>
}

/**
 * Substitute `{name}` placeholders in `path` with values from
 * `opts.params.path`. Mirrors openapi-fetch's path interpolation.
 */
function interpolate(path: string, opts?: RequestOptions): string {
  const map = opts?.params?.path ?? {}
  return path.replace(/\{([^}]+)\}/g, (_match, name: string) => map[name] ?? `{${name}}`)
}

interface RGMember {
  id: string
  memberType: 'monitor' | 'service'
  memberId: string
  /** Echoed back as `name` (monitors) or `slug` (services). */
  label: string
}

interface FakeRG {
  id: string
  name: string
  members: RGMember[]
}

interface FakeMonitor {
  id: string
  name: string
  type: string
  config: Record<string, unknown>
  managedBy: 'CLI' | 'API'
}

interface FakeStatusPage {
  id: string
  name: string
  slug: string
  visibility: string
  enabled: boolean
  incidentMode: string
  description: string | null
  branding: null
}

interface FakeStatusPageGroup {
  id: string
  name: string
  description: string | null
  displayOrder: number
  defaultOpen: boolean
}

interface FakeStatusPageComponent {
  id: string
  name: string
  type: string
  description: string | null
  displayOrder: number
  showUptime: boolean
  excludeFromOverall: boolean
  startDate: string | null
  groupId: string | null
  monitorId: string | null
  resourceGroupId: string | null
}

/**
 * Predicate passed to FakeApi to inject failures at specific call sites.
 * Receives the resolved path + method + body and returns true to fail.
 */
type FailureRule = (req: {method: string; path: string; body?: unknown}) => boolean

class FakeApi {
  private idCounter = 0
  private resourceGroups = new Map<string, FakeRG>()
  private monitors = new Map<string, FakeMonitor>()
  private statusPages = new Map<string, FakeStatusPage>()
  private statusPageGroups = new Map<string, Map<string, FakeStatusPageGroup>>()
  private statusPageComponents = new Map<string, Map<string, FakeStatusPageComponent>>()
  private failures: FailureRule[] = []

  /** Calls observed for assertion. */
  readonly calls: Array<{method: string; path: string; body?: unknown}> = []

  injectFailure(rule: FailureRule): void {
    this.failures.push(rule)
  }

  clearFailures(): void {
    this.failures = []
  }

  private nextId(prefix: string): string {
    this.idCounter += 1
    return `${prefix}-${this.idCounter}`
  }

  private maybeFail(req: {method: string; path: string; body?: unknown}): void {
    for (const rule of this.failures) {
      if (rule(req)) {
        const err = new Error(`injected failure: ${req.method} ${req.path}`)
        ;(err as Error & {status?: number}).status = 500
        throw err
      }
    }
  }

  /** Snapshot helpers used by tests for assertions. */
  rgByName(name: string): FakeRG | undefined {
    for (const rg of this.resourceGroups.values()) if (rg.name === name) return rg
    return undefined
  }

  monitorByName(name: string): FakeMonitor | undefined {
    for (const m of this.monitors.values()) if (m.name === name) return m
    return undefined
  }

  statusPageBySlug(slug: string): FakeStatusPage | undefined {
    for (const p of this.statusPages.values()) if (p.slug === slug) return p
    return undefined
  }

  componentsForPage(pageId: string): FakeStatusPageComponent[] {
    return [...(this.statusPageComponents.get(pageId)?.values() ?? [])]
  }

  groupsForPage(pageId: string): FakeStatusPageGroup[] {
    return [...(this.statusPageGroups.get(pageId)?.values() ?? [])]
  }

  // ── Routing ──────────────────────────────────────────────────────────

  client(): FakeClient {
    return {
      GET: (p, opts) => this.handle('GET', interpolate(p, opts), opts),
      POST: (p, opts) => this.handle('POST', interpolate(p, opts), opts),
      PUT: (p, opts) => this.handle('PUT', interpolate(p, opts), opts),
      PATCH: (p, opts) => this.handle('PATCH', interpolate(p, opts), opts),
      DELETE: (p, opts) => this.handle('DELETE', interpolate(p, opts), opts),
    }
  }

  private handle(method: string, path: string, opts?: RequestOptions): Promise<unknown> {
    const body = opts?.body
    this.calls.push({method, path, body})
    this.maybeFail({method, path, body})

    if (method === 'GET') return Promise.resolve(this.handleGet(path))
    if (method === 'POST') return Promise.resolve(this.handlePost(path, body))
    if (method === 'PUT') return Promise.resolve(this.handlePut(path, body))
    if (method === 'DELETE') return Promise.resolve(this.handleDelete(path))
    if (method === 'PATCH') return Promise.resolve(this.handlePatch(path, body))
    throw new Error(`unhandled method ${method} ${path}`)
  }

  private handleGet(path: string): unknown {
    if (path === '/api/v1/resource-groups') {
      return {data: [...this.resourceGroups.values()].map((rg) => this.rgToDto(rg)), hasNext: false}
    }
    if (path === '/api/v1/monitors') {
      return {data: [...this.monitors.values()].map((m) => this.monitorToDto(m)), hasNext: false}
    }
    if (path === '/api/v1/status-pages') {
      return {data: [...this.statusPages.values()], hasNext: false}
    }
    const groupsMatch = path.match(/^\/api\/v1\/status-pages\/([^/]+)\/groups$/)
    if (groupsMatch) {
      return {data: [...(this.statusPageGroups.get(groupsMatch[1])?.values() ?? [])], hasNext: false}
    }
    const compsMatch = path.match(/^\/api\/v1\/status-pages\/([^/]+)\/components$/)
    if (compsMatch) {
      return {data: [...(this.statusPageComponents.get(compsMatch[1])?.values() ?? [])], hasNext: false}
    }
    // All other listPath endpoints used by fetchAllRefs return empty pages.
    if (path.startsWith('/api/v1/')) return {data: [], hasNext: false}
    throw new Error(`fake api: unhandled GET ${path}`)
  }

  private handlePost(path: string, body: unknown): unknown {
    if (path === '/api/v1/resource-groups') {
      const reqBody = body as {name: string}
      const id = this.nextId('rg')
      this.resourceGroups.set(id, {id, name: reqBody.name, members: []})
      return {data: {id, name: reqBody.name, members: []}}
    }
    const memberMatch = path.match(/^\/api\/v1\/resource-groups\/([^/]+)\/members$/)
    if (memberMatch) {
      const rg = this.resourceGroups.get(memberMatch[1])
      if (!rg) throw new Error(`fake api: resource group ${memberMatch[1]} not found`)
      const reqBody = body as {memberType: 'monitor' | 'service'; memberId: string}
      const memberId = this.nextId('rgm')
      const label = reqBody.memberType === 'monitor'
        ? this.monitors.get(reqBody.memberId)?.name ?? reqBody.memberId
        : reqBody.memberId
      rg.members.push({id: memberId, memberType: reqBody.memberType, memberId: reqBody.memberId, label})
      return {data: {id: memberId}}
    }
    if (path === '/api/v1/monitors') {
      const reqBody = body as {name: string; type: string; config: Record<string, unknown>}
      const id = this.nextId('mon')
      this.monitors.set(id, {
        id, name: reqBody.name, type: reqBody.type, config: reqBody.config, managedBy: 'CLI',
      })
      return {data: {id, name: reqBody.name, type: reqBody.type, config: reqBody.config, managedBy: 'CLI'}}
    }
    if (path === '/api/v1/status-pages') {
      const reqBody = body as {name: string; slug: string; visibility?: string; enabled?: boolean; incidentMode?: string; description?: string | null}
      const id = this.nextId('sp')
      this.statusPages.set(id, {
        id, name: reqBody.name, slug: reqBody.slug,
        visibility: reqBody.visibility ?? 'PUBLIC',
        enabled: reqBody.enabled ?? true,
        incidentMode: reqBody.incidentMode ?? 'AUTOMATIC',
        description: reqBody.description ?? null,
        branding: null,
      })
      this.statusPageGroups.set(id, new Map())
      this.statusPageComponents.set(id, new Map())
      return {data: this.statusPages.get(id)}
    }
    const pageGroupsMatch = path.match(/^\/api\/v1\/status-pages\/([^/]+)\/groups$/)
    if (pageGroupsMatch) {
      const pageId = pageGroupsMatch[1]
      const reqBody = body as {name: string; description?: string | null; displayOrder: number; defaultOpen?: boolean}
      const id = this.nextId('spg')
      const dto: FakeStatusPageGroup = {
        id, name: reqBody.name, description: reqBody.description ?? null,
        displayOrder: reqBody.displayOrder, defaultOpen: reqBody.defaultOpen ?? true,
      }
      this.statusPageGroups.get(pageId)!.set(id, dto)
      return {data: dto}
    }
    const pageCompsMatch = path.match(/^\/api\/v1\/status-pages\/([^/]+)\/components$/)
    if (pageCompsMatch) {
      const pageId = pageCompsMatch[1]
      const reqBody = body as {
        name: string; type: string; description?: string | null
        displayOrder: number; showUptime?: boolean; excludeFromOverall?: boolean
        startDate?: string | null; groupId?: string | null; monitorId?: string | null
        resourceGroupId?: string | null
      }
      const id = this.nextId('spc')
      const dto: FakeStatusPageComponent = {
        id, name: reqBody.name, type: reqBody.type,
        description: reqBody.description ?? null,
        displayOrder: reqBody.displayOrder,
        showUptime: reqBody.showUptime ?? true,
        excludeFromOverall: reqBody.excludeFromOverall ?? false,
        startDate: reqBody.startDate ?? null,
        groupId: reqBody.groupId ?? null,
        monitorId: reqBody.monitorId ?? null,
        resourceGroupId: reqBody.resourceGroupId ?? null,
      }
      this.statusPageComponents.get(pageId)!.set(id, dto)
      return {data: dto}
    }
    throw new Error(`fake api: unhandled POST ${path}`)
  }

  private handlePut(path: string, body: unknown): unknown {
    // Reorder endpoint must be matched FIRST — it shares a prefix with
    // the component child PUT and would otherwise be treated as a
    // child-id="reorder" lookup. We don't model order in the in-memory
    // store, so a no-op is fine.
    if (/^\/api\/v1\/status-pages\/[^/]+\/components\/reorder$/.test(path)) {
      return {data: undefined}
    }
    // Status page child PUTs: actually mutate the in-memory store so
    // rename + update + drift-detection scenarios behave like the real
    // API. Without this, a child update would no-op and the next deploy
    // would still see "drift" against the unchanged stored child.
    const groupPut = path.match(/^\/api\/v1\/status-pages\/([^/]+)\/groups\/([^/]+)$/)
    if (groupPut) {
      const group = this.statusPageGroups.get(groupPut[1])?.get(groupPut[2])
      if (!group) throw new Error(`fake api: group ${groupPut[2]} not found`)
      const reqBody = body as {name?: string; description?: string | null; displayOrder?: number; defaultOpen?: boolean}
      if (reqBody.name !== undefined) group.name = reqBody.name
      if (reqBody.description !== undefined) group.description = reqBody.description ?? null
      if (reqBody.displayOrder !== undefined) group.displayOrder = reqBody.displayOrder
      if (reqBody.defaultOpen !== undefined) group.defaultOpen = reqBody.defaultOpen
      return {data: group}
    }
    const compPut = path.match(/^\/api\/v1\/status-pages\/([^/]+)\/components\/([^/]+)$/)
    if (compPut) {
      const comp = this.statusPageComponents.get(compPut[1])?.get(compPut[2])
      if (!comp) throw new Error(`fake api: component ${compPut[2]} not found`)
      const reqBody = body as {
        name?: string; description?: string | null; displayOrder?: number
        showUptime?: boolean; excludeFromOverall?: boolean
        startDate?: string | null; groupId?: string | null; removeFromGroup?: boolean
      }
      if (reqBody.name !== undefined) comp.name = reqBody.name
      if (reqBody.description !== undefined) comp.description = reqBody.description ?? null
      if (reqBody.displayOrder !== undefined) comp.displayOrder = reqBody.displayOrder
      if (reqBody.showUptime !== undefined) comp.showUptime = reqBody.showUptime
      if (reqBody.excludeFromOverall !== undefined) comp.excludeFromOverall = reqBody.excludeFromOverall
      if (reqBody.startDate !== undefined) comp.startDate = reqBody.startDate ?? null
      if (reqBody.removeFromGroup) comp.groupId = null
      else if (reqBody.groupId !== undefined) comp.groupId = reqBody.groupId
      return {data: comp}
    }
    // All other PUTs are idempotent no-ops — handlers only need them to
    // not throw on re-runs of unchanged top-level resources.
    if (path.startsWith('/api/v1/')) return {data: undefined}
    throw new Error(`fake api: unhandled PUT ${path}`)
  }

  private handlePatch(path: string, _body: unknown): unknown {
    if (path.startsWith('/api/v1/')) return {data: undefined}
    throw new Error(`fake api: unhandled PATCH ${path}`)
  }

  private handleDelete(path: string): unknown {
    // Mutating deletes for status page children + RG members so re-runs
    // see the API state actually change.
    const groupDel = path.match(/^\/api\/v1\/status-pages\/([^/]+)\/groups\/([^/]+)$/)
    if (groupDel) {
      this.statusPageGroups.get(groupDel[1])?.delete(groupDel[2])
      return {data: undefined}
    }
    const compDel = path.match(/^\/api\/v1\/status-pages\/([^/]+)\/components\/([^/]+)$/)
    if (compDel) {
      this.statusPageComponents.get(compDel[1])?.delete(compDel[2])
      return {data: undefined}
    }
    const memberDel = path.match(/^\/api\/v1\/resource-groups\/([^/]+)\/members\/([^/]+)$/)
    if (memberDel) {
      const rg = this.resourceGroups.get(memberDel[1])
      if (rg) rg.members = rg.members.filter((m) => m.id !== memberDel[2])
      return {data: undefined}
    }
    if (path.startsWith('/api/v1/')) return {data: undefined}
    throw new Error(`fake api: unhandled DELETE ${path}`)
  }

  private rgToDto(rg: FakeRG): Record<string, unknown> {
    return {
      id: rg.id, name: rg.name,
      members: rg.members.map((m) => ({
        id: m.id, memberType: m.memberType,
        ...(m.memberType === 'monitor' ? {name: m.label} : {slug: m.label}),
      })),
    }
  }

  private monitorToDto(m: FakeMonitor): Record<string, unknown> {
    return {id: m.id, name: m.name, type: m.type, config: m.config, managedBy: m.managedBy}
  }
}

// ── Deploy harness ──────────────────────────────────────────────────────

/**
 * Replicates deploy/index.ts run loop minus the oclif/CLI shell:
 *   1. Validate config.
 *   2. Fetch refs from API (state-aware).
 *   3. Register pending YAML refs.
 *   4. Diff against API + state.
 *   5. Apply.
 *   6. Merge stateEntries with prior untouched resources, write state.
 *
 * Returns the apply result + the final on-disk state.
 */
async function runDeploy(
  config: DevhelmConfig,
  api: FakeApi,
  cwd: string,
): Promise<{result: ApplyResult; state: DeployState}> {
  const validation = validate(config)
  if (validation.errors.length > 0) {
    throw new Error(`invalid config: ${validation.errors.map((e) => `${e.path}: ${e.message}`).join('; ')}`)
  }

  const currentState = readState(cwd) ?? emptyState()
  const client = api.client() as unknown as Parameters<typeof apply>[2]
  const refs = await fetchAllRefs(client, currentState)
  registerYamlPendingRefs(refs, config)
  const changeset = diff(config, refs, {}, currentState)
  const result = await apply(changeset, refs, client, currentState)

  // Mirror deploy/index.ts state-merge: build fresh state from successful
  // entries, then forward prior entries that weren't touched or deleted.
  const deletedAddresses = new Set(
    result.deletedRefKeys.map((d) => resourceAddress(d.resourceType, d.refKey)),
  )
  const newState = buildStateV2(result.stateEntries, currentState.serial)
  for (const [addr, entry] of Object.entries(currentState.resources)) {
    if (!(addr in newState.resources) && !deletedAddresses.has(addr)) {
      newState.resources[addr] = entry
    }
  }
  writeState(newState, cwd)

  return {result, state: newState}
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('partial-failure convergence (deploy harness)', () => {
  let cwd: string
  let api: FakeApi

  beforeEach(() => {
    cwd = join(tmpdir(), `devhelm-partial-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
    mkdirSync(cwd, {recursive: true})
    api = new FakeApi()
  })

  afterEach(() => {
    rmSync(cwd, {recursive: true, force: true})
  })

  describe('(a) resource group + monitor created, membership add fails', () => {
    const config: DevhelmConfig = {
      version: '1',
      monitors: [
        {name: 'API health', type: 'HTTP', config: {url: 'https://example.com', method: 'GET'}},
      ],
      resourceGroups: [
        {name: 'API services', monitors: ['API health']},
      ],
    }

    it('fails membership add but persists group + monitor in state, then re-deploy converges', async () => {
      // Inject failure on the first membership-add POST.
      api.injectFailure((req) =>
        req.method === 'POST' && /^\/api\/v1\/resource-groups\/[^/]+\/members$/.test(req.path),
      )

      const first = await runDeploy(config, api, cwd)

      expect(first.result.failed).toHaveLength(1)
      expect(first.result.failed[0].resourceType).toBe('groupMembership')
      expect(first.result.succeeded.map((s) => s.resourceType).sort()).toEqual(['monitor', 'resourceGroup'])

      // Group + monitor exist in API and in state, but no membership yet.
      const rg = api.rgByName('API services')!
      const mon = api.monitorByName('API health')!
      expect(rg.members).toHaveLength(0)
      expect(first.state.resources['resourceGroups.API services']?.apiId).toBe(rg.id)
      expect(first.state.resources['monitors.API health']?.apiId).toBe(mon.id)
      // Membership is not a top-level state entry — it's diff-driven from
      // the live API. Confirm we did not silently record it as "done".
      expect(Object.keys(first.state.resources).sort()).toEqual([
        'monitors.API health',
        'resourceGroups.API services',
      ])

      // Second deploy: clear the failure, re-run. Diff must compute a
      // membership-add (because rg.members is still empty in the API),
      // and apply must succeed.
      api.clearFailures()
      const second = await runDeploy(config, api, cwd)

      expect(second.result.failed).toHaveLength(0)
      expect(second.result.succeeded).toHaveLength(1)
      expect(second.result.succeeded[0].action).toBe('add')
      expect(second.result.succeeded[0].resourceType).toBe('groupMembership')

      // Membership now exists in API; group + monitor were not touched.
      const rgAfter = api.rgByName('API services')!
      expect(rgAfter.id).toBe(rg.id)
      expect(rgAfter.members).toHaveLength(1)
      expect(rgAfter.members[0]).toMatchObject({memberType: 'monitor', memberId: mon.id})

      // Third deploy: should be a no-op.
      const third = await runDeploy(config, api, cwd)
      expect(third.result.succeeded).toHaveLength(0)
      expect(third.result.failed).toHaveLength(0)
    })
  })

  describe('(b) status page created, child component create fails', () => {
    const config: DevhelmConfig = {
      version: '1',
      statusPages: [{
        slug: 'public',
        name: 'Public Status',
        components: [
          {name: 'API', type: 'STATIC'},
          {name: 'Web', type: 'STATIC'},
        ],
      }],
    }

    it('persists page + surviving child in state, re-deploy creates the missing component', async () => {
      // Fail the second component create. The first component succeeds,
      // the second throws — `applyChildDiff` continues to the remaining
      // ops in the same phase (none here) and raises a PartialApplyError
      // carrying the surviving child. The status page handler catches it,
      // re-throws with the parent id attached, and the applier persists
      // the parent + surviving child in state.
      let componentPostCount = 0
      api.injectFailure((req) => {
        if (req.method !== 'POST') return false
        if (!/^\/api\/v1\/status-pages\/[^/]+\/components$/.test(req.path)) return false
        componentPostCount += 1
        return componentPostCount === 2 // fail the second one
      })

      const first = await runDeploy(config, api, cwd)

      expect(first.result.failed).toHaveLength(1)
      expect(first.result.failed[0].resourceType).toBe('statusPage')

      // The page exists in API. The first component succeeded.
      const page = api.statusPageBySlug('public')!
      expect(page).toBeDefined()
      const componentsAfterFirst = api.componentsForPage(page.id)
      expect(componentsAfterFirst).toHaveLength(1)
      expect(componentsAfterFirst[0].name).toBe('API')

      // Partial state contract: the page IS tracked in state.json (with
      // the surviving child), even though applyCreate signalled failure.
      // The next deploy can diff state vs API directly and only retry the
      // missing component — no API rediscovery dance, identity
      // (renames, etc.) preserved across runs.
      const pageState = first.state.resources['statusPages.public']
      expect(pageState).toBeDefined()
      expect(pageState.apiId).toBe(page.id)
      expect(Object.keys(pageState.children).sort()).toEqual(['components.API'])
      expect(pageState.children['components.API']?.apiId).toBe(componentsAfterFirst[0].id)

      // Second deploy: clear the failure. State already pins the page +
      // first component, so diff queues an update on the page with
      // hasChildChanges=true; the reconciler creates only the missing
      // "Web" component.
      api.clearFailures()
      const second = await runDeploy(config, api, cwd)
      expect(second.result.failed).toHaveLength(0)

      const componentsAfterSecond = api.componentsForPage(page.id)
      expect(componentsAfterSecond.map((c) => c.name).sort()).toEqual(['API', 'Web'])

      // State now tracks the page + both children.
      const pageStateAfter = second.state.resources['statusPages.public']
      expect(pageStateAfter).toBeDefined()
      expect(pageStateAfter.apiId).toBe(page.id)
      expect(Object.keys(pageStateAfter.children).sort()).toEqual([
        'components.API', 'components.Web',
      ])

      // Third deploy: no-op.
      const third = await runDeploy(config, api, cwd)
      expect(third.result.succeeded).toHaveLength(0)
      expect(third.result.failed).toHaveLength(0)
    })
  })

  describe('(c) status page created, child component_group create fails', () => {
    const config: DevhelmConfig = {
      version: '1',
      statusPages: [{
        slug: 'public',
        name: 'Public Status',
        componentGroups: [
          {name: 'Platform'},
          {name: 'Integrations'},
        ],
      }],
    }

    it('persists page + surviving group in state, re-deploy creates the missing group', async () => {
      let groupPostCount = 0
      api.injectFailure((req) => {
        if (req.method !== 'POST') return false
        if (!/^\/api\/v1\/status-pages\/[^/]+\/groups$/.test(req.path)) return false
        groupPostCount += 1
        return groupPostCount === 2
      })

      const first = await runDeploy(config, api, cwd)

      expect(first.result.failed).toHaveLength(1)
      expect(first.result.failed[0].resourceType).toBe('statusPage')

      const page = api.statusPageBySlug('public')!
      expect(page).toBeDefined()
      const groupsAfterFirst = api.groupsForPage(page.id)
      expect(groupsAfterFirst).toHaveLength(1)
      expect(groupsAfterFirst[0].name).toBe('Platform')

      // Partial state pins the page + surviving group.
      const pageState = first.state.resources['statusPages.public']
      expect(pageState).toBeDefined()
      expect(pageState.apiId).toBe(page.id)
      expect(Object.keys(pageState.children).sort()).toEqual(['groups.Platform'])

      api.clearFailures()
      const second = await runDeploy(config, api, cwd)
      expect(second.result.failed).toHaveLength(0)

      const groupsAfterSecond = api.groupsForPage(page.id)
      expect(groupsAfterSecond.map((g) => g.name).sort()).toEqual(['Integrations', 'Platform'])

      const pageStateAfter = second.state.resources['statusPages.public']
      expect(pageStateAfter).toBeDefined()
      expect(pageStateAfter.apiId).toBe(page.id)
      expect(Object.keys(pageStateAfter.children).sort()).toEqual([
        'groups.Integrations', 'groups.Platform',
      ])

      const third = await runDeploy(config, api, cwd)
      expect(third.result.succeeded).toHaveLength(0)
      expect(third.result.failed).toHaveLength(0)
    })
  })

  describe('(d) child reconciler attempts all ops even when one fails', () => {
    // Three components — fail only the middle one. With the old halt-on-
    // first-error behavior, the third component would be skipped and only
    // one component would land per deploy (forcing 3 deploys to converge).
    // With the new behavior we land 2 components on the first deploy and
    // converge in 2 deploys total.
    const config: DevhelmConfig = {
      version: '1',
      statusPages: [{
        slug: 'public',
        name: 'Public Status',
        components: [
          {name: 'API', type: 'STATIC'},
          {name: 'Web', type: 'STATIC'},
          {name: 'Workers', type: 'STATIC'},
        ],
      }],
    }

    it('lands the 1st + 3rd components when the 2nd fails, then converges', async () => {
      let componentPostCount = 0
      api.injectFailure((req) => {
        if (req.method !== 'POST') return false
        if (!/^\/api\/v1\/status-pages\/[^/]+\/components$/.test(req.path)) return false
        componentPostCount += 1
        return componentPostCount === 2
      })

      const first = await runDeploy(config, api, cwd)
      expect(first.result.failed).toHaveLength(1)

      const page = api.statusPageBySlug('public')!
      const componentsAfterFirst = api.componentsForPage(page.id)
      // Both surviving components landed, despite the failure in between.
      expect(componentsAfterFirst.map((c) => c.name).sort()).toEqual(['API', 'Workers'])

      // State pins the page + both surviving children.
      const pageState = first.state.resources['statusPages.public']
      expect(pageState).toBeDefined()
      expect(Object.keys(pageState.children).sort()).toEqual([
        'components.API', 'components.Workers',
      ])

      // Second deploy: clear, only the missing one is created.
      api.clearFailures()
      const second = await runDeploy(config, api, cwd)
      expect(second.result.failed).toHaveLength(0)

      const componentsAfterSecond = api.componentsForPage(page.id)
      expect(componentsAfterSecond.map((c) => c.name).sort()).toEqual(['API', 'Web', 'Workers'])

      // No-op on the third deploy.
      const third = await runDeploy(config, api, cwd)
      expect(third.result.succeeded).toHaveLength(0)
      expect(third.result.failed).toHaveLength(0)
    })
  })

  describe('(e) component reconciliation runs even when group reconciliation fails', () => {
    // Mixed page: 1 group + 1 component (static, no group ref). With the
    // old behavior, a group failure would skip the entire component phase.
    // With the new behavior, both phases run and only the failing op is
    // surfaced.
    const config: DevhelmConfig = {
      version: '1',
      statusPages: [{
        slug: 'public',
        name: 'Public Status',
        componentGroups: [{name: 'Platform'}],
        components: [{name: 'StandaloneAPI', type: 'STATIC'}],
      }],
    }

    it('still creates the standalone component when the group fails', async () => {
      api.injectFailure((req) =>
        req.method === 'POST' && /^\/api\/v1\/status-pages\/[^/]+\/groups$/.test(req.path),
      )

      const first = await runDeploy(config, api, cwd)
      expect(first.result.failed).toHaveLength(1)

      const page = api.statusPageBySlug('public')!
      // Group failed but component still created.
      expect(api.groupsForPage(page.id)).toHaveLength(0)
      expect(api.componentsForPage(page.id)).toHaveLength(1)
      expect(api.componentsForPage(page.id)[0].name).toBe('StandaloneAPI')

      // State pins the page + surviving component (no group entry).
      const pageState = first.state.resources['statusPages.public']
      expect(pageState).toBeDefined()
      expect(Object.keys(pageState.children).sort()).toEqual(['components.StandaloneAPI'])

      // Second deploy converges the missing group.
      api.clearFailures()
      const second = await runDeploy(config, api, cwd)
      expect(second.result.failed).toHaveLength(0)
      expect(api.groupsForPage(page.id).map((g) => g.name)).toEqual(['Platform'])

      const third = await runDeploy(config, api, cwd)
      expect(third.result.succeeded).toHaveLength(0)
      expect(third.result.failed).toHaveLength(0)
    })
  })

  // ── Advanced scenarios ──────────────────────────────────────────────────
  //
  // The base scenarios above prove the contract for one failure at a time
  // in fresh-create paths. These advanced ones cover the matrix the audit
  // flagged: multi-failure RG memberships, the UPDATE code path (different
  // from CREATE), rename-across-failure (the architectural value of state
  // pinning), failed deletes carried forward, and failed updates retried.

  describe('(f) RG with multiple memberships, only one fails', () => {
    const config: DevhelmConfig = {
      version: '1',
      monitors: [
        {name: 'API', type: 'HTTP', config: {url: 'https://example.com', method: 'GET'}},
        {name: 'Web', type: 'HTTP', config: {url: 'https://example.com/web', method: 'GET'}},
        {name: 'Workers', type: 'HTTP', config: {url: 'https://example.com/workers', method: 'GET'}},
      ],
      resourceGroups: [
        {name: 'Services', monitors: ['API', 'Web', 'Workers']},
      ],
    }

    it('lands 2 of 3 memberships when the middle one fails, then converges', async () => {
      // Membership POSTs run after RG + monitors are created. Fail the
      // second add — top-level applier loops with try/catch per change so
      // the third should still go through.
      let memberPostCount = 0
      api.injectFailure((req) => {
        if (req.method !== 'POST') return false
        if (!/^\/api\/v1\/resource-groups\/[^/]+\/members$/.test(req.path)) return false
        memberPostCount += 1
        return memberPostCount === 2
      })

      const first = await runDeploy(config, api, cwd)

      // 3 monitors + 1 RG + 2 memberships = 6 succeeded; 1 membership failed.
      expect(first.result.failed).toHaveLength(1)
      expect(first.result.failed[0].resourceType).toBe('groupMembership')
      expect(first.result.succeeded).toHaveLength(6)

      const rg = api.rgByName('Services')!
      expect(rg.members).toHaveLength(2)
      expect(rg.members.map((m) => m.label).sort()).toEqual(['API', 'Workers'])

      // Top-level state for monitors + RG is intact.
      expect(first.state.resources['resourceGroups.Services']?.apiId).toBe(rg.id)
      expect(first.state.resources['monitors.API']).toBeDefined()
      expect(first.state.resources['monitors.Web']).toBeDefined()
      expect(first.state.resources['monitors.Workers']).toBeDefined()

      // Re-deploy: only the missing membership add runs.
      api.clearFailures()
      const second = await runDeploy(config, api, cwd)
      expect(second.result.failed).toHaveLength(0)
      expect(second.result.succeeded).toHaveLength(1)
      expect(second.result.succeeded[0].action).toBe('add')

      const rgAfter = api.rgByName('Services')!
      expect(rgAfter.members.map((m) => m.label).sort()).toEqual(['API', 'Web', 'Workers'])

      const third = await runDeploy(config, api, cwd)
      expect(third.result.succeeded).toHaveLength(0)
      expect(third.result.failed).toHaveLength(0)
    })
  })

  describe('(g) status page UPDATE path: existing page, partial child failure', () => {
    it('persists partial children from an UPDATE, then converges', async () => {
      // First deploy: bring the page up cleanly with one component.
      const initial: DevhelmConfig = {
        version: '1',
        statusPages: [{
          slug: 'public',
          name: 'Public Status',
          components: [{name: 'API', type: 'STATIC'}],
        }],
      }
      const first = await runDeploy(initial, api, cwd)
      expect(first.result.failed).toHaveLength(0)
      const page = api.statusPageBySlug('public')!
      expect(api.componentsForPage(page.id).map((c) => c.name)).toEqual(['API'])

      // Second deploy: add 2 more components. Inject a failure on the
      // first NEW component create. This goes through the UPDATE path
      // (page already exists) — exercising applyUpdate's child reconcile
      // catch, which is a different code path from applyCreate.
      const expanded: DevhelmConfig = {
        version: '1',
        statusPages: [{
          slug: 'public',
          name: 'Public Status',
          components: [
            {name: 'API', type: 'STATIC'},
            {name: 'Web', type: 'STATIC'},
            {name: 'Workers', type: 'STATIC'},
          ],
        }],
      }
      let newComponentPosts = 0
      api.injectFailure((req) => {
        if (req.method !== 'POST') return false
        if (!/^\/api\/v1\/status-pages\/[^/]+\/components$/.test(req.path)) return false
        newComponentPosts += 1
        return newComponentPosts === 1 // fail "Web"
      })

      const second = await runDeploy(expanded, api, cwd)
      expect(second.result.failed).toHaveLength(1)
      expect(second.result.failed[0].resourceType).toBe('statusPage')

      // "Workers" still landed despite "Web" failing in the same phase.
      expect(api.componentsForPage(page.id).map((c) => c.name).sort()).toEqual(['API', 'Workers'])

      // Partial state from the UPDATE path: page entry preserved
      // (forwarded from prior state by the deploy state-merge), children
      // map updated to reflect API truth (API + Workers, no Web).
      const pageState = second.state.resources['statusPages.public']
      expect(pageState).toBeDefined()
      expect(pageState.apiId).toBe(page.id)
      expect(Object.keys(pageState.children).sort()).toEqual([
        'components.API', 'components.Workers',
      ])

      // Third deploy converges Web.
      api.clearFailures()
      const third = await runDeploy(expanded, api, cwd)
      expect(third.result.failed).toHaveLength(0)
      expect(api.componentsForPage(page.id).map((c) => c.name).sort()).toEqual(['API', 'Web', 'Workers'])
    })
  })

  describe('(h) state pinning resolves out-of-band drift via PUT, not delete+create', () => {
    // Architectural value of the new persisted child state: when a child
    // is mutated out-of-band (e.g. someone hand-edited via the API), the
    // next deploy resolves identity by apiId from state, sees a snapshot
    // mismatch, and issues a corrective PUT — instead of delete+create
    // (which would lose history, downstream incidents, etc.).
    //
    // Without the partial-state plumbing we just added, after a partial
    // failure the page wouldn't be in state — and a subsequent out-of-
    // band rename would degrade to delete+create on the next deploy
    // because state-aware identity matching needs state to work.

    it('uses PUT to fix out-of-band drift after a partial failure', async () => {
      // First deploy: page with 2 components, fail the second create.
      // After this, state pins the page + the surviving "API" child.
      const config: DevhelmConfig = {
        version: '1',
        statusPages: [{
          slug: 'public',
          name: 'Public Status',
          components: [
            {name: 'API', type: 'STATIC', description: 'desired'},
            {name: 'Web', type: 'STATIC'},
          ],
        }],
      }
      let postCount = 0
      api.injectFailure((req) => {
        if (req.method !== 'POST') return false
        if (!/^\/api\/v1\/status-pages\/[^/]+\/components$/.test(req.path)) return false
        postCount += 1
        return postCount === 2 // fail Web
      })

      const first = await runDeploy(config, api, cwd)
      expect(first.result.failed).toHaveLength(1)
      const page = api.statusPageBySlug('public')!
      const apiCompId = api.componentsForPage(page.id)[0].id
      // State pins the surviving child under its name → apiId.
      expect(first.state.resources['statusPages.public'].children['components.API']?.apiId).toBe(apiCompId)

      // Out-of-band: someone changed the description directly on the
      // API. State pin remains valid (apiId unchanged).
      api.componentsForPage(page.id)[0].description = 'edited out of band'

      // Second deploy: clear failure. We expect:
      //  (a) Web gets created (the original failure converges), AND
      //  (b) the API component gets a PUT to restore description=desired.
      //      The PUT is identity-resolved via the state-pinned apiId,
      //      not via name lookup.
      api.clearFailures()
      const callsBefore = api.calls.length
      const second = await runDeploy(config, api, cwd)
      expect(second.result.failed).toHaveLength(0)

      const callsDuringSecond = api.calls.slice(callsBefore)
      const apiPuts = callsDuringSecond.filter((c) =>
        c.method === 'PUT' && c.path.endsWith(`/components/${apiCompId}`),
      )
      const apiDeletes = callsDuringSecond.filter((c) =>
        c.method === 'DELETE' && c.path.endsWith(`/components/${apiCompId}`),
      )
      // The drift was fixed via PUT — NOT delete+create.
      expect(apiPuts.length).toBeGreaterThanOrEqual(1)
      expect(apiDeletes).toHaveLength(0)

      // API component's description restored, id preserved (no recreate).
      const apiCompAfter = api.componentsForPage(page.id).find((c) => c.id === apiCompId)
      expect(apiCompAfter).toBeDefined()
      expect(apiCompAfter!.description).toBe('desired')

      // Web also created.
      expect(api.componentsForPage(page.id).map((c) => c.name).sort()).toEqual(['API', 'Web'])
    })
  })

  describe('(i) failed child delete is carried forward and retried', () => {
    it('keeps orphan tracked in state and retries on next deploy', async () => {
      // Setup: page with 2 components.
      const v1: DevhelmConfig = {
        version: '1',
        statusPages: [{
          slug: 'public',
          name: 'Public Status',
          components: [
            {name: 'API', type: 'STATIC'},
            {name: 'Web', type: 'STATIC'},
          ],
        }],
      }
      const first = await runDeploy(v1, api, cwd)
      expect(first.result.failed).toHaveLength(0)
      const page = api.statusPageBySlug('public')!
      const webId = api.componentsForPage(page.id).find((c) => c.name === 'Web')!.id

      // Second deploy: remove "Web". Fail its DELETE.
      const v2: DevhelmConfig = {
        version: '1',
        statusPages: [{
          slug: 'public',
          name: 'Public Status',
          components: [{name: 'API', type: 'STATIC'}],
        }],
      }
      api.injectFailure((req) =>
        req.method === 'DELETE' && req.path.endsWith(`/components/${webId}`),
      )

      const second = await runDeploy(v2, api, cwd)
      expect(second.result.failed).toHaveLength(1)

      // "Web" is still in API (delete failed) AND tracked in state with
      // its apiId so the next diff can find it again.
      expect(api.componentsForPage(page.id).map((c) => c.name).sort()).toEqual(['API', 'Web'])
      const pageState = second.state.resources['statusPages.public']
      expect(pageState.children['components.Web']?.apiId).toBe(webId)
      expect(pageState.children['components.API']).toBeDefined()

      // Third deploy: clear failure, retry. Delete must succeed.
      api.clearFailures()
      const third = await runDeploy(v2, api, cwd)
      expect(third.result.failed).toHaveLength(0)
      expect(api.componentsForPage(page.id).map((c) => c.name)).toEqual(['API'])

      const finalState = third.state.resources['statusPages.public']
      expect(Object.keys(finalState.children).sort()).toEqual(['components.API'])
    })
  })

  describe('(j) failed child update is retried on next deploy', () => {
    it('records empty-attrs marker so next diff still sees drift', async () => {
      // Setup: page with one component.
      const v1: DevhelmConfig = {
        version: '1',
        statusPages: [{
          slug: 'public',
          name: 'Public Status',
          components: [{name: 'API', type: 'STATIC'}],
        }],
      }
      const first = await runDeploy(v1, api, cwd)
      expect(first.result.failed).toHaveLength(0)
      const page = api.statusPageBySlug('public')!
      const apiCompId = api.componentsForPage(page.id)[0].id

      // Second deploy: change description (UPDATE on the child). Fail
      // the PUT. The child reconciler must record an "empty-attrs"
      // marker so the next diff still sees drift and retries.
      const v2: DevhelmConfig = {
        version: '1',
        statusPages: [{
          slug: 'public',
          name: 'Public Status',
          components: [{name: 'API', type: 'STATIC', description: 'Primary API endpoint'}],
        }],
      }
      api.injectFailure((req) =>
        req.method === 'PUT' && req.path.endsWith(`/components/${apiCompId}`),
      )

      const second = await runDeploy(v2, api, cwd)
      expect(second.result.failed).toHaveLength(1)
      // Description not applied (PUT failed).
      expect(api.componentsForPage(page.id)[0].description).toBeNull()

      // State: child still tracked by apiId, but attributes are EMPTY
      // (not the desired snapshot). This is the critical correctness
      // detail — if we'd stored the desired snapshot here, the next
      // diff would compare desired-vs-desired and see no drift.
      const pageState = second.state.resources['statusPages.public']
      expect(pageState.children['components.API']?.apiId).toBe(apiCompId)
      expect(pageState.children['components.API']?.attributes).toEqual({})

      // Third deploy: clear failure, retry. Update must succeed.
      api.clearFailures()
      const third = await runDeploy(v2, api, cwd)
      expect(third.result.failed).toHaveLength(0)
      expect(api.componentsForPage(page.id)[0].description).toBe('Primary API endpoint')

      // No-op afterwards (state is now correct).
      const fourth = await runDeploy(v2, api, cwd)
      expect(fourth.result.succeeded).toHaveLength(0)
      expect(fourth.result.failed).toHaveLength(0)
    })
  })
})
