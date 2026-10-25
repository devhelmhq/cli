# Changelog

## 1.12.0 (unreleased)

### Added
- Browser and multi-step API monitors in devhelm.yml: `project`, `org`, `workspace`, `defaults.runtimeId`, and per monitor `code`, `key`, `session`, `runParallel`, `fastRetryMaxAttempts`, `capturePolicy`, `secretKeys`. Bundling uses `@devhelm/sdk/bundler`.
- `validate --online`, `test` (with `--reporter junit|github|json`, `--repeat`, `--from-terraform`), code-aware `plan` and `deploy` (validate-then-create, draft → test → publish with `requireTested`, `landed[]/notLanded[]`, `--adopt`, `--acknowledge-rollback`, `--no-test`), `trigger`, `doctor`, `destroy --project`, `init --browser|--api`.
- `monitors`: name resolution everywhere, `run`, `history`, `revisions …`, `publish`, `rollback`, `export`, `transfer`, `restore`, `trash list`, `drift`, `mute`/`unmute`, `quarantine`/`release-quarantine`, `secret-requests …`, `sessions …`.
- `runs …`, `runtimes …`, `secrets values set|delete`, `account usage|entitlements`, `audit events`, `api-keys create --preset`, `api-keys rotate`, device-code `auth login`, `auth switch`, `workspaces list`, `regions list`, and incident and status-page commands over the shipped routes.
- Frozen exit codes (see README), mapped from the error category; `X-DevHelm-Client` and `Idempotency-Key` on every request.

### Changed
- `deploy` never changes `enabled` (pause is an overlay); `enabled` in devhelm.yml is now an error naming `monitors pause|resume`.
- `--prune` deletes only monitors this project owns. `state pull` pulls only this project's monitors.
- `monitors test` exits 14 when a probe fails.
- The owner the CLI writes is `GIT`.

### Removed
- `deploy --prune-org-cli`, `--prune-all`.

### Deprecated (removed 2027-01-31)
- `monitors results` (use `monitors history`).
- The bare JSON output of pre-1.12 commands (set `DEVHELM_JSON_ENVELOPE=1` for the wrapper).
