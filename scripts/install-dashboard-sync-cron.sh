#!/usr/bin/env bash
# Install WSL user crontab line for CNS dashboard sync (every 3 minutes).
# Env vars must be available to cron — source from ~/.hermes/dashboard-sync.env (create from example).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="${DASHBOARD_SYNC_LOG:-$HOME/.hermes/logs/dashboard-sync.log}"
ENV_FILE="${DASHBOARD_SYNC_ENV:-$HOME/.hermes/dashboard-sync.env}"
CRON_TAG="cns-dashboard-sync"

mkdir -p "$(dirname "$LOG_FILE")"

if [[ ! -f "$ENV_FILE" ]]; then
  cat >"$ENV_FILE" <<EOF
# CNS dashboard-sync cron environment (edit paths and secrets)
CNS_VAULT_ROOT=""
CONVEX_URL=""
CONVEX_DEPLOY_KEY=""
# If deploy key contains |, wrap the value in double quotes in this file.
EOF
  chmod 600 "$ENV_FILE"
  echo "Created $ENV_FILE — set CNS_VAULT_ROOT, CONVEX_URL, and CONVEX_DEPLOY_KEY before enabling cron."
fi

# Do not `. env` in the crontab line — /bin/sh breaks quoted values (spaces in vault path).
# Use bash wrapper: NVM PATH + `source` dashboard-sync.env.
RUNNER="$REPO_ROOT/scripts/run-dashboard-sync-cron.sh"
chmod +x "$RUNNER"
CRON_LINE="*/3 * * * * /bin/bash \"$RUNNER\" >> \"$LOG_FILE\" 2>&1 # $CRON_TAG"

EXISTING="$(crontab -l 2>/dev/null || true)"
FILTERED="$(printf '%s\n' "$EXISTING" | grep -v "$CRON_TAG" | sed '/^[[:space:]]*$/d' || true)"
{
  printf '%s\n' "$FILTERED"
  printf '%s\n' "$CRON_LINE"
} | crontab -

echo "Installed dashboard-sync cron (every 3 min)."
echo "Log: $LOG_FILE"
echo "Env: $ENV_FILE"
echo "Line: $CRON_LINE"
