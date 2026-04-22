/**
 * State file v3 for tracking resources managed by `devhelm deploy`.
 *
 * **Identity-only store.** The state file is the *primary identity source*:
 * it maps resource addresses (e.g. `monitors.API`) to API UUIDs and tracks
 * the parent → child UUID hierarchy for status pages. Nothing else.
 *
 * Rationale (see `docs/rfcs/0001-state-as-identity-only.md`): earlier
 * versions also stored a snapshot of last-deployed attributes for drift
 * detection. That stale snapshot caused multiple incidents — most
 * recently the `defaultOpen` cross-environment drift on April 2026 — by
 * acting as the diff baseline instead of the live API. v3 removes the
 * snapshot, and `devhelm plan` always re-reads attributes from the API.
 *
 * The historical v1 (flat array, no children) and v2 (with attributes)
 * formats are silently migrated by the reader on first load; nothing
 * downstream sees them.
 *
 * State file: .devhelm/state.json (gitignored by convention)
 */
import {existsSync, readFileSync, writeFileSync, mkdirSync} from 'node:fs'
import {join, dirname} from 'node:path'
import {z} from 'zod'
import type {ResourceType} from './types.js'

// ── V3 types (current) ───────────────────────────────────────────────────

export interface ChildStateEntry {
  apiId: string
}

export interface StateEntry {
  apiId: string
  resourceType: ResourceType
  children: Record<string, ChildStateEntry>
}

export interface DeployStateV3 {
  version: '3'
  serial: number
  lastDeployedAt: string
  resources: Record<string, StateEntry>
}

// ── V2 types (for migration only) ────────────────────────────────────────

interface ChildStateEntryV2 {
  apiId: string
  attributes: Record<string, unknown>
}

interface StateEntryV2 {
  apiId: string
  resourceType: string
  attributes: Record<string, unknown>
  children: Record<string, ChildStateEntryV2>
}

interface DeployStateV2 {
  version: '2'
  serial: number
  lastDeployedAt: string
  resources: Record<string, StateEntryV2>
}

// ── V1 types (for migration only) ────────────────────────────────────────

export interface StateEntryV1 {
  resourceType: string
  refKey: string
  id: string
  createdAt: string
}

export interface DeployStateV1 {
  version: string
  lastDeployedAt: string
  resources: StateEntryV1[]
}

export type DeployState = DeployStateV3

// ── Zod schemas for state file validation ────────────────────────────────

const ChildStateEntryV3Schema = z.object({
  apiId: z.string(),
})

const StateEntryV3Schema = z.object({
  apiId: z.string(),
  resourceType: z.string(),
  children: z.record(ChildStateEntryV3Schema),
})

const DeployStateV3Schema = z.object({
  version: z.literal('3'),
  serial: z.number(),
  lastDeployedAt: z.string(),
  resources: z.record(StateEntryV3Schema),
})

// V2 schema is permissive — we only need it to validate enough of the shape
// to safely strip out the `attributes` fields during migration.
const ChildStateEntryV2Schema = z.object({
  apiId: z.string(),
  attributes: z.record(z.unknown()).optional(),
})

const StateEntryV2Schema = z.object({
  apiId: z.string(),
  resourceType: z.string(),
  attributes: z.record(z.unknown()).optional(),
  children: z.record(ChildStateEntryV2Schema).optional(),
})

const DeployStateV2Schema = z.object({
  version: z.literal('2'),
  serial: z.number(),
  lastDeployedAt: z.string(),
  resources: z.record(StateEntryV2Schema),
})

const StateEntryV1Schema = z.object({
  resourceType: z.string(),
  refKey: z.string(),
  id: z.string(),
  createdAt: z.string(),
})

const DeployStateV1Schema = z.object({
  version: z.string().optional(),
  lastDeployedAt: z.string().optional(),
  resources: z.array(StateEntryV1Schema),
})

// ── Constants ────────────────────────────────────────────────────────────

const STATE_DIR = '.devhelm'
const STATE_FILE = 'state.json'
export const STATE_VERSION = '3'

// Resource type → plural section key for address construction
const SECTION_NAMES: Record<string, string> = {
  tag: 'tags',
  environment: 'environments',
  secret: 'secrets',
  alertChannel: 'alertChannels',
  notificationPolicy: 'notificationPolicies',
  webhook: 'webhooks',
  resourceGroup: 'resourceGroups',
  monitor: 'monitors',
  dependency: 'dependencies',
  statusPage: 'statusPages',
}

/** Reverse map: plural section → singular resourceType */
const SECTION_TO_RESOURCE_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(SECTION_NAMES).map(([rt, section]) => [section, rt]),
)

/** Known section names (plural form used in addresses). */
export const KNOWN_SECTIONS: readonly string[] = Object.values(SECTION_NAMES)

// ── Address helpers ──────────────────────────────────────────────────────

export function resourceAddress(resourceType: string, refKey: string): string {
  const section = SECTION_NAMES[resourceType] ?? resourceType
  return `${section}.${refKey}`
}

/**
 * Parse an address of the form `<section>.<refKey>`. The first `.` is the
 * separator (section names never contain dots), so refKeys that themselves
 * contain `.` (e.g. `api.v2`) parse correctly.
 *
 * Returns `undefined` if the address is malformed. To additionally validate
 * that the section is a known resource type, see `parseAndValidateAddress`.
 */
export function parseAddress(address: string): {section: string; refKey: string} | undefined {
  const dotIdx = address.indexOf('.')
  if (dotIdx < 1 || dotIdx === address.length - 1) return undefined
  return {section: address.slice(0, dotIdx), refKey: address.slice(dotIdx + 1)}
}

/**
 * Like `parseAddress` but also enforces that the section is a known plural
 * resource section. Returns an error message string on failure.
 */
export function parseAndValidateAddress(
  address: string,
): {section: string; refKey: string; resourceType: string} | {error: string} {
  const parsed = parseAddress(address)
  if (!parsed) {
    return {error: `invalid address "${address}" — expected "<section>.<refKey>"`}
  }
  const resourceType = SECTION_TO_RESOURCE_TYPE[parsed.section]
  if (!resourceType) {
    return {
      error: `unknown section "${parsed.section}" in address "${address}" — ` +
        `valid sections: ${KNOWN_SECTIONS.join(', ')}`,
    }
  }
  if (parsed.refKey.length === 0) {
    return {error: `empty refKey in address "${address}"`}
  }
  return {section: parsed.section, refKey: parsed.refKey, resourceType}
}

// ── Path helpers ─────────────────────────────────────────────────────────

function statePath(cwd: string): string {
  return join(cwd, STATE_DIR, STATE_FILE)
}

// ── Read/write ───────────────────────────────────────────────────────────

/**
 * Error thrown when the state file exists but is unreadable/unparseable.
 * Callers (deploy/plan/import) should catch this and exit with a clear message
 * rather than silently proceeding as if no state existed — that would risk
 * duplicate creates of resources already deployed.
 */
export class StateFileCorruptError extends Error {
  readonly path: string
  readonly cause: unknown
  constructor(path: string, cause: unknown) {
    const causeMsg = cause instanceof Error ? cause.message : String(cause)
    super(
      `State file at ${path} is corrupt or invalid JSON: ${causeMsg}. ` +
      `Inspect or remove the file (or back it up and run \`devhelm state pull\` to reconstruct) before retrying.`,
    )
    this.path = path
    this.cause = cause
    this.name = 'StateFileCorruptError'
  }
}

export function readState(cwd: string = process.cwd()): DeployState | undefined {
  const path = statePath(cwd)
  if (!existsSync(path)) return undefined
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'))
  } catch (err) {
    throw new StateFileCorruptError(path, err)
  }
  if (raw === null || typeof raw !== 'object') {
    throw new StateFileCorruptError(path, new Error('expected JSON object at top level'))
  }

  const obj = raw as Record<string, unknown>

  // V1 detection: explicit version "1" or legacy shape (no version + array resources)
  if (obj.version === '1' || (obj.version === undefined && Array.isArray(obj.resources))) {
    const v1 = DeployStateV1Schema.safeParse(raw)
    if (!v1.success) {
      const issues = v1.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
      throw new StateFileCorruptError(path, new Error(`invalid v1 state: ${issues}`))
    }
    return migrateV1(v1.data as DeployStateV1)
  }

  if (obj.version === '2') {
    const v2 = DeployStateV2Schema.safeParse(raw)
    if (!v2.success) {
      const issues = v2.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
      throw new StateFileCorruptError(path, new Error(`invalid v2 state: ${issues}`))
    }
    return migrateV2(v2.data as DeployStateV2)
  }

  const v3 = DeployStateV3Schema.safeParse(raw)
  if (!v3.success) {
    const issues = v3.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new StateFileCorruptError(path, new Error(`invalid v3 state: ${issues}`))
  }
  return v3.data as DeployState
}

export function writeState(state: DeployState, cwd: string = process.cwd()): void {
  const path = statePath(cwd)
  const dir = dirname(path)
  if (!existsSync(dir)) {
    mkdirSync(dir, {recursive: true})
  }
  writeFileSync(path, JSON.stringify(state, null, 2))
}

// ── State construction ───────────────────────────────────────────────────

export function emptyState(): DeployState {
  return {
    version: '3',
    serial: 0,
    lastDeployedAt: new Date().toISOString(),
    resources: {},
  }
}

/**
 * Create a new state snapshot with incremented serial.
 * Merges provided entries into a fresh resource map.
 *
 * Note: callers may still pass `attributes` for backwards compatibility
 * with the v2 applier signatures during the transition; they are dropped
 * silently. See RFC 0001 for why state no longer stores attributes.
 */
export function buildState(
  entries: Array<{
    resourceType: ResourceType
    refKey: string
    apiId: string
    children?: Record<string, ChildStateEntry>
  }>,
  previousSerial: number = 0,
): DeployState {
  const resources: Record<string, StateEntry> = {}
  for (const e of entries) {
    const addr = resourceAddress(e.resourceType, e.refKey)
    resources[addr] = {
      apiId: e.apiId,
      resourceType: e.resourceType,
      children: e.children ?? {},
    }
  }
  return {
    version: '3',
    serial: previousSerial + 1,
    lastDeployedAt: new Date().toISOString(),
    resources,
  }
}

/**
 * @deprecated Use `buildState`. Retained for one release so out-of-tree
 * callers (none known) keep building. Drops `attributes` on the floor.
 */
export const buildStateV2 = buildState

/**
 * Mutate state: set or update a single resource entry.
 * Increments serial on each call.
 */
export function upsertStateEntry(
  state: DeployState,
  resourceType: ResourceType,
  refKey: string,
  apiId: string,
  children: Record<string, ChildStateEntry> = {},
): void {
  const addr = resourceAddress(resourceType, refKey)
  state.resources[addr] = {apiId, resourceType, children}
  state.serial++
  state.lastDeployedAt = new Date().toISOString()
}

/**
 * Remove a resource from state by address.
 */
export function removeStateEntry(state: DeployState, address: string): boolean {
  if (address in state.resources) {
    delete state.resources[address]
    state.serial++
    state.lastDeployedAt = new Date().toISOString()
    return true
  }
  return false
}

/**
 * Look up a resource entry by address.
 */
export function lookupByAddress(state: DeployState, address: string): StateEntry | undefined {
  return state.resources[address]
}

/**
 * Look up a resource by API ID across all entries.
 */
export function lookupByApiId(state: DeployState, apiId: string): {address: string; entry: StateEntry} | undefined {
  for (const [addr, entry] of Object.entries(state.resources)) {
    if (entry.apiId === apiId) return {address: addr, entry}
  }
  return undefined
}

/**
 * Process `moved` blocks: renames addresses in state while preserving API IDs.
 * Returns warnings for moves that couldn't be applied (e.g. source not found
 * or malformed address). The state serial is only incremented when at least
 * one move was actually applied.
 */
export function processMovedBlocks(
  state: DeployState,
  moved: Array<{from: string; to: string}>,
): string[] {
  const warnings: string[] = []
  let applied = 0

  for (const {from, to} of moved) {
    const fromParsed = parseAndValidateAddress(from)
    if ('error' in fromParsed) {
      warnings.push(`moved: invalid "from" address — ${fromParsed.error}`)
      continue
    }
    const toParsed = parseAndValidateAddress(to)
    if ('error' in toParsed) {
      warnings.push(`moved: invalid "to" address — ${toParsed.error}`)
      continue
    }
    if (fromParsed.section !== toParsed.section) {
      warnings.push(
        `moved: cannot move across sections — "${from}" (${fromParsed.section}) → "${to}" (${toParsed.section})`,
      )
      continue
    }

    const entry = state.resources[from]
    if (!entry) {
      warnings.push(`moved: "${from}" not found in state (no-op)`)
      continue
    }
    if (state.resources[to]) {
      warnings.push(`moved: target "${to}" already exists in state, skipping move from "${from}"`)
      continue
    }
    state.resources[to] = entry
    delete state.resources[from]
    applied++
  }

  if (applied > 0) {
    state.serial++
    state.lastDeployedAt = new Date().toISOString()
  }
  return warnings
}

/**
 * Read-only preview of `processMovedBlocks` for use by `devhelm plan`.
 *
 * Returns a deep clone of `state` with the renames applied (so that the
 * subsequent diff sees the post-move addresses, matching what `deploy`
 * would compute), plus the same warnings as `processMovedBlocks`. The
 * original state argument is left untouched, and nothing is persisted.
 *
 * Why this is its own function: `processMovedBlocks` mutates and bumps
 * `serial`/`lastDeployedAt`, which is correct during `deploy` but wrong
 * during `plan`. Forking the helper keeps both call sites honest and
 * documents the read-only contract in the type signature.
 */
export function previewMovedBlocks(
  state: DeployState,
  moved: Array<{from: string; to: string}>,
): {state: DeployState; warnings: string[]} {
  const cloned: DeployState = {
    ...state,
    resources: Object.fromEntries(
      Object.entries(state.resources).map(([addr, entry]) => [
        addr,
        {
          ...entry,
          children: Object.fromEntries(
            Object.entries(entry.children ?? {}).map(([k, v]) => [k, {...v}]),
          ),
        },
      ]),
    ),
  }
  const warnings = processMovedBlocks(cloned, moved)
  return {state: cloned, warnings}
}

// ── Legacy → V3 migration ────────────────────────────────────────────────

/**
 * Migrate a v1 state file (flat array, no children) to v3.
 *
 * v1 stored only `(resourceType, refKey, id)` per entry, which is exactly
 * what v3 needs at the parent level — no attributes to drop, no children
 * to migrate. The serial is reset to 1 because v1 didn't track serials.
 */
export function migrateV1(v1: DeployStateV1): DeployState {
  const resources: Record<string, StateEntry> = {}
  for (const entry of v1.resources ?? []) {
    const addr = resourceAddress(entry.resourceType, entry.refKey)
    resources[addr] = {
      apiId: entry.id,
      resourceType: entry.resourceType as ResourceType,
      children: {},
    }
  }
  return {
    version: '3',
    serial: 1,
    lastDeployedAt: v1.lastDeployedAt ?? new Date().toISOString(),
    resources,
  }
}

// ── V2 → V3 migration ────────────────────────────────────────────────────

/**
 * Migrate a v2 state file to v3 by stripping the now-unused `attributes`
 * fields at both the parent and child level. Identity (apiId, resourceType,
 * children's apiId) is preserved verbatim, so renames and child tracking
 * keep working without any user action.
 *
 * The migration runs silently on first read; the next `deploy` or `state pull`
 * persists the v3 shape, and the v2 file is gone.
 */
export function migrateV2(v2: DeployStateV2): DeployState {
  const resources: Record<string, StateEntry> = {}
  for (const [addr, entry] of Object.entries(v2.resources)) {
    const children: Record<string, ChildStateEntry> = {}
    for (const [key, child] of Object.entries(entry.children ?? {})) {
      children[key] = {apiId: child.apiId}
    }
    resources[addr] = {
      apiId: entry.apiId,
      resourceType: entry.resourceType as ResourceType,
      children,
    }
  }
  return {
    version: '3',
    serial: v2.serial,
    lastDeployedAt: v2.lastDeployedAt,
    resources,
  }
}
