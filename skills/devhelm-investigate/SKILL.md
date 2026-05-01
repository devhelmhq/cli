---
name: devhelm-investigate
description: Diagnose DevHelm monitor failures and answer status questions — why is monitor X failing, what's red right now, show recent check results, list active incidents, inspect uptime over a window, or trace audit history. Use whenever the user asks "why is X down?", "is everything green?", "what happened at 3:14?", "show the last 10 failures", or any read/debug question about monitoring state.
---

# DevHelm — Investigate

You help the user understand the **current and past state** of their
monitoring. This skill is strictly read-only: never create, update, or
delete anything here. For write flows, switch to `devhelm-configure` or
`devhelm-communicate`.

---

## Preconditions

1. `devhelm --version` succeeds.
2. `devhelm auth me` succeeds. If not, tell the user to `devhelm auth
   login` and stop.

---

## Surface selection

DevHelm exposes the same read data through two surfaces. Choose based
on context:

| Situation | Surface | Why |
|---|---|---|
| A DevHelm MCP server is configured in the host (Cursor/Claude Code) | **MCP tools** | Zero subprocess cost, structured results, cheaper for follow-up questions. |
| No MCP, or the user is outside a conversational agent | **CLI** (`devhelm <resource> list/get/results`) | Universal fallback; every piece of MCP data has a CLI equivalent. |
| User explicitly says "use CLI" | CLI | Respect it. |

**How to check for MCP:** try calling `list_monitors` (or any DevHelm
MCP tool). If the tool exists in the agent's catalog, MCP is live. If
not, fall back to CLI without further checks.

The rest of this skill refers to **actions** (read check results, list
incidents, etc.) — the actual tool name differs between MCP and CLI.
The references enumerate the CLI commands; MCP tool names mirror them
(`list_monitors`, `get_monitor`, `list_check_results`, `list_incidents`,
`get_incident`, `list_audit_events`, `query_uptime`).

---

## Triage workflow (the common case)

**User prompt:** *"Why is api-prod failing?"* / *"Why is monitor X red?"*

### Step 1 — Locate the monitor

- If the user named it precisely → `devhelm monitors list --name=<q>`
  (or MCP `list_monitors` with the name filter).
- If ambiguous (multiple matches), show the matches and ask which one.
- If not found, report so and offer to create one (hand off to
  `devhelm-configure`).

### Step 2 — Pull current state

```bash
devhelm monitors get <id>
```

Extract: `status` (UP / DOWN / DEGRADED / PAUSED), `lastCheckAt`,
`assertions`, `enabled`.

- `status == PAUSED` → tell the user the monitor is paused and when;
  don't go deeper.
- `status == UP` → tell the user the monitor is currently green and ask
  what window they're asking about.

### Step 3 — Pull the last N check results

Default window: last 25 results, or last 60 minutes — whichever is
wider.

```bash
devhelm monitors results <id> --limit=25 --output=json
```

For each **failed** check result, extract:

- `executedAt` (when)
- `region` (which probe region)
- `statusCode` / `responseTimeMs`
- `failureReason` (the assertion that failed, with the observed value)

### Step 4 — Correlate with incidents

```bash
devhelm incidents list --monitor=<id> --state=OPEN,CONFIRMED --output=json
devhelm incidents list --monitor=<id> --since=24h --output=json
```

If there's an active incident → include its ID, title, state, and
first-failure timestamp. Link to `@references/incidents.md` for
incident fields.

### Step 5 — Use forensics for confirmed incidents

For any incident in CONFIRMED / RESOLVED state, the forensic trace
explains *exactly* which check results triggered the state machine and
which policy rule matched:

```bash
devhelm forensics trace <incident-id>
```

The trace returns a sequence of rule evaluations, state transitions,
and the policy snapshot at the moment of trigger — read
`@references/incidents.md` §forensics for how to render it.

### Step 6 — Respond

Produce a structured summary:

```
Monitor:    api-prod (mon_abc123)   — DOWN
Target:     https://api.example.com/health
Last check: 2026-04-27T15:42:11Z from us-east → FAILED
   - Assertion STATUS_CODE EQUALS 200 failed (observed 503)
   - 8 of the last 10 checks failed, starting 15:34:02Z

Incident:   inc_xyz789  (CONFIRMED, severity DOWN)
   - First failure: 15:34:02Z   (3 consecutive from us-east)
   - Confirmed:     15:35:30Z   (trigger + 2 more from eu-west)
   - Age:           8 minutes
   - Forensics:     devhelm forensics trace inc_xyz789

Dashboard:  https://app.devhelm.io/monitors/mon_abc123

Likely cause: the target is returning 503 consistently across both
regions, which rules out a probe-side issue. Check your origin.

Next step: `devhelm incidents updates <inc_xyz789>` to post a public
status message, or switch to skill devhelm-configure if you want to
silence alerting temporarily.
```

Pack everything into one reply. Don't make the user ask three times.

---

## Other common questions

### "Is everything green?"

```bash
devhelm status            # dashboard overview: up/down/degraded counts
devhelm monitors list --status=DOWN,DEGRADED
```

Report the totals; list only the non-green monitors.

### "Show me the last 24 hours"

```bash
devhelm incidents list --since=24h --output=table
```

If none, say so. If many, group by monitor.

### "What happened at 15:30 UTC?"

```bash
devhelm audit events --since='2026-04-27T15:00:00Z' --until='2026-04-27T15:45:00Z' --output=table
```

Audit events cover user actions (config changes), not check results.
For check results at a specific time, use `monitors results <id>
--since=... --until=...`.

### "What's our uptime this month?"

```bash
devhelm monitors uptime <id> --window=30d --output=json
```

Return percentage + total downtime duration. For a service-level view
across many monitors, aggregate with `resource-groups`.

---

## Safety rails

1. **Read-only.** If the user asks for anything that modifies state
   (pause, delete, ack), stop and hand off to `devhelm-configure` or
   `devhelm-communicate`.
2. **Never expose API keys or secrets.** If an audit event references a
   secret value, redact to last-4.
3. **Time-scope your queries.** Don't pull unbounded history; always
   cap with `--limit` or `--since/--until`. Default window: last 24h.
4. **Cite data by ID.** When reporting, include monitor ID, incident
   ID, check result timestamp — the user can drill down later.
5. **Don't guess causes.** If the data is ambiguous, say so and suggest
   a follow-up query. Never invent an explanation that isn't in the
   check results or incident record.

---

## References

- `@references/check-results.md`
- `@references/incidents.md`
- `@references/uptime-queries.md`
- `@references/audit-log.md`
