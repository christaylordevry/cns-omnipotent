#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="$REPO_ROOT/scripts/hermes-skill-examples/triage"

DEST_DIR="${HOME}/.hermes/skills/cns/triage"

if [[ ! -d "$SRC_DIR" ]]; then
  echo "install-hermes-skill-triage: source dir missing: $SRC_DIR" >&2
  exit 1
fi

mkdir -p "$DEST_DIR"

# Copy skill payload (no secrets).
cp -a "$SRC_DIR/." "$DEST_DIR/"

echo "Installed Hermes skill to: $DEST_DIR"
echo "Next: bind /triage in #hermes via ~/.hermes/config.yaml (see $DEST_DIR/references/config-snippet.md)."
