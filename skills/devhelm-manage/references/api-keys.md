# API Keys

An **API key** is a long-lived bearer token that authenticates
programmatic access to DevHelm — CLI, SDKs, Terraform, direct HTTP.
Every workspace has at least one; most have several (one per
environment, one per CI, one per engineer).

## The default key

Every DevHelm organization is created with a **permanent default API
key** named `Default` at org-creation time. Users see it once during
onboarding (with a copy button), after which only the last-4 is
visible.

The default key:

- Can't be deleted without creating a replacement first.
- Is scoped to the org (full access within it).
- Can be rotated any time (`devhelm api-keys rotate default`).

It's the key the onboarding skill-install flow embeds into
`~/.devhelm/contexts.json`.

## Create

```bash
devhelm api-keys create --name="ci-deploy"
```

Response:

```json
{
  "id": "key_...",
  "name": "ci-deploy",
  "value": "devhelm_pat_<opaque>",
  "last4": "...a3f1",
  "createdAt": "..."
}
```

**The `value` field is ONLY present in the create response.** All
subsequent `list` / `get` calls return the key without `value`,
only `last4`. There is no "reveal" endpoint.

## List / get

```bash
devhelm api-keys list
devhelm api-keys get <id>
```

Returns name, ID, `last4`, `createdAt`, `lastUsedAt`, `revokedAt`
(if revoked).

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
NEW=$(devhelm api-keys create --name="ci-deploy-v2" --output=json | jq -r '.value')

# 2. Update consumers to use $NEW (e.g. GitHub Actions secret, ~/.devhelm)
# ...

# 3. Verify everything works, then revoke the old one
devhelm api-keys revoke <old-id>
```

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
