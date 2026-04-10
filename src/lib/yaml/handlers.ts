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
 * TypeScript enforces both functions return the same TSnapshot type.  Adding a
 * field to TSnapshot → compile error until both sides are updated.
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
  toCreateMonitorRequest, toUpdateMonitorRequest,
} from './transform.js'
import {typedPost, typedPut, typedPatch, fetchPaginated} from '../typed-api.js'

type Schemas = components['schemas']

// ── Response wrappers (match generated SingleValueResponse* pattern) ─────

interface SingleValueResponse<T> {
  data?: T
}

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
 * that both return TSnapshot, OR set alwaysChanged for write-only resources.
 * hasChanged is automatically derived — handlers never implement it manually.
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

  /**
   * true → resource always reports as changed (e.g. secrets: value is write-only,
   * the API never returns it, so we can't compare).
   */
  alwaysChanged?: boolean

  /**
   * Project the YAML config + current API state into a comparable snapshot.
   * For undefined (optional) YAML fields, use the current API value so they
   * don't trigger a false diff.
   */
  toDesiredSnapshot?: (yaml: TYaml, api: TApiDto, refs: ResolvedRefs) => TSnapshot

  /**
   * Project the API DTO into the same comparable snapshot shape.
   */
  toCurrentSnapshot?: (api: TApiDto) => TSnapshot

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
function defineHandler<TYaml, TApiDto, TSnapshot = never>(
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
      if (h.alwaysChanged) return true
      if (!h.toDesiredSnapshot || !h.toCurrentSnapshot) return true
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

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}

/**
 * Deterministic JSON serialization with alphabetically sorted keys at every
 * nesting level.  Produces the same output regardless of JS engine key
 * insertion order, matching the Java-side TreeMap-based canonical JSON.
 */
function stableStringify(obj: unknown): string {
  if (obj === null || obj === undefined) return 'null'
  if (typeof obj !== 'object') return JSON.stringify(obj)
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']'
  const record = obj as Record<string, unknown>
  const keys = Object.keys(record).sort()
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(record[k])).join(',') + '}'
}

// ── Tag ─────────────────────────────────────────────────────────────────

interface TagSnapshot {
  name: string
  color: string | null
}

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
    name: api.name ?? '',
    color: api.color ?? null,
  }),

  fetchAll: (client) => fetchPaginated<Schemas['TagDto']>(client, '/api/v1/tags'),

  async applyCreate(yaml, _refs, client) {
    const resp = await typedPost<SingleValueResponse<Schemas['TagDto']>>(
      client, '/api/v1/tags', toCreateTagRequest(yaml),
    )
    return resp.data?.id ?? undefined
  },
  async applyUpdate(yaml, id, _refs, client) {
    await typedPut(client, `/api/v1/tags/${id}`, toCreateTagRequest(yaml))
  },
  deletePath: (id) => `/api/v1/tags/${id}`,
})

// ── Environment ─────────────────────────────────────────────────────────

interface EnvironmentSnapshot {
  name: string
  isDefault: boolean
  variables: Record<string, string> | null
}

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
    isDefault: yaml.isDefault ?? api.isDefault ?? false,
    variables: yaml.variables ?? api.variables ?? null,
  }),
  toCurrentSnapshot: (api) => ({
    name: api.name ?? '',
    isDefault: api.isDefault ?? false,
    variables: api.variables ?? null,
  }),

  fetchAll: (client) => fetchPaginated<Schemas['EnvironmentDto']>(client, '/api/v1/environments'),

  async applyCreate(yaml, _refs, client) {
    const resp = await typedPost<SingleValueResponse<Schemas['EnvironmentDto']>>(
      client, '/api/v1/environments', toCreateEnvironmentRequest(yaml),
    )
    return resp.data?.id ?? undefined
  },
  async applyUpdate(yaml, id, _refs, client) {
    await typedPut(client, `/api/v1/environments/${id}`, {
      name: yaml.name, variables: yaml.variables ?? null, isDefault: yaml.isDefault,
    })
  },
  deletePath: (id) => `/api/v1/environments/${id}`,
})

// ── Secret ──────────────────────────────────────────────────────────────

interface SecretSnapshot {
  key: string
  valueHash: string
}

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
    const resp = await typedPost<SingleValueResponse<Schemas['SecretDto']>>(
      client, '/api/v1/secrets', toCreateSecretRequest(yaml),
    )
    return resp.data?.id ?? undefined
  },
  async applyUpdate(yaml, _id, _refs, client) {
    await typedPut(client, `/api/v1/secrets/${yaml.key}`, {value: yaml.value})
  },
  deletePath: (id) => `/api/v1/secrets/${id}`,
})

// ── Alert Channel ───────────────────────────────────────────────────────

interface AlertChannelSnapshot {
  name: string
  channelType: string
  configHash: string
}

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
    // configHash is available once the API is deployed with V89 migration.
    // Pre-migration responses lack it → empty string → forces update (backfills hash).
    configHash: (api as Record<string, unknown>).configHash as string ?? '',
  }),

  fetchAll: (client) => fetchPaginated<Schemas['AlertChannelDto']>(client, '/api/v1/alert-channels'),

  async applyCreate(yaml, _refs, client) {
    const resp = await typedPost<SingleValueResponse<Schemas['AlertChannelDto']>>(
      client, '/api/v1/alert-channels', toCreateAlertChannelRequest(yaml),
    )
    return resp.data?.id ?? undefined
  },
  async applyUpdate(yaml, id, _refs, client) {
    await typedPut(client, `/api/v1/alert-channels/${id}`, toCreateAlertChannelRequest(yaml))
  },
  deletePath: (id) => `/api/v1/alert-channels/${id}`,
})

// ── Notification Policy ─────────────────────────────────────────────────

interface NotificationPolicySnapshot {
  name: string
  enabled: boolean
  priority: number
  matchRules: unknown
  escalation: unknown
}

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
      matchRules: req.matchRules ?? api.matchRules ?? null,
      escalation: req.escalation,
    }
  },
  toCurrentSnapshot: (api) => ({
    name: api.name ?? '',
    enabled: api.enabled ?? true,
    priority: api.priority ?? 0,
    matchRules: api.matchRules ?? null,
    escalation: api.escalation ?? null,
  }),

  fetchAll: (client) => fetchPaginated<Schemas['NotificationPolicyDto']>(client, '/api/v1/notification-policies'),

  async applyCreate(yaml, refs, client) {
    const resp = await typedPost<SingleValueResponse<Schemas['NotificationPolicyDto']>>(
      client, '/api/v1/notification-policies', toCreateNotificationPolicyRequest(yaml, refs),
    )
    return resp.data?.id != null ? String(resp.data.id) : undefined
  },
  async applyUpdate(yaml, id, refs, client) {
    await typedPut(client, `/api/v1/notification-policies/${id}`, toCreateNotificationPolicyRequest(yaml, refs))
  },
  deletePath: (id) => `/api/v1/notification-policies/${id}`,
})

// ── Webhook ─────────────────────────────────────────────────────────────

interface WebhookSnapshot {
  url: string
  description: string | null
  subscribedEvents: string[]
}

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
  }),
  toCurrentSnapshot: (api) => ({
    url: api.url ?? '',
    description: api.description ?? null,
    subscribedEvents: sortedIds(api.subscribedEvents ?? []),
  }),

  fetchAll: (client) => fetchPaginated<Schemas['WebhookEndpointDto']>(client, '/api/v1/webhooks'),

  async applyCreate(yaml, _refs, client) {
    const resp = await typedPost<SingleValueResponse<Schemas['WebhookEndpointDto']>>(
      client, '/api/v1/webhooks', toCreateWebhookRequest(yaml),
    )
    return resp.data?.id ?? undefined
  },
  async applyUpdate(yaml, id, _refs, client) {
    await typedPut(client, `/api/v1/webhooks/${id}`, toCreateWebhookRequest(yaml))
  },
  deletePath: (id) => `/api/v1/webhooks/${id}`,
})

// ── Resource Group ──────────────────────────────────────────────────────

interface ResourceGroupSnapshot {
  name: string
  description: string | null
  alertPolicyId: string | null
  defaultFrequency: number | null
  defaultRegions: string[] | null
  defaultRetryStrategy: unknown
  defaultAlertChannelIds: string[] | null
  defaultEnvironmentId: string | null
  healthThresholdType: string | null
  healthThresholdValue: number | null
  suppressMemberAlerts: boolean | undefined
  confirmationDelaySeconds: number | null
  recoveryCooldownMinutes: number | null
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
    defaultAlertChannelIds: yaml.defaultAlertChannels !== undefined
      ? sortedIds(yaml.defaultAlertChannels.map((n) => refs.resolve('alertChannels', n) ?? n))
      : (api.defaultAlertChannels ? sortedIds(nonNullStrings(api.defaultAlertChannels)) : null),
    defaultEnvironmentId: yaml.defaultEnvironment !== undefined
      ? (refs.resolve('environments', yaml.defaultEnvironment) ?? null)
      : (api.defaultEnvironmentId ?? null),
    healthThresholdType: yaml.healthThresholdType ?? api.healthThresholdType ?? null,
    healthThresholdValue: yaml.healthThresholdValue ?? api.healthThresholdValue ?? null,
    suppressMemberAlerts: yaml.suppressMemberAlerts ?? api.suppressMemberAlerts,
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
    defaultAlertChannelIds: api.defaultAlertChannels ? sortedIds(nonNullStrings(api.defaultAlertChannels)) : null,
    defaultEnvironmentId: api.defaultEnvironmentId ?? null,
    healthThresholdType: api.healthThresholdType ?? null,
    healthThresholdValue: api.healthThresholdValue ?? null,
    suppressMemberAlerts: api.suppressMemberAlerts,
    confirmationDelaySeconds: api.confirmationDelaySeconds ?? null,
    recoveryCooldownMinutes: api.recoveryCooldownMinutes ?? null,
  }),

  fetchAll: (client) => fetchPaginated<Schemas['ResourceGroupDto']>(client, '/api/v1/resource-groups'),

  async applyCreate(yaml, refs, client) {
    const resp = await typedPost<SingleValueResponse<Schemas['ResourceGroupDto']>>(
      client, '/api/v1/resource-groups', toCreateResourceGroupRequest(yaml, refs),
    )
    return resp.data?.id ?? undefined
  },
  async applyUpdate(yaml, id, refs, client) {
    await typedPut(client, `/api/v1/resource-groups/${id}`, toCreateResourceGroupRequest(yaml, refs))
  },
  deletePath: (id) => `/api/v1/resource-groups/${id}`,
})

// ── Monitor ─────────────────────────────────────────────────────────────

interface MonitorSnapshot {
  name: string
  type: string
  config: unknown
  enabled: boolean | undefined
  frequencySeconds: number | undefined
  regions: string[] | null
  environmentId: string | null
  tagIds: string[] | null
  alertChannelIds: string[] | null
  auth: unknown
  assertions: unknown
  incidentPolicy: unknown
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
    type: yaml.type,
    config: yaml.config,
    enabled: yaml.enabled ?? api.enabled,
    frequencySeconds: yaml.frequency ?? api.frequencySeconds,
    regions: yaml.regions !== undefined
      ? sortedIds(yaml.regions)
      : (api.regions ? sortedIds(api.regions) : null),
    environmentId: yaml.environment !== undefined
      ? (refs.resolve('environments', yaml.environment) ?? null)
      : (api.environment?.id ?? null),
    tagIds: yaml.tags !== undefined
      ? sortedIds(yaml.tags.map((n) => refs.resolve('tags', n) ?? n))
      : extractTagIds(api),
    alertChannelIds: yaml.alertChannels !== undefined
      ? sortedIds(yaml.alertChannels.map((n) => refs.resolve('alertChannels', n) ?? n))
      : (api.alertChannelIds ? sortedIds(nonNullStrings(api.alertChannelIds)) : null),
    auth: yaml.auth !== undefined
      ? normalizeYamlAuth(yaml.auth, refs)
      : normalizeApiAuth(api.auth),
    assertions: yaml.assertions !== undefined
      ? normalizeYamlAssertions(yaml.assertions)
      : normalizeApiAssertions(api.assertions),
    incidentPolicy: yaml.incidentPolicy !== undefined
      ? normalizeIncidentPolicy(yaml.incidentPolicy)
      : normalizeApiIncidentPolicy(api.incidentPolicy),
  }),
  toCurrentSnapshot: (api) => ({
    name: api.name ?? '',
    type: api.type ?? '',
    config: api.config,
    enabled: api.enabled,
    frequencySeconds: api.frequencySeconds,
    regions: api.regions ? sortedIds(api.regions) : null,
    environmentId: api.environment?.id ?? null,
    tagIds: extractTagIds(api),
    alertChannelIds: api.alertChannelIds ? sortedIds(nonNullStrings(api.alertChannelIds)) : null,
    auth: normalizeApiAuth(api.auth),
    assertions: normalizeApiAssertions(api.assertions),
    incidentPolicy: normalizeApiIncidentPolicy(api.incidentPolicy),
  }),

  fetchAll: (client) => fetchPaginated<Schemas['MonitorDto']>(client, '/api/v1/monitors'),

  async applyCreate(yaml, refs, client) {
    const resp = await typedPost<SingleValueResponse<Schemas['MonitorDto']>>(
      client, '/api/v1/monitors', toCreateMonitorRequest(yaml, refs),
    )
    return resp.data?.id ?? undefined
  },
  async applyUpdate(yaml, id, refs, client) {
    await typedPut(client, `/api/v1/monitors/${id}`, toUpdateMonitorRequest(yaml, refs))
  },
  deletePath: (id) => `/api/v1/monitors/${id}`,
})

// ── Monitor snapshot normalization helpers ───────────────────────────────

function extractTagIds(api: Schemas['MonitorDto']): string[] | null {
  if (!api.tags) return null
  return sortedIds(api.tags.map((t) => String(t.id ?? '')).filter(Boolean))
}

interface NormalizedAuth {
  type: string
  secretId: string | null
  headerName?: string
}

const AUTH_TYPE_CANONICAL: Record<string, string> = {
  BearerAuthConfig: 'bearer',
  BasicAuthConfig: 'basic',
  ApiKeyAuthConfig: 'api_key',
  HeaderAuthConfig: 'header',
  bearer: 'bearer',
  basic: 'basic',
  api_key: 'api_key',
  header: 'header',
}

function normalizeYamlAuth(auth: YamlMonitor['auth'], refs: ResolvedRefs): NormalizedAuth | null {
  if (!auth) return null
  const base: NormalizedAuth = {
    type: AUTH_TYPE_CANONICAL[auth.type] ?? auth.type,
    secretId: refs.resolve('secrets', auth.secret) ?? null,
  }
  if ('headerName' in auth) base.headerName = auth.headerName
  return base
}

function normalizeApiAuth(auth: Schemas['MonitorDto']['auth']): NormalizedAuth | null {
  if (!auth) return null
  const config = auth.config as Record<string, unknown> | undefined
  const base: NormalizedAuth = {
    type: AUTH_TYPE_CANONICAL[auth.authType ?? ''] ?? (auth.authType ?? ''),
    secretId: (config?.vaultSecretId as string | null) ?? null,
  }
  if (config?.headerName) base.headerName = config.headerName as string
  return base
}

interface NormalizedAssertion {
  type: string
  config: Record<string, unknown>
  severity: string
}

function normalizeYamlAssertions(assertions: YamlMonitor['assertions']): NormalizedAssertion[] | null {
  if (!assertions) return null
  return assertions
    .map((a) => ({type: a.type, config: a.config ?? {}, severity: a.severity ?? 'fail'}))
    .sort((a, b) => a.type.localeCompare(b.type))
}

function normalizeApiAssertions(assertions: Schemas['MonitorDto']['assertions']): NormalizedAssertion[] | null {
  if (!assertions) return null
  return assertions
    .map((a) => {
      const config = (a.config ?? {}) as Record<string, unknown>
      const {type, ...rest} = config
      return {type: type as string, config: rest, severity: a.severity ?? 'fail'}
    })
    .sort((a, b) => a.type.localeCompare(b.type))
}

function normalizeIncidentPolicy(policy: YamlMonitor['incidentPolicy']): unknown {
  if (!policy) return null
  return {
    triggerRules: policy.triggerRules,
    confirmation: policy.confirmation,
    recovery: policy.recovery,
  }
}

function normalizeApiIncidentPolicy(policy: Schemas['MonitorDto']['incidentPolicy']): unknown {
  if (!policy) return null
  return {
    triggerRules: policy.triggerRules,
    confirmation: policy.confirmation,
    recovery: policy.recovery,
  }
}

// ── Dependency ──────────────────────────────────────────────────────────

interface DependencySnapshot {
  alertSensitivity: string | null
  component: string | null
}

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
    const resp = await typedPost<SingleValueResponse<Schemas['ServiceSubscriptionDto']>>(
      client, `/api/v1/service-subscriptions/${yaml.service}`, {
        alertSensitivity: yaml.alertSensitivity ?? null,
        componentId: yaml.component ?? null,
      },
    )
    return resp.data?.subscriptionId ?? undefined
  },
  async applyUpdate(yaml, id, _refs, client) {
    if (yaml.alertSensitivity !== undefined) {
      await typedPatch(client, `/api/v1/service-subscriptions/${id}/alert-sensitivity`, {
        alertSensitivity: yaml.alertSensitivity,
      })
    }
    if (yaml.component !== undefined) {
      await typedPatch(client, `/api/v1/service-subscriptions/${id}`, {
        componentId: yaml.component,
      })
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
