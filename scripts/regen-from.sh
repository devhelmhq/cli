#!/usr/bin/env bash
#
# Regenerate generated code from an arbitrary OpenAPI spec file.
#
# Usage: scripts/regen-from.sh <path-to-spec.json>
#
# Per-artifact entry point for the spec-evolution harness
# (`mono/tests/surfaces/evolution/`). The harness handles backup/restore.
#
# Behavior:
#   - copies <path-to-spec.json> over docs/openapi/monitoring-api.json
#   - runs typegen + zodgen + descgen + tsc to rebuild dist/
#   - prints absolute path to src/lib/api.generated.ts on stdout
#
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <path-to-spec.json>" >&2
  exit 1
fi

INPUT_SPEC="$1"
if [[ ! -f "$INPUT_SPEC" ]]; then
  echo "error: spec not found at $INPUT_SPEC" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TARGET_SPEC="$ROOT_DIR/docs/openapi/monitoring-api.json"
OUTPUT="$ROOT_DIR/src/lib/api.generated.ts"

# Skip the copy when the caller passes the vendored spec back in (harness
# post-session teardown re-regens from the restored baseline).
INPUT_ABS="$(cd "$(dirname "$INPUT_SPEC")" && pwd)/$(basename "$INPUT_SPEC")"
TARGET_ABS="$(cd "$(dirname "$TARGET_SPEC")" && pwd)/$(basename "$TARGET_SPEC")"
if [[ "$INPUT_ABS" != "$TARGET_ABS" ]]; then
  cp "$INPUT_SPEC" "$TARGET_SPEC"
fi

cd "$ROOT_DIR"
npm run typegen >&2
npm run zodgen >&2
npm run descgen >&2
# Build the dist/ tree so subprocess invocation (bin/run.js) sees the new
# code. We pass `--force` to bypass tsc's incremental cache: the spec-
# evolution harness regenerates from many different specs in one process,
# and a previous failed build can leave .tsbuildinfo in a state that
# convinces tsc to skip emitting files even after the source has changed.
npx tsc -b --force >&2

echo "$OUTPUT"
