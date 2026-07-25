#!/usr/bin/env bash
# Install WSL crontab + Hermes cron job for unified-loop Discover-only (Story 84-1).
# Idempotent: replaces tagged crontab line and recreates Hermes job on each run.
# WSL crontab is the sole civil-time trigger; Hermes job uses dummy schedule (26-7 pattern).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNNER="$REPO_ROOT/scripts/run-unified-loop-discover-cron.sh"
LOG_FILE="${UNIFIED_LOOP_DISCOVER_CRON_LOG:-$HOME/.hermes/logs/unified-loop-discover-cron.log}"
JOB_ID_FILE="${UNIFIED_LOOP_DISCOVER_CRON_JOB_ID_FILE:-$HOME/.hermes/unified-loop-discover-cron-job-id}"
HERMES_CONFIG="${HERMES_CONFIG:-$HOME/.hermes/config.yaml}"
CRON_TAG="cns-unified-loop-discover"
DEFAULT_CRON="0 8 * * *"
HERMES_SCHEDULE_DUMMY="${UNIFIED_LOOP_DISCOVER_HERMES_SCHEDULE:-0 0 1 1 *}"
JOB_NAME="unified-loop-discover"
JOB_PROMPT="Run unified-loop skill Discover-only: collect internal dev state, write discover.json, post bounded #hermes summary."

if [[ ! -f "$REPO_ROOT/.env.live-chain" ]]; then
  echo "install-unified-loop-discover-cron: missing $REPO_ROOT/.env.live-chain" >&2
  exit 1
fi

resolve_unified_loop_discover_cron() {
  if [[ -n "${UNIFIED_LOOP_DISCOVER_CRON:-}" ]]; then
    printf '%s' "$UNIFIED_LOOP_DISCOVER_CRON"
    return
  fi

  if [[ -f "$HERMES_CONFIG" ]]; then
    local from_config
    from_config="$(
      python3 - "$HERMES_CONFIG" <<'PY'
import re
import sys
from pathlib import Path

path = Path(sys.argv[1])
if not path.is_file():
    sys.exit(0)
text = path.read_text(encoding="utf-8", errors="replace")
match = re.search(
    r"^unified_loop:\s*\n(?:[ \t][^\n]*\n)*?[ \t]+discover_cron:\s*[\"']?([^\"'\n]+)[\"']?",
    text,
    re.MULTILINE,
)
if match:
    print(match.group(1).strip())
PY
    )"
    if [[ -n "$from_config" ]]; then
      printf '%s' "$from_config"
      return
    fi
  fi

  printf '%s' "$DEFAULT_CRON"
}

remove_hermes_job() {
  local job_id="$1"
  if [[ -z "$job_id" ]]; then
    return 0
  fi
  hermes cron rm "$job_id" 2>/dev/null || hermes cron remove "$job_id" 2>/dev/null || true
}

remove_unified_loop_discover_jobs() {
  local output line current_id=""
  output="$(hermes cron list 2>/dev/null || true)"
  while IFS= read -r line; do
    if [[ "$line" =~ ^[[:space:]]+([0-9a-f]+)[[:space:]]+\[ ]]; then
      current_id="${BASH_REMATCH[1]}"
      continue
    fi
    if [[ "$line" =~ Name:[[:space:]]+unified-loop-discover[[:space:]]*$ ]] && [[ -n "$current_id" ]]; then
      remove_hermes_job "$current_id"
      current_id=""
    fi
  done <<< "$output"
}

install_wsl_crontab_line() {
  local cron_line="$1"
  local existing filtered
  existing="$(crontab -l 2>/dev/null || true)"
  filtered="$(printf '%s\n' "$existing" | grep -v "$CRON_TAG" | sed '/^[[:space:]]*$/d' || true)"
  {
    printf '%s\n' "$filtered"
    printf '%s\n' "$cron_line"
  } | crontab -
}

mkdir -p "$(dirname "$LOG_FILE")"
mkdir -p "$(dirname "$JOB_ID_FILE")"
chmod +x "$RUNNER"

CRON_EXPR="$(resolve_unified_loop_discover_cron)"
CRON_LINE="${CRON_EXPR} CRON_TZ=Australia/Sydney /bin/bash \"$RUNNER\" >>\"$LOG_FILE\" 2>&1 # $CRON_TAG"

export HERMES_ACCEPT_HOOKS="${HERMES_ACCEPT_HOOKS:-1}"

if [[ -f "$JOB_ID_FILE" ]]; then
  OLD="$(tr -d '[:space:]' <"$JOB_ID_FILE" || true)"
  remove_hermes_job "${OLD:-}"
fi
remove_unified_loop_discover_jobs

OUT="$(hermes cron create "$HERMES_SCHEDULE_DUMMY" "$JOB_PROMPT" \
  --skill unified-loop \
  --name "$JOB_NAME" \
  --deliver discord 2>&1)" || {
  echo "$OUT" >&2
  exit 1
}

echo "$OUT"
JOB_ID="$(echo "$OUT" | sed -n 's/^Created job: *\([^[:space:]]*\).*/\1/p')"
if [[ -z "$JOB_ID" ]]; then
  echo "install-unified-loop-discover-cron: could not parse job id from hermes output" >&2
  exit 1
fi

printf '%s\n' "$JOB_ID" >"$JOB_ID_FILE"

install_wsl_crontab_line "$CRON_LINE"

echo "Installed unified-loop Discover-only cron."
echo "WSL schedule: $CRON_EXPR (CRON_TZ=Australia/Sydney on crontab line)"
echo "Hermes job schedule: $HERMES_SCHEDULE_DUMMY (dummy; WSL line is the real trigger)"
echo "Log: $LOG_FILE"
echo "Job id file: $JOB_ID_FILE"
echo "Crontab line:"
echo "  $CRON_LINE"
echo "Override WSL schedule: export UNIFIED_LOOP_DISCOVER_CRON='...' or set unified_loop.discover_cron in $HERMES_CONFIG, then re-run this script."
