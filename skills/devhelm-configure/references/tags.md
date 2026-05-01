# Tags

Tags are **free-form key/value metadata** you can attach to monitors,
alert channels, resource groups, and most other resource types. They
drive:

- **Filtering**: `devhelm monitors list --tags=env=prod,team=platform`.
- **Notification-policy scoping**: a policy with
  `--tags=env=prod` applies only to prod monitors.
- **Dashboard + status-page sectioning** in some views.

Tags are not the same as **resource groups**. Groups have ownership
semantics (one-per-monitor, parent container). Tags are many-to-many
metadata.

## Set tags

Inline at creation:

```bash
devhelm monitors create --name=api --tags='env=prod,team=platform' ...
```

Or as JSON:

```bash
devhelm monitors update <id> --tags='{"env":"prod","team":"platform","service":"checkout"}'
```

YAML:

```yaml
monitors:
  - name: api
    tags:
      env: prod
      team: platform
      service: checkout
```

## Rules

- Keys: lowercase alphanumeric + `_` / `-`, ≤32 chars.
- Values: any string ≤128 chars. No newlines.
- A resource can have up to 32 tags. The first 4 show in list views;
  the rest are filter-only.
- Tag updates are **full replacements** at the tag level, not deep
  merges. Update sends the full tag map; fields omitted are removed.

## Common patterns

| Pattern | Tags |
|---|---|
| Environment separation | `env=prod`, `env=staging`, `env=dev` |
| Team ownership | `team=platform`, `team=payments` |
| Service boundary | `service=checkout`, `service=auth` |
| Severity class | `tier=t0`, `tier=t1`, `tier=t2` |
| Rollout phase | `phase=ga`, `phase=beta`, `phase=preview` |

Most customers converge on `env` + `team` + `service`. Keep it
disciplined — tag-explosion makes filters useless.

## Complete field reference

There's no standalone "tags" resource. Tags are a field on other
resources. See the field reference for the resource you're tagging.
