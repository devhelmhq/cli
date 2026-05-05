/**
 * Diff engine: compares desired state (YAML) against current state (API)
 * and produces an ordered changeset.
 *
 * Delegates all per-resource-type semantic comparison to typed handlers
 * in handlers.ts — no Record<string, unknown> anywhere in this file.
 *
 * **State as identity, not snapshot** (see RFC 0001): for handlers that
 * declare `fetchChildSnapshots`, the differ pre-fetches live API children
 * at plan time and feeds them into `hasChildChanges`. State is consulted
 * only for renames/identity (`apiId`), never as a diff baseline.
 */
import type {ApiClient} from '../api-client.js'
import type {components} from '../api.generated.js'
import type {DevhelmConfig} from './schema.js'
import type {ResolvedRefs} from './resolver.js'
import {allHandlers, type ResourceHandler, type CurrentChildEntry} from './handlers.js'
import type {Change, Changeset, DiffOptions, PruneScope} from './types.js'
import {RESOURCE_ORDER} from './types.js'
import type {DeployState} from './state.js'
import {resourceAddress} from './state.js'
import type {ResourceType} from './types.js'

type ResourceGroupDto = components['schemas']['ResourceGroupDto']
type ResourceGroupMemberDto = components['schemas']['ResourceGroupMemberDto']

// Re-export types so existing consumers don't need to change imports
export type {ChangeAction, ResourceType, Change, DiffOptions, Changeset, AttributeDiff} from './types.js'

// ── Main diff function ─────────────────────────────────────────────────

/** Pre-fetched live child snapshots, keyed by parent resource-address
 * (e.g. `statusPages.platform`). Built by `prefetchChildSnapshots` and
 * consumed by `diff`. Empty for parents whose handler doesn't declare
 * `fetchChildSnapshots` or that don't yet exist in the API. */
export type ChildSnapshotMap = Map<string, Record<string, CurrentChildEntry>>

/**
 * Compute the changeset for a deploy/plan run.
 *
 * **Async because of child collections.** For handlers like `statusPage`
 * that declare `fetchChildSnapshots`, the differ needs live API child
 * data as the diff baseline (see RFC 0001). Pre-fetching is split into
 * `prefetchChildSnapshots` so production callers can run all child
 * fetches concurrently up-front, while tests can inject an empty/fake
 * map without spinning up an HTTP mock.
 *
 * `currentChildren` defaults to an empty map. That's the correct
 * behavior for configs without child-bearing parents AND for tests that
 * only care about parent-field diffing.
 */
export async function diff(
  config: DevhelmConfig,
  refs: ResolvedRefs,
  options: DiffOptions = {},
  priorState?: DeployState,
  currentChildren: ChildSnapshotMap = new Map(),
): Promise<Changeset> {
  const creates: Change[] = []
  const updates: Change[] = []
  const deletes: Change[] = []
  const memberships: Change[] = []

  function lookupCurrentChildren(
    resourceType: ResourceType, refKey: string,
  ): Record<string, CurrentChildEntry> {
    const addr = resourceAddress(resourceType, refKey)
    return currentChildren.get(addr) ?? {}
  }

  // Set of `<section>.<refKey>` addresses present in this config's
  // `.devhelm/state.json`. Drives the `--prune` (state-scoped) branch
  // in `diffSection` — non-state addresses are only candidates under
  // `--prune-org-cli` or `--prune-all`. Lazily an empty set when no
  // state was passed so callers / tests can omit `priorState` without
  // accidentally widening the prune scope.
  const stateAddresses = new Set<string>(
    priorState ? Object.keys(priorState.resources) : [],
  )

  for (const handler of allHandlers()) {
    diffSection(handler, config[handler.configKey], refs, creates, updates, deletes, options, lookupCurrentChildren, stateAddresses)
  }

  diffMemberships(config, refs, memberships, options)

  creates.sort(byResourceOrder)
  updates.sort(byResourceOrder)
  deletes.sort((a, b) => byResourceOrderIndex(b.resourceType) - byResourceOrderIndex(a.resourceType))

  return {creates, updates, deletes, memberships}
}

/**
 * For every handler that declares `fetchChildSnapshots`, fetch live API
 * children for each parent that already exists in the API. Returns a map
 * keyed by parent resource-address so the inner diff loop can look up
 * children in O(1) without async.
 *
 * Network errors are NOT swallowed: if the API fails to return children
 * for an existing parent, the plan is incorrect by construction (we'd
 * silently fall back to "no children" and miss real drift). Better to
 * surface the failure and let the caller retry.
 */
export async function prefetchChildSnapshots(
  config: DevhelmConfig,
  refs: ResolvedRefs,
  client: ApiClient,
): Promise<ChildSnapshotMap> {
  const out: ChildSnapshotMap = new Map()
  const tasks: Promise<void>[] = []

  for (const handler of allHandlers()) {
    if (!handler.fetchChildSnapshots) continue
    const items = config[handler.configKey] as unknown[] | undefined
    if (!items || items.length === 0) continue

    // Only fetch for parents that actually exist in the API (i.e. have a
    // ref entry that isn't a YAML-only pending placeholder). New parents
    // skip the fetch — their children are handled by `applyCreate`.
    for (const item of items) {
      const refKey = handler.getRefKey(item)
      const existing = refs.get(handler.refType, refKey)
      if (!existing || existing.isPending) continue
      const addr = resourceAddress(handler.resourceType as ResourceType, refKey)
      tasks.push(
        handler.fetchChildSnapshots(existing.id, client, refs).then((snapshots) => {
          out.set(addr, snapshots)
        }),
      )
    }
  }

  await Promise.all(tasks)
  return out
}

/**
 * Resource-order comparator. Unknown resource types sort *after* known ones
 * (using Number.MAX_SAFE_INTEGER) and then by resourceType alphabetically for
 * stability, so the plan output is always deterministic even if a new type
 * sneaks in without being registered in RESOURCE_ORDER.
 */
function byResourceOrderIndex(resourceType: string): number {
  const idx = RESOURCE_ORDER.indexOf(resourceType as typeof RESOURCE_ORDER[number])
  return idx < 0 ? Number.MAX_SAFE_INTEGER : idx
}

function byResourceOrder(a: Change, b: Change): number {
  const d = byResourceOrderIndex(a.resourceType) - byResourceOrderIndex(b.resourceType)
  if (d !== 0) return d
  if (a.resourceType !== b.resourceType) return a.resourceType < b.resourceType ? -1 : 1
  return a.refKey < b.refKey ? -1 : a.refKey > b.refKey ? 1 : 0
}

// ── Generic diff section ────────────────────────────────────────────────

function diffSection(
  handler: ResourceHandler,
  items: unknown[] | undefined,
  refs: ResolvedRefs,
  creates: Change[],
  updates: Change[],
  deletes: Change[],
  options: DiffOptions,
  lookupCurrentChildren: (resourceType: ResourceType, refKey: string) => Record<string, CurrentChildEntry>,
  stateAddresses: ReadonlySet<string>,
): void {
  const desired = new Set<string>()

  for (const item of items ?? []) {
    const refKey = handler.getRefKey(item)
    desired.add(refKey)
    const existing = refs.get(handler.refType, refKey)

    // Pending entries are YAML-only placeholders injected by
    // registerYamlPendingRefs so dependent snapshots can resolve references.
    // They are NOT real API resources and must not divert the differ from
    // the create path.
    if (existing && !existing.isPending) {
      const parentChanged = handler.hasChanged(item, existing.raw, refs)
      // hasChildChanges complements parent comparison so the differ can
      // detect "user added a component to an existing status page" even when
      // the page itself is byte-identical. The children map was pre-fetched
      // live from the API in prefetchChildSnapshots above, so this OR'd-in
      // check correctly catches drift across machines/environments without
      // depending on `state.json` having an up-to-date snapshot.
      const currentChildren = lookupCurrentChildren(handler.resourceType as ResourceType, refKey)
      const childrenChanged = handler.hasChildChanges?.(item, currentChildren) ?? false
      if (parentChanged || childrenChanged) {
        const attributeDiffs = handler.computeAttributeDiffs?.(item, existing.raw, refs)
        updates.push({
          action: 'update',
          resourceType: handler.resourceType,
          refKey,
          existingId: existing.id,
          desired: item,
          current: existing.raw,
          attributeDiffs,
        })
      }
    } else {
      creates.push({
        action: 'create',
        resourceType: handler.resourceType,
        refKey,
        desired: item,
      })
    }
  }

  const anyPrune = options.prune || options.pruneOrgCli || options.pruneAll
  if (anyPrune && items !== undefined) {
    for (const entry of refs.allEntries(handler.refType)) {
      if (entry.isPending) continue
      if (desired.has(entry.refKey)) continue

      const address = resourceAddress(handler.resourceType as ResourceType, entry.refKey)
      const scope = classifyDeleteScope(handler, entry, stateAddresses, address)

      // Decide whether to include this delete based on the requested
      // prune flag(s). State-scoped deletes are the safe default and
      // are always included when *any* prune flag is on; the wider
      // scopes require their explicit opt-in.
      const include =
        (scope === 'state') ||
        (scope === 'org-cli' && (options.pruneOrgCli || options.pruneAll)) ||
        (scope === 'org-all' && options.pruneAll)
      if (!include) continue

      deletes.push({
        action: 'delete',
        resourceType: handler.resourceType,
        refKey: entry.refKey,
        existingId: entry.id,
        current: entry.raw,
        pruneScope: scope,
      })
    }
  }
}

function classifyDeleteScope(
  handler: ResourceHandler,
  entry: {refKey: string; managedBy?: string | null},
  stateAddresses: ReadonlySet<string>,
  address: string,
): PruneScope {
  if (stateAddresses.has(address)) return 'state'
  // Monitors carry an explicit `managedBy`; non-CLI monitors are
  // foreign (dashboard / Terraform / MCP / API) and only `--prune-all`
  // is allowed to touch them.
  if (handler.resourceType === 'monitor') {
    return entry.managedBy === 'CLI' ? 'org-cli' : 'org-all'
  }
  // Other resource types lack a managedBy concept on the API, so the
  // legacy `--prune` semantic was "delete anything not in YAML" — keep
  // that under `--prune-org-cli` for parity, and reserve `--prune-all`
  // for an unambiguous "everything".
  return 'org-cli'
}

// ── Membership diff ────────────────────────────────────────────────────
//
// Why memberships do **not** use the generic `ChildCollectionDef` machinery
// in `child-reconciler.ts`:
//
//   1. **Heterogeneous children.** A resource group has *two* concurrent
//      child types (monitor, service) that share an addressing space and a
//      single membership endpoint. ChildCollectionDef is parameterised over
//      one child type per parent.
//   2. **Additive-by-default semantics.** Memberships are intentionally
//      additive without an explicit `--prune` / `--prune-all` flag — we
//      never silently remove members someone added via the dashboard. The
//      generic reconciler always performs a full create/update/delete cycle
//      and would change this UX.
//   3. **No update phase.** Memberships only have create/delete; there is
//      no per-member attribute update to diff (membership is a join row).
//
// If/when these constraints change (e.g. a future API exposes membership
// attributes worth diffing), revisit migrating this onto the generic
// reconciler. Until then, the duplication is intentional and worth its
// weight in tailored UX.

function memberKey(memberType: string, nameOrSlug: string): string {
  return `${memberType}:${nameOrSlug}`
}

/**
 * Diff resource group memberships.
 *
 * Prune semantics (documented for M8):
 *   - Any prune flag (`--prune` / `--prune-org-cli` / `--prune-all`):
 *     - For groups **present in YAML**: remove any current members not listed.
 *     - For groups **absent from YAML** (orphan groups): *only* under
 *       `pruneAll` — membership provenance isn't tracked anywhere outside
 *       the YAML, so the safe default is to leave dashboard-curated
 *       memberships alone. `pruneAll` takes the Terraform stance:
 *       anything not in config is fair game.
 *   - Without prune flags, memberships are additive: we only create missing
 *     ones, never remove.
 */
function diffMemberships(
  config: DevhelmConfig,
  refs: ResolvedRefs,
  memberships: Change[],
  options: DiffOptions,
): void {
  const yamlGroupNames = new Set((config.resourceGroups ?? []).map((g) => g.name))

  for (const group of config.resourceGroups ?? []) {
    const groupEntry = refs.get('resourceGroups', group.name)
    const currentMembers = new Map<string, ResourceGroupMemberDto>()

    if (groupEntry) {
      const dto = groupEntry.raw as ResourceGroupDto
      for (const m of dto.members ?? []) {
        if (m.memberType === 'monitor' && m.name) {
          currentMembers.set(memberKey('monitor', m.name), m)
        } else if (m.memberType === 'service' && m.slug) {
          currentMembers.set(memberKey('service', m.slug), m)
        }
      }
    }

    const desired = new Set<string>()

    for (const monitorName of group.monitors ?? []) {
      const key = memberKey('monitor', monitorName)
      desired.add(key)
      if (!currentMembers.has(key)) {
        memberships.push({
          action: 'create',
          resourceType: 'groupMembership',
          refKey: `${group.name} → ${monitorName}`,
          desired: {groupName: group.name, memberType: 'monitor', memberRef: monitorName},
        })
      }
    }

    for (const serviceSlug of group.services ?? []) {
      const key = memberKey('service', serviceSlug)
      desired.add(key)
      if (!currentMembers.has(key)) {
        memberships.push({
          action: 'create',
          resourceType: 'groupMembership',
          refKey: `${group.name} → ${serviceSlug}`,
          desired: {groupName: group.name, memberType: 'service', memberRef: serviceSlug},
        })
      }
    }

    const anyPrune = options.prune || options.pruneOrgCli || options.pruneAll
    if (anyPrune && groupEntry) {
      for (const [key, member] of currentMembers) {
        if (!desired.has(key)) {
          const label = member.name ?? member.slug ?? member.id ?? 'unknown'
          memberships.push({
            action: 'delete',
            resourceType: 'groupMembership',
            refKey: `${group.name} → ${label}`,
            existingId: member.id,
            desired: {groupId: groupEntry.id, memberId: member.id},
          })
        }
      }
    }
  }

  // Orphan groups: groups in the API that are absent from YAML. Only prune
  // their memberships under `pruneAll` — see docstring.
  if (options.pruneAll) {
    for (const groupEntry of refs.allEntries('resourceGroups')) {
      if (groupEntry.isPending) continue
      if (yamlGroupNames.has(groupEntry.refKey)) continue
      const dto = groupEntry.raw as ResourceGroupDto
      for (const m of dto.members ?? []) {
        const label = m.name ?? m.slug ?? m.id ?? 'unknown'
        memberships.push({
          action: 'delete',
          resourceType: 'groupMembership',
          refKey: `${groupEntry.refKey} → ${label}`,
          existingId: m.id,
          desired: {groupId: groupEntry.id, memberId: m.id},
        })
      }
    }
  }
}

// ── JSON serialization ─────────────────────────────────────────────────

export interface ChangesetJson {
  format_version: string
  creates: ChangeJson[]
  updates: ChangeJson[]
  deletes: ChangeJson[]
  memberships: ChangeJson[]
  summary: {creates: number; updates: number; deletes: number; memberships: number}
}

interface ChangeJson {
  action: string
  resource_type: string
  ref_key: string
  existing_id?: string
  attribute_diffs?: Array<{field: string; old: unknown; new: unknown}>
  desired?: unknown
  current?: unknown
}

function changeToJson(c: Change): ChangeJson {
  const out: ChangeJson = {action: c.action, resource_type: c.resourceType, ref_key: c.refKey}
  if (c.existingId) out.existing_id = c.existingId
  if (c.attributeDiffs && c.attributeDiffs.length > 0) out.attribute_diffs = c.attributeDiffs
  if (c.desired !== undefined) out.desired = c.desired
  if (c.current !== undefined) out.current = c.current
  return out
}

export function changesetToJson(changeset: Changeset): ChangesetJson {
  return {
    format_version: '1',
    creates: changeset.creates.map(changeToJson),
    updates: changeset.updates.map(changeToJson),
    deletes: changeset.deletes.map(changeToJson),
    memberships: changeset.memberships.map(changeToJson),
    summary: {
      creates: changeset.creates.length,
      updates: changeset.updates.length,
      deletes: changeset.deletes.length,
      memberships: changeset.memberships.length,
    },
  }
}

// ── Plan formatting ────────────────────────────────────────────────────

export function formatPlan(changeset: Changeset): string {
  const lines: string[] = []
  const totalChanges = changeset.creates.length + changeset.updates.length + changeset.deletes.length + changeset.memberships.length

  if (totalChanges === 0) {
    return 'No changes. Infrastructure is up-to-date.'
  }

  for (const c of changeset.creates) {
    lines.push(`  + ${c.resourceType} "${c.refKey}"`)
  }
  for (const c of changeset.updates) {
    lines.push(`  ~ ${c.resourceType} "${c.refKey}"`)
    if (c.attributeDiffs && c.attributeDiffs.length > 0) {
      for (const d of c.attributeDiffs) {
        lines.push(`      ${d.field}: ${formatValue(d.old)} → ${formatValue(d.new)}`)
      }
    }
  }
  // Group destroys by prune scope so multi-team users can tell at a
  // glance which ones came from this config's state and which came from
  // the wider `--prune-org-cli` / `--prune-all` widening. When every
  // delete shares a single scope (the common case), only that group's
  // header is printed.
  if (changeset.deletes.length > 0) {
    const groups: Array<{label: string; scope: PruneScope | undefined}> = [
      {label: 'Tracked by this config:', scope: 'state'},
      {label: 'Other CLI-managed resources:', scope: 'org-cli'},
      {label: 'Foreign resources (--prune-all):', scope: 'org-all'},
    ]
    const present = new Set(changeset.deletes.map((d) => d.pruneScope ?? 'state'))
    const showHeaders = present.size > 1
    for (const {label, scope} of groups) {
      const items = changeset.deletes.filter((d) => (d.pruneScope ?? 'state') === scope)
      if (items.length === 0) continue
      if (showHeaders) lines.push(`  ${label}`)
      for (const c of items) {
        const indent = showHeaders ? '    ' : '  '
        lines.push(`${indent}- ${c.resourceType} "${c.refKey}"`)
      }
    }
  }
  for (const c of changeset.memberships) {
    const icon = c.action === 'delete' ? '- membership' : '→'
    lines.push(`  ${icon} ${c.refKey}`)
  }

  const membershipAdds = changeset.memberships.filter((c) => c.action === 'create').length
  const membershipRemoves = changeset.memberships.filter((c) => c.action === 'delete').length

  lines.push('')
  const parts = [
    `${changeset.creates.length} to add`,
    `${changeset.updates.length} to change`,
    `${changeset.deletes.length} to destroy`,
  ]
  if (membershipAdds > 0 || membershipRemoves > 0) {
    const mParts: string[] = []
    if (membershipAdds > 0) mParts.push(`${membershipAdds} membership${membershipAdds === 1 ? '' : 's'} to add`)
    if (membershipRemoves > 0) mParts.push(`${membershipRemoves} membership${membershipRemoves === 1 ? '' : 's'} to remove`)
    parts.push(mParts.join(', '))
  }
  lines.push(`Plan: ${parts.join(', ')}.`)

  return lines.join('\n')
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return 'null'
  if (typeof v === 'string') return `"${v}"`
  if (typeof v === 'boolean' || typeof v === 'number') return String(v)
  if (Array.isArray(v)) return `[${v.map(formatValue).join(', ')}]`
  return JSON.stringify(v)
}
