# Environments

An **environment** is a label that scopes DevHelm resources by
logical deployment tier — typically `production`, `staging`, `dev`.

Environments are not separate workspaces. They're shared tenancy with
a scoping label that:

- Filters dashboard views (`Environment: staging`).
- Scopes notification policies (a `production` policy won't fire for
  `staging` monitors).
- Gates `devhelm deploy` so you can target one at a time.

If the user wants **hard isolation** (different API keys, different
billing, different team roster), they should use multiple workspaces.
Environments are for one team managing multiple tiers.

## Create

```bash
devhelm environments create \
  --name="Production" \
  --slug=production \
  --description="Customer-facing"

devhelm environments create --name=Staging --slug=staging
```

## List / select

```bash
devhelm environments list
```

Active selection for CLI / MaC operations:

```bash
# Per-command flag
devhelm monitors list --environment=staging

# Per-session env var
export DEVHELM_ENVIRONMENT=staging
devhelm monitors list

# Persistent, per-context (stored in ~/.devhelm/contexts.json)
devhelm environments use staging
```

## Assign resources

```bash
devhelm monitors create --environment=production ...
devhelm monitors update <id> --environment=production
```

YAML:

```yaml
# devhelm.yml — single-environment file
environment: production

monitors:
  - name: api
    ...
```

Or mixed (rarer):

```yaml
monitors:
  - name: api-prod
    environment: production
    ...
  - name: api-staging
    environment: staging
    ...
```

The top-level `environment:` applies as a default; per-resource
overrides it.

## Delete

```bash
devhelm environments delete <slug>
```

Fails with 409 if any resources reference it — response lists them.
Move them first (`--environment=<other>` or set to unset), then
retry.

## Common gotchas

- **Default environment.** New orgs come with a single `production`
  environment. The user doesn't have to create one; they can just
  start.
- **`devhelm deploy` scope.** Without `--environment`, deploy operates
  on the currently-selected env. Be explicit in CI:
  `devhelm deploy --environment=production`.
- **Cross-environment references.** A notification policy scoped to
  `production` won't cover `staging` monitors. If the user wants one
  policy for both, either omit the environment scope on the policy,
  or create two scoped policies.

## Complete field reference

`@_generated/environments.fields.md`. Runtime pull:
`devhelm skills schema environments`.
