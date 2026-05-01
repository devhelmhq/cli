# Monitors

A **monitor** checks that something is up. DevHelm supports six types;
pick the narrowest one that answers the user's question.

## Types

| Type | What it checks | Use when |
|---|---|---|
| `HTTP` | HTTP(S) endpoint returns a 2xx (or matches custom assertions) | The service has a public HTTP endpoint |
| `HEARTBEAT` | A job pings DevHelm within its expected interval | Cron jobs, queue consumers, internal services |
| `TCP` | TCP port accepts a connection | Databases, non-HTTP services, SSL handshake |
| `DNS` | A DNS record resolves to the expected value(s) | DNS propagation, CDN origin |
| `MCP` | An MCP server responds to a probe | MCP tool health |
| `RSS_STATUS` | A third-party vendor's public status feed reports UP | Heroku, Slack, Stripe, etc. (use with `dependencies` for pSEO) |

### How to choose

- **Public URL you control** → HTTP (default).
- **Internal job, not reachable from outside** → HEARTBEAT.
- **Raw port** → TCP (rare; prefer HTTP).
- **You care only about DNS** → DNS.
- **You want to track a vendor's status** → usually `dependencies`,
  not a monitor directly. Read `@references/dependencies.md`.

## Minimum viable monitor

```bash
# HTTP (the 90% case)
devhelm monitors create \
  --name="api-prod" \
  --type=HTTP \
  --url=https://api.example.com/health

# Heartbeat
devhelm monitors create \
  --name="nightly-backup" \
  --type=HEARTBEAT \
  --grace-period=3600
```

Defaults you don't need to specify:

- `frequency=60` (seconds between checks, 30–86400)
- `regions=["us-east"]` (one region; add more with `--regions`)
- `method=GET`
- `follow_redirects=true`
- `assertions=[{type: "STATUS_CODE", operator: "EQUALS", target: "200"}]`
- `enabled=true`

## Assertions

Assertions are the **definition of up**. Without custom assertions,
"HTTP 2xx" is the only check. Common additions:

```bash
# "2xx AND body contains 'ok' AND responds within 500ms"
devhelm monitors create \
  --name=api-prod \
  --url=https://api.example.com/health \
  --assertion='{"type":"STATUS_CODE","operator":"EQUALS","target":"200"}' \
  --assertion='{"type":"RESPONSE_BODY","operator":"CONTAINS","target":"ok"}' \
  --assertion='{"type":"RESPONSE_TIME","operator":"LESS_THAN","target":"500"}'
```

Assertion types: `STATUS_CODE`, `RESPONSE_BODY`, `RESPONSE_TIME`,
`HEADER`, `JSON_BODY` (with JSONPath `property`), `SSL_CERTIFICATE`
(expiry check).

Operators: `EQUALS`, `NOT_EQUALS`, `CONTAINS`, `NOT_CONTAINS`,
`GREATER_THAN`, `LESS_THAN`, `MATCHES_REGEX`, `IS_EMPTY`, `IS_NOT_EMPTY`.

## Regions

Run from multiple regions to catch origin-side vs. network-side issues.

```bash
--regions us-east,eu-west,ap-southeast
```

A monitor is DOWN only if the incident policy says so — the default
requires 2+ regions to fail. See `@references/notification-policies.md`.

## Authentication

For monitors that need auth headers, tokens, or basic auth, **store
the credential as a secret first** (`@references/secrets.md`), then
reference it:

```bash
devhelm secrets create --name=STRIPE_TEST_KEY --value=...
devhelm monitors create \
  --name=stripe-webhook \
  --url=https://webhooks.example.com/stripe \
  --headers='[{"name":"Authorization","value":"${{secrets.STRIPE_TEST_KEY}}"}]'
```

Never hard-code a credential in a CLI flag or YAML file — it ends up
in shell history / git.

## Frequency vs. plan

Frequency is gated by plan. Free allows ≥300s, Pro allows ≥60s, Scale
and Enterprise allow ≥30s. If the user asks for a sub-60s check and
they're on Free, the API returns a 403 with a plan-hint — surface it.

## Common gotchas

- **Localhost URLs are rejected.** DevHelm probes from public
  datacenters. If the user needs to monitor something internal, use
  HEARTBEAT.
- **Self-signed TLS** — HTTP monitors validate certs by default. Add
  `--skip-tls-verify` only if the user explicitly asked (and warn them
  this weakens the signal).
- **Redirects** — `follow_redirects=true` is the default; assertions
  evaluate the *final* response. If the user wants to assert on the
  redirect itself, pass `--no-follow-redirects`.
- **Cold-start 5xx** — serverless functions often return 502/503 on the
  first cold check. Raise `trigger_count` in the incident policy
  rather than the monitor's assertions.

## YAML form

```yaml
# devhelm.yml
version: "1"
monitors:
  - name: api-prod
    type: HTTP
    url: https://api.example.com/health
    frequency: 60
    regions: [us-east, eu-west]
    tags: { env: prod, team: platform }
    assertions:
      - { type: STATUS_CODE, operator: EQUALS, target: "200" }
      - { type: RESPONSE_TIME, operator: LESS_THAN, target: "500" }
    alert_channels: [slack-platform]
```

Deploy with `devhelm plan` → `devhelm deploy`. The YAML is idempotent
by name.

## Terraform form

```hcl
resource "devhelm_monitor" "api_prod" {
  name      = "api-prod"
  type      = "HTTP"
  url       = "https://api.example.com/health"
  frequency = 60
  regions   = ["us-east", "eu-west"]

  assertion {
    type     = "STATUS_CODE"
    operator = "EQUALS"
    target   = "200"
  }
}
```

## Complete field reference

Current spec: `@_generated/monitors.fields.md` (regenerated at CLI
build time from `docs/openapi/monitoring-api.json`).

Runtime fresh-pull: `devhelm skills schema monitors`.
