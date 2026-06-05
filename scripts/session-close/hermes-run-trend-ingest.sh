#!/usr/bin/env bash
set -euo pipefail

# Hermes profile-isolates skill subprocesses under {HERMES_HOME}/home (Epic 59),
# so $HOME becomes e.g. /home/christ/.hermes/home. Remap HOME back to the real
# operator home so $HOME/.pyenv and trend-ingest.py's Path.home() lookups
# (.hermes/trend-watchlist.yaml + .hermes/trend-ingest.env) resolve correctly.
# Mirrors operator-home.mjs (inferOperatorHomeFromHome) — direct inference, no deps.
if [[ "$HOME" == */.hermes/home || "$HOME" == */.hermes/home/* ]]; then
  OPERATOR_HOME="${HOME%%/.hermes/home*}"
  if [[ -n "$OPERATOR_HOME" ]]; then
    export HOME="$OPERATOR_HOME"
  fi
fi

export PATH="$HOME/.pyenv/shims:$HOME/.pyenv/bin:$PATH"
REPO="${OMNIPOTENT_REPO:-$HOME/ai-factory/projects/Omnipotent.md}"
exec python3 "$REPO/scripts/trend-ingest.py" --dry-run --sources google_trends
