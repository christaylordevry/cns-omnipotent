#!/usr/bin/env bash
# WSL cron entrypoint for morning-digest (Epic 70-1).
# Runs deterministic Node orchestrator — not Hermes LLM agent cron.
set -euo pipefail

NODE_BIN="$(ls -d "$HOME/.nvm/versions/node/"*/bin 2>/dev/null | sort -V | tail -1)"
export PATH="${NODE_BIN:-$HOME/.nvm/versions/node/v24.14.0/bin}:$HOME/.local/bin:${PATH:-}"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ ! -f "$REPO_ROOT/.env.live-chain" ]]; then
  echo "run-morning-digest-cron: missing $REPO_ROOT/.env.live-chain" >&2
  exit 1
fi

# hermes gateway status may exit non-zero (e.g. outdated systemd unit warning) even when
# running; with pipefail that poisons the grep pipeline. Capture output first, ignore exit.
# Node orchestrator does not require the gateway — warn only.
_gw_out=$(hermes gateway status 2>&1 || true)
if ! printf '%s\n' "$_gw_out" | grep -qiE 'gateway service is running|gateway is running'; then
  echo "run-morning-digest-cron: WARNING — Hermes gateway not detected (Node orchestrator does not require it)" >&2
fi

# shellcheck disable=SC1091
set -a
# shellcheck source=/dev/null
. "$REPO_ROOT/.env.live-chain"
set +a

export DISCORD_BOT_TOKEN="${HERMES_DISCORD_TOKEN:?HERMES_DISCORD_TOKEN must be set in .env.live-chain}"
export DISCORD_ALLOWED_CHANNELS="${DISCORD_ALLOWED_CHANNELS:-}"
export DISCORD_FREE_RESPONSE_CHANNELS="${DISCORD_FREE_RESPONSE_CHANNELS:-}"
export DISCORD_ALLOWED_ROLES="${DISCORD_ALLOWED_ROLES:-}"
export DISCORD_ALLOWED_USERS="${DISCORD_ALLOWED_USERS:-}"
export DISCORD_ALLOW_ALL_USERS="${DISCORD_ALLOW_ALL_USERS:-}"

node "$REPO_ROOT/scripts/run-digest-convex-completion.mjs"
