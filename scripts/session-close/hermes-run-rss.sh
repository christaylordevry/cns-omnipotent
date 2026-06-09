#!/usr/bin/env bash
set -euo pipefail

export PATH="$HOME/.pyenv/shims:$HOME/.pyenv/bin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

exec node "$REPO_ROOT/scripts/hermes-skill-examples/morning-digest/scripts/fetch-rss-signals.mjs"
