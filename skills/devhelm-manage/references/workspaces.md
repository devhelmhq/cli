# Workspaces

A **workspace** is a tenant boundary inside a DevHelm organization.
One org can have multiple workspaces (e.g. per-product, per-client for
agencies, dev/prod hard isolation). Every resource — monitor, alert
channel, policy, status page, etc. — lives inside exactly one
workspace.

## Current workspace

```bash
devhelm auth me
```

Returns the currently-selected workspace for the active context,
along with the list of workspaces the authenticated user has access
to.

## Switch workspace

```bash
devhelm workspaces use <slug>
# or, equivalent via context:
devhelm auth context use <context-name>
```

Contexts bundle `(api_token, org, workspace, environment)` into one
named profile. For users with multiple orgs or workspaces, prefer
named contexts over re-logging-in.

## List (what am I a member of?)

```bash
devhelm workspaces list
```

Returns workspace name, slug, role (OWNER / ADMIN / MEMBER / VIEWER),
member count.

## Settings

This skill is **read-only for workspace settings**. For changes
(name, default environment, billing email, team roster), direct the
user to the dashboard:

```
https://app.devhelm.io/settings/workspace
```

## Create / delete

Also dashboard-only. API exists but isn't exposed in the CLI —
workspace creation has billing implications that are better handled
in a UI that can show plan changes.

## Common gotchas

- **Cross-workspace references don't work.** A notification policy
  in workspace A can't target a monitor in workspace B. Resources
  are fully scoped.
- **API tokens are per-workspace.** The onboarding default key
  belongs to the workspace it was created in; switching workspaces
  in the CLI context means you're using a different token (if
  configured) or no token (if not).
- **Role matters.** VIEWER users can't create anything; MEMBER can
  create most resources; ADMIN can manage team; OWNER can change
  billing. `devhelm auth me` shows the current role.

## Complete field reference

`@_generated/workspaces.fields.md`. Runtime pull:
`devhelm skills schema workspaces`.
