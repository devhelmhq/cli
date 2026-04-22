# DevHelm CLI RFCs

Architectural change proposals for the `devhelm` CLI. Each RFC is a
self-contained design doc, opened as a PR and merged once consensus
exists. Implementation PRs reference the RFC number.

## Index

| # | Status | Title |
| --- | --- | --- |
| 0001 | Draft | [`state.json` as identity-only; live-API attribute reads at plan time](./0001-state-as-identity-only.md) |

## Process

1. Open a PR adding `docs/rfcs/<NNNN>-<kebab-title>.md` (next available number).
2. Discussion happens in the PR.
3. Merging the RFC = consensus on the design. Implementation may land in the
   same PR (small RFCs) or follow-ups (larger ones).
4. Update the `Status` field in the RFC header as it moves through
   `Draft` → `Accepted` → `Shipped` (or `Rejected`/`Superseded`).
