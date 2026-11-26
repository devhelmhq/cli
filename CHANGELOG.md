# Changelog

## 1.12.0 (unreleased)

### Added
- Browser and multi-step API monitors in devhelm.yml: `project`, `org`, `workspace`, `defaults.runtimeId`, and per monitor `code`, `key`, `session`, `runParallel`, `fastRetryMaxAttempts`, `capturePolicy`, `secretKeys`. Bundling uses `@devhelm/sdk/bundler`.
- `validate --online`, `test` (with `--reporter junit|github|json`, `--repeat`, `--from-terraform`), code-aware `plan` and `deploy` (validate-then-create, draft → test → publish with `requireTested`, `landed[]/notLanded[]`, `--adopt`, `--acknowledge-rollback`, `--no-test`), `trigger`, `doctor`, `destroy --project`, `init --browser|--api`.
- `monitors`: name resolution everywhere, `run`, `history`, `revisions …`, `publish`, `rollback`, `export`, `transfer`, `restore`, `trash list`, `drift`, `mute`/`unmute`, `quarantine`/`release-quarantine`, `secret-requests …`, `sessions …`.
- `runs …`, `runtimes …`, `secrets values set|delete`, `account usage|entitlements`, `audit events`, `api-keys create --preset`, `api-keys rotate`, device-code `auth login`, `auth switch`, `workspaces list`, `regions list`, and incident and status-page commands over the shipped routes.
- Frozen exit codes (see README), mapped from the error category; `X-DevHelm-Client` on every request and an `Idempotency-Key` on every POST. Keys are random per invocation and reused only for retries of that request, so a second identical command is a new request (as before), never a replay.

### Fixed
- `maintenance-windows update` keeps the window's monitor scope, repeat rule, `suppressAlerts` and reason when you do not pass them; a single-monitor window no longer becomes org-wide.
- `deploy --prune-org-cli` deletes only resources the API reports as CLI- or Git-managed (alert channels, resource groups, status pages and monitors). Dashboard-made resources, resources with no owner, and types without owner tracking (tags, environments, secrets, notification policies, webhooks, dependencies) are only deleted via `.devhelm/state.json` or `--prune-all`.

### Changed
- `deploy --prune` also deletes monitors this project owns (`ownerProject == project`) that are absent from the config, in addition to the resources in `.devhelm/state.json`. `--prune-org-cli` and `--prune-all` keep their wider scopes.
- `state pull` pulls only this project's monitors when devhelm.yml sets `project:`; without `project:` it pulls every monitor, as before.
- `monitors test` exits 14 when a probe fails.
- The owner the CLI writes is `GIT`.

### Deprecated (removed 2027-01-31)
- `monitors results` (use `monitors history`).
- The bare JSON output of pre-1.12 commands (set `DEVHELM_JSON_ENVELOPE=1` for the wrapper).
