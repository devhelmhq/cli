# Status Page Components

A **component** is a row on the status page. Each component has:

- A user-facing name (*"API"*, *"Dashboard"*, *"Checkout"*).
- A source of truth — usually a **monitor** or a **dependency**, but
  can also be manual (useful for non-automated services).
- An optional parent **group** for sectioning.
- A display order.

## Create

```bash
# Backed by a monitor
devhelm status-pages components create <page-id> \
  --name="API" \
  --monitor-id=<mon_id> \
  --group-id=<group_id> \
  --description="Public API"

# Backed by a dependency
devhelm status-pages components create <page-id> \
  --name="Stripe Payments" \
  --dependency-id=<dep_id>

# Manual (status set by user, not auto-computed)
devhelm status-pages components create <page-id> \
  --name="Internal Admin" \
  --manual-status=OPERATIONAL
```

## Groups

Groups section the page. Create them first, then attach components:

```bash
devhelm status-pages groups create <page-id> \
  --name="Production" \
  --display-order=1

devhelm status-pages components create <page-id> \
  --name="API" \
  --monitor-id=<mon_id> \
  --group-id=<group-id>
```

Display order: ascending integer. The page renders groups in order;
components are ordered within their group.

## Propose a component layout (onboarding flow)

When the user says *"set up a status page"* and has N monitors:

1. Read `devhelm monitors list --output=json`.
2. Infer groupings from tags (`env`, `service`) and resource-group
   membership.
3. Propose one component per monitor, within groups derived from the
   dominant grouping tag.

Show as a tree, ask for one yes/no before creating anything.

## Update / delete / reorder

```bash
devhelm status-pages components update <component-id> --name="..." --display-order=2
devhelm status-pages components delete <component-id>
```

Delete is reversible only via undelete API within 24h (not exposed in
CLI yet) — warn the user.

## Manual status override

For manual components or when the user wants to force a status
regardless of the underlying monitor:

```bash
devhelm status-pages components update <component-id> \
  --manual-status=DEGRADED \
  --manual-status-reason="Known issue with X, ETA 30min"
```

Valid statuses: `OPERATIONAL`, `DEGRADED`, `PARTIAL_OUTAGE`,
`MAJOR_OUTAGE`, `UNDER_MAINTENANCE`.

To return to monitor-driven status:

```bash
devhelm status-pages components update <component-id> --manual-status=null
```

## Common gotchas

- **Monitor binding is 1:1 per page** — the same monitor can back
  components on multiple pages (if you run public + internal pages),
  but not twice on the same page. API rejects duplicates.
- **Group deletion** with components inside → components become
  orphaned (group-less), not deleted. Prune them separately.
- **Auto-incidents from manual components** — don't fire, because
  there's no monitor driving them. Manual incidents only.

## Complete field reference

`@_generated/status-page-components.fields.md`. Runtime pull:
`devhelm skills schema status-page-components`.
