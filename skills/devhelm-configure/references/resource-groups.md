# Resource Groups

A **resource group** is a named bundle of monitors (and other
resources) that share an ownership boundary — a team, a service, a
product line.

Use groups when:

- You want a unified uptime number for a logical service ("Checkout
  service = 3 monitors at 99.93%").
- Multiple teams share a workspace and you want per-team dashboards
  + policies.
- You're publishing a status page and want components grouped by
  service rather than per-monitor.

**Don't confuse with tags.** Tags are free-form key/value metadata
that any number of resources can share; they're for filtering.
Resource groups are single-parent containers with ownership
semantics. A monitor has one group (or none) but many tags.

## Create

```bash
devhelm resource-groups create \
  --name="Checkout" \
  --slug=checkout \
  --description="Payment + cart flow"
```

## Add monitors

Two ways:

```bash
# At monitor creation
devhelm monitors create --name=checkout-api --resource-group=checkout ...

# After the fact
devhelm monitors update <monitor-id> --resource-group=checkout
```

## Read / list

```bash
devhelm resource-groups list
devhelm resource-groups get <slug>      # includes member counts
devhelm monitors list --resource-group=<slug>
```

## YAML

```yaml
resource_groups:
  - name: Checkout
    slug: checkout
    description: Payment + cart flow

monitors:
  - name: checkout-api
    type: HTTP
    url: https://checkout.example.com/health
    resource_group: checkout
```

## Use in status pages

Status page components can be grouped by `resource_group` for
automatic sectioning — see `devhelm-communicate` skill →
`@references/components.md`.

## Use in notification policies

Policies can scope to a group:

```bash
devhelm notification-policies create \
  --name=checkout-oncall \
  --resource-group=checkout \
  --trigger-count=2 \
  --alert-channels=pd-checkout
```

## Common gotchas

- **Deleting a group with members** — the API returns 409. Move
  monitors to another group or to none (`--resource-group=null`)
  first.
- **Slug immutability** — slugs are used in dashboard URLs and pSEO
  (if enabled). The API allows slug updates but any external links
  break. Avoid unless necessary.
- **One group per monitor** — if the user wants cross-team shared
  monitors, use tags and multiple notification policies instead.

## Complete field reference

`@_generated/resource-groups.fields.md`. Runtime pull:
`devhelm skills schema resource-groups`.
