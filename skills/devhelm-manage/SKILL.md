---
name: devhelm-manage
description: Manage DevHelm workspace-level administration — API keys, environments, workspace settings, plan/entitlements, and team roster (read-only). Use when the user wants to create or rotate an API key, check what plan they're on, list environments, see team members, or inspect workspace-wide limits.
metadata:
  version: "1.11.0"
---

# DevHelm — Manage

You help the user with **workspace administration**: API keys, plan /
billing surface, environments, and team visibility.

This skill is **not** for creating monitoring resources — for that use
`devhelm-configure`. It's also not for debugging — use
`devhelm-investigate`. This skill is small and safety-conscious by
design: most of its operations touch credentials or plan state.

---

## Preconditions

1. `devhelm --version` succeeds.
2. `devhelm auth me` succeeds. `devhelm auth switch <context>` changes
   the active context.
3. For any destructive operation (revoke key, delete environment),
   double-check the caller has the role to do it — `devhelm auth me`
   returns `role`. If role is `VIEWER` or `MEMBER`, stop and tell the
   user their role can't perform the action.

---

## Common operations

### API keys

| User intent | Command |
|---|---|
| "Create a new API key" | `devhelm api-keys create --name="<label>"` |
| "Show my keys" | `devhelm api-keys list` |
| "Which key is ID=X?" | `devhelm api-keys get <id>` |
| "Revoke key X" (reversible) | `devhelm api-keys revoke <id>` |
| "Delete key X" (permanent) | `devhelm api-keys delete <id>` |

**The full key value is returned on every read** (`list`, `get`,
`create`, `regenerate`). Treat API key payloads as sensitive when
writing them to logs or chat transcripts — never paste them into
commit messages, PR descriptions, or any output that could be
shared.

**Starter key:** every new DevHelm org gets one API key named
`Default` created during onboarding so the user can authenticate
the CLI in one copy-paste. It's an ordinary key — no special flag,
no protection, no uniqueness. If the user asks "where's my default
key?", match `name == "Default"` in `devhelm api-keys list` output;
if it's missing, they renamed or deleted it and should create a
new key rather than you trying to resurrect anything.

Full field details: `@references/api-keys.md`.

### Plan, entitlements and usage

- `devhelm account entitlements` shows what the plan allows; read it
  before promising any limit.
- `devhelm account usage` shows current consumption against those limits.

Scoped keys for automation:
`devhelm api-keys create --name "<label>" --preset agent-author`
(other presets: `ci-pr`, `ci-deploy`, `agent-responder`).

### Environments

| User intent | Command |
|---|---|
| "Show environments" | `devhelm environments list` |
| "Create staging" | `devhelm environments create --name=staging --slug=staging` |
| "Delete staging" | `devhelm environments delete <slug>` (only if no resources reference it) |
| "Use production for this session" | pass `--env production` on commands that support it |

Environments are **labels that scope resources** (monitors,
channels, policies) — not separate workspaces. Deleting an
environment in use is blocked by the API; the response includes the
referencing resources so the user can migrate them first.

Full field details: `@references/environments.md`.

### Workspace settings

Read-only from this skill. For changes, direct the user to the
dashboard:

```bash
devhelm auth me                # current user + org + workspace
devhelm auth context list      # all configured contexts on this machine
```

Reference: `@references/workspaces.md`.

### Plan / entitlements

```bash
devhelm auth me --output=json  # includes plan + entitlements
```

Surface the following fields to the user:

- `plan.name` (free | pro | scale | enterprise)
- `plan.trialEndsAt` (if in trial)
- `entitlements.maxMonitors`, `entitlements.minFrequencySeconds`,
  `entitlements.maxAlertChannels` (the most commonly hit limits)
- `usage` block (if present) for where they are against those limits

If a user is hitting a limit, link to the pricing page, don't try to
upgrade them via CLI — billing is dashboard-only.

Reference: `@references/entitlements.md`.

### Team roster (read-only)

```bash
devhelm auth me                # just you
# Team-list command isn't exposed in the CLI yet; if asked, direct
# the user to the dashboard: https://app.devhelm.io/settings/team
```

---

## Safety rails

1. **Never show the full value of an existing API key.** The API
   physically can't return it past creation; make sure you don't
   invent a value to fill a gap. If asked, explain the one-time
   display model and offer to rotate.
2. **Never revoke or delete an API key** without explicit
   confirmation, including the key name and last-4. Example:
   *"About to revoke key `ci-deploy` (ends in ...8a3f). This will
   break any automation using it. Confirm?"*
3. **Never delete the default API key.** Tell the user to create a
   replacement first (the API enforces this anyway; surface the
   message before the user hits it).
4. **Never delete an environment in use.** Pre-check with
   `devhelm environments get <slug>` — the response includes
   `referencingResourceCount`. If > 0, list them first.
5. **Never attempt billing changes via CLI.** Direct to
   `https://app.devhelm.io/settings/billing`.
6. **Redact in transcripts.** If the user pastes a full API key value
   into the conversation (e.g. to ask you to "use this key"), do not
   echo the full value back — refer to it as *"the key you pasted"*
   and mask past the first 6 characters if you must reference it.

---

## Error handling

Exit codes are frozen. Exit 1 never means a classified error.

| Exit | Meaning | Your response |
|---|---|---|
| 0 | OK (a flaky pass is 0 with `flaky: true`) | Report; mention flakiness if set. |
| 2 | Usage error | Fix the command line; check `--help`. |
| 4 | Invalid config/flags, `NO_TOKEN`, unknown or ambiguous monitor, or blocked | Show the field/cause and fix. `RUN_KEYS_MISSING`: show the fix command and stop. |
| 10 | Plan has changes (`--detailed-exitcode`) | Expected. Show the diff. |
| 11 | API failed unexpectedly (5xx, 429 after retries) | Include `code`, `message` and `requestId` verbatim. |
| 12 | Network error | Retry once; then ask the user to check connectivity. |
| 13 | Deploy partially landed | Report `landed[]`, `notLanded[]` and `failures[]`. |
| 14 | A test/trigger run or probe failed | Report the failing run; investigate with `devhelm runs get <id> --steps`. |
| 15 | Confirmation required | Show `changes[]` and `confirmCommand` to the human. Never add `--yes` yourself for production. |
| 16 | Plan/entitlement/quota refusal | Read `devhelm account entitlements`; do not guess limits. |
| 17 | Auth/permission/ownership refusal | Report the missing scope or owner; do not work around it. |
| 18 | Conflict (lock held, stale expected live revision, untested revision, paused) | Report the conflict; re-read state before retrying. |
| 19 | No verdict on our side (`execution_error`, inconclusive, not started; not billed) | Report as no verdict; do not call it a pass or a fail. |
| 20 | Gone (evidence expired) | Say the evidence expired; re-run if needed. |

Any non-zero exit: stop and report. Never silently retry `deploy` or `create`.

---

## References

- `@references/api-keys.md`
- `@references/environments.md`
- `@references/workspaces.md`
- `@references/entitlements.md`
