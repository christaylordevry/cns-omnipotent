#!/usr/bin/env bash
set -euo pipefail

# Story 59-3: operator HOME + nvm PATH before drive-sync (Hermes isolation).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/npm-env.sh
source "${SCRIPT_DIR}/lib/npm-env.sh"

if ! command -v node &>/dev/null; then
  echo "[hermes-run-sync-vault-export-drive] ERROR: node not found in PATH" >&2
  echo "[hermes-run-sync-vault-export-drive] PATH=$PATH" >&2
  exit 1
fi

export OMNIPOTENT_REPO="${OMNIPOTENT_REPO:-/home/christ/ai-factory/projects/Omnipotent.md}"
exec node "$OMNIPOTENT_REPO/scripts/session-close/sync-vault-export-drive.mjs" "$@"
