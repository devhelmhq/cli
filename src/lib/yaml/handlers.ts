/**
 * Typed resource handlers — the single source of truth for each resource type's
 * identity, semantic comparison, API operations, and list fetching.
 *
 * Every handler is defined with FULL TypeScript generics over its YAML input type
 * (what the user writes in devhelm.yml), its API DTO type (what the API returns),
 * and a Snapshot type used for drift detection.
 *
 * Drift detection uses "snapshot comparison":
 *   - toDesiredSnapshot(yaml, api, refs) → TSnapshot  (what we WANT)
 *   - toCurrentSnapshot(api)             → TSnapshot  (what we HAVE)
 *   - hasChanged = !isEqual(desired, current)
 *
 * Snapshot types are derived from the OpenAPI-generated Update*Request schemas
 * (via Required<Schemas['UpdateXRequest']>).  This guarantees that when the API
 * contract changes — a field is added, removed, or renamed — the TypeScript
 * compiler immediately errors in the snapshot functions, preventing silent drift.
 *
 * Three resources use custom snapshot types because their update semantics
 * don't map 1:1 to an UpdateXRequest schema:
 *   - secret:       write-only value, compared by SHA-256 hash
 *   - alertChannel: complex config union, compared by content-addressed hash
 *   - dependency:   no single update endpoint (split across two API calls)
 *
 * Adding a new resource type requires:
 *   1. Adding it to HandledResourceType in types.ts
 *   2. Implementing a handler here (with snapshot functions)
 *   3. Adding it to HANDLER_MAP (TypeScript errors if you forget)
 */
import {createHash} from 'node:crypto'
import isEqual from 'lodash-es/isEqual.js'
import type {components} from '../api.generated.js'
import type {ApiClient} from '../api-client.js'
import type {ResolvedRefs} from './resolver.js'
import type {HandledResourceType, RefType} from './types.js'
import type {
  YamlTag, YamlEnvironment, YamlSecret, YamlAlertChannel,
  YamlNotificationPolicy, YamlWebhook, YamlResourceGroup,
  YamlMonitor, YamlDependency, YamlStatusPage,
  YamlStatusPageComponentGroup, YamlStatusPageComponent,
} from './schema.js'
import type {YamlSectionKey} from './schema.js'
import {
  toCreateTagRequest, toCreateEnvironmentRequest, toCreateSecretRequest,
  toCreateAlertChannelRequest, toCreateNotificationPolicyRequest,
  toCreateWebhookRequest, toCreateResourceGroupRequest,
  toCreateMonitorRequest, toUpdateMonitorRequest, toAuthConfig,
  toCreateAssertionRequest, toIncidentPolicy,
  toCreateStatusPageRequest, toUpdateStatusPageRequest, toBrandingRequest,
} from './transform.js'
import {fetchPaginated} from '../typed-api.js'
import {checkedFetch, apiPatch} from '../api-client.js'
import {apiPost, apiPut, apiDelete as apiDeleteRaw} from '../api-client.js'

/**
 * Coerce a freshly-created resource id to a string. The OpenAPI spec
 * types most ids as `string` (UUID), but the notification-policy create
 * response returns `number`, so the typed `.data.id` we read off
 * `checkedFetch` can be either. Stashing it in the YAML state file is
 * always string-shaped, hence the conversion here.
 *
 * Returns `undefined` when the response was 2xx but had no id at all —
 * the applier records that as a failure ("Create succeeded but API
 * returned no resource ID") so we don't lose the partial outcome.
 */
function idToString(id: string | number | null | undefined): string | undefined {
  if (id === null || id === undefined) return undefined
  return typeof id === 'string' ? id : String(id)
}
import type {ChildCollectionDef} from './child-reconciler.js'
import {diffChildren, applyChildDiff} from './child-reconciler.js'
import {PartialApplyError} from './apply-error.js'
import type {ChildStateEntry} from './state.js'

type Schemas = components['schemas']

// ── Public interface ────────────────────────────────────────────────────

/**
 * Generic handler for a YAML-managed resource type.
 *
 * TYaml = the type the user writes in devhelm.yml (e.g. YamlTag)
 * TApiDto = the DTO the API returns (e.g. TagDto)
 *
 * The registry stores ResourceHandler (defaults → unknown) for heterogeneous
 * storage.  defineHandler verifies all field accesses at compile time,
 * then type-erases to the default form.
 */
/**
 * Rich outcome for handlers that manage child collections. Handlers that
 * don't manage children can still return a bare string (for applyCreate) or
 * void (for applyUpdate); the applier normalizes both forms.
 */
export interface ApplyOutcome {
  id?: string
  children?: Record<string, ChildStateEntry>
}

/**
 * Live snapshot of a child resource fetched from the API at plan time.
 *
 * The differ feeds these to `hasChildChanges` so child drift is detected
 * against the API truth, not against `state.json` (which v3 no longer
 * stores attributes for — see RFC 0001). `apiId` is preserved alongside
 * the snapshot to keep state-aware rename matching working.
 */
export interface CurrentChildEntry {
  apiId: string
  snapshot: Record<string, unknown>
}

export interface ResourceHandler<TYaml = unknown, TApiDto = unknown> {
  readonly resourceType: HandledResourceType
  readonly refType: RefType
  readonly configKey: YamlSectionKey
  readonly listPath: string

  getRefKey(yaml: TYaml): string
  getApiRefKey(api: TApiDto): string
  getApiId(api: TApiDto): string
  getManagedBy?(api: TApiDto): string | undefined

  hasChanged(yaml: TYaml, api: TApiDto, refs: ResolvedRefs): boolean

  /**
   * Detect changes inside child collections (e.g. status-page components,
   * groups). Implementing this is what lets the differ queue an update when
   * only the children differ — without it, statusPageHandler.hasChanged
   * would compare parent fields only and miss "user added a new component".
   *
   * **v3 contract**: `currentChildren` is fetched live from the API by the
   * differ via `fetchChildSnapshots` immediately before this is called.
   * That means cross-environment drift (e.g. a deploy from machine A
   * followed by a plan from machine B with no `state pull`) is detected
   * correctly without relying on `state.json`'s attributes.
   */
  hasChildChanges?(yaml: TYaml, currentChildren: Record<string, CurrentChildEntry>): boolean

  /**
   * Fetch live child snapshots for a parent. Required if `hasChildChanges`
   * is implemented. Called by the differ in parallel for every parent that
   * already exists in the API. The returned map is keyed `<collection>.<name>`
   * (e.g. `groups.Platform`) for parity with the apply path's state keys.
   */
  fetchChildSnapshots?(
    parentApiId: string,
    client: ApiClient,
    refs: ResolvedRefs,
  ): Promise<Record<string, CurrentChildEntry>>

  fetchAll(client: ApiClient): Promise<TApiDto[]>
  applyCreate(
    yaml: TYaml, refs: ResolvedRefs, client: ApiClient, priorChildren?: Record<string, ChildStateEntry>,
  ): Promise<ApplyOutcome | string | undefined>
  applyUpdate(
    yaml: TYaml, existingId: string, refs: ResolvedRefs, client: ApiClient, priorChildren?: Record<string, ChildStateEntry>,
  ): Promise<ApplyOutcome | void>
  deletePath(id: string, refKey: string): string

  /** Compute per-field attribute diffs between desired YAML and current API state */
  computeAttributeDiffs?(yaml: TYaml, api: TApiDto, refs: ResolvedRefs): Array<{field: string; old: unknown; new: unknown}>
}

// ── Handler definition (snapshot-based) ─────────────────────────────────

/**
 * Input shape for defineHandler.  Handlers provide two snapshot functions
 * that both return TSnapshot.  hasChanged is automatically derived from
 * snapshot comparison — handlers never implement it manually.
 */
interface HandlerDef<TYaml, TApiDto, TSnapshot> {
  readonly resourceType: HandledResourceType
  readonly refType: RefType
  readonly configKey: YamlSectionKey
  readonly listPath: string

  getRefKey(yaml: TYaml): string
  getApiRefKey(api: TApiDto): string
  getApiId(api: TApiDto): string
  getManagedBy?: (api: TApiDto) => string | undefined

  toDesiredSnapshot(yaml: TYaml, api: TApiDto, refs: ResolvedRefs): TSnapshot
  toCurrentSnapshot(api: TApiDto): TSnapshot

  /** Optional: report drift inside child collections using live API data. */
  hasChildChanges?(yaml: TYaml, currentChildren: Record<string, CurrentChildEntry>): boolean

  /** Optional: fetch child snapshots from the API for plan-time diffing. */
  fetchChildSnapshots?(
    parentApiId: string,
    client: ApiClient,
    refs: ResolvedRefs,
  ): Promise<Record<string, CurrentChildEntry>>

  fetchAll(client: ApiClient): Promise<TApiDto[]>
  applyCreate(
    yaml: TYaml, refs: ResolvedRefs, client: ApiClient, priorChildren?: Record<string, ChildStateEntry>,
  ): Promise<ApplyOutcome | string | undefined>
  applyUpdate(
    yaml: TYaml, existingId: string, refs: ResolvedRefs, client: ApiClient, priorChildren?: Record<string, ChildStateEntry>,
  ): Promise<ApplyOutcome | void>
  deletePath(id: string, refKey: string): string
}

/**
 * Normalize the possibly-string return of applyCreate into a uniform outcome.
 */
export function normalizeCreateOutcome(raw: ApplyOutcome | string | undefined): ApplyOutcome | undefined {
  if (raw === undefined) return undefined
  if (typeof raw === 'string') return {id: raw}
  return raw
}

/**
 * Normalize the possibly-void return of applyUpdate into a uniform outcome.
 */
export function normalizeUpdateOutcome(raw: ApplyOutcome | void): ApplyOutcome {
  return raw ?? {}
}

/**
 * Type-checking bridge: takes a handler definition with full generic types,
 * derives hasChanged from snapshot comparison, then type-erases to
 * ResourceHandler (defaults) for registry storage.
 */
function defineHandler<TYaml, TApiDto, TSnapshot>(
  h: HandlerDef<TYaml, TApiDto, TSnapshot>,
): ResourceHandler {
  const handler: ResourceHandler<TYaml, TApiDto> = {
    resourceType: h.resourceType,
    refType: h.refType,
    configKey: h.configKey,
    listPath: h.listPath,

    getRefKey: h.getRefKey,
    getApiRefKey: h.getApiRefKey,
    getApiId: h.getApiId,
    getManagedBy: h.getManagedBy,

    hasChanged(yaml: TYaml, api: TApiDto, refs: ResolvedRefs): boolean {
      return !isEqual(h.toDesiredSnapshot(yaml, api, refs), h.toCurrentSnapshot(api))
    },

    hasChildChanges: h.hasChildChanges,
    fetchChildSnapshots: h.fetchChildSnapshots,

    computeAttributeDiffs(yaml: TYaml, api: TApiDto, refs: ResolvedRefs) {
      const desired = h.toDesiredSnapshot(yaml, api, refs) as Record<string, unknown>
      const current = h.toCurrentSnapshot(api) as Record<string, unknown>
      const diffs: Array<{field: string; old: unknown; new: unknown}> = []
      const allKeys = new Set([...Object.keys(desired), ...Object.keys(current)])
      for (const key of allKeys) {
        if (!isEqual(desired[key], current[key])) {
          diffs.push({field: key, old: current[key], new: desired[key]})
        }
      }
      return diffs
    },

    fetchAll: h.fetchAll,
    applyCreate: h.applyCreate,
    applyUpdate: h.applyUpdate,
    deletePath: h.deletePath,
  }
  // SAFETY: ResourceHandler<TYaml, TApiDto> → ResourceHandler<unknown, unknown>.
  // Method params are contravariant, so TS rejects the direct assignment.
  // defineHandler already verified all field accesses at compile time;
  // the registry only calls methods with the correct concrete types
  // (routed through HANDLER_MAP keyed by HandledResourceType).
  return handler as unknown as ResourceHandler
}

// ── Shared helpers ──────────────────────────────────────────────────────

function nonNullStrings(arr: (string | null)[] | null | undefined): string[] {
  return (arr ?? []).filter((v): v is string => v !== null)
}

function sortedIds<T extends string>(ids: readonly T[]): T[] {
  return [...ids].sort()
}

/**
 * Recursively strip `null` and `undefined` properties from an object/array
 * tree so two snapshots that only differ in "field absent" vs "field
 * explicitly null" compare equal under `lodash.isEqual`.
 *
 * Why this exists: Java DTOs serialize all fields, including unset ones, as
 * `null`. The user's YAML rarely sets every optional field. So a freshly-
 * created HTTP monitor reads back from the API with `customHeaders: null,
 * requestBody: null, contentType: null, verifyTls: null` while the desired
 * snapshot built straight from YAML only has `{url, method}`. Without this
 * normalization, `plan` reports phantom drift on every run for monitors,
 * notification policies, etc.
 *
 * Important: snapshot comparison is the *only* place this is appropriate.
 * Do NOT use this on outbound API request bodies — there `null` carries
 * "explicitly clear this field" semantics that we must preserve.
 */
function stripNullish<T>(value: T): T {
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) {
    // SAFETY: T is narrowed to an array type by the guard above, but TS
    // can't re-narrow the generic. The mapped array preserves the runtime
    // shape, so the cast back to T is sound.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Array.isArray narrows to any[]; cast is verified by the guard
    return value.map((v) => stripNullish(v)) as unknown as T
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === null || v === undefined) continue
      out[k] = stripNullish(v)
    }
    return out as T
  }
  return value
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}

/**
 * Deterministic JSON serialization with alphabetically sorted keys at every
 * nesting level.  Produces the same output regardless of JS engine key
 * insertion order, matching the Java-side TreeMap-based canonical JSON.
 */
export function stableStringify(obj: unknown): string {
  if (obj === null || obj === undefined) return 'null'
  if (typeof obj !== 'object') return JSON.stringify(obj)
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']'
  const record = obj as Record<string, unknown>
  const keys = Object.keys(record).sort()
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(record[k])).join(',') + '}'
}

// ── Tag ─────────────────────────────────────────────────────────────────

type TagSnapshot = Required<Schemas['UpdateTagRequest']>

const tagHandler = defineHandler<YamlTag, Schemas['TagDto'], TagSnapshot>({
  resourceType: 'tag',
  refType: 'tags',
  configKey: 'tags',
  listPath: '/api/v1/tags',

  getRefKey: (yaml) => yaml.name,
  getApiRefKey: (api) => api.name ?? '',
  getApiId: (api) => String(api.id ?? ''),

  toDesiredSnapshot: (yaml, api) => ({
    name: yaml.name,
    color: yaml.color ?? api.color ?? null,
  }),
  toCurrentSnapshot: (api) => ({
    name: api.name ?? null,
    color: api.color ?? null,
  }),

  fetchAll: (client) => fetchPaginated<Schemas['TagDto']>(client, '/api/v1/tags'),

  async applyCreate(yaml, _refs, client) {
    const resp = await checkedFetch(client.POST('/api/v1/tags', {body: toCreateTagRequest(yaml)}))
    return idToString(resp?.data?.id)
  },
  async applyUpdate(yaml, id, _refs, client) {
    const body = toCreateTagRequest(yaml) as Schemas['UpdateTagRequest']
    await checkedFetch(client.PUT('/api/v1/tags/{id}', {params: {path: {id}}, body}))
  },
  deletePath: (id) => `/api/v1/tags/${id}`,
})

// ── Environment ─────────────────────────────────────────────────────────

type EnvironmentSnapshot = Required<Schemas['UpdateEnvironmentRequest']>

const environmentHandler = defineHandler<YamlEnvironment, Schemas['EnvironmentDto'], EnvironmentSnapshot>({
  resourceType: 'environment',
  refType: 'environments',
  configKey: 'environments',
  listPath: '/api/v1/environments',

  getRefKey: (yaml) => yaml.slug,
  getApiRefKey: (api) => api.slug ?? '',
  getApiId: (api) => String(api.id ?? ''),

  toDesiredSnapshot: (yaml, api) => ({
    name: yaml.name,
    isDefault: yaml.isDefault ?? api.isDefault ?? null,
    variables: yaml.variables ?? api.variables ?? null,
  }),
  toCurrentSnapshot: (api) => ({
    name: api.name ?? null,
    isDefault: api.isDefault ?? null,
    variables: api.variables ?? null,
  }),

  fetchAll: (client) => fetchPaginated<Schemas['EnvironmentDto']>(client, '/api/v1/environments'),

  async applyCreate(yaml, _refs, client) {
    const resp = await checkedFetch(client.POST('/api/v1/environments', {body: toCreateEnvironmentRequest(yaml)}))
    return idToString(resp?.data?.id)
  },
  async applyUpdate(yaml, id, refs, client) {
    // The environment API uses slug as the path key and does not support
    // renaming a slug via UpdateEnvironmentRequest (no `slug` field).
    // If the YAML slug diverges from the slug currently stored in the API
    // (e.g. user renamed via a `moved` block), the update would 404.
    // Surface a clear, actionable error instead of letting it fail at the
    // network layer.
    const current = refs.findById('environments', id)?.raw
    const currentSlug = current?.slug ?? yaml.slug
    if (currentSlug !== yaml.slug) {
      throw new Error(
        `Cannot rename environment slug from "${currentSlug}" to "${yaml.slug}": ` +
        `the API does not support slug changes. Delete the environment and ` +
        `re-create it with the new slug, or revert the slug in YAML.`,
      )
    }
    await checkedFetch(client.PUT('/api/v1/environments/{slug}', {
      params: {path: {slug: currentSlug}},
      body: {
        name: yaml.name, variables: yaml.variables ?? null, isDefault: yaml.isDefault ?? null,
      },
    }))
  },
  // Deletes use the YAML refKey (= slug pre-rename). After a `moved` block
  // the YAML slug may differ from the API slug; the planner-level check in
  // `validatePlanRefs` rejects that combination before reaching apply, so
  // refKey here is always the real API slug.
  deletePath: (_id, refKey) => `/api/v1/environments/${encodeURIComponent(refKey)}`,
})

// ── Secret ──────────────────────────────────────────────────────────────

// Custom snapshot: the API never returns the plaintext value (write-only),
// so we compare by SHA-256 hash instead of using UpdateSecretRequest.
type SecretSnapshot = { key: string; valueHash: string }

const secretHandler = defineHandler<YamlSecret, Schemas['SecretDto'], SecretSnapshot>({
  resourceType: 'secret',
  refType: 'secrets',
  configKey: 'secrets',
  listPath: '/api/v1/secrets',

  getRefKey: (yaml) => yaml.key,
  getApiRefKey: (api) => api.key ?? '',
  getApiId: (api) => String(api.id ?? ''),

  toDesiredSnapshot: (yaml) => ({
    key: yaml.key,
    valueHash: sha256Hex(yaml.value),
  }),
  toCurrentSnapshot: (api) => ({
    key: api.key ?? '',
    valueHash: api.valueHash ?? '',
  }),

  fetchAll: (client) => fetchPaginated<Schemas['SecretDto']>(client, '/api/v1/secrets'),

  async applyCreate(yaml, _refs, client) {
    const resp = await checkedFetch(client.POST('/api/v1/secrets', {body: toCreateSecretRequest(yaml)}))
    return idToString(resp?.data?.id)
  },
  async applyUpdate(yaml, _id, _refs, client) {
    await checkedFetch(client.PUT('/api/v1/secrets/{key}', {params: {path: {key: yaml.key}}, body: {value: yaml.value}}))
  },
  deletePath: (id) => `/api/v1/secrets/${id}`,
})

// ── Alert Channel ───────────────────────────────────────────────────────

// Custom snapshot: config is a complex discriminated union, compared by
// content-addressed SHA-256 hash (matching the API's configHash field).
type AlertChannelSnapshot = { name: string; channelType: string; configHash: string }

const alertChannelHandler = defineHandler<YamlAlertChannel, Schemas['AlertChannelDto'], AlertChannelSnapshot>({
  resourceType: 'alertChannel',
  refType: 'alertChannels',
  configKey: 'alertChannels',
  listPath: '/api/v1/alert-channels',

  getRefKey: (yaml) => yaml.name,
  getApiRefKey: (api) => api.name,
  getApiId: (api) => api.id,

  toDesiredSnapshot: (yaml) => {
    const req = toCreateAlertChannelRequest(yaml)
    // Strip nullish before hashing so we match the API's canonicalConfigHash,
    // which also strips nulls before computing the hash. Without this, any
    // YAML that explicitly sets an optional field to `null` (rare but
    // possible) would produce a different hash than the API.
    return {
      name: req.name,
      channelType: yaml.config.channelType,
      configHash: sha256Hex(stableStringify(stripNullish(req.config))),
    }
  },
  toCurrentSnapshot: (api) => ({
    name: api.name,
    channelType: api.channelType?.toLowerCase?.() ?? '',
    configHash: api.configHash ?? '',
  }),

  fetchAll: (client) => fetchPaginated<Schemas['AlertChannelDto']>(client, '/api/v1/alert-channels'),

  async applyCreate(yaml, _refs, client) {
    const resp = await checkedFetch(client.POST('/api/v1/alert-channels', {body: toCreateAlertChannelRequest(yaml)}))
    return idToString(resp?.data?.id)
  },
  async applyUpdate(yaml, id, _refs, client) {
    await checkedFetch(client.PUT('/api/v1/alert-channels/{id}', {params: {path: {id}}, body: toCreateAlertChannelRequest(yaml)}))
  },
  deletePath: (id) => `/api/v1/alert-channels/${id}`,
})

// ── Notification Policy ─────────────────────────────────────────────────

type NotificationPolicySnapshot = Required<Schemas['UpdateNotificationPolicyRequest']>

const notificationPolicyHandler = defineHandler<YamlNotificationPolicy, Schemas['NotificationPolicyDto'], NotificationPolicySnapshot>({
  resourceType: 'notificationPolicy',
  refType: 'notificationPolicies',
  configKey: 'notificationPolicies',
  listPath: '/api/v1/notification-policies',

  getRefKey: (yaml) => yaml.name,
  getApiRefKey: (api) => api.name ?? '',
  getApiId: (api) => String(api.id ?? ''),

  toDesiredSnapshot: (yaml, api, refs) => {
    const req = toCreateNotificationPolicyRequest(yaml, refs)
    return {
      name: req.name,
      enabled: req.enabled ?? api.enabled ?? true,
      priority: req.priority ?? api.priority ?? 0,
      // matchRules from the request shape carry deeply-nested null fields
      // (monitorIds, regions, values, etc.) while the API echoes the same
      // shape with the same nulls — but if the user omits matchRules we
      // get [] vs null asymmetry. stripNullish flattens both to a stable
      // shape for comparison.
      matchRules: stripNullish(req.matchRules ?? api.matchRules ?? []),
      escalation: stripNullish(req.escalation),
    }
  },
  toCurrentSnapshot: (api) => ({
    name: api.name ?? '',
    enabled: api.enabled ?? true,
    priority: api.priority ?? 0,
    matchRules: stripNullish(api.matchRules ?? []),
    escalation: stripNullish(api.escalation ?? {steps: [], onResolve: null, onReopen: null}),
  }),

  fetchAll: (client) => fetchPaginated<Schemas['NotificationPolicyDto']>(client, '/api/v1/notification-policies'),

  async applyCreate(yaml, refs, client) {
    const resp = await checkedFetch(client.POST('/api/v1/notification-policies', {body: toCreateNotificationPolicyRequest(yaml, refs)}))
    return idToString(resp?.data?.id)
  },
  async applyUpdate(yaml, id, refs, client) {
    const body = toCreateNotificationPolicyRequest(yaml, refs) as Schemas['UpdateNotificationPolicyRequest']
    await checkedFetch(client.PUT('/api/v1/notification-policies/{id}', {params: {path: {id}}, body}))
  },
  deletePath: (id) => `/api/v1/notification-policies/${id}`,
})

// ── Webhook ─────────────────────────────────────────────────────────────

type WebhookSnapshot = Required<Schemas['UpdateWebhookEndpointRequest']>

const webhookHandler = defineHandler<YamlWebhook, Schemas['WebhookEndpointDto'], WebhookSnapshot>({
  resourceType: 'webhook',
  refType: 'webhooks',
  configKey: 'webhooks',
  listPath: '/api/v1/webhooks',

  getRefKey: (yaml) => yaml.url,
  getApiRefKey: (api) => api.url ?? '',
  getApiId: (api) => String(api.id ?? ''),

  toDesiredSnapshot: (yaml, api) => ({
    url: yaml.url,
    description: yaml.description ?? api.description ?? null,
    subscribedEvents: sortedIds(yaml.subscribedEvents),
    enabled: yaml.enabled ?? api.enabled ?? true,
  }),
  toCurrentSnapshot: (api) => ({
    url: api.url ?? null,
    description: api.description ?? null,
    // Cast: spec asymmetry — `CreateWebhookEndpointRequest.subscribedEvents`
    // narrows items to the WEBHOOK_EVENT_TYPES enum, but the response DTO
    // emits plain `string[]`. The API only ever returns valid event types
    // (it's the same backing column as the request enum), so this cast is
    // safe; remove once the OpenAPI spec adds the enum to the DTO too.
    subscribedEvents: api.subscribedEvents
      ? (sortedIds(api.subscribedEvents) as WebhookSnapshot['subscribedEvents'])
      : null,
    enabled: api.enabled ?? null,
  }),

  fetchAll: (client) => fetchPaginated<Schemas['WebhookEndpointDto']>(client, '/api/v1/webhooks'),

  async applyCreate(yaml, _refs, client) {
    const resp = await checkedFetch(client.POST('/api/v1/webhooks', {body: toCreateWebhookRequest(yaml)}))
    return idToString(resp?.data?.id)
  },
  async applyUpdate(yaml, id, _refs, client) {
    const body = {
      ...toCreateWebhookRequest(yaml),
      enabled: yaml.enabled ?? null,
    } as Schemas['UpdateWebhookEndpointRequest']
    await checkedFetch(client.PUT('/api/v1/webhooks/{id}', {params: {path: {id}}, body}))
  },
  deletePath: (id) => `/api/v1/webhooks/${id}`,
})

// ── Resource Group ──────────────────────────────────────────────────────

// defaultRetryStrategy is optional (not nullable) in the Update schema,
// but a group can legitimately have none, so we add | null.
// managedBy is a mutation signal (provenance), not declarative state —
// snapshots should ignore it the same way the Monitor handler does.
type ResourceGroupSnapshotBase = Required<Omit<Schemas['UpdateResourceGroupRequest'], 'managedBy'>>
type ResourceGroupSnapshot = Omit<ResourceGroupSnapshotBase, 'defaultRetryStrategy'> & {
  defaultRetryStrategy: ResourceGroupSnapshotBase['defaultRetryStrategy'] | null
}

const resourceGroupHandler = defineHandler<YamlResourceGroup, Schemas['ResourceGroupDto'], ResourceGroupSnapshot>({
  resourceType: 'resourceGroup',
  refType: 'resourceGroups',
  configKey: 'resourceGroups',
  listPath: '/api/v1/resource-groups',

  getRefKey: (yaml) => yaml.name,
  getApiRefKey: (api) => api.name ?? '',
  getApiId: (api) => String(api.id ?? ''),

  toDesiredSnapshot: (yaml, api, refs) => ({
    name: yaml.name,
    description: yaml.description ?? api.description ?? null,
    alertPolicyId: yaml.alertPolicy !== undefined
      ? (refs.resolve('notificationPolicies', yaml.alertPolicy) ?? null)
      : (api.alertPolicyId ?? null),
    defaultFrequency: yaml.defaultFrequency ?? api.defaultFrequency ?? null,
    defaultRegions: yaml.defaultRegions !== undefined
      ? sortedIds(yaml.defaultRegions)
      : (api.defaultRegions ? sortedIds(nonNullStrings(api.defaultRegions)) : null),
    defaultRetryStrategy: yaml.defaultRetryStrategy ?? api.defaultRetryStrategy ?? null,
    defaultAlertChannels: yaml.defaultAlertChannels !== undefined
      ? sortedIds(yaml.defaultAlertChannels.map((n) => refs.resolve('alertChannels', n) ?? n))
      : (api.defaultAlertChannels ? sortedIds(nonNullStrings(api.defaultAlertChannels)) : null),
    defaultEnvironmentId: yaml.defaultEnvironment !== undefined
      ? (refs.resolve('environments', yaml.defaultEnvironment) ?? null)
      : (api.defaultEnvironmentId ?? null),
    healthThresholdType: yaml.healthThresholdType ?? api.healthThresholdType ?? null,
    healthThresholdValue: yaml.healthThresholdValue ?? api.healthThresholdValue ?? null,
    suppressMemberAlerts: yaml.suppressMemberAlerts ?? api.suppressMemberAlerts ?? null,
    confirmationDelaySeconds: yaml.confirmationDelaySeconds ?? api.confirmationDelaySeconds ?? null,
    recoveryCooldownMinutes: yaml.recoveryCooldownMinutes ?? api.recoveryCooldownMinutes ?? null,
  }),
  toCurrentSnapshot: (api) => ({
    name: api.name ?? '',
    description: api.description ?? null,
    alertPolicyId: api.alertPolicyId ?? null,
    defaultFrequency: api.defaultFrequency ?? null,
    defaultRegions: api.defaultRegions ? sortedIds(nonNullStrings(api.defaultRegions)) : null,
    defaultRetryStrategy: api.defaultRetryStrategy ?? null,
    defaultAlertChannels: api.defaultAlertChannels ? sortedIds(nonNullStrings(api.defaultAlertChannels)) : null,
    defaultEnvironmentId: api.defaultEnvironmentId ?? null,
    healthThresholdType: api.healthThresholdType ?? null,
    healthThresholdValue: api.healthThresholdValue ?? null,
    suppressMemberAlerts: api.suppressMemberAlerts ?? null,
    confirmationDelaySeconds: api.confirmationDelaySeconds ?? null,
    recoveryCooldownMinutes: api.recoveryCooldownMinutes ?? null,
  }),

  fetchAll: (client) => fetchPaginated<Schemas['ResourceGroupDto']>(client, '/api/v1/resource-groups'),

  async applyCreate(yaml, refs, client) {
    const resp = await checkedFetch(client.POST('/api/v1/resource-groups', {body: toCreateResourceGroupRequest(yaml, refs)}))
    return idToString(resp?.data?.id)
  },
  async applyUpdate(yaml, id, refs, client) {
    await checkedFetch(client.PUT('/api/v1/resource-groups/{id}', {params: {path: {id}}, body: toCreateResourceGroupRequest(yaml, refs)}))
  },
  deletePath: (id) => `/api/v1/resource-groups/${id}`,
})

// ── Monitor ─────────────────────────────────────────────────────────────

// Derived from UpdateMonitorRequest minus control-only fields (clearAuth,
// clearEnvironmentId, managedBy) that are mutation signals, not state.
// auth and incidentPolicy need | null because monitors can lack them.
type MonitorSnapshotBase = Required<Omit<Schemas['UpdateMonitorRequest'], 'clearEnvironmentId' | 'clearAuth' | 'managedBy'>>
type MonitorSnapshot = Omit<MonitorSnapshotBase, 'auth' | 'incidentPolicy'> & {
  auth: MonitorSnapshotBase['auth'] | null
  incidentPolicy: MonitorSnapshotBase['incidentPolicy'] | null
}

const monitorHandler = defineHandler<YamlMonitor, Schemas['MonitorDto'], MonitorSnapshot>({
  resourceType: 'monitor',
  refType: 'monitors',
  configKey: 'monitors',
  listPath: '/api/v1/monitors',

  getRefKey: (yaml) => yaml.name,
  getApiRefKey: (api) => api.name ?? '',
  getApiId: (api) => String(api.id ?? ''),
  getManagedBy: (api) => api.managedBy,

  toDesiredSnapshot: (yaml, api, refs) => ({
    name: yaml.name,
    // The API echoes back JSONB configs with every optional field expanded
    // to null; the user's YAML almost never spells those out. Normalize both
    // sides by stripping null/undefined so we don't loop on phantom drift.
    // SAFETY: yaml.config is pre-validated by the Zod monitor config schema
    // (dispatched by monitor.type), so it structurally matches the API config
    // union. The double-cast bridges the YAML config type to the API snapshot
    // config type which TS can't prove equivalent.
    config: stripNullish(yaml.config) as unknown as MonitorSnapshot['config'],
    frequencySeconds: yaml.frequencySeconds ?? api.frequencySeconds ?? null,
    enabled: yaml.enabled ?? api.enabled ?? null,
    regions: yaml.regions !== undefined
      ? sortedIds(yaml.regions)
      : (api.regions ? sortedIds(api.regions) : null),
    environmentId: yaml.environment === null
      ? null
      : yaml.environment !== undefined
        ? (refs.resolve('environments', yaml.environment) ?? null)
        : (api.environment?.id ?? null),
    assertions: yaml.assertions !== undefined
      ? sortAssertions(yaml.assertions.map(toCreateAssertionRequest))
      : apiAssertionsToSnapshot(api.assertions),
    auth: yaml.auth === null
      ? null
      : yaml.auth !== undefined
        ? (toAuthConfig(yaml.auth, refs) ?? null)
        : (api.auth ?? null),
    incidentPolicy: yaml.incidentPolicy !== undefined
      ? toIncidentPolicy(yaml.incidentPolicy)
      : apiIncidentPolicyToSnapshot(api.incidentPolicy),
    alertChannelIds: yaml.alertChannels !== undefined
      ? sortedIds(yaml.alertChannels.map((n) => refs.resolve('alertChannels', n) ?? n))
      : (api.alertChannelIds ? sortedIds(nonNullStrings(api.alertChannelIds)) : null),
    tags: yaml.tags !== undefined
      ? {
        tagIds: sortedIds(yaml.tags.map((n) => refs.resolve('tags', n)).filter((id): id is string => id !== undefined)),
        newTags: yaml.tags.filter((n) => !refs.resolve('tags', n)).map((n) => ({name: n})),
      }
      : apiTagsToSnapshot(api),
  }),
  toCurrentSnapshot: (api) => ({
    name: api.name ?? null,
    config: stripNullish(api.config) as MonitorSnapshot['config'],
    frequencySeconds: api.frequencySeconds ?? null,
    enabled: api.enabled ?? null,
    regions: api.regions ? sortedIds(api.regions) : null,
    environmentId: api.environment?.id ?? null,
    assertions: apiAssertionsToSnapshot(api.assertions),
    auth: api.auth ?? null,
    incidentPolicy: apiIncidentPolicyToSnapshot(api.incidentPolicy),
    alertChannelIds: api.alertChannelIds ? sortedIds(nonNullStrings(api.alertChannelIds)) : null,
    tags: apiTagsToSnapshot(api),
  }),

  fetchAll: (client) => fetchPaginated<Schemas['MonitorDto']>(client, '/api/v1/monitors'),

  async applyCreate(yaml, refs, client) {
    const resp = await checkedFetch(client.POST('/api/v1/monitors', {body: toCreateMonitorRequest(yaml, refs)}))
    return idToString(resp?.data?.id)
  },
  async applyUpdate(yaml, id, refs, client) {
    // YAML `auth: null` / `environment: null` signals an explicit clear,
    // which `toUpdateMonitorRequest` translates into the API's
    // `clearAuth` / `clearEnvironmentId` flags. Omitting the field
    // entirely preserves the current API value.
    await checkedFetch(client.PUT('/api/v1/monitors/{id}', {
      params: {path: {id}},
      body: toUpdateMonitorRequest(yaml, refs),
    }))
  },
  deletePath: (id) => `/api/v1/monitors/${id}`,
})

// ── Monitor snapshot helpers ─────────────────────────────────────────────

function sortAssertions(
  assertions: Schemas['CreateAssertionRequest'][],
): Schemas['CreateAssertionRequest'][] {
  return [...assertions].sort((a, b) => {
    const aType = (a.config as {type: string}).type
    const bType = (b.config as {type: string}).type
    return aType.localeCompare(bType)
  })
}

function apiAssertionsToSnapshot(
  assertions: Schemas['MonitorDto']['assertions'],
): Schemas['CreateAssertionRequest'][] | null {
  if (!assertions) return null
  return sortAssertions(assertions.map((a) => ({
    config: a.config as Schemas['CreateAssertionRequest']['config'],
    severity: a.severity,
  })))
}

function apiIncidentPolicyToSnapshot(
  policy: Schemas['MonitorDto']['incidentPolicy'],
): Schemas['UpdateIncidentPolicyRequest'] | null {
  if (!policy) return null
  return {
    triggerRules: policy.triggerRules ?? [],
    confirmation: policy.confirmation ?? {type: 'multi_region'},
    recovery: policy.recovery ?? {consecutiveSuccesses: 1, minRegionsPassing: 1, cooldownMinutes: 0},
  }
}

function apiTagsToSnapshot(api: Schemas['MonitorDto']): Schemas['AddMonitorTagsRequest'] {
  // Always return {tagIds: [], newTags: []} for "no tags" so it compares
  // structurally identical to a desired snapshot built from `tags: []` in
  // YAML. Returning {tagIds: null, ...} produced spurious diffs because
  // toDesiredSnapshot uses sortedIds([]) === [] for the empty case.
  if (!api.tags || api.tags.length === 0) return {tagIds: [], newTags: []}
  return {
    tagIds: sortedIds(api.tags.map((t) => String(t.id ?? '')).filter(Boolean)),
    newTags: [],
  }
}

// ── Dependency ──────────────────────────────────────────────────────────

// Custom snapshot: there is no single UpdateDependencyRequest — updates are
// split across UpdateAlertSensitivityRequest and a generic PATCH.
type DependencySnapshot = { alertSensitivity: string | null; component: string | null }

const dependencyHandler = defineHandler<YamlDependency, Schemas['ServiceSubscriptionDto'], DependencySnapshot>({
  resourceType: 'dependency',
  refType: 'dependencies',
  configKey: 'dependencies',
  listPath: '/api/v1/service-subscriptions',

  getRefKey: (yaml) => yaml.service,
  getApiRefKey: (api) => api.slug ?? '',
  getApiId: (api) => String(api.subscriptionId ?? ''),

  toDesiredSnapshot: (yaml, api) => ({
    alertSensitivity: yaml.alertSensitivity ?? api.alertSensitivity ?? null,
    component: yaml.component ?? api.componentId ?? null,
  }),
  toCurrentSnapshot: (api) => ({
    alertSensitivity: api.alertSensitivity ?? null,
    component: api.componentId ?? null,
  }),

  fetchAll: (client) => fetchPaginated<Schemas['ServiceSubscriptionDto']>(client, '/api/v1/service-subscriptions'),

  async applyCreate(yaml, _refs, client) {
    const resp = await checkedFetch(client.POST('/api/v1/service-subscriptions/{slug}', {
      params: {path: {slug: yaml.service}},
      body: {
        alertSensitivity: yaml.alertSensitivity ?? null,
        componentId: yaml.component ?? null,
      },
    }))
    return idToString(resp?.data?.subscriptionId)
  },
  async applyUpdate(yaml, id, _refs, client) {
    if (yaml.alertSensitivity !== undefined) {
      await checkedFetch(client.PATCH('/api/v1/service-subscriptions/{id}/alert-sensitivity', {
        params: {path: {id}},
        body: {alertSensitivity: yaml.alertSensitivity},
      }))
    }
    if (yaml.component !== undefined) {
      await apiPatch(client, `/api/v1/service-subscriptions/${id}`, {componentId: yaml.component})
    }
  },
  deletePath: (id) => `/api/v1/service-subscriptions/${id}`,
})

// ── Status Page ─────────────────────────────────────────────────────────

type StatusPageSnapshot = {
  name: string
  slug: string
  description: string | null
  visibility: string
  enabled: boolean
  incidentMode: string
  branding: Schemas['StatusPageBranding'] | null
}

/**
 * Produce a drift-friendly snapshot of branding.
 *
 *   desired (YAML present)    → normalized StatusPageBranding record
 *   desired (YAML absent)     → null (means "preserve current" on the wire;
 *                                the snapshot borrows the current API value
 *                                so diff stays quiet)
 *   current                   → normalized API value, or null if empty
 *
 * Normalization fills every field (missing → null, hidePoweredBy → false)
 * so that the structural equality check in `defineHandler` doesn't flap on
 * key-presence differences between YAML and API JSON.
 */
function normalizeBrandingForSnapshot(
  b: Schemas['StatusPageBranding'] | null | undefined,
): Schemas['StatusPageBranding'] | null {
  if (!b) return null
  return {
    logoUrl: b.logoUrl ?? null,
    faviconUrl: b.faviconUrl ?? null,
    brandColor: b.brandColor ?? null,
    pageBackground: b.pageBackground ?? null,
    cardBackground: b.cardBackground ?? null,
    textColor: b.textColor ?? null,
    borderColor: b.borderColor ?? null,
    headerStyle: b.headerStyle ?? null,
    theme: b.theme ?? null,
    reportUrl: b.reportUrl ?? null,
    hidePoweredBy: b.hidePoweredBy ?? false,
    customCss: b.customCss ?? null,
    customHeadHtml: b.customHeadHtml ?? null,
  }
}

// ── Status page child collection definitions ────────────────────────────

/**
 * Standalone snapshot for a YAML group/component, factored out of the
 * collection defs above so `hasChildChanges` can compare against prior-state
 * attributes without needing an `ApiClient`. The collection defs delegate to
 * these so the comparison shape stays in lockstep.
 */
export function statusPageGroupDesiredSnapshot(
  yaml: YamlStatusPageComponentGroup,
): Record<string, unknown> {
  return {
    name: yaml.name,
    description: yaml.description ?? null,
    defaultOpen: yaml.defaultOpen ?? true,
  }
}

export function statusPageComponentDesiredSnapshot(
  yaml: YamlStatusPageComponent,
): Record<string, unknown> {
  return {
    name: yaml.name,
    description: yaml.description ?? null,
    type: yaml.type,
    showUptime: yaml.showUptime ?? true,
    excludeFromOverall: yaml.excludeFromOverall ?? false,
    startDate: yaml.startDate ?? null,
    group: yaml.group ?? null,
    monitor: yaml.monitor ?? null,
    resourceGroup: yaml.resourceGroup ?? null,
  }
}

/**
 * Translate an API group DTO into the snapshot shape used by the diff
 * comparator. This is the single source of truth for "what attributes
 * matter on a group" — both the deploy-time collection def and `state pull`
 * share this so they cannot drift apart.
 *
 * Any new field that should participate in drift detection must be added
 * here AND in `statusPageGroupDesiredSnapshot` (the YAML-side mirror); the
 * shapes must stay structurally identical.
 */
export function statusPageGroupCurrentSnapshot(
  api: Schemas['StatusPageComponentGroupDto'],
): Record<string, unknown> {
  return {
    name: api.name ?? '',
    description: api.description ?? null,
    defaultOpen: api.defaultOpen ?? true,
  }
}

/**
 * Translate an API component DTO into the snapshot shape used by the diff
 * comparator. Reverse-resolves `groupId` / `monitorId` / `resourceGroupId`
 * to the human-readable names used in YAML so desired/current snapshots
 * compare as plain strings.
 *
 * Same drift-detection rules as `statusPageGroupCurrentSnapshot`: every
 * field added here must be mirrored in `statusPageComponentDesiredSnapshot`.
 */
export function statusPageComponentCurrentSnapshot(
  api: Schemas['StatusPageComponentDto'],
  groupNameToId: Map<string, string>,
  refs: ResolvedRefs,
): Record<string, unknown> {
  let groupName: string | null = null
  if (api.groupId) {
    for (const [name, id] of groupNameToId) {
      if (id === api.groupId) {groupName = name; break}
    }
  }
  let monitorName: string | null = null
  if (api.monitorId) {
    for (const entry of refs.allEntries('monitors')) {
      if (entry.id === api.monitorId) {monitorName = entry.refKey; break}
    }
  }
  let resourceGroupName: string | null = null
  if (api.resourceGroupId) {
    for (const entry of refs.allEntries('resourceGroups')) {
      if (entry.id === String(api.resourceGroupId)) {resourceGroupName = entry.refKey; break}
    }
  }
  return {
    name: api.name ?? '',
    description: api.description ?? null,
    type: api.type ?? 'STATIC',
    showUptime: api.showUptime ?? true,
    excludeFromOverall: api.excludeFromOverall ?? false,
    // API returns an OffsetDateTime (startOfDay UTC); slice back to YYYY-MM-DD
    // so desired/current snapshots compare as strings.
    startDate: api.startDate ? api.startDate.slice(0, 10) : null,
    group: groupName,
    monitor: monitorName,
    resourceGroup: resourceGroupName,
  }
}

function makeGroupCollectionDef(
  client: ApiClient,
): ChildCollectionDef<YamlStatusPageComponentGroup, Schemas['StatusPageComponentGroupDto']> {
  return {
    name: 'groups',
    identityKey: (yaml) => yaml.name,
    apiIdentityKey: (api) => api.name ?? '',
    apiId: (api) => String(api.id),
    toDesiredSnapshot: statusPageGroupDesiredSnapshot,
    toCurrentSnapshot: statusPageGroupCurrentSnapshot,
    async applyCreate(parentId, yaml, index) {
      const resp = (await apiPost(
        client, `/api/v1/status-pages/${parentId}/groups`,
        {name: yaml.name, description: yaml.description ?? null, displayOrder: index, defaultOpen: yaml.defaultOpen ?? true},
      )) as {data?: Schemas['StatusPageComponentGroupDto']}
      return String(resp.data?.id ?? '')
    },
    async applyUpdate(parentId, childId, yaml, index) {
      await apiPut(client, `/api/v1/status-pages/${parentId}/groups/${childId}`,
        {name: yaml.name, description: yaml.description ?? null, displayOrder: index, defaultOpen: yaml.defaultOpen ?? true},
      )
    },
    async applyDelete(parentId, childId) {
      await apiDeleteRaw(client, `/api/v1/status-pages/${parentId}/groups/${childId}`)
    },
  }
}

function makeComponentCollectionDef(
  client: ApiClient,
  refs: ResolvedRefs,
  groupNameToId: Map<string, string>,
): ChildCollectionDef<YamlStatusPageComponent, Schemas['StatusPageComponentDto']> {
  return {
    name: 'components',
    identityKey: (yaml) => yaml.name,
    apiIdentityKey: (api) => api.name ?? '',
    apiId: (api) => String(api.id),
    toDesiredSnapshot: statusPageComponentDesiredSnapshot,
    toCurrentSnapshot: (api) => statusPageComponentCurrentSnapshot(api, groupNameToId, refs),
    async applyCreate(parentId, yaml, index) {
      const body: Record<string, unknown> = {
        name: yaml.name, type: yaml.type,
        description: yaml.description ?? null,
        displayOrder: index, showUptime: yaml.showUptime ?? true,
      }
      if (yaml.excludeFromOverall !== undefined) body.excludeFromOverall = yaml.excludeFromOverall
      if (yaml.startDate !== undefined) body.startDate = yaml.startDate
      if (yaml.group && groupNameToId.has(yaml.group)) body.groupId = groupNameToId.get(yaml.group)
      if (yaml.type === 'MONITOR' && yaml.monitor) {
        body.monitorId = refs.resolve('monitors', yaml.monitor) ?? yaml.monitor
      }
      if (yaml.type === 'GROUP' && yaml.resourceGroup) {
        body.resourceGroupId = refs.resolve('resourceGroups', yaml.resourceGroup) ?? yaml.resourceGroup
      }
      const resp = (await apiPost(
        client, `/api/v1/status-pages/${parentId}/components`, body,
      )) as {data?: Schemas['StatusPageComponentDto']}
      return String(resp.data?.id ?? '')
    },
    async applyUpdate(parentId, childId, yaml, index) {
      const body: Record<string, unknown> = {
        name: yaml.name,
        description: yaml.description ?? null,
        displayOrder: index, showUptime: yaml.showUptime ?? true,
      }
      if (yaml.excludeFromOverall !== undefined) body.excludeFromOverall = yaml.excludeFromOverall
      if (yaml.startDate !== undefined) body.startDate = yaml.startDate
      if (yaml.group && groupNameToId.has(yaml.group)) {
        body.groupId = groupNameToId.get(yaml.group)
      } else if (!yaml.group) {
        body.removeFromGroup = true
      }
      await apiPut(client, `/api/v1/status-pages/${parentId}/components/${childId}`, body)
    },
    async applyDelete(parentId, childId) {
      await apiDeleteRaw(client, `/api/v1/status-pages/${parentId}/components/${childId}`)
    },
    async applyReorder(parentId, ordered) {
      // The reorder endpoint replaces both displayOrder AND groupId on every
      // listed component. If we sent groupId: null for everything, we'd
      // silently move every grouped component back to "ungrouped" on every
      // deploy that triggered a reorder. Resolve groupId from the YAML's
      // group name so reorder preserves group assignments.
      const positions = ordered.map(({id, yaml, index}) => {
        const groupId = yaml.group ? (groupNameToId.get(yaml.group) ?? null) : null
        return {componentId: id, displayOrder: index, groupId}
      })
      await apiPut(client, `/api/v1/status-pages/${parentId}/components/reorder`, {positions})
    },
  }
}

/**
 * Drift detection for status-page child collections (groups + components).
 *
 * **v3 contract**: `currentChildren` is fetched live from the API by the
 * differ via `fetchStatusPageChildSnapshots` *before* this is called. Why
 * we no longer use prior state for the diff baseline:
 *
 *   - State drift across environments: a deploy from machine A followed
 *     by a plan from machine B (no `state pull`) would compare YAML
 *     against B's empty state and conclude "everything must be created"
 *     — a false positive at best, duplicate-creates at worst.
 *   - State drift across versions: a CLI release that changes the
 *     desired-snapshot shape (e.g. the `defaultOpen` rename in v0.4.0)
 *     would diff every existing parent on every machine until a fresh
 *     deploy rewrote state. Live API as baseline keeps both sides on
 *     the same shape forever. See RFC 0001 for the full incident log.
 *
 * Special cases (unchanged):
 *   - Empty current state + no YAML children → no change (applyCreate
 *     handles the first-time path).
 *   - YAML omits `components` / `componentGroups` → that collection is
 *     left alone by `reconcileStatusPageChildren`, so it never reports
 *     drift here.
 */
function hasStatusPageChildChanges(
  yaml: YamlStatusPage,
  currentChildren: Record<string, CurrentChildEntry>,
): boolean {
  if (yaml.componentGroups !== undefined) {
    if (childCollectionDiffers(yaml.componentGroups, currentChildren, 'groups.', statusPageGroupDesiredSnapshot)) {
      return true
    }
  }
  if (yaml.components !== undefined) {
    if (childCollectionDiffers(yaml.components, currentChildren, 'components.', statusPageComponentDesiredSnapshot)) {
      return true
    }
  }
  return false
}

function childCollectionDiffers<T extends {name: string}>(
  desired: T[],
  currentChildren: Record<string, CurrentChildEntry>,
  prefix: string,
  toSnapshot: (yaml: T) => Record<string, unknown>,
): boolean {
  const currentKeys = new Set(
    Object.keys(currentChildren).filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length)),
  )
  const desiredKeys = new Set(desired.map((c) => c.name))

  for (const k of desiredKeys) if (!currentKeys.has(k)) return true
  for (const k of currentKeys) if (!desiredKeys.has(k)) return true

  for (const item of desired) {
    const current = currentChildren[`${prefix}${item.name}`]
    if (!current) return true
    if (!isEqual(toSnapshot(item), current.snapshot)) return true
  }
  return false
}

/**
 * Live-fetch status page children + project them into snapshots that
 * `hasStatusPageChildChanges` can diff against. Used at plan time only;
 * the deploy path's `reconcileStatusPageChildren` already does its own
 * (richer) live fetch internally.
 *
 * Component snapshots depend on the group name → id map (so the YAML's
 * `group: "Platform"` can be resolved against the API's numeric groupId);
 * we build that map from the just-fetched groups before snapshotting
 * components.
 */
async function fetchStatusPageChildSnapshots(
  pageId: string,
  client: ApiClient,
  refs: ResolvedRefs,
): Promise<Record<string, CurrentChildEntry>> {
  const [groups, components] = await Promise.all([
    fetchPaginated<Schemas['StatusPageComponentGroupDto']>(
      client, `/api/v1/status-pages/${pageId}/groups`,
    ),
    fetchPaginated<Schemas['StatusPageComponentDto']>(
      client, `/api/v1/status-pages/${pageId}/components`,
    ),
  ])

  const out: Record<string, CurrentChildEntry> = {}
  const groupNameToId = new Map<string, string>()

  for (const g of groups) {
    const name = g.name ?? ''
    if (!name) continue
    groupNameToId.set(name, String(g.id ?? ''))
    out[`groups.${name}`] = {
      apiId: String(g.id ?? ''),
      snapshot: statusPageGroupCurrentSnapshot(g),
    }
  }

  for (const c of components) {
    const name = c.name ?? ''
    if (!name) continue
    out[`components.${name}`] = {
      apiId: String(c.id ?? ''),
      snapshot: statusPageComponentCurrentSnapshot(c, groupNameToId, refs),
    }
  }

  return out
}

/**
 * Reconcile groups and components on a status page using the child reconciler.
 * Replaces the old delete-all/recreate-all approach with individual CRUD.
 *
 * Omission vs empty semantics (critical — must not mass-delete):
 *   - key omitted (undefined) → do NOT reconcile; preserve existing API state and prior state children
 *   - key explicitly `[]` → reconcile to empty (deletes all remote children of that kind)
 *   - key with entries → reconcile to that desired set
 *
 * Components need group IDs, so if only `components` is present we still must
 * fetch existing groups to resolve `group` references, but we never mutate them.
 */
async function reconcileStatusPageChildren(
  yaml: YamlStatusPage,
  pageId: string,
  refs: ResolvedRefs,
  client: ApiClient,
  stateChildren: Record<string, ChildStateEntry> = {},
): Promise<Record<string, ChildStateEntry>> {
  const reconcileGroups = yaml.componentGroups !== undefined
  const reconcileComponents = yaml.components !== undefined
  if (!reconcileGroups && !reconcileComponents) return {}

  // Carry prior state children for any kind we are NOT reconciling, so they
  // remain tracked after this apply.
  const carriedState: Record<string, ChildStateEntry> = {}
  // Accumulator for surviving children across both phases. We thread this
  // through both happy + error paths so a partial component failure
  // doesn't lose the groups we already created (and vice versa).
  const accumulated: Record<string, ChildStateEntry> = {}
  const errors: string[] = []

  // Phase 1: Groups — fetch if we will reconcile OR if components need the name→id map
  let existingGroups: Schemas['StatusPageComponentGroupDto'][] = []
  if (reconcileGroups || reconcileComponents) {
    existingGroups = await fetchPaginated<Schemas['StatusPageComponentGroupDto']>(
      client, `/api/v1/status-pages/${pageId}/groups`,
    )
  }

  if (reconcileGroups) {
    const groupDef = makeGroupCollectionDef(client)
    const groupStateChildren: Record<string, ChildStateEntry> = {}
    for (const [key, entry] of Object.entries(stateChildren)) {
      if (key.startsWith('groups.')) groupStateChildren[key] = entry
    }

    const desiredGroups = yaml.componentGroups ?? []
    const groupDiff = diffChildren(groupDef, desiredGroups, existingGroups, groupStateChildren)
    try {
      const groupResult = await applyChildDiff(
        groupDef, pageId, desiredGroups, groupDiff, existingGroups, groupStateChildren,
      )
      Object.assign(accumulated, groupResult.childState)
    } catch (err) {
      // Drain whatever PartialApplyError carried so siblings (and the
      // component phase below) aren't punished for a peer's failure.
      if (err instanceof PartialApplyError && err.partial.children) {
        Object.assign(accumulated, err.partial.children)
      }
      errors.push(err instanceof Error ? err.message : String(err))
    }
  } else {
    // Preserve any group entries from prior state
    for (const [key, entry] of Object.entries(stateChildren)) {
      if (key.startsWith('groups.')) carriedState[key] = entry
    }
  }

  // Build group name → ID map from whatever survived: existing API groups
  // plus any newly-reconciled ones (including those that landed before a
  // peer failure). Components that reference a group that did NOT survive
  // will fail with a clearer error in their own phase.
  const groupNameToId = new Map<string, string>()
  for (const g of existingGroups) {
    groupNameToId.set(g.name ?? '', String(g.id))
  }
  for (const [key, entry] of Object.entries(accumulated)) {
    if (key.startsWith('groups.')) {
      groupNameToId.set(key.slice('groups.'.length), entry.apiId)
    }
  }

  // Phase 2: Components — runs even if groups partially failed so the user
  // gets maximum forward progress per deploy. Component creates that
  // depended on a failed group will themselves fail and be surfaced.
  if (reconcileComponents) {
    const componentDef = makeComponentCollectionDef(client, refs, groupNameToId)
    const existingComponents = await fetchPaginated<Schemas['StatusPageComponentDto']>(
      client, `/api/v1/status-pages/${pageId}/components`,
    )

    const componentStateChildren: Record<string, ChildStateEntry> = {}
    for (const [key, entry] of Object.entries(stateChildren)) {
      if (key.startsWith('components.')) componentStateChildren[key] = entry
    }

    const desiredComponents = yaml.components ?? []
    const componentDiff = diffChildren(componentDef, desiredComponents, existingComponents, componentStateChildren)
    try {
      const componentResult = await applyChildDiff(
        componentDef, pageId, desiredComponents, componentDiff, existingComponents, componentStateChildren,
      )
      Object.assign(accumulated, componentResult.childState)
    } catch (err) {
      if (err instanceof PartialApplyError && err.partial.children) {
        Object.assign(accumulated, err.partial.children)
      }
      errors.push(err instanceof Error ? err.message : String(err))
    }
  } else {
    for (const [key, entry] of Object.entries(stateChildren)) {
      if (key.startsWith('components.')) carriedState[key] = entry
    }
  }

  const finalChildren = {...carriedState, ...accumulated}
  if (errors.length > 0) {
    throw new PartialApplyError(
      `status page children: ${errors.join('; ')}`,
      {children: finalChildren},
    )
  }

  return finalChildren
}

const statusPageHandler = defineHandler<YamlStatusPage, Schemas['StatusPageDto'], StatusPageSnapshot>({
  resourceType: 'statusPage',
  refType: 'statusPages',
  configKey: 'statusPages',
  listPath: '/api/v1/status-pages',

  getRefKey: (yaml) => yaml.slug,
  getApiRefKey: (api) => api.slug ?? '',
  getApiId: (api) => String(api.id ?? ''),

  toDesiredSnapshot: (yaml, api) => ({
    name: yaml.name,
    slug: yaml.slug,
    description: yaml.description ?? api.description ?? null,
    visibility: yaml.visibility ?? api.visibility ?? 'PUBLIC',
    enabled: yaml.enabled ?? api.enabled ?? true,
    incidentMode: yaml.incidentMode ?? api.incidentMode ?? 'AUTOMATIC',
    // When YAML omits `branding`, adopt the current API value so diff stays
    // silent. When YAML provides it, that becomes the authoritative shape.
    branding: yaml.branding
      ? normalizeBrandingForSnapshot(toBrandingRequest(yaml.branding))
      : normalizeBrandingForSnapshot(api.branding),
  }),
  toCurrentSnapshot: (api) => ({
    name: api.name ?? '',
    slug: api.slug ?? '',
    description: api.description ?? null,
    visibility: api.visibility ?? 'PUBLIC',
    enabled: api.enabled ?? true,
    incidentMode: api.incidentMode ?? 'AUTOMATIC',
    branding: normalizeBrandingForSnapshot(api.branding),
  }),

  // Bubble child-collection drift up so the differ queues an update on this
  // status page even when only its components/groups changed. Without this,
  // hasChanged compares parent fields only, returns false, applyUpdate never
  // runs, and reconcileStatusPageChildren never gets a chance to create the
  // newly-added component (root cause of BDD scenario C2 failing pre-fix).
  //
  // The differ pre-fetches `currentChildren` via `fetchChildSnapshots`
  // below before invoking us; see RFC 0001.
  hasChildChanges(yaml, currentChildren) {
    return hasStatusPageChildChanges(yaml, currentChildren)
  },

  fetchChildSnapshots(parentApiId, client, refs) {
    return fetchStatusPageChildSnapshots(parentApiId, client, refs)
  },

  fetchAll: (client) => fetchPaginated<Schemas['StatusPageDto']>(client, '/api/v1/status-pages'),

  async applyCreate(yaml, refs, client, priorChildren) {
    const resp = (await apiPost(client, '/api/v1/status-pages', toCreateStatusPageRequest(yaml))) as {data?: Schemas['StatusPageDto']}
    const pageId = resp.data?.id
    if (!pageId) return undefined
    try {
      const children = await reconcileStatusPageChildren(yaml, pageId, refs, client, priorChildren ?? {})
      return {id: pageId, children}
    } catch (err) {
      // Re-throw as a parent-aware PartialApplyError so the applier can
      // persist the parent id + surviving children (state.json) before
      // recording the failure. Without this, the parent page is created
      // API-side but absent from state — fixable on next deploy via API
      // discovery, but identity-preserving renames lose their state pin.
      if (err instanceof PartialApplyError) {
        throw new PartialApplyError(
          `status page "${yaml.slug}" created (id=${pageId}) but child reconciliation failed: ${err.message}`,
          {id: pageId, children: err.partial.children ?? {}},
        )
      }
      throw err
    }
  },
  async applyUpdate(yaml, id, refs, client, priorChildren) {
    const body = toUpdateStatusPageRequest(yaml)
    await apiPut(client, `/api/v1/status-pages/${id}`, body)
    if (yaml.componentGroups === undefined && yaml.components === undefined) {
      return {children: priorChildren ?? {}}
    }
    try {
      const children = await reconcileStatusPageChildren(yaml, id, refs, client, priorChildren ?? {})
      return {children}
    } catch (err) {
      // Body PUT already landed; surface partial children so the applier
      // updates state with whatever survived. The parent id is `existingId`
      // on the caller side, so we still attach it here for symmetry with
      // applyCreate.
      if (err instanceof PartialApplyError) {
        throw new PartialApplyError(
          `status page "${yaml.slug}" body updated but child reconciliation failed: ${err.message}`,
          {id, children: err.partial.children ?? priorChildren ?? {}},
        )
      }
      throw err
    }
  },
  deletePath: (id) => `/api/v1/status-pages/${id}`,
})

// ── Handler registry ────────────────────────────────────────────────────

/**
 * Compile-time complete map: TypeScript errors if any HandledResourceType is missing.
 */
export const HANDLER_MAP: Record<HandledResourceType, ResourceHandler> = {
  tag: tagHandler,
  environment: environmentHandler,
  secret: secretHandler,
  alertChannel: alertChannelHandler,
  notificationPolicy: notificationPolicyHandler,
  webhook: webhookHandler,
  resourceGroup: resourceGroupHandler,
  monitor: monitorHandler,
  dependency: dependencyHandler,
  statusPage: statusPageHandler,
}

/** @internal – used by tests to look up a handler by resource type */
export function getHandler(type: HandledResourceType): ResourceHandler {
  return HANDLER_MAP[type]
}

export function allHandlers(): ResourceHandler[] {
  return Object.values(HANDLER_MAP)
}
