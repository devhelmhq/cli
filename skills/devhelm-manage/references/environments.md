# Environments (from the manage skill)

Same resource as covered in the configure skill's
`environments.md`, but from an administration angle:

- Listing what exists.
- Switching the CLI's current environment selection.
- Deleting empty environments.

For *creating monitors/alerts scoped to an environment*, the
configure skill's reference is authoritative.

## List

```bash
devhelm environments list
```

## Current selection

```bash
devhelm auth me                              # shows active context + env
devhelm environments use <slug>              # persists in context
```

Per-command: `--environment=<slug>` or `DEVHELM_ENVIRONMENT=<slug>`.

## Create / delete

See the configure skill's `environments.md` for the create flow.
Deletion from here:

```bash
devhelm environments delete <slug>           # fails with 409 if in use
```

The 409 response lists referencing resources. Move them first
(`devhelm monitors update <id> --environment=<other>`), then retry.

## Multi-environment auth contexts

For users operating multiple envs from the same machine, set up one
CLI context per env:

```bash
devhelm auth login --token=<prod-key>   --context=prod
devhelm auth login --token=<stage-key>  --context=staging
devhelm auth context use prod
```

Contexts also store the default environment, so `devhelm monitors
list` uses the right scope automatically.

## Complete field reference

See `@_generated/environments.fields.md` (same generator; same
reference across both skills).
