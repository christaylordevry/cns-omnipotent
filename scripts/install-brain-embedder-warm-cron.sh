#!/usr/bin/env bash
# Install WSL user crontab line for Portal embedder warm-keep (Story 82-6).
# Requires embedder_warm_keep.enabled=true in config/brain-recall-policy.json.
#
# Uninstall: bash scripts/install-brain-embedder-warm-cron.sh --uninstall
# Also removes hermes-dashboard ExecStartPost drop-in when --uninstall is passed.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
POLICY_FILE="$REPO_ROOT/config/brain-recall-policy.json"
LOG_FILE="${BRAIN_EMBEDDER_WARM_LOG:-$HOME/.hermes/logs/brain-embedder-warm.log}"
ENV_FILE="${BRAIN_RECALL_ENV:-$HOME/.hermes/brain-recall.env}"
SYSTEMD_USER_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
CRON_TAG="cns-brain-embedder-warm"
DASHBOARD_DROPIN="embedder-warm-post.conf"

read_policy() {
  node -e "
const fs = require('node:fs');
const p = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
const b = p.embedder_warm_keep || {};
const enabled = b.enabled === true;
const interval = b.ping_interval_minutes === undefined ? 10 : Number(b.ping_interval_minutes);
if (!Number.isInteger(interval) || interval < 1 || interval > 59) {
  console.error('embedder_warm_keep.ping_interval_minutes must be an integer from 1 to 59.');
  process.exit(1);
}
process.stdout.write([enabled, interval, b.warm_on_dashboard_start !== false].join(' '));
" "$POLICY_FILE"
}

usage() {
  cat <<EOF
Usage: $0 [--uninstall]

Installs periodic warm ping cron when embedder_warm_keep.enabled is true in policy.
Interval from policy embedder_warm_keep.ping_interval_minutes (default 10).

Uninstall removes cron tag and dashboard ExecStartPost drop-in.
EOF
}

remove_cron_tag() {
  local existing filtered
  existing="$(crontab -l 2>/dev/null || true)"
  filtered="$(printf '%s\n' "$existing" | grep -v "$CRON_TAG" | sed '/^[[:space:]]*$/d' || true)"
  if [[ -n "$filtered" ]]; then
    printf '%s\n' "$filtered" | crontab -
  else
    crontab -r 2>/dev/null || true
  fi
}

remove_dashboard_dropin() {
  local dest="$SYSTEMD_USER_DIR/hermes-dashboard.service.d/$DASHBOARD_DROPIN"
  if [[ -f "$dest" ]]; then
    rm -f "$dest"
    echo "Removed $dest"
  fi
}

install_dashboard_dropin() {
  local warm_on_start repo_root runner dest
  read -r enabled ping_interval_minutes warm_on_dashboard_start < <(read_policy)

  if [[ "$warm_on_dashboard_start" != "true" ]]; then
    remove_dashboard_dropin
    return 0
  fi

  if [[ ! -f "$ENV_FILE" ]]; then
    echo "WARNING: $ENV_FILE missing — dashboard warm Post uses REPO_ROOT fallback" >&2
    repo_root="$REPO_ROOT"
  else
    repo_root="$(grep -E '^CNS_OMNIPOTENT_ROOT=' "$ENV_FILE" 2>/dev/null | tail -1 | sed -E "s/^CNS_OMNIPOTENT_ROOT=//; s/^['\"]//; s/['\"]$//" || true)"
    repo_root="${repo_root:-$REPO_ROOT}"
  fi

  runner="$repo_root/scripts/run-brain-embedder-warm.sh"
  dest="$SYSTEMD_USER_DIR/hermes-dashboard.service.d/$DASHBOARD_DROPIN"
  mkdir -p "$(dirname "$dest")"
  cat >"$dest" <<EOF
[Service]
ExecStartPost=/bin/bash -c 'if test -x "$runner"; then nohup "$runner" >/dev/null 2>&1 & fi'
EOF
  echo "Wrote $dest"
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

if [[ "${1:-}" == "--uninstall" ]]; then
  remove_cron_tag
  remove_dashboard_dropin
  systemctl --user daemon-reload 2>/dev/null || true
  echo "Uninstalled brain-embedder-warm cron and dashboard drop-in."
  exit 0
fi

mkdir -p "$(dirname "$LOG_FILE")"
RUNNER="$REPO_ROOT/scripts/run-brain-embedder-warm.sh"
chmod +x "$RUNNER"

read -r enabled ping_interval_minutes warm_on_dashboard_start < <(read_policy)

if [[ "$enabled" != "true" ]]; then
  remove_cron_tag
  remove_dashboard_dropin
  echo "embedder_warm_keep.enabled is false — cron and dashboard drop-in removed (no-op install)."
  echo "Set enabled:true in $POLICY_FILE then re-run this script."
  exit 0
fi

CRON_LINE="*/${ping_interval_minutes} * * * * /bin/bash \"$RUNNER\" # $CRON_TAG"
EXISTING="$(crontab -l 2>/dev/null || true)"
FILTERED="$(printf '%s\n' "$EXISTING" | grep -v "$CRON_TAG" | sed '/^[[:space:]]*$/d' || true)"
{
  printf '%s\n' "$FILTERED"
  printf '%s\n' "$CRON_LINE"
} | crontab -

install_dashboard_dropin
systemctl --user daemon-reload 2>/dev/null || true

echo "Installed brain-embedder-warm cron every ${ping_interval_minutes} min."
echo "Log: $LOG_FILE"
echo "Line: $CRON_LINE"
echo "Policy: $POLICY_FILE (embedder_warm_keep.enabled=true)"
