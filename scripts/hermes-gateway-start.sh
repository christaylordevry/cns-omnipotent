#!/usr/bin/env bash
# Hermes Discord gateway launcher (Story 36-1). WSL @reboot cron and manual recovery.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GATEWAY_LOG="${HERMES_GATEWAY_LOG:-$HOME/.hermes/logs/gateway-cron.log}"

mkdir -p "$HOME/.hermes/logs"

if [[ ! -f "$REPO_ROOT/.env.live-chain" ]]; then
  echo "hermes-gateway-start: missing $REPO_ROOT/.env.live-chain" >&2
  exit 1
fi

cd "$REPO_ROOT"

# shellcheck disable=SC1091
set -a
# shellcheck source=/dev/null
. "$REPO_ROOT/.env.live-chain"
set +a

export DISCORD_BOT_TOKEN="${HERMES_DISCORD_TOKEN:?HERMES_DISCORD_TOKEN must be set in .env.live-chain}"
export DISCORD_ALLOW_ALL_USERS=true

gateway_status_out="$(hermes gateway status 2>/dev/null || true)"
if echo "$gateway_status_out" | grep -qi "gateway is running"; then
  gateway_pid="$(echo "$gateway_status_out" | sed -n 's/.*PID: \([0-9]*\).*/\1/p' | head -1)"
  if [[ -n "${gateway_pid:-}" ]] && kill -0 "$gateway_pid" 2>/dev/null; then
    echo "hermes-gateway-start: gateway already running (PID $gateway_pid)"
    exit 0
  fi
  echo "hermes-gateway-start: status reported running but PID ${gateway_pid:-unknown} not alive; starting"
fi

nohup hermes gateway run >>"$GATEWAY_LOG" 2>&1 &
echo "hermes-gateway-start: started gateway in background (log: $GATEWAY_LOG)"
