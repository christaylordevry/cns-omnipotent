#!/usr/bin/env bash
# Hermes Discord gateway launcher (Story 36-1). WSL @reboot cron and manual recovery.
# Story 67-9: stale gateway.pid / gateway.lock recovery after WSL suspend.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GATEWAY_LOG="${HERMES_GATEWAY_LOG:-$HOME/.hermes/logs/gateway-cron.log}"
HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
PID_FILE="$HERMES_HOME/gateway.pid"
LOCK_FILE="$HERMES_HOME/gateway.lock"

mkdir -p "$HERMES_HOME/logs"

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

extract_pid_from_status() {
  local status_out="$1"
  local pid=""
  pid="$(echo "$status_out" | sed -n 's/.*Main PID: \([0-9]*\).*/\1/p' | head -1)"
  if [[ -z "${pid:-}" ]]; then
    pid="$(echo "$status_out" | sed -n 's/.*PID: \([0-9]*\).*/\1/p' | head -1)"
  fi
  echo "$pid"
}

# Returns 0 when gateway.pid points at a live process (caller exits 0).
# Returns 1 when missing, unreadable, or stale (caller continues to start).
check_gateway_pid_file() {
  local pid=""
  if [[ ! -f "$PID_FILE" ]]; then
    return 1
  fi
  pid="$(python3 -c "import json; print(json.load(open('$PID_FILE')).get('pid',''))" 2>/dev/null || true)"
  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
    echo "hermes-gateway-start: gateway already running (PID $pid from gateway.pid)"
    return 0
  fi
  rm -f "$PID_FILE" "$LOCK_FILE"
  echo "hermes-gateway-start: cleared stale gateway lock (pid=${pid:-unknown})"
  return 1
}

if check_gateway_pid_file; then
  exit 0
fi

# Matches: "✓ User gateway service is running" (current) and legacy "gateway is running"
gateway_status_out="$(hermes gateway status 2>/dev/null || true)"
if echo "$gateway_status_out" | grep -qiE 'gateway service is running|gateway is running'; then
  gateway_pid="$(extract_pid_from_status "$gateway_status_out")"
  if [[ -n "${gateway_pid:-}" ]] && kill -0 "$gateway_pid" 2>/dev/null; then
    echo "hermes-gateway-start: gateway already running (PID $gateway_pid)"
    exit 0
  fi
  echo "hermes-gateway-start: status reported running but PID ${gateway_pid:-unknown} not alive; starting"
  rm -f "$PID_FILE" "$LOCK_FILE"
fi

nohup hermes gateway run >>"$GATEWAY_LOG" 2>&1 &
echo "hermes-gateway-start: started gateway in background (log: $GATEWAY_LOG)"
