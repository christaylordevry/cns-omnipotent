#!/usr/bin/env bash
# WSL cron entrypoint for morning-digest skill (Story 55-3).
# Invokes Hermes skill cron job via `hermes cron run` + `tick` — not Discord text trigger.
set -euo pipefail

NODE_BIN="$(ls -d "$HOME/.nvm/versions/node/"*/bin 2>/dev/null | sort -V | tail -1)"
export PATH="${NODE_BIN:-$HOME/.nvm/versions/node/v24.14.0/bin}:$HOME/.local/bin:${PATH:-}"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
JOB_ID_FILE="${MORNING_DIGEST_SKILL_CRON_JOB_ID_FILE:-$HOME/.hermes/morning-digest-skill-cron-job-id}"

if [[ ! -f "$REPO_ROOT/.env.live-chain" ]]; then
  echo "run-morning-digest-cron: missing $REPO_ROOT/.env.live-chain" >&2
  exit 1
fi

if [[ ! -f "$JOB_ID_FILE" ]]; then
  echo "run-morning-digest-cron: missing job id file $JOB_ID_FILE (run scripts/install-morning-digest-cron.sh once)" >&2
  exit 1
fi

# hermes gateway status may exit non-zero (e.g. outdated systemd unit warning) even when
# running; with pipefail that poisons the grep pipeline. Capture output first, ignore exit.
# Matches: "✓ User gateway service is running" (current) and legacy "gateway is running"
_gw_out=$(hermes gateway status 2>&1 || true)
if ! printf '%s\n' "$_gw_out" | grep -qiE 'gateway service is running|gateway is running'; then
  echo "run-morning-digest-cron: Hermes gateway is not running; aborting (no Discord delivery, no digest run)." >&2
  exit 1
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

JOB_ID="$(tr -d '[:space:]' <"$JOB_ID_FILE")"
if [[ -z "$JOB_ID" ]]; then
  echo "run-morning-digest-cron: empty job id in $JOB_ID_FILE" >&2
  exit 1
fi

export HERMES_ACCEPT_HOOKS="${HERMES_ACCEPT_HOOKS:-1}"

hermes cron run "$JOB_ID"
hermes cron tick
