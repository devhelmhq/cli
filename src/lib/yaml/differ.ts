/**
 * Diff engine: compares desired state (YAML) against current state (API)
 * and produces an ordered changeset.
 *
 * Delegates all per-resource-type semantic comparison to typed handlers
 * in handlers.ts — no Record<string, unknown> anywhere in this file.
 */
import type {components} from '../api.generated.js'
import type {DevhelmConfig} from './schema.js'
import type {ResolvedRefs} from './resolver.js'
import {allHandlers, type ResourceHandler} from './handlers.js'
import type {Change, Changeset, DiffOptions} from './types.js'
import {RESOURCE_ORDER} from './types.js'

type ResourceGroupDto = components['schemas']['ResourceGroupDto']
type ResourceGroupMemberDto = components['schemas']['ResourceGroupMemberDto']

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

  diffMemberships(config, refs, memberships, options)

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

// ── Membership diff ────────────────────────────────────────────────────

function memberKey(memberType: string, nameOrSlug: string): string {
  return `${memberType}:${nameOrSlug}`
}

function diffMemberships(
  config: DevhelmConfig,
  refs: ResolvedRefs,
  memberships: Change[],
  options: DiffOptions,
): void {
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

    if (options.prune && groupEntry) {
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
}

function changeToJson(c: Change): ChangeJson {
  const out: ChangeJson = {action: c.action, resource_type: c.resourceType, ref_key: c.refKey}
  if (c.existingId) out.existing_id = c.existingId
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
    const icon = c.action === 'delete' ? '- membership' : '→'
    lines.push(`  ${icon} ${c.refKey}`)
  }

  return lines.join('\n')
}
