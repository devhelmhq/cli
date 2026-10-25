# Subscribers

**Subscribers** are end users (customers) who want to receive email
notifications whenever incident updates are posted to a status page.

- Email subscribers are managed from the CLI.
- Opt-in only. Users self-subscribe via the status page's subscribe
  form, or an operator adds them programmatically.

## Add (operator-initiated)

```bash
devhelm status-pages subscribers add <page-id> --email=foo@example.com
```

- Sends a confirmation email.
- Subscriber status is `PENDING` until they click confirm.
- Only add a subscriber when the user has their consent on file.

## List

```bash
devhelm status-pages subscribers list <page-id> --limit=50 --output=table
```

## Delete (unsubscribe)

```bash
devhelm status-pages subscribers remove <page-id> <subscriber-id>
```

Sends a farewell email confirming unsubscription. Subscribers can
also self-unsubscribe via one-click link in every email.

## Import from another provider

No bulk-import CLI command yet. For small lists, shell-loop:

```bash
while read email; do
  devhelm status-pages subscribers add <page-id> --email="$email"
done < emails.txt
```

For large lists, direct the user to the dashboard's CSV import.

## Privacy / legal rails

1. **Consent.** Never add a subscriber without their consent on
   file.
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
