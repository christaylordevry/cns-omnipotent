#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

exec node "$REPO_ROOT/scripts/hermes-skill-examples/morning-digest/scripts/fetch-perplexity-signal.mjs" "$1"
