# Alert Channels

An **alert channel** is *where* notifications go. It's decoupled from
*when* (that's notification-policies) and *what* (that's monitors +
incidents). Ship the channel first, wire it up via a policy afterwards.

## Types

| Type | Needs | Use when |
|---|---|---|
| `SLACK` | Incoming webhook URL | Team-channel alerting in Slack |
| `DISCORD` | Incoming webhook URL | Gaming / community teams |
| `EMAIL` | Recipient email address | Direct one-off, or fallback |
| `PAGERDUTY` | PagerDuty integration key | On-call escalation |
| `OPSGENIE` | OpsGenie API key | On-call escalation (alternative) |
| `WEBHOOK` | URL + optional secret | Custom routing, SIEM, bespoke pipelines |
| `MS_TEAMS` | Teams incoming webhook | Microsoft-shop teams |
| `TELEGRAM` | Bot token + chat ID | Personal / small team |

## Create

```bash
# Slack
devhelm alert-channels create \
  --name=slack-platform \
  --type=SLACK \
  --webhook-url=https://hooks.slack.com/services/T000/B000/XXXX

# Email
devhelm alert-channels create \
  --name=oncall-email \
  --type=EMAIL \
  --recipient=oncall@example.com

# PagerDuty
devhelm alert-channels create \
  --name=pd-prod \
  --type=PAGERDUTY \
  --integration-key=<events-v2-integration-key>

# Generic webhook with HMAC
devhelm alert-channels create \
  --name=siem \
  --type=WEBHOOK \
  --url=https://siem.example.com/ingest/devhelm \
  --secret=<hmac-shared-secret>
```

## Verify

Always run this immediately after creating — sends a real test
notification so the user can confirm the channel works end-to-end:

```bash
devhelm alert-channels test <id>
```

If the test fails, the error response tells you which step broke
(invalid webhook URL, auth rejected, etc.). Report it verbatim.

## Wire it up

A channel does nothing until a **notification policy** references it.
The simplest flow:

```bash
devhelm notification-policies create \
  --name=default \
  --alert-channels=<channel-id> \
  --trigger-count=2 \
  --applies-to-all=true
```

See `@references/notification-policies.md` for the full model.

## Credentials go in secrets

Don't paste raw webhook URLs or integration keys into `devhelm.yml` or
Terraform — store them as secrets and reference:

```yaml
alert_channels:
  - name: slack-platform
    type: SLACK
    webhook_url: ${{secrets.SLACK_PLATFORM_WEBHOOK}}
```

```hcl
resource "devhelm_alert_channel" "slack_platform" {
  name        = "slack-platform"
  type        = "SLACK"
  webhook_url = var.slack_platform_webhook    # set via Terraform variables
}
```

## Common gotchas

- **Slack webhook revoked** → Slack-side. The test command surfaces a
  401; user must regen in Slack.
- **PagerDuty "routing_key" vs "integration_key"** — DevHelm uses the
  Events API v2 integration key. If the user pastes a service-key
  that starts with `P`, that's the wrong one.
- **Email rate-limits** — bulk alerting via EMAIL can hit provider
  limits; for high-volume paths, prefer SLACK or PAGERDUTY.
- **Webhook HMAC** — the optional `secret` becomes the shared secret
  for the HMAC-SHA256 signature sent in `X-DevHelm-Signature`. Users
  verifying on their side should compare bytes, not strings, and use
  constant-time comparison.

## Delete behavior

Deleting a channel that's referenced by a policy returns a 409 with
the referencing policies listed. Offer to unlink first:

```bash
devhelm alert-channels delete <id>   # may fail with 409
# Inspect references:
devhelm notification-policies list --alert-channel=<id>
```

## Complete field reference

`@_generated/alert-channels.fields.md` — regenerated from OpenAPI.
Runtime pull: `devhelm skills schema alert-channels`.
