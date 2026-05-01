# Uptime Queries

Uptime queries aggregate check results into **percentages and total
downtime durations** over a time window. Use when the user asks:

- *"What's our uptime this month?"*
- *"Compare prod vs. staging uptime last 30 days."*
- *"Did we hit our SLO?"*

## Per-monitor uptime

```bash
devhelm monitors uptime <monitor-id> \
  --window=30d \
  --region=us-east,eu-west \
  --output=json
```

Response:

```json
{
  "monitorId": "mon_...",
  "window": "30d",
  "uptimePct": 99.87,
  "downtimeSeconds": 3360,
  "totalSeconds": 2592000,
  "regions": {
    "us-east":   { "uptimePct": 99.92, "downtimeSeconds": 2080 },
    "eu-west":   { "uptimePct": 99.82, "downtimeSeconds": 4680 }
  },
  "incidents": [
    { "id": "inc_...", "durationSeconds": 1200, "severity": "DOWN" },
    { "id": "inc_...", "durationSeconds": 2160, "severity": "DEGRADED" }
  ]
}
```

Windows: `1h`, `24h`, `7d`, `30d`, `90d`, or explicit
`--since=<ISO>` + `--until=<ISO>`. Beyond plan retention, the
response returns `null` with a `reason`.

## Service-level (resource group) uptime

```bash
devhelm resource-groups uptime <slug> --window=30d
```

Aggregates all member monitors. Default aggregation: **min** across
monitors (i.e. the worst monitor defines the service's uptime). This
matches most SLO definitions; for **avg** or **sum**, pass
`--agg=avg`.

## Workspace-wide

No single CLI command — aggregate manually across resource groups or
per-monitor queries, or use the MCP `query_uptime` tool which accepts
a workspace-wide scope.

## Interpretation tips

- **99.9% over 30 days** = 43 minutes of downtime. Remind users of
  this when they ask "we had two 20-min outages last month, what's
  our uptime?"
- **Regional asymmetry** — if one region shows materially lower
  uptime than others over the same window, it's usually a local
  probe-network issue, not a service issue. Cross-check the status of
  the DevHelm region (`devhelm dependencies list | grep devhelm-region`
  if applicable).
- **DEGRADED time** — counted against uptime by default. Pass
  `--exclude=DEGRADED` if the SLO definition only cares about hard
  downtime.
- **Planned maintenance** — paused monitors are excluded from the
  window. If the user paused a monitor for 2h during a deployment,
  that 2h is subtracted from `totalSeconds`, not counted as downtime.

## SLO reports

For monthly SLO compliance reports:

```bash
devhelm resource-groups uptime checkout --window=30d --output=json \
  | jq '{service: "checkout", uptime: .uptimePct, budget_used:
         (100 - .uptimePct) / (100 - 99.9) * 100}'
```

The CLI doesn't ship an SLO-budget calculator natively — compose with
`jq` (or similar) and commit the query alongside your runbook.

## MCP equivalent

If MCP is available, use `query_uptime` — accepts the same window +
scope and returns structured JSON. Preferred for conversational
follow-ups ("and what about staging?").
