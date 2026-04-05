#!/usr/bin/env bash
set -euo pipefail

# Resolve repo root so this script works when invoked from any cwd.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "$REPO_ROOT"

echo "==> Factory verify gate (repo: ${REPO_ROOT})"

ran_any=0

# True if package.json defines scripts.<name> with a non-empty string.
# Note: `npm pkg get scripts.missing` can print "{}"; do not treat that as a script.
npm_has_script() {
  local name="$1"
  node -e "const s=require('./package.json').scripts||{}; const n=process.argv[1]; process.exit(typeof s[n]==='string'&&s[n].length>0?0:1);" "$name"
}

require_npm_script() {
  local name="$1"
  if ! npm_has_script "$name"; then
    echo "FATAL: package.json must define a non-empty scripts.${name} (Story 6.3 gate)."
    exit 1
  fi
}

run_npm_script_optional() {
  local name="$1"
  if npm_has_script "$name"; then
    echo "==> npm run ${name}"
    npm run -s "$name"
  else
    echo "(skip) no ${name} script in package.json"
  fi
}

# Node / TS projects
if [[ -f package.json ]]; then
  ran_any=1
  echo "==> Node project detected"
  require_npm_script test
  require_npm_script lint
  require_npm_script typecheck

  echo "==> npm run test (includes constitution mirror parity via tests/constitution.test.mjs)"
  npm test || { echo "TESTS failed"; exit 1; }

  echo "==> npm run lint"
  npm run -s lint || { echo "LINT failed"; exit 1; }

  echo "==> npm run typecheck"
  npm run -s typecheck || { echo "TYPECHECK failed"; exit 1; }

  # Optional compile check (not one of the three required gate steps; failures still fail the script)
  run_npm_script_optional build
fi

# Python projects
if [[ -f pyproject.toml || -f requirements.txt ]]; then
  ran_any=1
  echo "==> Python project detected"
  if command -v pytest >/dev/null 2>&1; then
    pytest -q
  else
    echo "pytest not found. Install it or add your own Python gate."
    exit 1
  fi
fi

if [[ "$ran_any" -eq 0 ]]; then
  echo "No project runtime detected (no package.json / pyproject.toml)."
  echo "This is expected on day-0. Your first agent task should scaffold the project + gates."
  exit 1
fi

echo "==> VERIFY PASSED"
