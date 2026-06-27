#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="$REPO_ROOT/scripts/hermes-plugin-examples/cns-brain-recall"
HERMES_ROOT="${HERMES_HOME:-${HOME}/.hermes}"
DEST_DIR="${HERMES_ROOT}/plugins/cns-brain-recall"

if [[ ! -d "$SRC_DIR" ]]; then
  echo "install-hermes-plugin-cns-brain-recall: source dir missing: $SRC_DIR" >&2
  exit 1
fi

if [[ -z "$HERMES_ROOT" || "$HERMES_ROOT" == "/" ]]; then
  echo "install-hermes-plugin-cns-brain-recall: unsafe Hermes root: $HERMES_ROOT" >&2
  exit 1
fi

mkdir -p "$(dirname "$DEST_DIR")"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

TMP_PLUGIN_DIR="$TMP_DIR/cns-brain-recall"
mkdir -p "$TMP_PLUGIN_DIR"

(
  cd "$SRC_DIR"
  tar --exclude="__pycache__" --exclude="*/__pycache__" --exclude="*.pyc" -cf - .
) | (
  cd "$TMP_PLUGIN_DIR"
  tar -xf -
)

rm -rf "$DEST_DIR"
mv "$TMP_PLUGIN_DIR" "$DEST_DIR"

echo "Installed Hermes plugin to: $DEST_DIR"
echo "Next: hermes plugins enable cns-brain-recall"
echo "Config snippet: $DEST_DIR/references/config-snippet.md"
