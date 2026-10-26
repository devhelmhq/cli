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
  --description="Real-time status of Acme products" \
  --incident-mode=REVIEW
```

Defaults:

- `slug` — defaults to the org's slug if not supplied. Immutable after
  publish (external bookmarks would break).
- `description` — optional subtitle shown on the page.
- `incident-mode` — `MANUAL`, `REVIEW` or `AUTOMATIC` (how monitor
  failures become public incidents).

## List / get / update / delete

```bash
devhelm status-pages list
devhelm status-pages get <page-id>
devhelm status-pages update <page-id> --description="..." --enabled
devhelm status-pages delete <page-id>        # irreversible; unpublish first
```

## Theme & branding

Branding comes from a JSON file; omit the flag to keep existing
branding:

```bash
devhelm status-pages update <page-id> --branding-file=./branding.json
```

Heavier customization (custom CSS, custom layout) is dashboard-only
for now.

## Auto-created incidents

When a monitor tied to a status-page component goes DOWN, DevHelm
**auto-creates a public incident** on the page. This means the page
reflects reality without the user having to manually post.

Control this per page:

```bash
devhelm status-pages update <page-id> --incident-mode=AUTOMATIC
```

Or per component (see `@references/components.md`).

## Publish flow

The user-visible flow is four steps:

1. `devhelm status-pages create --name=... --slug=...`
2. `devhelm status-pages components create ...` (one per monitor)
3. Review the layout with `devhelm status-pages get <page-id>` and
   the components list.
4. `devhelm status-pages update <page-id> --enabled`

Do not skip step 3 if the user hasn't seen the page layout before —
status pages are public and mistakes are visible.

## Un-publishing

```bash
devhelm status-pages update <page-id> --no-enabled
```

Reversible. The custom domain (if any) serves a 404 while unpublished.
Use this instead of delete for "temporarily hide the page".

## Incidents on the page

Two sources:

- **Auto-created** — from monitor failures.
- **Manual** — `devhelm status-pages incidents create <page-id> ...`
  for outages monitors can't detect.

Do **not** use incident create for planned work. Schedule a window
with `devhelm status-pages maintenance create <page-id> ...`.

Manual incidents need an explicit resolve; auto-created ones resolve
when the underlying monitor returns to UP.

## Complete field reference

`@_generated/status-pages.fields.md`. Runtime pull:
`devhelm skills schema status-pages`.
