#!/usr/bin/env bash
# Cron entrypoint: source trend-ingest.env + run one collector source per invocation.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${TREND_INGEST_ENV:-$HOME/.hermes/trend-ingest.env}"
DEFAULT_LOG="$HOME/.hermes/logs/trend-ingest.log"
SOURCE="${1:-}"

if [[ -z "$SOURCE" ]]; then
  echo "FATAL: usage: run-trend-ingest-cron.sh <news|reddit|google_trends>" >&2
  exit 1
fi

case "$SOURCE" in
  news|reddit|google_trends) ;;
  *)
    echo "FATAL: invalid source '$SOURCE' (expected news, reddit, or google_trends)" >&2
    exit 1
    ;;
esac

if [[ ! -f "$ENV_FILE" ]]; then
  echo "FATAL: missing $ENV_FILE" >&2
  exit 1
fi

export TREND_INGEST_LOG="${TREND_INGEST_LOG:-$DEFAULT_LOG}"

# CONVEX_DEPLOY_KEY often contains `|` — must be quoted in env file; source without `set -u`.
set -a
set +u
# shellcheck disable=SC1090
source "$ENV_FILE"
set -u

export TREND_INGEST_LOG="${TREND_INGEST_LOG:-$DEFAULT_LOG}"

export PATH="/usr/local/bin:/usr/bin:/bin:${PATH:-}"
PYTHON="$(command -v python3 || true)"
if [[ -z "$PYTHON" ]]; then
  echo "FATAL: python3 not found on PATH (expected under /usr/bin on WSL cron)" >&2
  exit 1
fi

cd "$REPO_ROOT"
exec "$PYTHON" scripts/trend-ingest.py --sources "$SOURCE"
