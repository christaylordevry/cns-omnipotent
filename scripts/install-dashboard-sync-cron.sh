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
EOF
  chmod 600 "$ENV_FILE"
  echo "Created $ENV_FILE — set CNS_VAULT_ROOT, CONVEX_URL, and CONVEX_DEPLOY_KEY before enabling cron."
fi

CRON_LINE="*/3 * * * * . \"$ENV_FILE\" && cd \"$REPO_ROOT\" && npx tsx scripts/dashboard-sync.ts >> \"$LOG_FILE\" 2>&1 # $CRON_TAG"

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
