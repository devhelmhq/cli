/**
 * Diff engine: compares desired state (YAML) against current state (API)
 * and produces an ordered changeset.
 *
 * Delegates all per-resource-type semantic comparison to typed handlers
 * in handlers.ts — no Record<string, unknown> anywhere in this file.
 */
import type {DevhelmConfig} from './schema.js'
import type {ResolvedRefs} from './resolver.js'
import {allHandlers, type ResourceHandler} from './handlers.js'
import type {Change, Changeset, DiffOptions} from './types.js'
import {RESOURCE_ORDER} from './types.js'

// Re-export types so existing consumers don't need to change imports
export type {ChangeAction, ResourceType, Change, DiffOptions, Changeset} from './types.js'

// ── Main diff function ─────────────────────────────────────────────────

export function diff(config: DevhelmConfig, refs: ResolvedRefs, options: DiffOptions = {}): Changeset {
  const creates: Change[] = []
  const updates: Change[] = []
  const deletes: Change[] = []
  const memberships: Change[] = []

  for (const handler of allHandlers()) {
    diffSection(handler, config[handler.configKey], refs, creates, updates, deletes, options)
  }

  for (const group of config.resourceGroups ?? []) {
    for (const monitorName of group.monitors ?? []) {
      memberships.push({
        action: 'create',
        resourceType: 'groupMembership',
        refKey: `${group.name} → ${monitorName}`,
        desired: {groupName: group.name, memberType: 'monitor', memberRef: monitorName},
      })
    }
    for (const serviceSlug of group.services ?? []) {
      memberships.push({
        action: 'create',
        resourceType: 'groupMembership',
        refKey: `${group.name} → ${serviceSlug}`,
        desired: {groupName: group.name, memberType: 'service', memberRef: serviceSlug},
      })
    }
  }

  creates.sort((a, b) => RESOURCE_ORDER.indexOf(a.resourceType) - RESOURCE_ORDER.indexOf(b.resourceType))
  updates.sort((a, b) => RESOURCE_ORDER.indexOf(a.resourceType) - RESOURCE_ORDER.indexOf(b.resourceType))
  deletes.sort((a, b) => RESOURCE_ORDER.indexOf(b.resourceType) - RESOURCE_ORDER.indexOf(a.resourceType))

  return {creates, updates, deletes, memberships}
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
): void {
  const desired = new Set<string>()

  for (const item of items ?? []) {
    const refKey = handler.getRefKey(item)
    desired.add(refKey)
    const existing = refs.get(handler.refType, refKey)

    if (existing) {
      if (handler.hasChanged(item, existing.raw, refs)) {
        updates.push({
          action: 'update',
          resourceType: handler.resourceType,
          refKey,
          existingId: existing.id,
          desired: item,
          current: existing.raw,
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

  if (options.prune && items !== undefined) {
    for (const entry of refs.allEntries(handler.refType)) {
      if (!desired.has(entry.refKey)) {
        if (handler.resourceType === 'monitor' && entry.managedBy !== 'CLI') continue
        deletes.push({
          action: 'delete',
          resourceType: handler.resourceType,
          refKey: entry.refKey,
          existingId: entry.id,
          current: entry.raw,
        })
      }
    }
  }
}

// ── Plan formatting ────────────────────────────────────────────────────

export function formatPlan(changeset: Changeset): string {
  const lines: string[] = []
  const totalChanges = changeset.creates.length + changeset.updates.length + changeset.deletes.length + changeset.memberships.length

  if (totalChanges === 0) {
    return 'No changes. Infrastructure is up-to-date.'
  }

  lines.push(`Plan: ${changeset.creates.length} to create, ${changeset.updates.length} to update, ${changeset.deletes.length} to delete, ${changeset.memberships.length} memberships\n`)

  for (const c of changeset.creates) {
    lines.push(`  + ${c.resourceType} "${c.refKey}"`)
  }
  for (const c of changeset.updates) {
    lines.push(`  ~ ${c.resourceType} "${c.refKey}"`)
  }
  for (const c of changeset.deletes) {
    lines.push(`  - ${c.resourceType} "${c.refKey}"`)
  }
  for (const c of changeset.memberships) {
    lines.push(`  → ${c.refKey}`)
  }

  return lines.join('\n')
}
