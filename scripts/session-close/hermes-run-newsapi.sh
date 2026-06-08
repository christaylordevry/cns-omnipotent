#!/usr/bin/env bash
set -euo pipefail

# Hermes profile-isolates skill subprocesses under {HERMES_HOME}/home (Epic 59),
# so $HOME becomes e.g. /home/christ/.hermes/home. Remap HOME back to the real
# operator home so $HOME/.pyenv and $HOME/.hermes/trend-ingest.env resolve
# correctly. Mirrors operator-home.mjs (inferOperatorHomeFromHome) — direct
# inference, no deps.
if [[ "$HOME" == */.hermes/home || "$HOME" == */.hermes/home/* ]]; then
  OPERATOR_HOME="${HOME%%/.hermes/home*}"
  if [[ -n "$OPERATOR_HOME" ]]; then
    export HOME="$OPERATOR_HOME"
  fi
fi

export PATH="$HOME/.pyenv/shims:$HOME/.pyenv/bin:$PATH"

ENV_FILE="$HOME/.hermes/trend-ingest.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo '{"error":"missing trend-ingest.env"}'
  exit 0
fi

while IFS='=' read -r name value; do
  [[ "$name" =~ ^[[:space:]]*# ]] && continue
  [[ -z "$name" ]] && continue
  name="${name// /}"
  if [[ "$name" == "NEWSAPI_API_KEY" ]]; then
    export NEWSAPI_API_KEY="${value//\"/}"
    export NEWSAPI_API_KEY="${NEWSAPI_API_KEY//\'/}"
  fi
done < "$ENV_FILE"

if [[ -z "${NEWSAPI_API_KEY:-}" ]]; then
  echo '{"error":"missing NEWSAPI_API_KEY"}'
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

exec node "$REPO_ROOT/scripts/hermes-skill-examples/morning-digest/scripts/fetch-newsapi-headlines.mjs"
