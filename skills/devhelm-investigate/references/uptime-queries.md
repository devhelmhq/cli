# Uptime Queries

Uptime queries aggregate check results into **percentages and total
downtime durations** over a time window. Use when the user asks:

- *"What's our uptime this month?"*
- *"Compare prod vs. staging uptime last 30 days."*
- *"Did we hit our SLO?"*

## Per-monitor history

The CLI has no per-monitor uptime-percentage command. Read the check
history for the window and compute the ratio, or use the dashboard
for a ready-made percentage:

```bash
devhelm monitors history <monitor-id> --since=30d --region=us-east --limit=200 --output=json
devhelm monitors history <monitor-id> --since=30d --failed --output=json
```

Uptime is `1 - failed/total` over the same window. `--failed` returns
only failing results, so compare counts from the two calls.

## Tracked services (dependencies)

For a third-party service you track as a dependency, the CLI returns
uptime directly:

```bash
devhelm data services uptime <service-slug> --period=30d --granularity=day --output=json
```

## Service-level (resource group)

There is no group-level uptime command. Pull `monitors history` for
each member monitor and take the **minimum** (the worst monitor
defines the service's uptime), which matches most SLO definitions.

## Workspace-wide

No single CLI command; aggregate across monitors, or use the MCP
`query_uptime` tool which accepts a workspace-wide scope.

## Interpretation tips

- **99.9% over 30 days** = 43 minutes of downtime. Remind users of
  this when they ask "we had two 20-min outages last month, what's
  our uptime?"
- **Regional asymmetry** — if one region shows materially lower
  uptime than others over the same window, it's usually a local
  probe-network issue, not a service issue. Cross-check the status of
  the DevHelm region (`devhelm dependencies list | grep devhelm-region`
  if applicable).
- **DEGRADED time** — decide up front whether the SLO counts it;
  filter degraded results out of the history if only hard downtime
  matters.
- **Planned maintenance** — paused monitors are excluded from the
  window. If the user paused a monitor for 2h during a deployment,
  that 2h is subtracted from `totalSeconds`, not counted as downtime.

## SLO reports

Compose `devhelm monitors history <id> --since=30d --output=json` with
`jq` (or similar) and commit the query alongside your runbook; the CLI
does not ship an SLO-budget calculator.

## MCP equivalent

If MCP is available, use `query_uptime` — accepts the same window +
scope and returns structured JSON. Preferred for conversational
follow-ups ("and what about staging?").
