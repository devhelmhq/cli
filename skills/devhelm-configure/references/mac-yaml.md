# Monitoring as Code — YAML

DevHelm's declarative surface. One or more `devhelm.yml` files
describe the desired state; `devhelm plan` shows the diff against
the live config; `devhelm deploy` applies it.

Use this mode when:

- The repo already has `devhelm.yml` (or `devhelm.yaml`).
- The user is creating 3+ resources in one turn.
- The user said anything that implies reviewability: "let's put this
  in code", "track in git", "review via PR", "CI should deploy".

## File layout conventions

| Pattern | Use |
|---|---|
| One file `devhelm.yml` at repo root | Small setups (<20 resources). |
| One file per resource type (`monitors.yml`, `alert-channels.yml`) | Mid-size (20–200). Pass with `-f`. |
| Directory `devhelm/` with one file per service | Large / per-team ownership (CODEOWNERS-friendly). |

`devhelm plan`/`deploy` auto-discover `devhelm.yml` at root. For other
layouts, pass explicit files:

```bash
devhelm plan -f devhelm/monitors/api.yml -f devhelm/alert-channels.yml
devhelm plan -f 'devhelm/**/*.yml'              # glob supported
```

## Minimal template

```yaml
# devhelm.yml
version: "1"

alert_channels:
  - name: slack-platform
    type: SLACK
    webhook_url: ${{secrets.SLACK_PLATFORM_WEBHOOK}}

notification_policies:
  - name: default
    applies_to_all: true
    trigger_count: 2
    alert_channels: [slack-platform]

monitors:
  - name: api-prod
    type: HTTP
    url: https://api.example.com/health
    frequency: 60
    regions: [us-east, eu-west]
    tags: { env: prod }
```

Resources reference each other **by name**. Name is immutable (used as
the idempotency key) — renaming requires a `moved` block (see below).

## The canonical flow

```bash
devhelm plan                 # show diff, exit 10 if changes pending
devhelm deploy               # apply
```

Always `plan` first. In CI, use `--detailed-exitcode` on plan:

- 0 = no changes
- 2 = plan succeeded, changes pending
- non-zero = error

and drive `deploy` conditionally.

## Renaming — the `moved` block

If the user wants to rename `api-prod` → `api-production`, add:

```yaml
moved:
  - from: monitors.api-prod
    to:   monitors.api-production
```

…and update the name in the resource block. Without this, DevHelm
destroys `api-prod` and creates a new `api-production` (losing
history).

## Pruning

By default, resources removed from YAML remain in the platform (to
avoid destructive surprises). To delete them:

```bash
devhelm plan --prune           # preview deletions
devhelm deploy --prune         # apply
```

Only applies to resources in namespaces the YAML explicitly manages.
Resources the YAML has never mentioned are left alone.

## State

DevHelm keeps server-side state; the CLI maintains a local
`devhelm.lock` for optimistic concurrency. If another user `deploy`s
while you're editing, `plan` will show your changes against the newer
server state, and `deploy` will refuse if the lock is stale — pull,
re-plan, re-deploy.

## Secrets in YAML

Reference with `${{secrets.NAME}}`. Never paste raw values into YAML.
See `@references/secrets.md`.

## Multi-environment

Two patterns:

```yaml
# Pattern A — one file per environment, select via CLI
# devhelm/production.yml
environment: production
monitors: [...]

# devhelm/staging.yml
environment: staging
monitors: [...]
```

```bash
devhelm deploy -f devhelm/production.yml
devhelm deploy -f devhelm/staging.yml
```

```yaml
# Pattern B — one file with per-resource environment
monitors:
  - name: api-prod
    environment: production
    ...
  - name: api-staging
    environment: staging
    ...
```

Pattern A is cleaner for separate CI jobs; Pattern B is simpler for a
single repo managed by one team.

## Bootstrapping from an existing platform

```bash
devhelm init --from-platform                 # writes devhelm.yml
```

Pulls everything currently configured into a single YAML file. Use
this when the user has set things up in the dashboard and now wants
it in code.

## Gotchas

- **YAML anchors** are supported but often confuse Git-diff reviewers.
  Prefer explicit duplication or templating in your build pipeline.
- **Comments** survive roundtripping (we use a format-preserving YAML
  parser) but only on edits — resource additions emit flat keys.
- **Integer vs string fields.** `frequency: 60` (int) not
  `frequency: "60"`. The Zod schema rejects quoted numerics with a
  helpful message.
- **`-f` vs glob.** Shell quoting matters:
  `-f 'devhelm/**/*.yml'` — single-quoted so the shell doesn't expand
  prematurely; the CLI does the glob.

## Reference

- CLI flags: `devhelm plan --help`, `devhelm deploy --help`.
- State commands: `devhelm state list`, `devhelm state rm <addr>`,
  `devhelm state mv <old> <new>` for advanced rebinding.
- Field reference per resource: the `@references/<resource>.md` files
  in this directory.
