# Incidents

An **incident** is a persistent state record that tracks an outage or
degradation through its lifecycle. It's created by the detection
engine when a monitor's check results satisfy a notification policy's
trigger condition.

## Lifecycle

```
OPEN (internal)
  ↓ (policy trigger condition met)
TRIGGERED
  ↓ (policy confirm_count met)
CONFIRMED
  ↓ (policy resolve condition met OR user resolves)
RESOLVED
  ↓ (new failure within cooldown)
REOPENED  → CONFIRMED → RESOLVED ...
```

The detection engine is event-sourced: every transition is immutable,
auditable, and has a `reason` field plus a `details.source` field
(`"pipeline"` for automated, `"public-api"` for user-driven).

## List

```bash
devhelm incidents list \
  --state=OPEN,TRIGGERED,CONFIRMED \
  --monitor=<monitor-id> \
  --resource-group=<slug> \
  --since=24h \
  --output=json
```

Sensible defaults for a triage prompt:

- `--state=TRIGGERED,CONFIRMED` (active only)
- `--since=24h`

## Get

```bash
devhelm incidents get <id> --output=json
```

Key fields:

- `state` — current state (above enum).
- `severity` — `DOWN`, `DEGRADED`.
- `monitorId`, `monitorName` — the triggering monitor.
- `startedAt` — first failed check timestamp.
- `confirmedAt` — when state flipped to CONFIRMED (if ever).
- `resolvedAt` — when state flipped to RESOLVED (if ever).
- `reopenCount` — how many times it's come back.
- `triggeringCheckId` — the check result that first met the trigger
  condition.
- `triggeredByRule` — the rule enum (`consecutive_failures`,
  `region_threshold`, etc.).
- `triggeredByRuleSnapshotHashHex` — hash of the policy snapshot at
  trigger time. Use with `forensics trace` to reconstruct the exact
  policy the engine evaluated.

Full field reference: `@_generated/incidents.fields.md`.

## Forensic trace

The **single most useful debugging tool** for "why did this
incident fire?". Shows every rule evaluation, state transition, and
the policy snapshot at the moment of each transition.

```bash
devhelm forensics trace <incident-id> --output=json
```

Trace entries include:

- `timestamp` — when the evaluation occurred
- `transition` — one of `trigger`, `confirm`, `resolve`,
  `auto_clear`, `reopen`
- `triggeringCheckIds[]` — the specific check result(s) that drove
  this transition
- `rule` — the policy rule that matched (incl. thresholds)
- `snapshot` — immutable policy snapshot (only on `trigger`)
- `details.source` — `pipeline` (automated) or `public-api`
  (user-driven; e.g. manual resolve)

Render this as a compact timeline in replies:

```
15:34:02Z  trigger    checks=[cr_1,cr_2,cr_3]       rule=consecutive_failures(3)
15:34:32Z  confirm    checks=[cr_4,cr_5]            rule=region_threshold(2)
15:41:12Z  resolve    checks=[cr_10,cr_11]          source=pipeline
```

## User-driven actions

### Resolve

```bash
devhelm incidents resolve <id> --reason="Deployment rolled back"
```

Posted transition reason appears in the forensic trace with
`details.source="public-api"`.

### Reopen

```bash
devhelm incidents reopen <id> --body="Still seeing failures after rollback"
```

Changes state → CONFIRMED. Writes a public update if the incident is
linked to a status page.

### Post an update

```bash
devhelm incidents updates create <id> \
  --status=INVESTIGATING \
  --body="We're looking into this now" \
  --notify-subscribers=false
```

Updates on private incidents (not linked to a status page) are
internal-only. Updates on status-page-linked incidents are
customer-facing — switch to `devhelm-communicate` skill for those.

## Correlation tips

- **Multiple incidents, same monitor, ≤1 hour apart** → probably one
  underlying issue that's flapping. Check `reopenCount` > 0; if
  multiple separate incidents with `reopenCount=0` each, the resolve
  condition may be too aggressive.
- **Multiple incidents across monitors, same timestamp** → shared
  dependency. Cross-reference with `devhelm dependencies list` or
  look for an AWS/GCP region-wide event.
- **Intermittent confirmed incidents** → consider raising
  `trigger_count` on the policy, or requiring multi-region failures.

## Retention

Incidents are retained for the life of the workspace (no
per-plan retention). Updates and forensic traces are retained per
check-result retention (since they cite check result IDs).
