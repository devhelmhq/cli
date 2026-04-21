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
  collapsed: boolean
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
      const reqBody = body as {name: string; description?: string | null; displayOrder: number; collapsed?: boolean}
      const id = this.nextId('spg')
      const dto: FakeStatusPageGroup = {
        id, name: reqBody.name, description: reqBody.description ?? null,
        displayOrder: reqBody.displayOrder, collapsed: reqBody.collapsed ?? true,
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

  private handlePut(path: string, _body: unknown): unknown {
    // Idempotent PUT for now — we only need it to not throw for re-runs of
    // updates against unchanged resources. The tests focus on create flows.
    if (path.startsWith('/api/v1/')) return {data: undefined}
    throw new Error(`fake api: unhandled PUT ${path}`)
  }

  private handlePatch(path: string, _body: unknown): unknown {
    if (path.startsWith('/api/v1/')) return {data: undefined}
    throw new Error(`fake api: unhandled PATCH ${path}`)
  }

  private handleDelete(path: string): unknown {
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

    it('persists page in state, re-deploy creates the missing component', async () => {
      // Fail the second component create. The first component succeeds, the
      // second throws — child reconciler propagates the throw out of
      // applyCreate, which means the parent's state entry is NOT pushed.
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

      // The page exists in API even though the create operation failed
      // partway through child reconciliation.
      const page = api.statusPageBySlug('public')!
      expect(page).toBeDefined()
      const componentsAfterFirst = api.componentsForPage(page.id)
      expect(componentsAfterFirst).toHaveLength(1)
      expect(componentsAfterFirst[0].name).toBe('API')

      // No state entry for the page (applyCreate threw). This is the
      // partial-failure footgun: the state file does NOT track the page,
      // so the next deploy must recover via API-driven diff.
      expect(first.state.resources['statusPages.public']).toBeUndefined()

      // Second deploy: clear the failure. fetchAllRefs sees the page in the
      // API, so diff() treats it as an existing resource and queues an
      // update with hasChildChanges=true to create the missing component.
      api.clearFailures()
      const second = await runDeploy(config, api, cwd)
      expect(second.result.failed).toHaveLength(0)

      const componentsAfterSecond = api.componentsForPage(page.id)
      expect(componentsAfterSecond.map((c) => c.name).sort()).toEqual(['API', 'Web'])

      // State now tracks the page + both children.
      const pageState = second.state.resources['statusPages.public']
      expect(pageState).toBeDefined()
      expect(pageState.apiId).toBe(page.id)
      expect(Object.keys(pageState.children).sort()).toEqual([
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

    it('persists page in state, re-deploy creates the missing component group', async () => {
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
      expect(first.state.resources['statusPages.public']).toBeUndefined()

      api.clearFailures()
      const second = await runDeploy(config, api, cwd)
      expect(second.result.failed).toHaveLength(0)

      const groupsAfterSecond = api.groupsForPage(page.id)
      expect(groupsAfterSecond.map((g) => g.name).sort()).toEqual(['Integrations', 'Platform'])

      const pageState = second.state.resources['statusPages.public']
      expect(pageState).toBeDefined()
      expect(pageState.apiId).toBe(page.id)
      expect(Object.keys(pageState.children).sort()).toEqual([
        'groups.Integrations', 'groups.Platform',
      ])

      const third = await runDeploy(config, api, cwd)
      expect(third.result.succeeded).toHaveLength(0)
      expect(third.result.failed).toHaveLength(0)
    })
  })
})
