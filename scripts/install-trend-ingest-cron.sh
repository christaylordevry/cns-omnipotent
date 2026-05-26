#!/usr/bin/env bash
# Install WSL user crontab lines for Epic 44 trend ingest (news/reddit every 15m, trends hourly).
# Env vars must be available to cron — source from ~/.hermes/trend-ingest.env (copy from example).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="${TREND_INGEST_LOG:-$HOME/.hermes/logs/trend-ingest.log}"
ENV_FILE="${TREND_INGEST_ENV:-$HOME/.hermes/trend-ingest.env}"
EXAMPLE_FILE="$REPO_ROOT/scripts/trend-ingest.env.example"
RUNNER="$REPO_ROOT/scripts/run-trend-ingest-cron.sh"

TAG_NEWS="cns-trend-ingest-news"
TAG_REDDIT="cns-trend-ingest-reddit"
TAG_TRENDS="cns-trend-ingest-google-trends"

mkdir -p "$(dirname "$LOG_FILE")"

if [[ ! -f "$ENV_FILE" ]]; then
  if [[ ! -f "$EXAMPLE_FILE" ]]; then
    echo "FATAL: missing $EXAMPLE_FILE" >&2
    exit 1
  fi
  cp "$EXAMPLE_FILE" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  echo "Created $ENV_FILE from example — set CONVEX_URL, CONVEX_DEPLOY_KEY, and source API keys before enabling cron."
fi

# Keep Python structured log path aligned with cron stderr redirect.
if grep -qE '^[[:space:]]*TREND_INGEST_LOG=' "$ENV_FILE" 2>/dev/null; then
  escaped="${LOG_FILE//\\/\\\\}"
  escaped="${escaped//|/\\|}"
  sed -i -E "s|^[[:space:]]*TREND_INGEST_LOG=.*|TREND_INGEST_LOG=\"${escaped}\"|" "$ENV_FILE"
else
  printf '\n# Structured ingest log (must match cron redirect)\nTREND_INGEST_LOG="%s"\n' "$LOG_FILE" >>"$ENV_FILE"
fi
chmod 600 "$ENV_FILE"

chmod +x "$RUNNER"

CRON_NEWS="*/15 * * * * /bin/bash \"$RUNNER\" news >> \"$LOG_FILE\" 2>&1 # $TAG_NEWS"
CRON_REDDIT="*/15 * * * * /bin/bash \"$RUNNER\" reddit >> \"$LOG_FILE\" 2>&1 # $TAG_REDDIT"
CRON_TRENDS="0 * * * * /bin/bash \"$RUNNER\" google_trends >> \"$LOG_FILE\" 2>&1 # $TAG_TRENDS"

EXISTING="$(crontab -l 2>/dev/null || true)"
FILTERED="$(printf '%s\n' "$EXISTING" \
  | grep -v "$TAG_NEWS" \
  | grep -v "$TAG_REDDIT" \
  | grep -v "$TAG_TRENDS" \
  | sed '/^[[:space:]]*$/d' || true)"
{
  printf '%s\n' "$FILTERED"
  printf '%s\n' "$CRON_NEWS"
  printf '%s\n' "$CRON_REDDIT"
  printf '%s\n' "$CRON_TRENDS"
} | crontab -

echo "Installed trend ingest cron (news/reddit every 15 min, google_trends hourly)."
echo "Log: $LOG_FILE"
echo "Env: $ENV_FILE"
echo "Lines:"
echo "  $CRON_NEWS"
echo "  $CRON_REDDIT"
echo "  $CRON_TRENDS"
