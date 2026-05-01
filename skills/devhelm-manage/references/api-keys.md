# API Keys

An **API key** is a long-lived bearer token that authenticates
programmatic access to DevHelm — CLI, SDKs, Terraform, direct HTTP.
Every workspace has at least one; most have several (one per
environment, one per CI, one per engineer).

## The starter key

Every new DevHelm organization is created with one starter API key
named `Default`. It's the key the setup-complete screen surfaces to
the user so they can authenticate the CLI in one copy-paste.

This is an **ordinary API key** — no special flag, no protection,
no uniqueness. The user can:

- Rename it (`devhelm api-keys update <id> --name=…`).
- Rotate its value (`devhelm api-keys regenerate <id>`).
- Revoke or delete it once they've created a replacement.

Do not treat "Default" as a first-class concept in skill prose or
flag semantics. It's just a name. If a user asks "where's my default
key?", find it with `devhelm api-keys list` and match on `name ==
"Default"`; if it's missing, the user renamed or deleted it and
you should offer to create a new key rather than resurrecting a
"default" state.

## Create

```bash
devhelm api-keys create --name="ci-deploy"
```

Response (includes the full `key` value):

```json
{
  "id": 12,
  "name": "ci-deploy",
  "key": "dh_live_<opaque>",
  "createdAt": "...",
  "updatedAt": "...",
  "lastUsedAt": null,
  "revokedAt": null,
  "expiresAt": null
}
```

## List / get

```bash
devhelm api-keys list
devhelm api-keys get <id>
```

Both endpoints return the full key value along with name, id,
timestamps, and revoke/expire state. There is no "last-4 only"
masking on reads — users and scripts can retrieve the value at any
time. Treat API key payloads as sensitive when writing them to logs
or chat transcripts.

## Revoke vs. delete

| Action | Effect | Reversible? |
|---|---|---|
| `revoke` | Key is marked REVOKED; API rejects it with 401. Record kept for audit. | Yes — `devhelm api-keys unrevoke <id>`. |
| `delete` | Key record is removed. No recovery. | No. |

**Always prefer `revoke`** for credentials that might have been
leaked. Delete only for cleanup of unused test keys where audit
history isn't needed.

```bash
devhelm api-keys revoke <id>
devhelm api-keys delete <id>
```

## Rotation pattern

```bash
# 1. Create a replacement
NEW=$(devhelm api-keys create --name="ci-deploy-v2" --output=json | jq -r '.key')

# 2. Update consumers to use $NEW (e.g. GitHub Actions secret, ~/.devhelm)
# ...

# 3. Verify everything works, then revoke the old one
devhelm api-keys revoke <old-id>
```

Alternatively, `devhelm api-keys regenerate <id>` rotates the value
on an existing key record (same id, new value) — useful when you
need to keep external references to the key name/id stable.

Never revoke first, create second — you'll break live automation.

## Scopes

The current API key model is **full-access within the org** — no
per-scope restriction. The `devhelm-configure` / `devhelm-manage`
skills respect this by requiring role checks at the action level
(via `auth me`'s `role` field), not by scoping the key.

If the user asks for a "read-only" or "monitor-only" key, explain
that scopes aren't available in v1 and suggest either:

- A separate workspace with limited-role service users, or
- External network-level isolation (outbound firewall rules on the
  CI runner).

## Local storage

API keys land in one of three places, in this order of precedence:

1. `--api-token=<value>` flag on any CLI command.
2. `DEVHELM_API_TOKEN` environment variable.
3. `~/.devhelm/contexts.json` managed by `devhelm auth login`.

The skill-install flow drops the onboarding key into (3). Users with
multiple workspaces can switch with `devhelm auth context use <name>`.

## Complete field reference

`@_generated/api-keys.fields.md`. Runtime pull:
`devhelm skills schema api-keys`.
