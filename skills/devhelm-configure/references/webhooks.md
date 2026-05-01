# Webhooks

An **outbound webhook** is how DevHelm pushes events to external
systems. It's distinct from `alert-channels` of type `WEBHOOK`:

- `alert-channels` type `WEBHOOK` → fires on *alert policy matches*
  (incident triggers, confirms, resolves). One event type, tailored to
  pager-like consumers.
- `webhooks` (this resource) → subscribes to a **stream of platform
  events** (monitor.created, monitor.updated, incident.updated,
  check.failed, etc.). For SIEMs, data warehouses, custom pipelines.

If the user says "send alerts to my Slack webhook", that's an
**alert channel**. If they say "mirror all our monitoring events into
BigQuery", that's a **webhook**.

## Create

```bash
devhelm webhooks create \
  --url=https://events.example.com/devhelm \
  --events=monitor.*,incident.* \
  --secret=<hmac-shared-secret>
```

### Events

Event names follow `<resource>.<verb>`:

- `monitor.created`, `monitor.updated`, `monitor.deleted`,
  `monitor.paused`, `monitor.resumed`
- `check.failed`, `check.recovered` (high volume — don't subscribe
  without a reason)
- `incident.triggered`, `incident.confirmed`, `incident.resolved`,
  `incident.reopened`, `incident.update.created`
- `alert.delivered`, `alert.failed`
- `status_page.published`, `status_page.incident.created`

Wildcards: `monitor.*` = all monitor verbs; `*` = everything.

Full event catalog + payload shapes:
`@_generated/webhooks.fields.md`.

## Signature verification

Every webhook delivery includes:

- `X-DevHelm-Delivery-Id` (UUID)
- `X-DevHelm-Event` (the event name)
- `X-DevHelm-Timestamp` (unix seconds)
- `X-DevHelm-Signature` (HMAC-SHA256 hex of
  `<timestamp>.<body>` using the configured `secret`)

Verify on receipt with a constant-time string compare. Reject
deliveries whose timestamp drifts >5 minutes from server time.

## Delivery semantics

- **At-least-once.** Deliveries retry on 5xx or timeout with
  exponential backoff (1s, 5s, 30s, 2m, 10m). After 5 failed retries,
  the delivery is marked FAILED and surfaces in
  `devhelm webhooks deliveries list --failed`.
- **Ordering is not guaranteed.** Use `X-DevHelm-Timestamp` or the
  event's own ID to order on your side.
- **Idempotency key:** `X-DevHelm-Delivery-Id` is unique per retry
  attempt; the event's own ID is unique per logical event. Dedupe
  on the latter.

## Test

```bash
devhelm webhooks test <id>
```

Sends a synthetic `webhook.test` event. Response includes the
HTTP status and any error body from the subscriber. Always run this
after create.

## Inspect deliveries

```bash
devhelm webhooks deliveries list <webhook-id> --limit=50
devhelm webhooks deliveries get <delivery-id>   # full request/response
devhelm webhooks deliveries replay <delivery-id>
```

Useful for debugging when the user says *"we didn't receive the
event"*.

## Common gotchas

- **Wildcards are greedy.** `check.*` includes `check.failed` at full
  monitor frequency — if 500 monitors run every 60s, that's 500k
  deliveries/day. Always scope tight.
- **Response status for ACK.** 200–299 = accepted. 4xx = permanent
  failure, no retry. 5xx or timeout = retry. A slow 200 still blocks
  redelivery.
- **HTTPS required** in production. HTTP URLs are allowed for local
  dev but warn the user.

## Complete field reference

`@_generated/webhooks.fields.md`. Runtime pull:
`devhelm skills schema webhooks`.
