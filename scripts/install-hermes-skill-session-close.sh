#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="$REPO_ROOT/scripts/hermes-skill-examples/session-close"
DEST_DIR="${HOME}/.hermes/skills/cns/session-close"

if [[ ! -d "$SRC_DIR" ]]; then
  echo "install-hermes-skill-session-close: source dir missing: $SRC_DIR" >&2
  exit 1
fi

mkdir -p "$DEST_DIR"

# Mirror repo tree exactly; prune stale files (e.g. references/task-prompt.md).
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
  rm -f "$DEST_DIR/references/task-prompt.md"
fi

echo "Installed Hermes skill to: $DEST_DIR"
echo "Next: bind /session-close in #hermes via ~/.hermes/config.yaml if needed."
