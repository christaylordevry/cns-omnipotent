#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="$REPO_ROOT/scripts/hermes-skill-examples/vault-think"

DEST_DIR="${HOME}/.hermes/skills/cns/vault-think"

if [[ ! -d "$SRC_DIR" ]]; then
  echo "install-hermes-skill-vault-think: source dir missing: $SRC_DIR" >&2
  exit 1
fi

mkdir -p "$DEST_DIR"

cp -a "$SRC_DIR/." "$DEST_DIR/"

echo "Installed Hermes skill to: $DEST_DIR"
echo "Next: add vault-think to discord.channel_skill_bindings for #hermes and extend channel_prompts per Omnipotent story 29-10."
