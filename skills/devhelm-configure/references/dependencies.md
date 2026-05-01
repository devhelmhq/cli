# Dependencies

A **dependency** tracks a third-party service's public status feed and
mirrors it into DevHelm. Use it when:

- Your product depends on Slack, Stripe, GitHub, AWS, Heroku, etc. and
  you want outages there to show up in your own monitoring + status
  page without you building a scraper.
- You want a single uptime board that says *"our service is UP, but
  Stripe's Payments is DOWN, here's what users are seeing"*.

Dependencies are distinct from **monitors** — they don't probe
anything from DevHelm's end; they consume the vendor's published feed
(public status page RSS, JSON API, or vendor-specific format).

## Create

```bash
devhelm dependencies create \
  --name="Stripe Payments" \
  --provider=stripe \
  --component=payments
```

The `provider` is DevHelm's internal slug for the vendor (see
`@_generated/dependencies.fields.md` for the full list — it's large
and grows with adapters). The `component` narrows to a specific
sub-service within that vendor's status page.

## List / get / delete

```bash
devhelm dependencies list
devhelm dependencies get <id>
devhelm dependencies delete <id>
```

## Attach to a status page

Dependencies show up as **read-only components** on the user's status
page — customers see "we depend on X, and X is currently Y".

```bash
devhelm status-pages components create <page-id> \
  --dependency-id=<dep-id> \
  --name="Stripe Payments"
```

See `devhelm-communicate` skill → `@references/components.md` for the
full attach flow.

## Alerting on a dependency failure

Dependencies can drive notification policies just like monitors — if
the vendor goes red, you get paged. Scope a policy with the
dependency's tags:

```bash
devhelm notification-policies create \
  --name=third-party \
  --tags=type=dependency \
  --alert-channels=slack-platform
```

## Common gotchas

- **Feed latency.** Vendor status feeds update every 30–120s in our
  experience; don't expect sub-minute resolution.
- **Unsupported vendor.** If the user names a vendor we don't have an
  adapter for, tell them so and ask if we can add it (support-ticket
  path) — don't try to scrape a random page.
- **Component naming drift.** Vendors rename their components
  occasionally (e.g. Slack merged "Login" into "Workspace
  administration"). The dependency record will start returning
  `UNKNOWN` status; `devhelm dependencies get <id>` surfaces it.
  Re-create with the new component name.

## Complete field reference

`@_generated/dependencies.fields.md`. Runtime pull:
`devhelm skills schema dependencies`.
