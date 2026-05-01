# Audit Log

The **audit log** is an immutable record of user actions and
significant system events in the workspace — who changed what, when,
from what IP, via which surface (dashboard / API / CLI / Terraform /
pipeline).

Use when the user asks:

- *"Who changed X?"* / *"When was this last modified?"*
- *"What happened around 15:30 UTC?"*
- *"Did we auto-pause this?"*
- *"Who deleted the production monitor?"*

## Query

```bash
devhelm audit events \
  --since=24h \
  --actor=user:alice@example.com \
  --resource-type=MONITOR \
  --resource-id=<monitor-id> \
  --action=UPDATE,DELETE \
  --output=json
```

Common filter combinations:

| Filter | Answers |
|---|---|
| `--since=1h` | "Anything happen in the last hour?" |
| `--actor=<email>` | "What did Alice do this week?" |
| `--resource-id=<id>` | "Full history of this specific monitor." |
| `--action=DELETE` | "All deletions." |
| `--surface=CLI,TERRAFORM` | "All code-driven changes." |

## Event shape

Each audit event includes:

| Field | Meaning |
|---|---|
| `id` | Stable UUID. |
| `occurredAt` | When the action was accepted by the API. |
| `actor` | User, service-account, API key, or SYSTEM. |
| `surface` | DASHBOARD, API, CLI, TERRAFORM, PIPELINE, SYSTEM. |
| `action` | CREATE, UPDATE, DELETE, PAUSE, RESUME, LOGIN, etc. |
| `resourceType` | MONITOR, ALERT_CHANNEL, NOTIFICATION_POLICY, … |
| `resourceId` / `resourceName` | The target. |
| `metadata` | Action-specific structured data — see below. |
| `requestId` | For support correlation with server-side logs. |

### metadata for common actions

- `UPDATE` → `metadata.changedFields[]` with `before` / `after` per
  field. Field values are redacted for sensitive types (secrets, API
  keys).
- `MEMBER_ROLE_CHANGED` → `metadata.oldRole`, `metadata.newRole`,
  `metadata.targetUserId`.
- `LOGIN` → `metadata.ip`, `metadata.userAgent`,
  `metadata.mfaMethod`.
- `PAUSE` / `RESUME` → `metadata.reason` (if user supplied one) and
  `metadata.autoPaused` (bool — system-triggered pauses).

Full field reference: `@_generated/audit-events.fields.md`.

## Correlation with incidents

Audit events are user-driven; incidents are monitoring-driven. To
answer *"did someone change config right before this incident?"*:

```bash
INC_ID=inc_xyz
START=$(devhelm incidents get $INC_ID --output=json | jq -r '.startedAt')

devhelm audit events \
  --until="$START" \
  --since=1h \
  --resource-type=MONITOR,NOTIFICATION_POLICY \
  --action=UPDATE,DELETE
```

Windowing 1 hour back from the incident start catches the common
"deploy-caused outage" pattern.

## Retention

- Free: 30 days
- Pro: 90 days
- Scale: 1 year
- Enterprise: 2 years + export to customer-owned S3 bucket (optional)

## Safety rails (restating from the skill)

- **Never expose API key values or secret contents** visible in
  `metadata`. They're redacted at the API boundary, but if you see
  any field that contains a literal token, truncate past the first
  6 characters.
- **Respect role boundaries.** VIEWER users can see audit events for
  their own actions and system events, but not others' PII (e.g. IPs
  of other users). The API enforces this; you'll see redacted fields
  in responses.
