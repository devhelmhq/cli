# Custom Domains

Status pages can be served on a custom domain like
`status.example.com` instead of the default `<slug>.devhelm.io`.

## Add a domain

```bash
devhelm status-pages domains add <page-id> --hostname=status.example.com
```

The response returns:

- `cnameTarget` — the value the user must CNAME their `status`
  record to (e.g. `custom.devhelm.io`).
- `tlsVerificationRecord` — a DNS TXT record value used for ACME
  DNS-01 challenge verification.
- `status` — `PENDING_DNS` initially.

## Configure DNS

Tell the user to add two records at their DNS provider:

```
Type   Name                               Value
CNAME  status.example.com                 <cnameTarget>
TXT    _devhelm-challenge.status.example.com   <tlsVerificationRecord>
```

TTL: any. Propagation: typically 5–60 minutes; often faster.

**Do NOT poll from this skill.** Instruct the user, then stop. The
user comes back when DNS is live.

## Verify

Once DNS is set:

```bash
devhelm status-pages domains verify <domain-id>
```

This triggers a fresh check. Possible outcomes:

- `VERIFIED` → TLS cert issued via ACME; page is live on the custom
  domain within ~1 minute.
- `DNS_NOT_FOUND` → records not visible from our side yet. Wait more.
- `CNAME_MISMATCH` → CNAME points somewhere else. Re-check record.
- `CHALLENGE_FAILED` → TXT record wrong or missing.

## List / inspect / remove

```bash
devhelm status-pages domains list <page-id>
devhelm status-pages domains get <domain-id>
devhelm status-pages domains remove <domain-id>
```

Removing a domain immediately stops serving; the default
`<slug>.devhelm.io` URL remains active.

## Multi-domain

Multiple custom domains per page are supported (e.g.
`status.example.com` + `status.example.io`). Only one is the
canonical — pass `--canonical=true` on the one that should be in
Open Graph metadata and emails:

```bash
devhelm status-pages domains update <domain-id> --canonical=true
```

## Gotchas

- **Apex/root domain** (`example.com` as the status page) needs an
  `ALIAS` / `ANAME` record — not all DNS providers support these.
  Work around by serving from `status.example.com` instead.
- **Cloudflare proxy (orange cloud)** must be **off** for our ACME
  challenge to resolve. Set to DNS-only (gray cloud) until
  verification, then flip back on.
- **AAAA records** for the user's existing domain don't interfere,
  but any CAA record restricting issuers must include `letsencrypt.org`
  (our current issuer).
- **TLS renewals** are automatic; we renew 30 days before expiry. No
  user action needed once initial verification succeeds.

## Complete field reference

`@_generated/status-page-domains.fields.md`. Runtime pull:
`devhelm skills schema status-page-domains`.
