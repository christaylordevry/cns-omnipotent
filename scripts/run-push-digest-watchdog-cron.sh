#!/usr/bin/env bash
NODE_BIN="$(ls -d "$HOME/.nvm/versions/node/"*/bin 2>/dev/null | sort -V | tail -1)"
export PATH="${NODE_BIN:-$HOME/.nvm/versions/node/v24.14.0/bin}:$HOME/.local/bin:${PATH:-}"

# WSL cron entrypoint for push-digest-watchdog (Story 67-10).
# Runs 15 minutes after morning-digest; no Hermes gateway required.
#
# DIGEST_TRIGGER: set by crontab prefix (watchdog-0715|1300|1830). .env.live-chain
# does not define DIGEST_TRIGGER — sourcing it cannot overwrite the inherited value.
# Do not reorder source-before-export without re-checking .env.live-chain.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export OMNIPOTENT_REPO="$REPO_ROOT"

_inherited_trigger="${DIGEST_TRIGGER:-}"

if [[ -f "$REPO_ROOT/.env.live-chain" ]]; then
  # shellcheck disable=SC1091
  set -a
  # shellcheck source=/dev/null
  . "$REPO_ROOT/.env.live-chain"
  set +a
fi

if [[ -n "$_inherited_trigger" ]]; then
  export DIGEST_TRIGGER="$_inherited_trigger"
elif [[ -z "${DIGEST_TRIGGER:-}" ]]; then
  SYDNEY_HOUR="$(TZ=Australia/Sydney date +%H)"
  case "$SYDNEY_HOUR" in
    07) export DIGEST_TRIGGER=watchdog-0715 ;;
    13) export DIGEST_TRIGGER=watchdog-1300 ;;
    18) export DIGEST_TRIGGER=watchdog-1830 ;;
    *) export DIGEST_TRIGGER=manual ;;
  esac
fi

exec node "$REPO_ROOT/scripts/run-digest-convex-completion.mjs"
