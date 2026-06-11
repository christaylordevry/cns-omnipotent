#!/usr/bin/env bash
# Install WSL crontab + Hermes cron job for morning-digest skill (Story 55-3).
# Idempotent: replaces tagged crontab line and recreates Hermes job on each run.
# WSL crontab is the sole civil-time trigger; Hermes job uses dummy schedule (26-7 pattern).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNNER="$REPO_ROOT/scripts/run-morning-digest-cron.sh"
LOG_FILE="${MORNING_DIGEST_SKILL_CRON_LOG:-$HOME/.hermes/logs/morning-digest-skill-cron.log}"
JOB_ID_FILE="${MORNING_DIGEST_SKILL_CRON_JOB_ID_FILE:-$HOME/.hermes/morning-digest-skill-cron-job-id}"
HERMES_CONFIG="${HERMES_CONFIG:-$HOME/.hermes/config.yaml}"
CRON_TAG="cns-morning-digest-skill"
WATCHDOG_CRON_TAG="cns-push-digest-watchdog"
WATCHDOG_CRON_TAG_AFTERNOON="cns-push-digest-watchdog-afternoon"
WATCHDOG_CRON_TAG_EVENING="cns-push-digest-watchdog-evening"
WATCHDOG_RUNNER="$REPO_ROOT/scripts/run-push-digest-watchdog-cron.sh"
WATCHDOG_LOG_FILE="${PUSH_DIGEST_WATCHDOG_CRON_LOG:-$HOME/.hermes/logs/push-digest-watchdog.log}"
DEFAULT_CRON="0 7 * * *"
DEFAULT_WATCHDOG_CRON="15 7 * * *"
DEFAULT_WATCHDOG_CRON_AFTERNOON="0 13 * * *"
DEFAULT_WATCHDOG_CRON_EVENING="30 18 * * *"
HERMES_SCHEDULE_DUMMY="${MORNING_DIGEST_SKILL_HERMES_SCHEDULE:-0 0 1 1 *}"
JOB_NAME="morning-digest"
JOB_PROMPT="Run morning-digest skill: trends, NewsAPI, Perplexity, NotebookLM vault context."

if [[ ! -f "$REPO_ROOT/.env.live-chain" ]]; then
  echo "install-morning-digest-cron: missing $REPO_ROOT/.env.live-chain" >&2
  exit 1
fi

resolve_morning_digest_cron() {
  if [[ -n "${MORNING_DIGEST_CRON:-}" ]]; then
    printf '%s' "$MORNING_DIGEST_CRON"
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
    r"^morning_digest:\s*\n(?:[ \t][^\n]*\n)*?[ \t]+cron:\s*[\"']?([^\"'\n]+)[\"']?",
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

remove_morning_digest_skill_jobs() {
  local output line current_id=""
  output="$(hermes cron list 2>/dev/null || true)"
  while IFS= read -r line; do
    if [[ "$line" =~ ^[[:space:]]+([0-9a-f]+)[[:space:]]+\[ ]]; then
      current_id="${BASH_REMATCH[1]}"
      continue
    fi
    if [[ "$line" =~ Name:[[:space:]]+morning-digest[[:space:]]*$ ]] && [[ -n "$current_id" ]]; then
      remove_hermes_job "$current_id"
      current_id=""
    fi
  done <<< "$output"
}

install_wsl_crontab_lines() {
  local digest_line="$1"
  shift
  local existing filtered
  existing="$(crontab -l 2>/dev/null || true)"
  filtered="$(printf '%s\n' "$existing" | grep -v "$CRON_TAG" | grep -v "$WATCHDOG_CRON_TAG" | grep -v "$WATCHDOG_CRON_TAG_AFTERNOON" | grep -v "$WATCHDOG_CRON_TAG_EVENING" | sed '/^[[:space:]]*$/d' || true)"
  {
    printf '%s\n' "$filtered"
    printf '%s\n' "$digest_line"
    for watchdog_line in "$@"; do
      printf '%s\n' "$watchdog_line"
    done
  } | crontab -
}

mkdir -p "$(dirname "$LOG_FILE")"
mkdir -p "$(dirname "$WATCHDOG_LOG_FILE")"
mkdir -p "$(dirname "$JOB_ID_FILE")"
chmod +x "$RUNNER"
chmod +x "$WATCHDOG_RUNNER"

CRON_EXPR="$(resolve_morning_digest_cron)"
WATCHDOG_CRON_EXPR="${PUSH_DIGEST_WATCHDOG_CRON:-$DEFAULT_WATCHDOG_CRON}"
WATCHDOG_CRON_EXPR_AFTERNOON="${PUSH_DIGEST_WATCHDOG_CRON_AFTERNOON:-$DEFAULT_WATCHDOG_CRON_AFTERNOON}"
WATCHDOG_CRON_EXPR_EVENING="${PUSH_DIGEST_WATCHDOG_CRON_EVENING:-$DEFAULT_WATCHDOG_CRON_EVENING}"
CRON_LINE="${CRON_EXPR} CRON_TZ=Australia/Sydney /bin/bash \"$RUNNER\" >>\"$LOG_FILE\" 2>&1 # $CRON_TAG"
WATCHDOG_CRON_LINE="${WATCHDOG_CRON_EXPR} CRON_TZ=Australia/Sydney /bin/bash \"$WATCHDOG_RUNNER\" >>\"$WATCHDOG_LOG_FILE\" 2>&1 # $WATCHDOG_CRON_TAG"
WATCHDOG_CRON_LINE_AFTERNOON="${WATCHDOG_CRON_EXPR_AFTERNOON} CRON_TZ=Australia/Sydney /bin/bash \"$WATCHDOG_RUNNER\" >>\"$WATCHDOG_LOG_FILE\" 2>&1 # $WATCHDOG_CRON_TAG_AFTERNOON"
WATCHDOG_CRON_LINE_EVENING="${WATCHDOG_CRON_EXPR_EVENING} CRON_TZ=Australia/Sydney /bin/bash \"$WATCHDOG_RUNNER\" >>\"$WATCHDOG_LOG_FILE\" 2>&1 # $WATCHDOG_CRON_TAG_EVENING"

export HERMES_ACCEPT_HOOKS="${HERMES_ACCEPT_HOOKS:-1}"

if [[ -f "$JOB_ID_FILE" ]]; then
  OLD="$(tr -d '[:space:]' <"$JOB_ID_FILE" || true)"
  remove_hermes_job "${OLD:-}"
fi
remove_morning_digest_skill_jobs

OUT="$(hermes cron create "$HERMES_SCHEDULE_DUMMY" "$JOB_PROMPT" \
  --skill morning-digest \
  --name "$JOB_NAME" \
  --deliver discord 2>&1)" || {
  echo "$OUT" >&2
  exit 1
}

echo "$OUT"
JOB_ID="$(echo "$OUT" | sed -n 's/^Created job: *\([^[:space:]]*\).*/\1/p')"
if [[ -z "$JOB_ID" ]]; then
  echo "install-morning-digest-cron: could not parse job id from hermes output" >&2
  exit 1
fi

printf '%s\n' "$JOB_ID" >"$JOB_ID_FILE"

install_wsl_crontab_lines "$CRON_LINE" "$WATCHDOG_CRON_LINE" "$WATCHDOG_CRON_LINE_AFTERNOON" "$WATCHDOG_CRON_LINE_EVENING"

echo "Installed morning-digest skill cron."
echo "WSL schedule: $CRON_EXPR (CRON_TZ=Australia/Sydney on crontab line)"
echo "Push watchdog schedules (CRON_TZ=Australia/Sydney): $WATCHDOG_CRON_EXPR, $WATCHDOG_CRON_EXPR_AFTERNOON, $WATCHDOG_CRON_EXPR_EVENING"
echo "Hermes job schedule: $HERMES_SCHEDULE_DUMMY (dummy; WSL line is the real trigger)"
echo "Log: $LOG_FILE"
echo "Watchdog log: $WATCHDOG_LOG_FILE"
echo "Job id file: $JOB_ID_FILE"
echo "Crontab lines:"
echo "  $CRON_LINE"
echo "  $WATCHDOG_CRON_LINE"
echo "  $WATCHDOG_CRON_LINE_AFTERNOON"
echo "  $WATCHDOG_CRON_LINE_EVENING"
echo "Override WSL schedule: export MORNING_DIGEST_CRON='...' or set morning_digest.cron in $HERMES_CONFIG, then re-run this script."
echo "Override watchdog schedules: PUSH_DIGEST_WATCHDOG_CRON, PUSH_DIGEST_WATCHDOG_CRON_AFTERNOON, PUSH_DIGEST_WATCHDOG_CRON_EVENING"
