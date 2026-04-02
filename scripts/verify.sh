#!/usr/bin/env bash
set -euo pipefail

echo "==> Factory verify gate"

ran_any=0

# Node / TS projects
if [[ -f package.json ]]; then
  ran_any=1
  echo "==> Node project detected"
  npm -s test || { echo "TESTS failed"; exit 1; }

  if npm -s run | grep -qE ' lint'; then npm -s run lint; else echo "(skip) no lint script"; fi
  if npm -s run | grep -qE ' typecheck'; then npm -s run typecheck; else echo "(skip) no typecheck script"; fi
  if npm -s run | grep -qE ' build'; then npm -s run build; else echo "(skip) no build script"; fi
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
