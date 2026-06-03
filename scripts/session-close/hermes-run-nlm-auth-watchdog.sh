#!/usr/bin/env bash
set -euo pipefail

# Story 59-3: operator HOME + nvm PATH before nlm auth watchdog (Hermes isolation).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/npm-env.sh
source "${SCRIPT_DIR}/lib/npm-env.sh"

if ! command -v node &>/dev/null; then
  echo "[hermes-run-nlm-auth-watchdog] ERROR: node not found in PATH" >&2
  echo "[hermes-run-nlm-auth-watchdog] PATH=$PATH" >&2
  exit 1
fi

OMNIPOTENT_REPO="${OMNIPOTENT_REPO:-/home/christ/ai-factory/projects/Omnipotent.md}"
exec node "$OMNIPOTENT_REPO/scripts/session-close/lib/nlm-auth-watchdog.mjs" "$@"
