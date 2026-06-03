#!/usr/bin/env bash
# Hermes / minimal-PATH prelude for npm invocations (Story 43-1, SC-2).
# Usage: source "$(dirname "$0")/npm-env.sh" && npm test
#
# Hermes terminal isolation sets HOME to ${HERMES_HOME}/home for subprocesses.
# nvm and project node_modules live under the operator's real home — resolve that
# before prepending Node to PATH (Story 59-2).
_operator_home="${OPERATOR_HOME:-$HOME}"
if [[ -n "${HERMES_HOME:-}" && "$HOME" == "${HERMES_HOME}/home"* ]]; then
  _passwd_home="$(getent passwd "${USER:-$(whoami 2>/dev/null)}" 2>/dev/null | cut -d: -f6)"
  if [[ -n "${_passwd_home}" ]]; then
    _operator_home="${_passwd_home}"
  fi
fi
export HOME="${_operator_home}"
export OPERATOR_HOME="${_operator_home}"
NODE_BIN="$(ls -d "${_operator_home}/.nvm/versions/node/"*/bin 2>/dev/null | sort -V | tail -1)"
export PATH="${NODE_BIN:-${_operator_home}/.nvm/versions/node/v24.14.0/bin}:${PATH}"
