#!/usr/bin/env bash
set -euo pipefail

export PATH=/home/christ/.nvm/versions/node/v24.14.0/bin:$PATH

if ! command -v node &>/dev/null; then
  echo "[hermes-run-session-close] ERROR: node not found in PATH" >&2
  echo "[hermes-run-session-close] PATH=$PATH" >&2
  exit 1
fi

echo "[hermes-run-session-close] Using node: $(which node) ($(node --version))" >&2

OMNIPOTENT_REPO="${OMNIPOTENT_REPO:-/home/christ/ai-factory/projects/Omnipotent.md}"
HERMES_HOME="${HERMES_HOME:-/home/christ/.hermes}"
export HERMES_HOME
exec node "$OMNIPOTENT_REPO/scripts/session-close/run-deterministic.mjs" "$@"
