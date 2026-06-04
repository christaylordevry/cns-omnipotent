# Morning digest pick-signal routing notes

## Purpose

Capture the debugging lessons from the `morning-digest-pick-signal-notebook.test.mjs` failure where the router returned `NO_ROUTE` unexpectedly.

## Durable lessons

- The notebook registry path must be treated as an explicit absolute path in tests when the harness sets `CNS_NOTEBOOK_REGISTRY_PATH`. Relative values can resolve against the repo root in unexpected ways.
- The pick-signal CLI should accept a registry path from `process.argv[3]` first, then fall back to `CNS_NOTEBOOK_REGISTRY_PATH`, then the default registry location.
- Isolated routing tests should clear unrelated digest payload env such as `DIGEST_SOURCES_JSON` so they exercise the scorer/router only.
- If a direct CLI reproduction returns `NO_ROUTE`, verify both the registry path and the active watched registry contents before changing the scorer logic.

## Repro recipe

```bash
CNS_NOTEBOOK_REGISTRY_PATH="/absolute/path/to/tests/fixtures/mock-notebook-registry.json" \
  node scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs \
  '{"trends":[],"headlines":[],"deep_signal":"..."}'

node --test tests/morning-digest-pick-signal-notebook.test.mjs
```

## Verification

- `npm test` passes
- `tests/morning-digest-pick-signal-notebook.test.mjs` no longer fails with `actual: 'NO_ROUTE', expected: 'ROUTED'`
