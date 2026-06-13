#!/usr/bin/env bash
# WSL cron entrypoint for digest outcome observability gate (Story 71-3).
set -euo pipefail

NODE_BIN="$(ls -d "$HOME/.nvm/versions/node/"*/bin 2>/dev/null | sort -V | tail -1)"
export PATH="${NODE_BIN:-$HOME/.nvm/versions/node/v24.14.0/bin}:$HOME/.local/bin:${PATH:-}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export OMNIPOTENT_REPO="$REPO_ROOT"

if [[ -f "$REPO_ROOT/.env.live-chain" ]]; then
  # shellcheck disable=SC1091
  set -a
  # shellcheck source=/dev/null
  . "$REPO_ROOT/.env.live-chain"
  set +a
fi

export DISCORD_BOT_TOKEN="${HERMES_DISCORD_TOKEN:-${DISCORD_BOT_TOKEN:-}}"
export CHECK_DIGEST_ALERT="${CHECK_DIGEST_ALERT:-1}"

exec node "$REPO_ROOT/scripts/check-digest-run-outcome.mjs"
