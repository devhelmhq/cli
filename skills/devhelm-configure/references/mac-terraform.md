# Monitoring as Code — Terraform

DevHelm has an official Terraform provider
(`registry.terraform.io/devhelmhq/devhelm`). Use this mode when the
user's repo already uses Terraform for infrastructure and they want
monitoring managed in the same state.

## Provider setup

```hcl
terraform {
  required_providers {
    devhelm = {
      source  = "devhelmhq/devhelm"
      version = "~> 0.3"
    }
  }
}

provider "devhelm" {
  # Token resolution order:
  #   1. provider config `api_token = var.devhelm_token`
  #   2. env var DEVHELM_API_TOKEN
  #   3. ~/.devhelm/contexts.json (if running locally)
}
```

In CI, always pass the token via env or TF variable — never hard-code.

## Supported resource types

As of the current provider version:

| Terraform resource | DevHelm resource |
|---|---|
| `devhelm_monitor` | Monitor (HTTP/HEARTBEAT/TCP/DNS/MCP/RSS_STATUS) |
| `devhelm_alert_channel` | Alert channel |
| `devhelm_notification_policy` | Notification policy |
| `devhelm_resource_group` | Resource group |
| `devhelm_dependency` | Dependency |
| `devhelm_secret` | Secret (write-only — can't read value back) |
| `devhelm_webhook` | Outbound webhook |
| `devhelm_environment` | Environment |
| `devhelm_status_page` | Public status page |
| `devhelm_status_page_component` | Status page component |

Check the provider's registry page for the canonical list if the user
asks about a resource not here.

## Minimal example

```hcl
resource "devhelm_alert_channel" "slack" {
  name        = "slack-platform"
  type        = "SLACK"
  webhook_url = var.slack_webhook
}

resource "devhelm_notification_policy" "default" {
  name              = "default"
  applies_to_all    = true
  trigger_count     = 2
  alert_channel_ids = [devhelm_alert_channel.slack.id]
}

resource "devhelm_monitor" "api_prod" {
  name      = "api-prod"
  type      = "HTTP"
  url       = "https://api.example.com/health"
  frequency = 60
  regions   = ["us-east", "eu-west"]
  tags      = { env = "prod", team = "platform" }

  assertion {
    type     = "STATUS_CODE"
    operator = "EQUALS"
    target   = "200"
  }
  assertion {
    type     = "RESPONSE_TIME"
    operator = "LESS_THAN"
    target   = "500"
  }
}
```

## The canonical flow

```bash
terraform plan
terraform apply
```

Same pattern as YAML mode, just with Terraform's tooling.

## Secrets in Terraform

Two options:

1. **DevHelm secrets** (recommended): create a `devhelm_secret`
   once (manually or via a separate workspace), then reference via
   `${{secrets.NAME}}` in string fields. The provider doesn't need
   the value.
2. **Terraform variables + providers like vault**: pass the value
   directly as a TF variable (`sensitive = true`). The value ends up
   in Terraform state — encrypt your state backend.

Prefer option 1 for anything reused; option 2 for one-off setup
values (Slack webhook URL).

## Importing existing resources

```bash
terraform import devhelm_monitor.api_prod <monitor-id>
```

Every DevHelm resource exposes a stable `id`; you can find it via
`devhelm <resource> list`.

For wholesale import of a pre-existing configuration:

```bash
devhelm init --from-platform --format=terraform > devhelm.tf
```

## State considerations

DevHelm state is **server-authoritative**. If a user edits a resource
via the dashboard, `terraform plan` sees drift on the next run and
proposes to revert. Either:

- Tell the user to edit in Terraform only (preferred for code-managed
  resources).
- Use `ignore_changes` per-field if a specific value must be
  dashboard-managed (e.g. `tags = { ... last_modified_by = ... }`).

## Gotchas

- **Resource renames** destroy-then-create by default. Use
  `terraform state mv <old> <new>` before the rename to preserve the
  underlying resource.
- **Assertion blocks are ordered**; reorder causes apparent drift.
  Keep them in the same order between runs.
- **`devhelm_secret.value` is write-only**; provider can't read it
  back on refresh. If rotation is needed, explicitly set a new
  `value` in the TF config.
- **Provider version pinning** matters — new spec fields land in new
  provider versions. When the user regenerates from `devhelm init`,
  the output targets the currently-installed provider; pin it.

## Reference

- Full provider docs:
  `https://registry.terraform.io/providers/devhelmhq/devhelm/latest/docs`
- Per-resource field lists: `@references/<resource>.md` in this
  directory (YAML-shaped but the field names match Terraform 1:1).
