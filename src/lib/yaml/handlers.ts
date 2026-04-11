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
  YamlMonitor, YamlDependency,
} from './schema.js'
import type {YamlSectionKey} from './schema.js'
import {
  toCreateTagRequest, toCreateEnvironmentRequest, toCreateSecretRequest,
  toCreateAlertChannelRequest, toCreateNotificationPolicyRequest,
  toCreateWebhookRequest, toCreateResourceGroupRequest,
  toCreateMonitorRequest, toUpdateMonitorRequest, toAuthConfig,
  toCreateAssertionRequest, toIncidentPolicy,
} from './transform.js'
import {fetchPaginated} from '../typed-api.js'
import {checkedFetch, apiPatch} from '../api-client.js'

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

  fetchAll(client: ApiClient): Promise<TApiDto[]>
  applyCreate(yaml: TYaml, refs: ResolvedRefs, client: ApiClient): Promise<string | undefined>
  applyUpdate(yaml: TYaml, existingId: string, refs: ResolvedRefs, client: ApiClient): Promise<void>
  deletePath(id: string): string
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

  fetchAll(client: ApiClient): Promise<TApiDto[]>
  applyCreate(yaml: TYaml, refs: ResolvedRefs, client: ApiClient): Promise<string | undefined>
  applyUpdate(yaml: TYaml, existingId: string, refs: ResolvedRefs, client: ApiClient): Promise<void>
  deletePath(id: string): string
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

    fetchAll: h.fetchAll,
    applyCreate: h.applyCreate,
    applyUpdate: h.applyUpdate,
    deletePath: h.deletePath,
  }
  return handler as unknown as ResourceHandler
}

// ── Shared helpers ──────────────────────────────────────────────────────

function nonNullStrings(arr: (string | null)[] | null | undefined): string[] {
  return (arr ?? []).filter((v): v is string => v !== null)
}

function sortedIds(ids: string[]): string[] {
  return [...ids].sort()
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
    return resp.data?.id ?? undefined
  },
  async applyUpdate(yaml, id, _refs, client) {
    await checkedFetch(client.PUT('/api/v1/tags/{id}', {params: {path: {id}}, body: toCreateTagRequest(yaml)}))
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
    return resp.data?.id ?? undefined
  },
  async applyUpdate(yaml, id, _refs, client) {
    await checkedFetch(client.PUT('/api/v1/environments/{slug}', {params: {path: {slug: id}}, body: {
      name: yaml.name, variables: yaml.variables ?? null, isDefault: yaml.isDefault,
    }}))
  },
  deletePath: (id) => `/api/v1/environments/${id}`,
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
    return resp.data?.id ?? undefined
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
    return {
      name: req.name,
      channelType: yaml.type,
      configHash: sha256Hex(stableStringify(req.config)),
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
    return resp.data?.id ?? undefined
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
      matchRules: req.matchRules ?? api.matchRules ?? [],
      escalation: req.escalation,
    }
  },
  toCurrentSnapshot: (api) => ({
    name: api.name ?? '',
    enabled: api.enabled ?? true,
    priority: api.priority ?? 0,
    matchRules: api.matchRules ?? [],
    escalation: api.escalation ?? {steps: [], onResolve: null, onReopen: null},
  }),

  fetchAll: (client) => fetchPaginated<Schemas['NotificationPolicyDto']>(client, '/api/v1/notification-policies'),

  async applyCreate(yaml, refs, client) {
    const resp = await checkedFetch(client.POST('/api/v1/notification-policies', {body: toCreateNotificationPolicyRequest(yaml, refs)}))
    return resp.data?.id != null ? String(resp.data.id) : undefined
  },
  async applyUpdate(yaml, id, refs, client) {
    await checkedFetch(client.PUT('/api/v1/notification-policies/{id}', {params: {path: {id}}, body: toCreateNotificationPolicyRequest(yaml, refs)}))
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
    subscribedEvents: sortedIds(yaml.events),
    enabled: api.enabled ?? null,
  }),
  toCurrentSnapshot: (api) => ({
    url: api.url ?? null,
    description: api.description ?? null,
    subscribedEvents: api.subscribedEvents ? sortedIds(api.subscribedEvents) : null,
    enabled: api.enabled ?? null,
  }),

  fetchAll: (client) => fetchPaginated<Schemas['WebhookEndpointDto']>(client, '/api/v1/webhooks'),

  async applyCreate(yaml, _refs, client) {
    const resp = await checkedFetch(client.POST('/api/v1/webhooks', {body: toCreateWebhookRequest(yaml)}))
    return resp.data?.id ?? undefined
  },
  async applyUpdate(yaml, id, _refs, client) {
    await checkedFetch(client.PUT('/api/v1/webhooks/{id}', {params: {path: {id}}, body: toCreateWebhookRequest(yaml)}))
  },
  deletePath: (id) => `/api/v1/webhooks/${id}`,
})

// ── Resource Group ──────────────────────────────────────────────────────

// defaultRetryStrategy is optional (not nullable) in the Update schema,
// but a group can legitimately have none, so we add | null.
type ResourceGroupSnapshotBase = Required<Schemas['UpdateResourceGroupRequest']>
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
    return resp.data?.id ?? undefined
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
    config: yaml.config as MonitorSnapshot['config'],
    frequencySeconds: yaml.frequency ?? api.frequencySeconds ?? null,
    enabled: yaml.enabled ?? api.enabled ?? null,
    regions: yaml.regions !== undefined
      ? sortedIds(yaml.regions)
      : (api.regions ? sortedIds(api.regions) : null),
    environmentId: yaml.environment !== undefined
      ? (refs.resolve('environments', yaml.environment) ?? null)
      : (api.environment?.id ?? null),
    assertions: yaml.assertions !== undefined
      ? sortAssertions(yaml.assertions.map(toCreateAssertionRequest))
      : apiAssertionsToSnapshot(api.assertions),
    auth: yaml.auth !== undefined
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
    config: api.config as MonitorSnapshot['config'],
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
    return resp.data?.id ?? undefined
  },
  async applyUpdate(yaml, id, refs, client) {
    await checkedFetch(client.PUT('/api/v1/monitors/{id}', {params: {path: {id}}, body: toUpdateMonitorRequest(yaml, refs)}))
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
  if (!api.tags) return {tagIds: null, newTags: []}
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
    return resp.data?.subscriptionId ?? undefined
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
}

export function getHandler(type: HandledResourceType): ResourceHandler {
  return HANDLER_MAP[type]
}

export function allHandlers(): ResourceHandler[] {
  return Object.values(HANDLER_MAP)
}
