# Subscribers

**Subscribers** are end users (customers) who want to receive email
notifications whenever incident updates are posted to a status page.

- Three channels: `email`, `webhook`, `rss` (RSS is URL-only; no
  explicit subscribe).
- Opt-in only. Users self-subscribe via the status page's subscribe
  form, or an operator adds them programmatically.
- Per-component filtering: subscribers can choose to follow only
  specific components rather than everything.

## Add (operator-initiated)

```bash
devhelm status-pages subscribers create <page-id> \
  --email=foo@example.com \
  --components=<comp_id1>,<comp_id2>      # optional; defaults to all
```

- Sends a confirmation email.
- Subscriber status is `PENDING` until they click confirm.
- `--skip-confirmation` is available for bulk imports but should
  only be used when the user has the subscriber's consent on file.

## List

```bash
devhelm status-pages subscribers list <page-id> \
  --status=ACTIVE,PENDING,UNSUBSCRIBED \
  --output=table
```

## Delete (unsubscribe)

```bash
devhelm status-pages subscribers delete <subscriber-id>
```

Sends a farewell email confirming unsubscription. Subscribers can
also self-unsubscribe via one-click link in every email.

## Webhook subscribers

```bash
devhelm status-pages subscribers create <page-id> \
  --webhook-url=https://hooks.example.com/devhelm-status \
  --secret=<hmac-shared-secret>
```

Receives the same event payloads as outbound webhooks
(`@references/webhooks.md`) filtered to status-page incidents on the
specified page.

## Import from another provider

No bulk-import CLI command yet. For small lists, shell-loop:

```bash
while read email; do
  devhelm status-pages subscribers create <page-id> --email="$email"
done < emails.txt
```

For large lists, direct the user to the dashboard's CSV import.

## Privacy / legal rails

1. **Consent.** Never add a subscriber without their consent on
   file. `--skip-confirmation` bypasses the opt-in email; use only
   with documented consent.
2. **PII in transcripts.** Don't echo full subscriber emails in chat
   output. Truncate to `f***@example.com` when listing; show full
   only for operator-initiated adds where the user just provided the
   address.
3. **Unsubscribe is one-click.** Don't work around it. Manual
   resubscribe after unsubscribe requires the user to re-subscribe
   from the page, not an operator to re-add them.

## Complete field reference

`@_generated/status-page-subscribers.fields.md`. Runtime pull:
`devhelm skills schema status-page-subscribers`.
