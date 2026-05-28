#!/usr/bin/env bash
# Hermes / minimal-PATH prelude for npm invocations (Story 43-1, SC-2).
# Usage: source "$(dirname "$0")/npm-env.sh" && npm test
NODE_BIN="$(ls -d "${HOME}/.nvm/versions/node/"*/bin 2>/dev/null | sort -V | tail -1)"
export PATH="${NODE_BIN:-${HOME}/.nvm/versions/node/v24.14.0/bin}:${PATH}"
