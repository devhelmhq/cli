# Check Results

A **check result** is one execution of a monitor from one region — the
atomic unit of monitoring data. Every monitor produces one check
result per region per frequency interval. High-frequency monitors
across many regions generate a lot; always scope queries.

## List

```bash
devhelm monitors results <monitor-id> \
  --limit=25 \
  --status=PASSED,FAILED,DEGRADED \
  --region=us-east,eu-west \
  --since=2026-04-27T00:00:00Z \
  --until=2026-04-27T23:59:59Z \
  --output=json
```

Defaults: last 25 results, all statuses, all regions.

## Key fields (per result)

| Field | Meaning |
|---|---|
| `id` | Check result ID (UUID). Stable; cited by incidents + forensics. |
| `monitorId` | Parent monitor. |
| `executedAt` | Start timestamp (UTC ISO 8601). |
| `region` | Probe region slug. |
| `status` | `PASSED`, `FAILED`, `DEGRADED`. |
| `responseTimeMs` | Wall-clock duration. |
| `statusCode` | HTTP status (HTTP monitors only). |
| `failedAssertions[]` | Which assertions failed and what they observed. |
| `raw` | Request/response snapshot (present for failed results only). |

For the full generated field list:
`@_generated/check-results.fields.md`.

## Interpretation

- **Single-region failure amid passes** → likely probe-side / network
  blip. The policy's `regions_required` determines if this becomes an
  incident.
- **All-region failure** → origin-side. Walk the `failedAssertions[]`
  to find the actual cause (status code, body mismatch, response time
  breach, SSL issue).
- **Intermittent `responseTimeMs` spikes** → investigate with the
  `uptime` query over a wider window (`@references/uptime-queries.md`)
  before calling it a problem; brief spikes are often GC or scale-up.
- **DEGRADED status** → the monitor has a DEGRADED threshold defined
  (e.g. `responseTime > 500` but still 2xx). Policy config
  determines whether DEGRADED alerts.

## Forensics: linking results to incidents

Every incident's forensic trace cites the exact check result IDs that
moved the state machine. For a CONFIRMED incident `inc_X`:

```bash
devhelm forensics trace inc_X --output=json
```

The trace array contains entries like:

```json
{
  "timestamp": "...",
  "transition": "trigger",
  "triggeringCheckIds": ["cr_123", "cr_124", "cr_125"],
  "rule": {
    "triggerCount": 3,
    "regionsRequired": 1
  }
}
```

Pair that with `devhelm monitors results <monitor-id>` to find those
specific results and explain *what the user's service was doing at
the moment the incident fired*.

## Retention

Check results are retained per plan:

- Free: 3 days
- Pro: 30 days
- Scale: 90 days
- Enterprise: 1 year

Beyond retention, only aggregated uptime stats remain. If the user
asks about a failure from 6 months ago on Pro, tell them the
per-check raw data is gone; the `devhelm monitors uptime <id>`
window will still cover it as aggregates.

## CLI output tips

- `--output=json` for programmatic / diff-able output.
- `--output=table` for quick terminal viewing — DEGRADED / FAILED
  rows are coloured.
- `--output=yaml` for pasting into support tickets (reads nicely in
  fixed-width but preserves structure).
