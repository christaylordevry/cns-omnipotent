#!/usr/bin/env bash
# Story 82-5 — brain-recall.env + systemd drop-ins for gateway and dashboard parity.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
SYSTEMD_USER_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"

resolve_nvm_bin_dir() {
  local bin_dir=""
  bin_dir="$(ls -d "$HOME/.nvm/versions/node/"*/bin 2>/dev/null | sort -V | tail -1 || true)"
  if [[ -z "$bin_dir" ]]; then
    echo "install-hermes-brain-recall-env: no nvm node bin dir under ~/.nvm/versions/node" >&2
    exit 1
  fi
  echo "$bin_dir"
}

default_path_suffix() {
  echo "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
}

shell_quote() {
  local value="$1"
  printf "'%s'" "${value//\'/\'\\\'\'}"
}

env_value_or_default() {
  local env_file="$1"
  local key="$2"
  local default_value="$3"
  local existing=""
  existing="$(grep -E "^${key}=" "$env_file" 2>/dev/null | tail -1 | cut -d= -f2- || true)"
  if [[ -z "$existing" ]]; then
    echo "$default_value"
    return 0
  fi
  if [[ "$existing" =~ ^\"(.*)\"$ ]]; then
    echo "${BASH_REMATCH[1]}"
    return 0
  fi
  if [[ "$existing" =~ ^\'(.*)\'$ ]]; then
    echo "${BASH_REMATCH[1]}"
    return 0
  fi
  echo "$existing"
}

write_normalized_brain_recall_env() {
  local env_file="$1"
  local nvm_bin node_bin tmp_file
  nvm_bin="$(resolve_nvm_bin_dir)"
  node_bin="$nvm_bin/node"
  tmp_file="$(mktemp)"

  {
    printf 'CNS_OMNIPOTENT_ROOT=%s\n' "$(shell_quote "$(env_value_or_default "$env_file" CNS_OMNIPOTENT_ROOT "$REPO_ROOT")")"
    printf 'CNS_BRAIN_INDEX_PATH=%s\n' "$(shell_quote "$(env_value_or_default "$env_file" CNS_BRAIN_INDEX_PATH "$HERMES_HOME/brain/brain-index.json")")"
    printf 'CNS_VAULT_ROOT=%s\n' "$(shell_quote "$(env_value_or_default "$env_file" CNS_VAULT_ROOT "/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE")")"
    printf 'CNS_BRAIN_EMBEDDER=%s\n' "$(shell_quote "$(env_value_or_default "$env_file" CNS_BRAIN_EMBEDDER "portal")")"
    printf 'CNS_NODE_BIN=%s\n' "$(shell_quote "$(env_value_or_default "$env_file" CNS_NODE_BIN "$node_bin")")"
  } >"$tmp_file"

  install -m 600 "$tmp_file" "$env_file"
  rm -f "$tmp_file"
}

write_brain_recall_env() {
  local env_file="$HERMES_HOME/brain-recall.env"
  mkdir -p "$HERMES_HOME"
  if [[ -f "$env_file" ]]; then
    if grep -q '^PATH=' "$env_file"; then
      echo "WARNING: $env_file contains PATH= — remove it; use env.conf drop-in for PATH" >&2
    fi
    write_normalized_brain_recall_env "$env_file"
    echo "Validated brain-recall.env: $env_file"
    return 0
  fi

  write_normalized_brain_recall_env "$env_file"
  echo "Created template brain-recall.env: $env_file"
}

write_drop_in() {
  local service="$1"
  local name="$2"
  local content="$3"
  local dir="$SYSTEMD_USER_DIR/${service}.d"
  mkdir -p "$dir"
  printf '%s\n' "$content" >"$dir/$name"
  echo "Wrote $dir/$name"
}

install_brain_recall_dropin() {
  local service="$1"
  local dir="$SYSTEMD_USER_DIR/${service}.d"
  local dest="$dir/brain-recall.conf"
  if [[ -f "$dest" ]]; then
    if grep -Fq 'EnvironmentFile=-%h/.hermes/brain-recall.env' "$dest"; then
      echo "Validated brain-recall.conf for $service"
      return 0
    fi
    echo "Refreshing invalid brain-recall.conf for $service"
  fi
  write_drop_in "$service" "brain-recall.conf" "[Service]
EnvironmentFile=-%h/.hermes/brain-recall.env"
}

install_env_conf_dropin() {
  local service="$1"
  local dir="$SYSTEMD_USER_DIR/${service}.d"
  local dest="$dir/env.conf"

  local nvm_bin path_line
  nvm_bin="$(resolve_nvm_bin_dir)"
  path_line="Environment=PATH=${nvm_bin}:$(default_path_suffix)"
  if [[ -f "$dest" ]]; then
    if grep -Fq "$path_line" "$dest"; then
      echo "Validated env.conf for $service"
      return 0
    fi
    echo "Refreshing invalid env.conf for $service"
  fi
  write_drop_in "$service" "env.conf" "[Service]
$path_line"
}

install_service_dropins() {
  local service="$1"
  install_brain_recall_dropin "$service"
  install_env_conf_dropin "$service"
}

write_brain_recall_env
install_service_dropins "hermes-dashboard.service"
install_service_dropins "hermes-gateway.service"

cat <<EOF

Next steps:
  systemctl --user daemon-reload
  systemctl --user restart hermes-dashboard.service
  systemctl --user restart hermes-gateway.service   # optional — only if gateway drop-ins were added

Verify dashboard env:
  tr '\\0' '\\n' < /proc/\$(systemctl --user show hermes-dashboard.service -p MainPID --value)/environ | grep -E 'CNS_BRAIN_INDEX_PATH|CNS_NODE_BIN|^PATH='
EOF
