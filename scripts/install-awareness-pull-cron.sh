#!/usr/bin/env bash
# Install WSL user crontab line for Hermes awareness pull (every 3 minutes).
# Env vars must be available to cron — source from ~/.hermes/awareness-pull.env.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="${AWARENESS_PULL_LOG:-$HOME/.hermes/logs/awareness-pull.log}"
ENV_FILE="${AWARENESS_PULL_ENV:-$HOME/.hermes/awareness-pull.env}"
EXAMPLE_FILE="$REPO_ROOT/scripts/awareness-pull.env.example"
CRON_TAG="cns-awareness-pull"

mkdir -p "$(dirname "$LOG_FILE")"
mkdir -p "$HOME/.hermes/memories"

if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -f "$EXAMPLE_FILE" ]]; then
    cp "$EXAMPLE_FILE" "$ENV_FILE"
  else
    cat >"$ENV_FILE" <<EOF
# Hermes awareness pull cron environment
CONVEX_URL=""
HERMES_CONVEX_READ_KEY=""
EOF
  fi
  chmod 600 "$ENV_FILE"
  echo "Created $ENV_FILE — set CONVEX_URL and HERMES_CONVEX_READ_KEY before enabling cron."
fi

RUNNER="$REPO_ROOT/scripts/run-awareness-pull-cron.sh"
chmod +x "$RUNNER"
CRON_LINE="*/3 * * * * /bin/bash \"$RUNNER\" >> \"$LOG_FILE\" 2>&1 # $CRON_TAG"

EXISTING="$(crontab -l 2>/dev/null || true)"
FILTERED="$(printf '%s\n' "$EXISTING" | grep -v "$CRON_TAG" | sed '/^[[:space:]]*$/d' || true)"
{
  printf '%s\n' "$FILTERED"
  printf '%s\n' "$CRON_LINE"
} | crontab -

echo "Installed awareness-pull cron (every 3 min)."
echo "Log: $LOG_FILE"
echo "Env: $ENV_FILE"
echo "Line: $CRON_LINE"
