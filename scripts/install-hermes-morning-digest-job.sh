#!/usr/bin/env bash
# One-time (or repeat-safe): create Hermes cron job for morning digest + write job id for scripts/hermes-morning-digest.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROMPT_FILE="${HERMES_MORNING_DIGEST_PROMPT:-$REPO_ROOT/scripts/hermes-morning-digest-prompt.md}"
SOURCE_INJECT="${HERMES_MORNING_DIGEST_INJECT_SOURCE:-$REPO_ROOT/scripts/hermes-morning-digest-date-inject.py}"
HERMES_SCRIPTS_DIR="${HERMES_HOME_SCRIPTS:-$HOME/.hermes/scripts}"
HERMES_SCRIPT_NAME="${HERMES_MORNING_DIGEST_INJECT_NAME:-hermes-morning-digest-date-inject.py}"
VAULT_WORKDIR="${HERMES_MORNING_DIGEST_WORKDIR:-$REPO_ROOT/Knowledge-Vault-ACTIVE}"
JOB_ID_FILE="${HERMES_MORNING_DIGEST_JOB_ID_FILE:-$HOME/.hermes/morning-digest-cron-job-id}"
SCHEDULE_DUMMY="${HERMES_MORNING_DIGEST_HERMES_SCHEDULE:-0 0 1 1 *}"

mkdir -p "$(dirname "$JOB_ID_FILE")"
mkdir -p "$HERMES_SCRIPTS_DIR"

if [[ ! -f "$PROMPT_FILE" ]]; then
  echo "install-hermes-morning-digest-job: missing prompt file $PROMPT_FILE" >&2
  exit 1
fi
if [[ ! -f "$SOURCE_INJECT" ]]; then
  echo "install-hermes-morning-digest-job: missing inject source $SOURCE_INJECT" >&2
  exit 1
fi
if [[ ! -x "$(command -v python3)" ]]; then
  echo "install-hermes-morning-digest-job: python3 required for --script" >&2
  exit 1
fi

cp "$SOURCE_INJECT" "$HERMES_SCRIPTS_DIR/$HERMES_SCRIPT_NAME"
chmod +x "$HERMES_SCRIPTS_DIR/$HERMES_SCRIPT_NAME"

PROMPT_TEXT="$(cat "$PROMPT_FILE")"
VAULT_ABS="$(python3 -c "import os,sys; print(os.path.realpath(sys.argv[1]))" "$VAULT_WORKDIR")"

export HERMES_ACCEPT_HOOKS="${HERMES_ACCEPT_HOOKS:-1}"

# Remove prior job id if present (single-job pattern)
if [[ -f "$JOB_ID_FILE" ]]; then
  OLD="$(tr -d '[:space:]' <"$JOB_ID_FILE" || true)"
  if [[ -n "${OLD:-}" ]]; then
    hermes cron rm "$OLD" 2>/dev/null || hermes cron remove "$OLD" 2>/dev/null || true
  fi
fi

# Dummy schedule: WSL user cron at 07:00 Australia/Sydney is the real trigger; we invoke `hermes cron run` + `tick` from scripts/hermes-morning-digest.sh
OUT="$(hermes cron create "$SCHEDULE_DUMMY" "$PROMPT_TEXT" \
  --name hermes-morning-digest \
  --deliver discord \
  --workdir "$VAULT_ABS" \
  --script "$HERMES_SCRIPT_NAME" 2>&1)" || {
  echo "$OUT" >&2
  exit 1
}

echo "$OUT"
JOB_ID="$(echo "$OUT" | sed -n 's/^Created job: *\([^[:space:]]*\).*/\1/p')"
if [[ -z "$JOB_ID" ]]; then
  echo "install-hermes-morning-digest-job: could not parse job id from hermes output" >&2
  exit 1
fi

printf '%s\n' "$JOB_ID" >"$JOB_ID_FILE"
echo "Wrote job id to $JOB_ID_FILE"
echo "Next: add WSL crontab line (see CNS-Operator-Guide.md Hermes morning digest section)."
