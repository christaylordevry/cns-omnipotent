#!/usr/bin/env bash
# Cron entrypoint: NVM on PATH + source dashboard-sync.env (quoted paths with spaces).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${DASHBOARD_SYNC_ENV:-$HOME/.hermes/dashboard-sync.env}"

NODE_BIN="$(ls -d "$HOME/.nvm/versions/node/"*/bin 2>/dev/null | sort -V | tail -1)"
export PATH="${NODE_BIN:-$HOME/.nvm/versions/node/v24.14.0/bin}:$PATH"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "FATAL: missing $ENV_FILE" >&2
  exit 1
fi

# CONVEX_DEPLOY_KEY often contains `|` — must be quoted in env file; source without `set -u`.
set -a
set +u
# shellcheck disable=SC1090
source "$ENV_FILE"
set -a
set -u

cd "$REPO_ROOT"
exec npx tsx scripts/dashboard-sync.ts
