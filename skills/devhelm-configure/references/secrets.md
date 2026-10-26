# Secrets

A **secret** is an encrypted string you can reference from monitor
configurations (HTTP headers, request bodies, DNS queries) and alert
channel configurations (webhook URLs, auth tokens) without pasting the
value into YAML / Terraform / shell history.

Values are encrypted at rest with envelope encryption; the dashboard
and API never return the plaintext after creation. Think of them like
`GITHUB_TOKEN` — create-only, one-time display, rotate when leaked.

## Create

Values are NEVER passed as arguments. `create` takes the key only;
the value comes from stdin or an environment variable:

```bash
printf %s "$STRIPE_TEST_KEY" | devhelm secrets create STRIPE_TEST_KEY --env staging --value-stdin
devhelm secrets create STRIPE_TEST_KEY --env staging --from-env STRIPE_TEST_KEY
```

Set or change the value for another environment with:

```bash
printf %s "$VALUE" | devhelm secrets values set STRIPE_TEST_KEY --env production --value-stdin
```

Naming convention: **UPPER_SNAKE_CASE**, matching how they'll be
referenced. The key is part of the `${{secrets.NAME}}` template
syntax.

## Reference

In YAML:

```yaml
monitors:
  - name: webhooks
    type: HTTP
    url: https://webhooks.example.com
    headers:
      - { name: Authorization, value: "Bearer ${{secrets.STRIPE_TEST_KEY}}" }
```

The `${{secrets.NAME}}` token is resolved at check-execution time, not
at create time. Typos in the name don't fail validation; they fail at
runtime (the monitor will emit a failing check with an assertion
failure reason of "missing secret"). Always verify a newly-referenced
secret with `devhelm monitors test <id>`.

## List / rotate / delete

```bash
devhelm secrets list                    # names + IDs + lastUpdatedAt — no values
devhelm secrets usage <key>             # which monitors reference it
printf %s "$NEW" | devhelm secrets update <key> --value-stdin
devhelm secrets delete <key>            # fails if referenced; unlink first
```

Rotation best practice: **create the new secret under a new name**,
update the monitors to reference it, then delete the old one. In-place
value updates are supported but harder to audit.

## Common gotchas

- **Never paste a secret into a chat transcript or commit.** If the
  user pastes one, do not echo it back; mask everything past the
  first 6 characters.
- **Secret values don't appear in `devhelm plan`** — the plan shows
  the template token (`${{secrets.NAME}}`) unchanged, which is
  correct behavior. Users sometimes panic when they don't see the
  secret "applied" in the plan; explain the template model.
- **Deletion protection.** Secrets referenced by any monitor / alert
  channel can't be deleted. API returns 409 with the references.
- **Environments.** A secret key is workspace-wide but holds one
  value per environment: set each with `devhelm secrets values set KEY
  --env <slug>`.

## Complete field reference

`@_generated/secrets.fields.md`. Runtime pull:
`devhelm skills schema secrets`.
