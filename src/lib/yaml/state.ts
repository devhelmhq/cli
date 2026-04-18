/**
 * State file v2 for tracking resources managed by `devhelm deploy`.
 *
 * The state file is the primary identity source: it maps resource addresses
 * (e.g. "monitors.API") to API UUIDs. This enables rename detection via
 * `moved` blocks, drift detection via `lastDeployedAttributes`, and child
 * resource tracking for status pages and resource groups.
 *
 * State file: .devhelm/state.json (gitignored by convention)
 */
import {existsSync, readFileSync, writeFileSync, mkdirSync} from 'node:fs'
import {join, dirname} from 'node:path'
import type {ResourceType} from './types.js'

// ── V2 types ─────────────────────────────────────────────────────────────

export interface ChildStateEntry {
  apiId: string
  attributes: Record<string, unknown>
}

export interface StateEntry {
  apiId: string
  resourceType: ResourceType
  attributes: Record<string, unknown>
  children: Record<string, ChildStateEntry>
}

export interface DeployStateV2 {
  version: '2'
  serial: number
  lastDeployedAt: string
  resources: Record<string, StateEntry>
}

// ── V1 types (for migration) ─────────────────────────────────────────────

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

export type DeployState = DeployStateV2

// ── Constants ────────────────────────────────────────────────────────────

const STATE_DIR = '.devhelm'
const STATE_FILE = 'state.json'
export const STATE_VERSION = '2'

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
  if (obj.version === '1' || (obj.version === undefined && Array.isArray(obj.resources))) {
    return migrateV1(obj as unknown as DeployStateV1)
  }
  if (obj.version !== '2' || typeof obj.resources !== 'object' || obj.resources === null) {
    throw new StateFileCorruptError(path, new Error(`unrecognized state shape (version=${String(obj.version)})`))
  }
  return obj as unknown as DeployState
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
    version: '2',
    serial: 0,
    lastDeployedAt: new Date().toISOString(),
    resources: {},
  }
}

/**
 * Create a new state snapshot with incremented serial.
 * Merges provided entries into a fresh resource map.
 */
export function buildStateV2(
  entries: Array<{
    resourceType: ResourceType
    refKey: string
    apiId: string
    attributes?: Record<string, unknown>
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
      attributes: e.attributes ?? {},
      children: e.children ?? {},
    }
  }
  return {
    version: '2',
    serial: previousSerial + 1,
    lastDeployedAt: new Date().toISOString(),
    resources,
  }
}

/**
 * Mutate state: set or update a single resource entry.
 * Increments serial on each call.
 */
export function upsertStateEntry(
  state: DeployState,
  resourceType: ResourceType,
  refKey: string,
  apiId: string,
  attributes: Record<string, unknown> = {},
  children: Record<string, ChildStateEntry> = {},
): void {
  const addr = resourceAddress(resourceType, refKey)
  state.resources[addr] = {apiId, resourceType, attributes, children}
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
          attributes: {...entry.attributes},
          children: Object.fromEntries(
            Object.entries(entry.children ?? {}).map(([k, v]) => [
              k,
              {...v, attributes: {...v.attributes}},
            ]),
          ),
        },
      ]),
    ),
  }
  const warnings = processMovedBlocks(cloned, moved)
  return {state: cloned, warnings}
}

// ── V1 → V2 migration ───────────────────────────────────────────────────

/**
 * Migrate a v1 state file (flat array, no attributes/children) to v2.
 *
 * **Synthetic attributes.** v1 stored only the API id and refKey, so we
 * cannot reconstruct real attributes here. We seed a placeholder
 * `attributes: {name: refKey, _migrated: true}` for two reasons:
 *
 *   1. Some resource types (webhooks, secrets, environments) don't even
 *      have a `name` field — their refKey is `url`/`key`/`slug`. The
 *      placeholder is *not* used by the diffing engine (snapshots are
 *      always rebuilt from the YAML + API DTO via the handler), only as
 *      filler until the next deploy overwrites it via `buildStateV2`.
 *   2. The `_migrated: true` marker makes it trivial to spot a state file
 *      that has not yet been re-written post-upgrade, both in tooling and
 *      by humans inspecting `.devhelm/state.json`.
 *
 * The serial is reset to 1 because v1 didn't track serials.
 */
export function migrateV1(v1: DeployStateV1): DeployState {
  const resources: Record<string, StateEntry> = {}
  for (const entry of v1.resources ?? []) {
    const addr = resourceAddress(entry.resourceType, entry.refKey)
    resources[addr] = {
      apiId: entry.id,
      resourceType: entry.resourceType as ResourceType,
      attributes: {name: entry.refKey, _migrated: true},
      children: {},
    }
  }
  return {
    version: '2',
    serial: 1,
    lastDeployedAt: v1.lastDeployedAt ?? new Date().toISOString(),
    resources,
  }
}

// ── Backward-compat shim ─────────────────────────────────────────────────

/**
 * @deprecated Use buildStateV2. Kept for backward compat with deploy command
 * until it's fully migrated to v2 state writes.
 */
export function buildState(
  entries: Array<{resourceType: string; refKey: string; id: string; createdAt: string}>,
): DeployState {
  return buildStateV2(
    entries.map((e) => ({
      resourceType: e.resourceType as ResourceType,
      refKey: e.refKey,
      apiId: e.id,
      attributes: {name: e.refKey},
    })),
  )
}
