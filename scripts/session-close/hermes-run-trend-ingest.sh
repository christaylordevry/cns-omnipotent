#!/usr/bin/env bash
set -euo pipefail

export PATH="$HOME/.pyenv/shims:$HOME/.pyenv/bin:$PATH"
REPO="${OMNIPOTENT_REPO:-$HOME/ai-factory/projects/Omnipotent.md}"
exec python3 "$REPO/scripts/trend-ingest.py" --dry-run --sources google_trends
