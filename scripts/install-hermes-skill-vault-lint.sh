#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="$REPO_ROOT/scripts/hermes-skill-examples/vault-lint"
DEST_DIR="${HOME}/.hermes/skills/cns/vault-lint"

if [[ ! -d "$SRC_DIR" ]]; then
  echo "install-hermes-skill-vault-lint: source dir missing: $SRC_DIR" >&2
  exit 1
fi

mkdir -p "$DEST_DIR"

cp -a "$SRC_DIR/." "$DEST_DIR/"

echo "Installed Hermes skill to: $DEST_DIR"
