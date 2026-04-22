# RFC 0001: state.json as identity-only; live-API attribute reads at plan time

| Field | Value |
| --- | --- |
| Status | Accepted (implemented in 0.5.0) |
| Author | DevHelm CLI maintainers |
| Created | 2026-04-22 |
| Accepted | 2026-04-22 |
| Target release | `devhelm` 0.5.0 |
| Related | Issue A (`pullStatusPageChildren` underfills) — subsumed by this RFC |

## Implementation status

Shipped in `cli@0.5.0`:

- `state.json` schema bumped to v3 (identity-only). v1 → v3 and v2 → v3
  reader-side migrations strip `attributes` silently on load; users see
  no breakage and no migration command is required.
- `differ.diff()` is now async and accepts a `ChildSnapshotMap`. A new
  `prefetchChildSnapshots(config, refs, client)` runs all per-parent
  child fetches concurrently before the diff loop. `plan` and `deploy`
  call it; tests inject a fake map.
- `statusPageHandler` declares `fetchChildSnapshots` (live API read of
  groups + components) and a `hasChildChanges` that compares YAML
  against the live snapshot, not state.
- `applier`, `child-reconciler`, `state pull`, and `import` no longer
  write `attributes` to state. `upsertStateEntry` lost its `attributes`
  parameter.
- `buildStateV2` is kept as a deprecated alias of `buildState` that
  silently drops attributes — keeps the public name from breaking until
  the next major.

See the v3 schema in `src/lib/yaml/state.ts` and the diff pipeline in
`src/lib/yaml/differ.ts`.

## Summary

Today the `devhelm` CLI compares user YAML against a local `state.json`
snapshot of "what we last applied" instead of against the live API. This
proposal flips that: **`state.json` keeps only the identity mapping
(YAML address → API UUID + minimum disambiguators); attribute values are
always re-read from the live API at plan time**. The result is the same
contract Terraform itself ships with (`refresh` before `plan`), gives us
correct out-of-band drift detection for free, and eliminates an entire
class of bug we keep hitting (most recently `defaultOpen` on status
page groups).

## Motivation

### What broke (concrete incidents)

1. **`defaultOpen` drift between environments (April 2026, mini deploy).**
   Production was deployed first (`defaultOpen: true` reached the prod
   API and the local `state.json`). The same operator then targeted the
   mini API, where the DB still had `defaultOpen: false`. `devhelm plan`
   showed *no changes* because the local snapshot already said `true`.
   The bug was not in the diff — it was that the diff had no idea what
   the mini API actually held.

2. **`pullStatusPageChildren` underfilled attributes.** `state pull` only
   wrote `{name}` into the snapshot for every group/component, ignoring
   `defaultOpen`, `description`, `showUptime`, etc. After a `state
   pull`, the very next `plan` would falsely report drift on every
   field — or, depending on which side of the diff the bug landed,
   miss real drift. (Now fixed via single-source `*CurrentSnapshot`
   helpers, but the architecture made it inevitable.)

3. **Manual SQL fixup invisible to plan.** During the same incident an
   operator updated `default_open = true` directly via `psql` on the
   mini DB. `devhelm plan` did not flag this as drift because the local
   `state.json` agreed with the YAML — neither had any window into the
   actual API.

All three share the same root cause: the diff input is local memory
(`state.json`'s `attributes`), not the live API.

### Why this keeps happening

The state file currently serves four roles bundled into one document:

| Role | Why it's needed | Owner of truth |
| --- | --- | --- |
| Identity mapping (`address → apiId`) | Rename detection, child-collection reconciliation | State file |
| Cross-deploy bookkeeping (`serial`, `lastDeployedAt`) | Audit trail | State file |
| Drift baseline (`attributes`) | Compare YAML vs. "what we last shipped" | State file (today) — but morally the API |
| Drift baseline (`children[*].attributes`) | Same, for status page child collections | State file (today) — same problem |

The first two are inherent to the CLI (no other source has them). The
last two are not — they exist in the API and we already pay the cost of
fetching them at deploy time. Storing a stale shadow copy in
`state.json` and using THAT as the diff baseline trades **drift
correctness** for **fewer HTTP calls at plan time**, which is the wrong
trade for an IaC tool.

### Precedent: the DevHelm Terraform provider already does this

Our own Terraform provider (`devhelmhq/terraform-provider-devhelm`)
implements the proposed model. Each `devhelm_status_page_component_group`
resource's `Read()` method always queries the live API
(`internal/provider/resources/status_page_component_group.go:172-205`)
and overwrites the in-memory state with what the API returned. The
TF state file (`terraform.tfstate`) functions as the identity index;
the actual diff input for `terraform plan` is whatever `Read()` just
returned.

Critically, the TF provider has **never** had a `defaultOpen`-style
drift bug, despite shipping the same field. The same pattern works in
the CLI.

## Goals

- `devhelm plan` correctly reports out-of-band changes (DB edits, dashboard
  edits, deploys from another machine) without requiring `devhelm state pull`
  as a defensive ritual.
- Adding a new field to a managed resource's API DTO requires updating
  exactly one place in the CLI (the YAML schema + the YAML→snapshot
  function — same as today). It must not require also updating a
  separate "what to put in state" path.
- `state.json` becomes small, stable, and human-auditable — the only
  values inside are identifiers and operational metadata.
- `devhelm state pull` becomes a no-op for attribute hydration (it
  rebuilds identity only). `state pull` remains useful only for
  rebuilding a lost state file from scratch.

## Non-goals

- Replacing `state.json` with a remote backend. This RFC keeps the file
  local + gitignored.
- Changing the YAML schema or any user-facing DSL.
- Changing how child-collection identity is keyed (`groups.<name>`,
  `components.<name>` stay).
- Changing concurrency / locking semantics.

## Proposed design

### 1. New state schema (v3)

```jsonc
{
  "version": "3",
  "serial": 42,
  "lastDeployedAt": "2026-04-22T18:30:00Z",
  "resources": {
    "monitors.API": {
      "apiId": "mon-uuid-1",
      "resourceType": "monitor"
    },
    "statusPages.public": {
      "apiId": "sp-uuid-1",
      "resourceType": "statusPage",
      "children": {
        "groups.Platform": {"apiId": "g-uuid-1"},
        "components.API":  {"apiId": "c-uuid-1"}
      }
    }
  }
}
```

Differences from v2:

- `attributes` field removed from `StateEntry` and `ChildStateEntry`.
  These were the source of all four drift bugs above.
- `children[*]` becomes `{apiId: string}` only.
- Everything else is unchanged.

### 2. Plan flow becomes "refresh then diff"

Today (`plan.ts` → `differ.ts`):
1. Read `state.json`.
2. Fetch all primary resources from the API (`fetchAllRefs`).
3. For each YAML resource, find its API counterpart via state matching.
4. Diff YAML's snapshot vs. **state.json**'s `lastDeployedAttributes` /
   children `attributes`.

Proposed:
1. Read `state.json` (identity only).
2. Fetch all primary resources from the API (unchanged).
3. **For status pages and any other parent with child collections,
   fetch children eagerly** (`/api/v1/status-pages/{id}/{groups,components}`).
   This is one extra round-trip per status page on plan; status pages are
   rare (typically 1 per workspace), so the cost is negligible.
4. Build a "current snapshot" per resource by passing the API DTO
   through the existing `toCurrentSnapshot` (now the SOLE path that
   produces snapshots — `state pull` calls into the same path).
5. Diff YAML's `toDesiredSnapshot` vs. the freshly-built current
   snapshot. Same comparator code as today; only the right-hand-side
   source changes.

### 3. `applier.ts` no longer writes `attributes` to state

After a successful create/update, the applier writes only `{apiId, resourceType}`
(plus the identity portion of `children`). The next plan will re-read
the API.

### 4. Child-collection diffing collapses

`hasStatusPageChildChanges` and `childCollectionDiffers` (`handlers.ts:1113-1150`)
disappear from the plan path. They were the workaround for "we don't
have child API data at plan time"; with eager child fetch, the regular
add/update/delete reconciler runs at both plan-time (read-only,
producing the diff summary) and apply-time (mutating).

### 5. Migration: silent v2 → v3 read

`readState()` already supports v1 → v2 silent migration. We add v2 → v3:

- Read v2 if present.
- Drop all `attributes` fields, keep identity only.
- On the next `deploy`, write v3.

No user action. No flag day. The first plan after upgrade may show
*real* drift the user didn't know about — that's the feature.

### 6. `state pull` shrinks

`pullStatusPageChildren` (and any future per-collection puller) returns
only `{apiId}`. We delete the recently-added `*CurrentSnapshot` calls
in pull (the helpers themselves stay in `handlers.ts`, now used solely
by the plan path).

`devhelm state pull` continues to exist for genuine
state-file-loss recovery, but its blast radius is now tiny: it cannot
cause phantom diffs because it stores no attributes to compare against.

## Trade-offs

### Cost: more HTTP calls at plan time

- Today: `plan` issues N list calls (one per primary resource type) +
  zero per-status-page child fetches.
- Proposed: same N + 2× per status page (groups + components).
  Status pages are typically 1–3 per workspace; we go from ~10 list
  calls to ~12–16. With local API or DOKS-internal, this is sub-100ms.
- For the production `devhelm.yml` (the dogfood case): currently 1
  status page → 2 extra calls. Negligible.

If this becomes a problem at very high resource counts, the API has
existing pagination + `?expand=children` patterns we can opt into. Out
of scope for this RFC.

### Cost: plan now requires API access

Today, a `devhelm plan` against a stale state file kind-of works
offline (it diffs YAML against last-known attributes). In practice this
is never useful — `plan` already requires API access for primary refs
fetch. No regression.

### Benefit: third-party edits become first-class

Edits made via the dashboard, the public API, the Terraform provider,
or direct DB SQL all surface as drift in `devhelm plan` after this RFC.
This is the explicit positive: the CLI stops pretending it's the only
writer.

### Risk: a future field that's expensive to fetch

If we ever add a field to a managed resource that's expensive to compute
on the API side (e.g. a derived rollup), eager fetch at plan time would
pay that cost on every plan. Mitigation: the API can move expensive
fields off the default DTO (we already do this for monitor stats), and
the snapshot helpers naturally exclude fields that aren't on the DTO.
This isn't a new problem — `lastDeployedAttributes` would have been
stale anyway.

### Risk: divergence between deploy-time apply and plan-time refresh

Today, `applyUpdate` writes attributes back to state immediately, so
plan and apply read the same baseline. Proposed: plan and apply both
read the API; if the API mutates between plan and apply, the user gets
exactly what `terraform apply` does — a possible re-plan prompt or a
benign no-op. We accept this; it is the correct semantic.

## Alternatives considered

### A. Keep state attributes, add a `--refresh` flag to `plan`

Equivalent to `terraform plan -refresh=true`. Cheap to ship, but the
default behavior remains wrong, and the existing failure modes (forgot
to run `state pull`, forgot the flag) persist. We've already lived
with this for ~4 versions; the workaround is exactly what users are
not doing.

### B. Server-side ETag / version comparison

API returns `version` per resource; CLI stores only versions in
`state.json` and asks the API "have any of these changed?". Smaller
state, fewer bytes — but requires API-side support, doesn't help when
no version field exists, and still needs full DTOs to compute the diff
display. Not chosen.

### C. Drop `state.json` entirely; key everything by name

Equivalent to running `terraform import` on every plan. Breaks rename
detection, makes child collections ambiguous, and we'd need an "I
manage this" flag at the API level. Considered and rejected: the
identity mapping is genuinely useful and small.

### D. Hybrid — keep attributes but also fetch live and warn on mismatch

Doubles the work, splits the truth, and exposes operators to "the CLI
says X but the API says Y, who is right?" prompts on every plan.
Strictly worse than (A) or this RFC.

## Open questions

- **`pluginManifest`-style cache for primary resource DTOs?** If two
  consecutive `plan`s within ~30s could share an in-memory fetch, we
  could halve the round-trips during interactive iteration. Probably a
  follow-up; out of scope.
- **What about resources with derived attributes the API doesn't echo
  back?** None today — every YAML field round-trips through a DTO. If
  this changes, those fields go into `state.json` explicitly with a
  doc note ("server-derived; CLI-tracked").
- **Backfill: should the v2→v3 migration warn when it would have
  reported drift?** Tempting (helps operators audit). Probably yes,
  gated behind a one-shot `--explain-migration` flag so we don't spam
  CI.

## Migration plan

This RFC is a single PR (post-approval), staged behind a feature flag:

1. **Phase 0 (already shipped, this branch).** Single-source
   `*CurrentSnapshot` helpers + `state pull` parity tests. Removes
   the underfilling bug class even before this RFC lands.
2. **Phase 1 — additive.** Add eager child fetch + v3 reader behind
   `DEVHELM_STATE_V3=1`. Internal dogfood for one release cycle.
3. **Phase 2 — default on.** Flip the env var default. Both readers
   present; writer emits v3. Existing v2 state files silently upgrade
   on next deploy.
4. **Phase 3 — cleanup.** Remove v2 writer + `lastDeployedAttributes`
   field from `ChildStateEntry`. Remove `childCollectionDiffers`. Ship
   in next minor.

## Acceptance criteria

The implementation PR is mergeable when:

- All four reproduction cases above (`defaultOpen` cross-env,
  `pullStatusPageChildren` underfill, manual SQL fixup, dashboard
  edit) produce a correct diff in `devhelm plan` *without* the user
  having run `devhelm state pull`.
- `state.json` no longer contains any field whose source-of-truth lives
  in the API.
- Existing 867 unit tests pass unchanged (the diff comparator's input
  changes; the comparator itself does not).
- New integration test in `tests/integration/cli/` exercises the
  cross-environment scenario end-to-end (deploy A, mutate B's DB,
  plan against B, expect drift report).
- Terraform provider's own `Read`-based pattern is referenced in the
  shipping documentation as the canonical analog.

## Out of this RFC's scope (tracked separately)

- **Plan UX (Issue B).** The diff renderer currently prints opaque
  "groups: changed" for child collections. Once attributes are
  per-field, the renderer should print field-level diffs. Tracked as a
  follow-up since the architectural change here unblocks it.
- **Terraform provider.** Confirmed not affected (it already uses the
  proposed model). No work needed.
