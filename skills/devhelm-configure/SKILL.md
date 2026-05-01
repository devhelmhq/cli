---
name: devhelm-configure
description: Create and manage DevHelm monitoring resources — monitors, alert channels, notification policies, resource groups, dependencies, secrets, tags, webhooks, and environments. Use when the user wants to set up uptime or heartbeat monitoring, wire Slack/email/PagerDuty/webhook alerts, group monitors by team/service, track third-party status pages as dependencies, store secrets for monitor auth, or otherwise configure any DevHelm resource. Auto-detects monitoring-as-code repos (devhelm.yml, Terraform) and picks the right surface.
---

# DevHelm — Configure

You help the user create and manage monitoring resources in DevHelm. This
skill covers the **write side** of the platform: everything that creates,
updates, or deletes a resource.

For read/debug flows (status, failures, incidents, uptime), switch to the
`devhelm-investigate` skill. For status pages, switch to
`devhelm-communicate`. For API keys / plan / workspace admin, switch to
`devhelm-manage`.

---

## Preconditions (run once per session)

1. **CLI installed.** Run `devhelm --version`. If it fails, stop and tell
   the user: `npm install -g devhelm`.
2. **Authenticated.** Run `devhelm auth me`. If it fails with a 401 or
   reports no active context, stop and tell the user: `devhelm auth login`
   (or `devhelm auth login --token=<api-key>` if they have one). Do not
   attempt to create anything without an active context.
3. **Optional env override.** If the user's prompt names an environment
   (e.g. "in staging"), resolve it with `devhelm environments list` and
   pass `--environment <slug>` on every subsequent command.

---

## Step 1 — Detect the mode

Check the repo, in this order, and stop at the first match:

| Signal | Mode | Rationale |
|---|---|---|
| `devhelm.yml` or `devhelm.yaml` exists at repo root | **MaC-YAML** | User has already committed to declarative. |
| Any `*.tf` file references `devhelm_*` resources | **MaC-Terraform** | User has already committed to Terraform. |
| `.github/workflows/*.yml` contains `devhelm deploy` | **MaC-YAML** | CI-driven declarative flow. |
| User's prompt names ≥3 resources to create in one turn | **MaC-YAML** | Bulk is always worth the reviewability. |
| None of the above, user is in a git repo | **Imperative CLI**, then offer to bootstrap MaC after success |
| Not in a git repo | **Imperative CLI only** | No bootstrap offer. |

Fast checks (do NOT scan every file):

```bash
test -f devhelm.yml || test -f devhelm.yaml && echo YAML
grep -rl --include='*.tf' 'devhelm_' . 2>/dev/null | head -1
grep -l 'devhelm deploy' .github/workflows/*.yml 2>/dev/null | head -1
```

**Announce the detected mode in one sentence** before taking any action.
Example: *"Detected `devhelm.yml` in this repo — I'll add the monitor
there and run `devhelm plan` before applying."* Don't ladder through
multi-turn confirmation — proceed unless the user pushes back.

Always re-run detection at the start of each *new* user turn; repos
change between requests.

---

## Step 2 — Identify the resource(s)

Map the user's intent to a resource type, then load the matching
reference. Each reference has a **hand-written** authoritative section
and a **generated** field list (`_generated/<resource>.fields.md`) that
tracks the current OpenAPI spec.

| Intent vocabulary | Resource | Reference |
|---|---|---|
| "monitor", "check", "uptime of X", "health of X" | monitors | `@references/monitors.md` |
| "alert", "Slack channel", "PagerDuty", "email me", "webhook alert" | alert-channels | `@references/alert-channels.md` |
| "policy", "escalation", "notify on-call", "route alerts" | notification-policies | `@references/notification-policies.md` |
| "group", "per team", "per service", "bundle monitors" | resource-groups | `@references/resource-groups.md` |
| "track github", "slack status", "depends on X status page" | dependencies | `@references/dependencies.md` |
| "store secret", "API token for auth", "credential" | secrets | `@references/secrets.md` |
| "label", "env=prod", "team=payments" | tags | `@references/tags.md` |
| "outbound webhook", "notify external service" | webhooks | `@references/webhooks.md` |
| "staging env", "production env", "environment" | environments | `@references/environments.md` |

If the intent is ambiguous (e.g. "set up monitoring for Slack"), ask
**one** clarifier — "Do you want to monitor your own API that depends on
Slack (monitor), or show Slack's public status on your page (dependency)?"
— then proceed.

---

## Step 3 — Execute

### Mode: Imperative CLI (single resource, fastest to green)

Every resource type supports the same six verbs:

```bash
devhelm <resource> create <args>
devhelm <resource> list [--output json|yaml|table]
devhelm <resource> get <id>
devhelm <resource> update <id> <args>
devhelm <resource> delete <id>
devhelm <resource> test <id>         # where applicable (monitors, webhooks, alert-channels)
```

Flags are driven by the OpenAPI spec. To see current flags for any
resource: `devhelm <resource> create --help`. To see the full field
schema programmatically: `devhelm skills schema <resource>`.

**Defaults to apply unless the user specified otherwise:**

- HTTP monitors → `frequency=60`, `regions=us-east`, `method=GET`,
  `follow_redirects=true`, `assertions=[{type: "STATUS_CODE", operator: "EQUALS", target: "200"}]`.
- Heartbeat monitors → `grace_period=300`.
- Notification policies — create a sensible default that fans to any
  alert channels the user has already configured (list them first).

After creation, always run the resource's `test` command (if it exists)
and report the result.

### Mode: MaC-YAML (one or many, declarative)

Read `@references/mac-yaml.md` for the full recipe. Core loop:

1. Read existing `devhelm.yml` — never overwrite fields the user already
   set.
2. Show the user the **diff** you're about to write (use the Read /
   Write tools, not a shell `sed`).
3. Run `devhelm plan` and include its output verbatim in your reply.
4. Wait for explicit confirmation unless user already said "go ahead".
5. Run `devhelm deploy` and summarise the changeset.

### Mode: MaC-Terraform

Read `@references/mac-terraform.md` for the full recipe. Core loop:

1. Add the HCL block to the most topical `*.tf` file, or a new
   `monitors.tf` if the repo is unstructured.
2. Run `terraform plan` and include its output.
3. Wait for confirmation.
4. Run `terraform apply`.

### Verify (all modes)

- Monitors: `devhelm monitors test <id>` immediately after create,
  then `devhelm monitors get <id>` a few seconds later to show status.
- Alert channels: `devhelm alert-channels test <id>`.
- Webhooks: `devhelm webhooks test <id>`.
- Everything else: `devhelm <resource> get <id>`.

Report the resource name, ID, dashboard URL, and verification result.

---

## Step 4 — Offer the next logical step

After creating a monitor, suggest **one** next step, tailored to
context:

- No alert channels exist → *"Want me to wire up a Slack/email alert
  channel so failures notify you?"*
- 1 monitor, no group → skip; grouping makes sense at ≥3.
- ≥3 monitors, no `devhelm.yml` → *"Want me to bootstrap `devhelm.yml`
  so these live as code?"*
- ≥3 monitors, no status page → *"Want me to publish a public status
  page showing these?"* (hand off to `devhelm-communicate`).

One suggestion, not a menu. The user can ignore it without guilt.

---

## Safety rails (non-negotiable)

1. **Never edit `devhelm.yml` without showing the diff first.** Use the
   Read+Write tools; do not `sed` config files in the shell.
2. **Never create more than 5 resources in one turn** without explicit
   per-resource confirmation. 6+ = ask.
3. **Never delete** an existing resource unless the user explicitly used
   the word "delete" or "remove". "Update" and "replace" are not delete
   signals.
4. **Never run `devhelm deploy` without `devhelm plan` immediately
   before**, and never skip the plan output from your reply.
5. **Reject localhost / private IP / link-local targets** on HTTP
   monitors with a one-line explanation: *"DevHelm probes run from
   public datacenters and can't reach 127.0.0.1 / 10.0.0.0/8 /
   192.168.0.0/16 / 169.254.0.0/16. Use a heartbeat monitor instead if
   you want to verify an internal service from its own host."* Then
   offer to create the heartbeat.
6. **Never expose the full value of an existing API key or secret.**
   They're only visible once at creation time; past that, only the
   last-4 characters and ID are returned by the API.

---

## Error handling

The CLI uses structured exit codes (see `DevhelmError` taxonomy):

| Exit | Meaning | Your response |
|---|---|---|
| 0 | Success | Report. |
| 4 | Local validation | The user's input failed a Zod schema. Show the field + fix. Don't retry blindly. |
| 10 | Plan has changes | Expected during `plan`. Show diff. |
| 11 | API error (4xx/5xx) | Include the API error's `code`, `message`, and `requestId` verbatim in your reply. |
| 12 | Transport error | Network/TLS/DNS. Retry once; if it fails again, ask the user to check connectivity. |
| 13 | Partial failure (deploy) | Some resources applied, some didn't. Report both sides. |

Any non-zero exit → stop and report. Never silently retry `deploy` or
`create`.

---

## References

- `@references/monitors.md`
- `@references/alert-channels.md`
- `@references/notification-policies.md`
- `@references/resource-groups.md`
- `@references/dependencies.md`
- `@references/secrets.md`
- `@references/tags.md`
- `@references/webhooks.md`
- `@references/environments.md`
- `@references/mac-yaml.md`
- `@references/mac-terraform.md`

For absolute-latest field schemas (useful when the CLI is a stale
version): `devhelm skills schema <resource>`.
