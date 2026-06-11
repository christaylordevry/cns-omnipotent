#!/usr/bin/env bash
set -euo pipefail

# Hermes profile-isolates skill subprocesses under {HERMES_HOME}/home (Epic 59),
# so $HOME becomes e.g. /home/christ/.hermes/home. Remap HOME back to the real
# operator home so trend-ingest.env resolves correctly.
if [[ "$HOME" == */.hermes/home || "$HOME" == */.hermes/home/* ]]; then
  OPERATOR_HOME="${HOME%%/.hermes/home*}"
  if [[ -n "$OPERATOR_HOME" ]]; then
    export HOME="$OPERATOR_HOME"
  fi
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

exec node "$REPO_ROOT/scripts/validate-epic-68-digest.mjs" "$@"
