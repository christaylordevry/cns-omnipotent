#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="$REPO_ROOT/scripts/hermes-skill-examples/awareness-sync"

DEST_DIR="${HOME}/.hermes/skills/cns/awareness-sync"

if [[ ! -d "$SRC_DIR" ]]; then
  echo "install-hermes-skill-awareness-sync: source dir missing: $SRC_DIR" >&2
  exit 1
fi

mkdir -p "$DEST_DIR"

# Copy skill payload (no secrets).
if cp -a "$SRC_DIR/." "$DEST_DIR/" 2>/dev/null; then
  :
else
  # macOS/BSD cp does not support -a
  cp -R "$SRC_DIR/." "$DEST_DIR/"
fi

echo "Installed Hermes skill to: $DEST_DIR"
echo "Next: bind awareness-sync in #hermes via ~/.hermes/config.yaml (see $DEST_DIR/references/config-snippet.md)."
echo "Ensure ~/.hermes/awareness-pull.env exists (from scripts/awareness-pull.env.example)."
