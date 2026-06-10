#!/usr/bin/env bash
# WSL cron entrypoint for push-digest-watchdog (Story 67-10).
# Runs 15 minutes after morning-digest; no Hermes gateway required.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export OMNIPOTENT_REPO="$REPO_ROOT"

if [[ -f "$REPO_ROOT/.env.live-chain" ]]; then
  # shellcheck disable=SC1091
  set -a
  # shellcheck source=/dev/null
  . "$REPO_ROOT/.env.live-chain"
  set +a
fi

exec node "$REPO_ROOT/scripts/push-digest-watchdog.mjs"
