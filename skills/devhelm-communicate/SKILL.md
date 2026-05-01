---
name: devhelm-communicate
description: Set up and operate public DevHelm status pages — create pages, add components grouped by service, attach custom domains, manage subscribers, and publish incident updates. Use whenever the user wants a status page, says "status.example.com", "tell users about an outage", "post an update", "publish an incident", "add a subscriber", or "customize the page".
---

# DevHelm — Communicate

You help the user run the **public-facing** side of DevHelm: status
pages, components, public incidents, subscribers, and custom domains.

For the private write side (creating the underlying monitors / alerts),
switch to `devhelm-configure`. For debugging a failure *before*
communicating, switch to `devhelm-investigate`.

---

## Preconditions

1. `devhelm --version` succeeds.
2. `devhelm auth me` succeeds.
3. **Workspace has at least one monitor** — a status page without
   monitors has nothing to render. If there are none, offer to create
   one via `devhelm-configure` first.

---

## The two main journeys

### Journey A — "First status page" (onboarding happy path)

**User prompt:** *"Set up a status page"*, *"Get me on status.
example.com"*, *"Publish a public status page"*.

**Step 1 — Inventory existing monitors.**

```bash
devhelm monitors list --output=json
```

If 0 monitors → stop, hand off to `devhelm-configure`.

**Step 2 — Propose a component layout.**

The cleanest default is **one component per monitor**. If the user has
clear groupings (e.g. `api-prod`, `api-staging`, `dashboard-prod`),
propose **groups** for environments or services.

Show the user the proposed layout as a compact tree and ask for a
single yes/no:

```
Proposed layout for status page:

  Production
    API        → monitor api-prod
    Dashboard  → monitor dashboard-prod
  Staging
    API        → monitor api-staging

Publish with this layout? (y/n, or name changes you want)
```

**Step 3 — Confirm slug + name.**

- **Slug**: defaults to the org's slug (get it from `devhelm auth me`
  → `organization.slug`). Ask only if the user hasn't named one.
- **Name**: defaults to `<Org name> Status`.

**Step 4 — Create the page, then components, then groups.**

```bash
# 4a. Create the page (unpublished by default)
devhelm status-pages create \
  --name="Acme Status" \
  --slug=acme \
  --headline="Acme service status"

# 4b. Create component groups (if using them)
devhelm status-pages groups create <page-id> \
  --name="Production"

# 4c. Create components (one per monitor)
devhelm status-pages components create <page-id> \
  --name="API" \
  --monitor-id=<mon_id> \
  --group-id=<group_id>

# 4d. Publish
devhelm status-pages update <page-id> --published=true
```

**Step 5 — Verify.**

```bash
devhelm status-pages get <page-id>
```

Report the public URL: `https://<slug>.devhelm.io` (or whatever the
response returns as the canonical URL).

**Step 6 — Offer next steps.**

*"Want me to attach a custom domain like `status.example.com`? Or add a
subscriber so someone gets emailed when you post updates?"* — one, not
both.

### Journey B — "Publish an incident update"

**User prompt:** *"Post an update to our status page"*, *"Tell users
API is down"*, *"Publish an incident"*.

**Step 1 — Identify the status page.**

If the user only has one published page, use it. Otherwise:

```bash
devhelm status-pages list --output=table
```

Ask which one if ambiguous.

**Step 2 — Existing incident or new one?**

- **Existing auto-created incident** (from a monitor going down):
  list recent ones with `devhelm status-pages incidents list
  <page-id>` and ask the user which to post under.
- **New manual incident**: create with `devhelm status-pages incidents
  create <page-id> ...` (planned maintenance, external provider
  outages, etc.).

**Step 3 — Compose the update.**

Incident update bodies are **public-facing text**. Follow these rules:

- Lead with *what users should do right now* (*"Retry your request in
  5 minutes"*, *"No action needed"*).
- Name the impact in user terms, not internal service names (*"Login
  is temporarily failing"*, not *"auth-svc pods are crashlooping"*).
- Include a plain timestamp (*"Started ~14:30 UTC"*).
- Keep it under ~280 characters for the first post; longer follow-ups
  are fine.
- Never include PII, API keys, stack traces, or customer names.

**Step 4 — Post it.**

```bash
devhelm status-pages incidents updates create <incident-id> \
  --status=INVESTIGATING \
  --body="<your text>" \
  --notify-subscribers=true
```

Valid statuses: `INVESTIGATING`, `IDENTIFIED`, `MONITORING`,
`RESOLVED`. The `--notify-subscribers=true` flag sends emails —
always ask before setting it on the first post of a session.

**Step 5 — Verify + share URL.**

Show the permalink to the incident on the public page.

---

## Custom domains

```bash
devhelm status-pages domains add <page-id> --hostname=status.example.com
devhelm status-pages domains list <page-id>
```

The response includes a CNAME target and a TLS verification record.
Tell the user to add both to their DNS, then run `devhelm status-pages
domains verify <domain-id>`. Do NOT loop polling for them — instruct
and stop.

For full field details: `@references/custom-domains.md`.

---

## Subscribers

```bash
devhelm status-pages subscribers create <page-id> --email=foo@bar.com
devhelm status-pages subscribers list <page-id>
```

Subscribers receive emails whenever an incident update is posted with
`--notify-subscribers=true`. Full field details:
`@references/subscribers.md`.

---

## Safety rails

1. **Never publish a status page without explicit confirmation.** Show
   the layout first, wait for yes.
2. **Never post an incident update without showing the body first** and
   asking *"post this with status=X and notify-subscribers=<bool>?"*.
   Public communication is irreversible (updates can be deleted but
   subscribers already got the email).
3. **Never set `notify-subscribers=true` on the first post of a fresh
   incident without confirming.** Accidental notifications are the #1
   regret.
4. **Never include PII, API keys, stack traces, internal service
   names, or customer identifiers** in incident bodies. If the user
   pastes something sensitive, redact and ask before posting.
5. **No localhost URLs in custom domains.** Same reason as
   `devhelm-configure`.
6. **Never delete a published status page** unless the user explicitly
   said "delete this page" using that word. "Unpublish" is
   `devhelm status-pages update <id> --published=false`, which is
   reversible; prefer it.

---

## References

- `@references/status-pages.md`
- `@references/components.md`
- `@references/incidents.md`
- `@references/subscribers.md`
- `@references/custom-domains.md`
