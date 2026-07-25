#!/usr/bin/env bash
# Story 82-5 — manual dashboard launch with brain-recall env + nvm PATH (non-systemd).
set -euo pipefail

HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
BRAIN_ENV="$HERMES_HOME/brain-recall.env"

NODE_BIN_DIR="$(ls -d "$HOME/.nvm/versions/node/"*/bin 2>/dev/null | sort -V | tail -1 || true)"
if [[ -z "$NODE_BIN_DIR" ]]; then
  NODE_BIN_DIR="$HOME/.nvm/versions/node/v24.14.0/bin"
fi
export PATH="${NODE_BIN_DIR}:${PATH:-/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin}"

if [[ -f "$BRAIN_ENV" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$BRAIN_ENV"
  set +a
else
  echo "hermes-dashboard-start: missing $BRAIN_ENV — run scripts/install-hermes-brain-recall-env.sh" >&2
  exit 1
fi

exec hermes dashboard --no-open --host 0.0.0.0 --port 9119 --skip-build "$@"
