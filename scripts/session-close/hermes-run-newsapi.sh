#!/usr/bin/env bash
set -euo pipefail

# Hermes profile-isolates skill subprocesses under {HERMES_HOME}/home (Epic 59),
# so $HOME becomes e.g. /home/christ/.hermes/home. Remap HOME back to the real
# operator home so $HOME/.pyenv and $HOME/.hermes/trend-ingest.env resolve
# correctly. Mirrors operator-home.mjs (inferOperatorHomeFromHome) — direct
# inference, no deps.
if [[ "$HOME" == */.hermes/home || "$HOME" == */.hermes/home/* ]]; then
  OPERATOR_HOME="${HOME%%/.hermes/home*}"
  if [[ -n "$OPERATOR_HOME" ]]; then
    export HOME="$OPERATOR_HOME"
  fi
fi

export PATH="$HOME/.pyenv/shims:$HOME/.pyenv/bin:$PATH"

ENV_FILE="$HOME/.hermes/trend-ingest.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo '{"error":"missing trend-ingest.env"}'
  exit 0
fi

while IFS='=' read -r name value; do
  [[ "$name" =~ ^[[:space:]]*# ]] && continue
  [[ -z "$name" ]] && continue
  name="${name// /}"
  if [[ "$name" == "NEWSAPI_API_KEY" ]]; then
    export NEWSAPI_API_KEY="${value//\"/}"
    export NEWSAPI_API_KEY="${NEWSAPI_API_KEY//\'/}"
  fi
done < "$ENV_FILE"

if [[ -z "${NEWSAPI_API_KEY:-}" ]]; then
  echo '{"error":"missing NEWSAPI_API_KEY"}'
  exit 0
fi

python3 - <<'PY'
import json, os, urllib.parse, urllib.request

key = os.environ.get("NEWSAPI_API_KEY", "")
params = urllib.parse.urlencode({
    "q": "(\"artificial intelligence\" OR \"AI agents\" OR automation) AND NOT sports",
    "sortBy": "publishedAt",
    "pageSize": "5",
    "language": "en",
    "apiKey": key,
})
try:
    with urllib.request.urlopen("https://newsapi.org/v2/everything?" + params, timeout=20) as r:
        payload = json.loads(r.read().decode())
except Exception as exc:
    print(json.dumps({"error": type(exc).__name__}))
    raise SystemExit(0)

if payload.get("status") != "ok":
    print(json.dumps({"error": payload.get("code") or "newsapi error"}))
    raise SystemExit(0)

headlines = [a.get("title","").strip() for a in payload.get("articles",[]) if a.get("title","").strip()]
print(json.dumps({"headlines": headlines[:5]}))
PY
