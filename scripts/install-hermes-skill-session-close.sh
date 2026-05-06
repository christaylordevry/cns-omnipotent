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

# Copy skill payload only. It contains no secrets.
cp -a "$SRC_DIR/." "$DEST_DIR/"

echo "Installed Hermes skill to: $DEST_DIR"
echo "Next: bind /session-close in #hermes via ~/.hermes/config.yaml if needed."
