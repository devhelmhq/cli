# Status Pages

A **status page** is a public web page that shows the real-time
status of a customer's services. It renders:

- A top-level UP/DEGRADED/DOWN banner computed from member
  components.
- Components (one per monitor or dependency).
- Ongoing + recent incidents with customer-facing updates.
- Historical uptime (last 90 days of per-day status).
- A subscribe form (if enabled).

DevHelm hosts pages at `https://<slug>.devhelm.io`. Custom domains
(`status.example.com`) are supported — see
`@references/custom-domains.md`.

## Create a page (unpublished)

```bash
devhelm status-pages create \
  --name="Acme Status" \
  --slug=acme \
  --headline="Acme service status" \
  --description="Real-time status of Acme products" \
  --published=false
```

Defaults:

- `slug` — defaults to the org's slug if not supplied. Immutable after
  publish (external bookmarks would break).
- `headline` — defaults to `<Org name> service status`.
- `published` — defaults to `false`. Users must opt in to publish.

## List / get / update / delete

```bash
devhelm status-pages list
devhelm status-pages get <page-id>
devhelm status-pages update <page-id> --headline="..." --published=true
devhelm status-pages delete <page-id>        # irreversible; unpublish first
```

## Theme & branding

Light customization is available via flags:

```bash
devhelm status-pages update <page-id> \
  --logo-url=https://cdn.example.com/logo.svg \
  --primary-color="#0066CC" \
  --favicon-url=https://cdn.example.com/favicon.ico
```

Heavier customization (custom CSS, custom layout) is dashboard-only
for now.

## Auto-created incidents

When a monitor tied to a status-page component goes DOWN, DevHelm
**auto-creates a public incident** on the page. This means the page
reflects reality without the user having to manually post.

Control this per page:

```bash
devhelm status-pages update <page-id> --auto-create-incidents=true
```

Or per component (see `@references/components.md`).

## Publish flow

The user-visible flow is four steps:

1. `devhelm status-pages create --published=false`
2. `devhelm status-pages components create ...` (one per monitor)
3. Preview with `devhelm status-pages preview <page-id>` (opens the
   dashboard's draft-preview URL).
4. `devhelm status-pages update <page-id> --published=true`

Do not skip step 3 if the user hasn't seen the page layout before —
status pages are public and mistakes are visible.

## Un-publishing

```bash
devhelm status-pages update <page-id> --published=false
```

Reversible. The custom domain (if any) serves a 404 while unpublished.
Use this instead of delete for "temporarily hide the page".

## Incidents on the page

Two sources:

- **Auto-created** — from monitor failures.
- **Manual** — `devhelm status-pages incidents create <page-id> ...`
  for maintenance windows, vendor-side outages, etc.

Both are rendered in the same section. Manual incidents need an
explicit resolve; auto-created ones resolve when the underlying
monitor returns to UP.

## Complete field reference

`@_generated/status-pages.fields.md`. Runtime pull:
`devhelm skills schema status-pages`.
