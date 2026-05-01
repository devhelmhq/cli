# Public Incidents (on status pages)

This reference is for **public-facing incidents on a status page** —
distinct from the internal incident records covered in
`devhelm-investigate` → `@references/incidents.md`. Public incidents
show up on the status page and optionally notify subscribers.

Two flavors:

- **Auto-created**: a monitor tied to a status page component went
  DOWN; DevHelm opened a public incident automatically. The user can
  edit/update it.
- **Manual**: the user creates one for scheduled maintenance or
  vendor-side outages that monitors can't detect.

## List on a page

```bash
devhelm status-pages incidents list <page-id> --state=OPEN,MONITORING
devhelm status-pages incidents get <incident-id>
```

## Create a manual incident

```bash
devhelm status-pages incidents create <page-id> \
  --title="Scheduled maintenance — DB upgrade" \
  --status=SCHEDULED \
  --scheduled-start=2026-05-01T02:00:00Z \
  --scheduled-end=2026-05-01T03:00:00Z \
  --affected-components=<comp_id1>,<comp_id2> \
  --body="Database upgrade. Expect 5-10m of read-only mode."
```

### Incident kinds

| Kind | Use | Required fields |
|---|---|---|
| `REAL_TIME` | Something is broken right now | `status=INVESTIGATING`, `body` |
| `SCHEDULED` | Upcoming planned work | `scheduled_start`, `scheduled_end`, `body` |
| `HISTORICAL` | Retrospective entry for an outage already over | `status=RESOLVED`, `body` with timeline |

## Update an incident (post an update)

```bash
devhelm status-pages incidents updates create <incident-id> \
  --status=IDENTIFIED \
  --body="Root cause: upstream DNS resolver. Working on failover." \
  --notify-subscribers=true
```

Valid status values:

- `SCHEDULED` → upcoming maintenance
- `INVESTIGATING` → just started, cause unknown
- `IDENTIFIED` → cause known, fix in progress
- `MONITORING` → fix applied, watching
- `RESOLVED` → over

Each update is appended to the incident; the page shows the full
timeline.

## Writing update bodies — the rules

1. **Lead with what users should do.** *"Retry your request in 5
   minutes"*, *"No action needed"*.
2. **Name the impact in user terms.** Not *"auth-svc pods
   crashlooping"* — say *"login is temporarily failing"*.
3. **Include a plain timestamp.** *"Started ~14:30 UTC"*.
4. **Keep the first post under ~280 characters.** Longer follow-ups
   are fine.
5. **Never include PII, API keys, stack traces, internal service
   names, or customer identifiers.**

### Example — good

> **Login temporarily failing.** Some users can't sign in since ~14:32
> UTC. No data loss. We've identified the cause and are rolling back a
> recent change. Next update in 15 minutes.

### Example — bad

> auth-svc pod stuck in CrashLoopBackoff due to OOMKilled. user
> alice@acme.com reported. working on rollback of PR #1234.

## Edit a past update

```bash
devhelm status-pages incidents updates update <update-id> \
  --body="Corrected text..."
```

**Edits are reflected immediately on the public page.** Subscribers
who already received the original email are *not* re-notified of the
edit. Prefer posting a new update over editing for clarity.

## Resolve

```bash
devhelm status-pages incidents updates create <incident-id> \
  --status=RESOLVED \
  --body="The fix is deployed. All monitors green since 14:58 UTC.
          Sorry for the disruption." \
  --notify-subscribers=true
```

For auto-created incidents, you can also let them auto-resolve when
the monitor returns to UP — this posts a default resolve message.
Control per page:

```bash
devhelm status-pages update <page-id> --auto-resolve-incidents=true
```

If the user wants a custom resolve message, disable auto-resolve and
post manually.

## Delete an incident

```bash
devhelm status-pages incidents delete <incident-id>
```

Reversible within 24h via dashboard (not CLI). Deletion removes the
incident from the public timeline but preserves the internal record
for audit. Never delete an incident to "hide" an outage — users who
got subscriber emails still have the email.

## Complete field reference

`@_generated/status-page-incidents.fields.md`. Runtime pull:
`devhelm skills schema status-page-incidents`.
