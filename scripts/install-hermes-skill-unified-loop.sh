#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="$REPO_ROOT/scripts/hermes-skill-examples/unified-loop"

DEST_DIR="${HOME}/.hermes/skills/cns/unified-loop"

if [[ ! -d "$SRC_DIR" ]]; then
  echo "install-hermes-skill-unified-loop: source dir missing: $SRC_DIR" >&2
  exit 1
fi

mkdir -p "$DEST_DIR"

# Mirror repo tree exactly; prune stale files (parity with morning-digest install).
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete "$SRC_DIR/" "$DEST_DIR/"
else
  rm -rf "$DEST_DIR"
  mkdir -p "$DEST_DIR"
  if cp -a "$SRC_DIR/." "$DEST_DIR/" 2>/dev/null; then
    :
  else
    cp -R "$SRC_DIR/." "$DEST_DIR/"
  fi
fi

echo "Installed Hermes skill to: $DEST_DIR"
echo "Next: bind unified-loop in #hermes via ~/.hermes/config.yaml (see $DEST_DIR/references/config-snippet.md)."
echo "Cron: bash scripts/install-unified-loop-discover-cron.sh (Discover-only; see $DEST_DIR/references/cron-snippet.md)."
