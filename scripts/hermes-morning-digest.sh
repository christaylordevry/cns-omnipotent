#!/usr/bin/env bash
# Hermes morning digest launcher (Story 26-7). WSL cron calls this at 07:00 Australia/Sydney.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
JOB_ID_FILE="${HERMES_MORNING_DIGEST_JOB_ID_FILE:-$HOME/.hermes/morning-digest-cron-job-id}"
PROMPT_FILE="${HERMES_MORNING_DIGEST_PROMPT:-$REPO_ROOT/scripts/hermes-morning-digest-prompt.md}"
INJECT_SCRIPT="${HERMES_MORNING_DIGEST_INJECT:-$REPO_ROOT/scripts/hermes-morning-digest-date-inject.py}"
VAULT_WORKDIR="${HERMES_MORNING_DIGEST_WORKDIR:-$REPO_ROOT/Knowledge-Vault-ACTIVE}"
export VAULT_WORKDIR

if [[ ! -f "$REPO_ROOT/.env.live-chain" ]]; then
  echo "hermes-morning-digest: missing $REPO_ROOT/.env.live-chain" >&2
  exit 1
fi

if [[ ! -f "$JOB_ID_FILE" ]]; then
  echo "hermes-morning-digest: missing job id file $JOB_ID_FILE (run scripts/install-hermes-morning-digest-job.sh once)" >&2
  exit 1
fi

if ! hermes gateway status 2>/dev/null | grep -qi "gateway is running"; then
  echo "hermes-morning-digest: Hermes gateway is not running; aborting (no Discord delivery, no digest run)." >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a
# shellcheck source=/dev/null
. "$REPO_ROOT/.env.live-chain"
set +a

export DISCORD_BOT_TOKEN="${HERMES_DISCORD_TOKEN:?HERMES_DISCORD_TOKEN must be set in .env.live-chain}"
# HI-5 parity: channel scoping remains in ~/.hermes/config.yaml; optional env overrides if operator sets them:
export DISCORD_ALLOWED_CHANNELS="${DISCORD_ALLOWED_CHANNELS:-}"
export DISCORD_FREE_RESPONSE_CHANNELS="${DISCORD_FREE_RESPONSE_CHANNELS:-}"
export DISCORD_ALLOWED_ROLES="${DISCORD_ALLOWED_ROLES:-}"
export DISCORD_ALLOWED_USERS="${DISCORD_ALLOWED_USERS:-}"
export DISCORD_ALLOW_ALL_USERS="${DISCORD_ALLOW_ALL_USERS:-}"

JOB_ID="$(tr -d '[:space:]' <"$JOB_ID_FILE")"
if [[ -z "$JOB_ID" ]]; then
  echo "hermes-morning-digest: empty job id in $JOB_ID_FILE" >&2
  exit 1
fi

export HERMES_ACCEPT_HOOKS="${HERMES_ACCEPT_HOOKS:-1}"

# Refresh stored prompt + script paths on the job (Hermes persists job definition; edit files + re-install to change).
# Here we only trigger execution; job was created with --workdir and prompt snapshot at install time.
# Operator must re-run install script after editing prompt file if Hermes does not hot-reload job text.
hermes cron run "$JOB_ID"
hermes cron tick

EXPECTED_DIGEST="$VAULT_WORKDIR/00-Inbox/hermes-morning-digest-$(TZ=Australia/Sydney date +%F).md"
if [[ ! -f "$EXPECTED_DIGEST" ]]; then
  echo "hermes-morning-digest: Mode B artifact missing after cron tick: $EXPECTED_DIGEST" >&2
  echo "hermes-morning-digest: inspect Hermes logs; agent must write this path before finishing." >&2
  exit 2
fi
