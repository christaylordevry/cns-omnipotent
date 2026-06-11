#!/usr/bin/env bash
# Install gateway hook for morning-digest Convex completion (Story 68-10).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_HOOK="$REPO_ROOT/scripts/hermes-hooks/morning-digest-convex-completion"
DEST_HOOK="${HERMES_HOME:-$HOME/.hermes}/hooks/morning-digest-convex-completion"

if [[ ! -f "$SRC_HOOK/HOOK.yaml" || ! -f "$SRC_HOOK/handler.py" ]]; then
  echo "install-morning-digest-convex-completion-hook: missing source hook files" >&2
  exit 1
fi

mkdir -p "$(dirname "$DEST_HOOK")"
rm -rf "$DEST_HOOK"
cp -a "$SRC_HOOK" "$DEST_HOOK"

echo "Installed morning-digest Convex completion hook:"
echo "  $DEST_HOOK"
echo "Restart Hermes gateway to load hook: hermes gateway restart"
