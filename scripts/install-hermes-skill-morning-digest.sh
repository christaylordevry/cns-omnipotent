#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="$REPO_ROOT/scripts/hermes-skill-examples/morning-digest"

DEST_DIR="${HOME}/.hermes/skills/cns/morning-digest"

if [[ ! -d "$SRC_DIR" ]]; then
  echo "install-hermes-skill-morning-digest: source dir missing: $SRC_DIR" >&2
  exit 1
fi

mkdir -p "$DEST_DIR"

# Mirror repo tree exactly; prune stale files (parity with session-close install).
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
echo "Next: bind morning-digest in #hermes via ~/.hermes/config.yaml (see $DEST_DIR/references/config-snippet.md)."
echo "Cron: bash scripts/install-morning-digest-cron.sh (default 07:00 Australia/Sydney; see $DEST_DIR/references/cron-snippet.md)."
echo "Migration: comment out legacy 26-7 WSL crontab line in Operator Guide §15.2 — keep scripts as fallback."
echo "NotebookLM: Vault context requires notebook-query scripts in repo (51-1) and nlm on PATH."
