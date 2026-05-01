---
name: devhelm-manage
description: Manage DevHelm workspace-level administration — API keys, environments, workspace settings, plan/entitlements, and team roster (read-only). Use when the user wants to create or rotate an API key, check what plan they're on, list environments, see team members, or inspect workspace-wide limits.
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
2. `devhelm auth me` succeeds.
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

**The value of a key is only shown once at creation time.** The
`list` and `get` endpoints return only the last-4 and the ID. Never
promise the user you can retrieve the full value later.

**Default API key:** every DevHelm organization has a permanent
default API key created at org-creation time. It's named `Default`
and scoped to the org. Users can rotate it any time; they can't
delete it without creating a replacement first (the API enforces
this).

Full field details: `@references/api-keys.md`.

### Environments

| User intent | Command |
|---|---|
| "Show environments" | `devhelm environments list` |
| "Create staging" | `devhelm environments create --name=staging --slug=staging` |
| "Delete staging" | `devhelm environments delete <slug>` (only if no resources reference it) |
| "Use production for this session" | set `DEVHELM_ENVIRONMENT=production` or pass `--environment production` |

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

## References

- `@references/api-keys.md`
- `@references/environments.md`
- `@references/workspaces.md`
- `@references/entitlements.md`
