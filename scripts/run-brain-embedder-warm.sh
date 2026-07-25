#!/usr/bin/env bash
# Story 82-6 — cron entrypoint: NVM on PATH + brain-recall.env + warm ping.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${BRAIN_RECALL_ENV:-$HOME/.hermes/brain-recall.env}"
LOG_FILE="${BRAIN_EMBEDDER_WARM_LOG:-$HOME/.hermes/logs/brain-embedder-warm.log}"

NODE_BIN="$(ls -d "$HOME/.nvm/versions/node/"*/bin 2>/dev/null | sort -V | tail -1 || true)"
export PATH="${NODE_BIN:-$HOME/.nvm/versions/node/v24.14.0/bin}:$PATH"

mkdir -p "$(dirname "$LOG_FILE")"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "$(date -Is) FATAL: missing $ENV_FILE" >>"$LOG_FILE"
  exit 0
fi

set -a
set +u
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
set -u

cd "$REPO_ROOT"
{
  rc=0
  echo "$(date -Is) start"
  node scripts/brain-embedder-warm.mjs || rc=$?
  echo "$(date -Is) exit=$rc"
} >>"$LOG_FILE" 2>&1
exit 0
