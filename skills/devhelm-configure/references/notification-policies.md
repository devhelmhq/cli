# Notification Policies

A **notification policy** is *when and how* an alert channel gets
notified. It wraps:

- **Which monitors** it applies to (all, or by tag, or by resource
  group).
- **What triggers it** — number of consecutive failed checks
  (`trigger_count`), regions required to fail.
- **What confirms it** — extra failures after trigger before state
  flips to CONFIRMED (`confirm_count`).
- **What resolves it** — consecutive passes required to clear
  (`resolve_count`).
- **Who to notify** — one or more alert channels.
- **Escalation** — optional second tier after a delay.

The policy is the **source of truth for incident state transitions**.
The detection engine evaluates the policy against incoming check
results; transitions flow through the forensic model (see
`devhelm-investigate` skill → `@references/incidents.md`).

## Minimum viable policy

```bash
devhelm notification-policies create \
  --name=default \
  --applies-to-all=true \
  --trigger-count=2 \
  --resolve-count=2 \
  --alert-channels=<slack-channel-id>
```

This alerts Slack after 2 consecutive failed checks anywhere, and
clears after 2 consecutive passes.

## Scoping

Three mutually-exclusive targeting modes:

| Flag | Meaning |
|---|---|
| `--applies-to-all=true` | All monitors in the workspace |
| `--tags=key=value,key2=value2` | Only monitors with those tags |
| `--resource-group=<slug>` | Only monitors in that group |

If multiple policies match a monitor, **all of them** fire (additive,
not exclusive). Prefer one general default + targeted overrides over
many narrowly-scoped ones.

## Region requirements

By default, a failure from **one region** counts. To reduce
probe-side false positives, require multiple regions:

```bash
--regions-required=2
```

Monitors with only 1 region configured can't satisfy a
regions-required=2 policy; the API returns a 400 with the offending
monitor names.

## Escalation

Optional second-tier channel after a delay:

```bash
devhelm notification-policies create \
  --name=prod-escalated \
  --tags=env=prod \
  --trigger-count=2 \
  --alert-channels=slack-platform \
  --escalation-channels=pd-prod \
  --escalation-after-seconds=900      # 15 minutes
```

If the incident is still CONFIRMED 15 minutes later, PagerDuty gets
paged. Escalation fires once per incident; re-occurring incidents
start the timer fresh.

## Severity

Policies can set a default severity for incidents they create:

```bash
--severity=DOWN           # "the service is down"
--severity=DEGRADED       # "something's slow or partially broken"
```

Overridable per-monitor via the monitor's own `severity` field.

## Common patterns

### Default: one catch-all + explicit prod overrides

```yaml
notification_policies:
  - name: catch-all
    applies_to_all: true
    trigger_count: 2
    alert_channels: [slack-noise]

  - name: prod
    tags: { env: prod }
    trigger_count: 2
    regions_required: 2
    alert_channels: [slack-platform]
    escalation_channels: [pd-prod]
    escalation_after_seconds: 600
```

### Quiet hours — not supported as a single flag

DevHelm doesn't have a "silence window" on policies. Implement
scheduled silencing by having the CI pipeline pause the monitor
(`devhelm monitors pause`) during known-maintenance windows, or
subscribe to the webhook and filter in your downstream.

### "Only notify on confirmed, never on trigger"

```bash
--notify-on-trigger=false \
--notify-on-confirm=true
```

Trigger is the first-signal (one probe region, trigger_count failures).
Confirm is the second-signal (additional regions / failures). Many
teams want only confirmed notifications to cut noise; the default is
both.

## Validation quirks

- `trigger_count ≥ 1`, `confirm_count ≥ 0`, `resolve_count ≥ 1`.
- If `regions_required > 1`, the monitor must be configured with at
  least that many regions. API pre-validates.
- Escalation channels must be a different set from the primary
  channels (API rejects overlaps to prevent double-paging).

## Testing

There's no `test` verb on a policy directly — you test by:

1. Pausing a monitor → unpausing with deliberately broken config
   (e.g. URL=`https://httpstat.us/503`).
2. Observing the incident + alert-channel delivery.
3. Restoring the monitor.

The `devhelm-investigate` skill's `forensics trace <incident-id>`
command is the debugger for policy behavior — it shows exactly which
rule evaluation triggered, confirmed, or resolved an incident.

## Complete field reference

`@_generated/notification-policies.fields.md`. Runtime pull:
`devhelm skills schema notification-policies`.
