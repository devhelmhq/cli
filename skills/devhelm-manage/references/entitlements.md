# Entitlements & Plan

**Entitlements** are the plan-driven limits applied to a workspace:
how many monitors it can have, the minimum check frequency, how many
alert channels, retention windows for historical data, etc.

The API enforces them on every write; when a limit is hit, the user
gets a 403 with a plan-hint. This skill's job is to surface the
current state and help the user reason about what they can or can't
do.

## Inspect

```bash
devhelm auth me --output=json | jq '.plan, .entitlements, .usage'
```

The `auth me` response carries three relevant blocks:

- `plan`:
  - `name` — `free` | `pro` | `scale` | `enterprise`
  - `trialEndsAt` — ISO timestamp if currently in trial, else null
  - `subscriptionStatus` — `ACTIVE`, `TRIALING`, `PAST_DUE`,
    `CANCELED`
- `entitlements` — the hard limits (details below).
- `usage` — current values against those limits.

## Common entitlements

| Field | Meaning | Free | Pro | Scale | Enterprise |
|---|---|---|---|---|---|
| `maxMonitors` | Monitors total | 5 | 50 | 500 | Unlimited |
| `minFrequencySeconds` | Minimum check interval | 300 | 60 | 30 | 30 |
| `maxRegions` | Regions per monitor | 1 | 3 | 6 | 6 |
| `maxAlertChannels` | Alert channels | 2 | 20 | 100 | Unlimited |
| `maxNotificationPolicies` | Policies | 2 | 20 | 100 | Unlimited |
| `maxStatusPages` | Public status pages | 0 | 1 | 5 | Unlimited |
| `maxCustomDomains` | Custom domains | 0 | 1 | 5 | Unlimited |
| `maxSubscribers` | Status page subscribers | 0 | 1,000 | 10,000 | Unlimited |
| `auditRetentionDays` | Audit log | 30 | 90 | 365 | 730 |
| `checkResultRetentionDays` | Per-check raw data | 3 | 30 | 90 | 365 |
| `maxTeamMembers` | Team size | 2 | 10 | 50 | Unlimited |
| `mcpServerEnabled` | MCP access | false | true | true | true |

Note: the tables above are a snapshot; always read the actual
`entitlements` block at query time (plan changes + custom contracts
diverge from the defaults).

## Common prompts

### "Am I about to hit a limit?"

```bash
devhelm auth me --output=json | jq '
  .entitlements | to_entries[] |
  select(.value|type=="number") |
  "\(.key): \(.value) limit, \($usage[.key] // "?") used"
  ' --argjson usage "$(devhelm auth me --output=json | jq '.usage')"
```

Or just render the `.usage / .entitlements` diff in natural language.

### "Upgrade me to Pro."

Can't from the CLI. Direct to:

```
https://app.devhelm.io/settings/billing
```

### "What do I lose on downgrade?"

API exposes `GET /platform/plan-preview?plan=free` which returns the
entitlements that would apply, plus a list of resources that would
**exceed** them (over-quota). CLI:

```bash
devhelm plan-preview --plan=free
```

Shows what would break. Don't initiate a downgrade from a chat
prompt; direct to dashboard.

## Trials

Free trials (14 days of Pro) are auto-assigned at signup. The
`plan.trialEndsAt` is set; at expiry the plan drops to Free, and
over-quota resources get **paused** (not deleted) with a notice.

## Complete field reference

`@_generated/entitlements.fields.md`. Runtime pull:
`devhelm skills schema entitlements`.
