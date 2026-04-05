#!/usr/bin/env bash
# Export vault markdown under 01-Projects and 03-Resources into one NotebookLM-friendly source file.
# Usage: from repo root, `bash scripts/export-vault-for-notebooklm.sh`
# Override vault root: CNS_VAULT_ROOT=/path/to/vault bash scripts/export-vault-for-notebooklm.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VAULT="${CNS_VAULT_ROOT:-/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE}"
OUT_DIR="$REPO_ROOT/scripts/output"
OUT_FILE="$OUT_DIR/vault-export-for-notebooklm.md"

if [[ ! -d "$VAULT" ]]; then
  echo "error: vault directory not found: $VAULT (set CNS_VAULT_ROOT)" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
TMP_LIST="$(mktemp)"
trap 'rm -f "$TMP_LIST"' EXIT

# Collect paths: only 01-Projects and 03-Resources; exclude subtree patterns and _README* names.
collect() {
  local base="$1"
  if [[ ! -d "$base" ]]; then
    return 0
  fi
  find "$base" -type f -name '*.md' \
    ! -path '*/_meta/*' \
    ! -path '*/AI-Context/*' \
    ! -path '*/00-Inbox/*' \
    ! -path '*/04-Archives/*' \
    ! -path '*/DailyNotes/*' \
    ! -name '_README*'
}

{
  collect "$VAULT/01-Projects"
  collect "$VAULT/03-Resources"
} | sort -u >"$TMP_LIST"

FILE_COUNT="$(wc -l <"$TMP_LIST" | tr -d ' ')"

{
  echo "# Vault export for NotebookLM"
  echo ""
  echo "- **Export date (UTC):** $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  echo "- **Vault root:** $VAULT"
  echo "- **Files included:** $FILE_COUNT"
  echo "- **NotebookLM hints:** Google NotebookLM sources are often cited around ~500K words or ~200MB per source; confirm current limits in the product UI before upload."
  echo ""

  while IFS= read -r abs; do
    [[ -n "$abs" ]] || continue
    rel="${abs#"$VAULT"/}"
    echo "## Source: $rel"
    echo ""
    cat "$abs"
    echo ""
    echo ""
  done <"$TMP_LIST"
} >"$OUT_FILE"

BYTES="$(wc -c <"$OUT_FILE" | tr -d ' ')"
HUMAN="$(du -h "$OUT_FILE" | cut -f1)"

echo "Wrote $OUT_FILE"
echo "Files: $FILE_COUNT | Size: $HUMAN ($BYTES bytes)"
