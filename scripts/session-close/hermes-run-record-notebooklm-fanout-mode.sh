#!/usr/bin/env bash
set -euo pipefail

export PATH=/home/christ/.nvm/versions/node/v24.14.0/bin:$PATH

if ! command -v node &>/dev/null; then
  echo "[hermes-run-record-notebooklm-fanout-mode] ERROR: node not found in PATH" >&2
  exit 1
fi

OMNIPOTENT_REPO="${OMNIPOTENT_REPO:-/home/christ/ai-factory/projects/Omnipotent.md}"
exec node "$OMNIPOTENT_REPO/scripts/session-close/record-notebooklm-fanout-mode.mjs" "$@"
