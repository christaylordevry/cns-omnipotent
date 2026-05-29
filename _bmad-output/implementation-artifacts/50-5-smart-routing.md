---
baseline_commit: a9ee4a7f30a3b70da36bd951c9d783d5082190f3
---

# Story 50.5: Smart routing

Status: done

Epic: **50** (NotebookLM Full Integration)  
Tracked in sprint-status as: **`50-5-smart-routing`**

**Operator intent:** Wire the full pipeline (`registry → scorer → disambiguator`) into `readNotebookLmTargets` behind the `NOTEBOOK_SMART_ROUTING` environment flag. When the flag is set and env/watch overrides have not resolved a target, the function calls `extractScoringTopic(contextPack)` → `scoreNotebooks(topic, registry)` → `disambiguateRoute(result, registry)`. If the disambiguator returns `ROUTED`, that single notebook ID is used. Otherwise fall through to project-map parsing. No new libraries, no LLM, no network.

## Story

As an **operator**,  
I want **session-close to automatically route vault exports to the most contextually relevant notebook when `NOTEBOOK_SMART_ROUTING=1` is set**,  
so that **I don't need to maintain explicit watch flags or project-map entries for notebooks that can be inferred from the current sprint/story context**.

## Acceptance Criteria

1. **Flag gate (AC: flag)**  
   **Given** `NOTEBOOK_SMART_ROUTING` env var is not set or is falsy (`0`, `false`, empty string)  
   **When** `readNotebookLmTargets` resolves targets  
   **Then** smart routing step is completely skipped — behavior is identical to today (50-2 state)

   **Given** `NOTEBOOK_SMART_ROUTING=1` (or any truthy string)  
   **When** `readNotebookLmTargets` resolves targets  
   **Then** smart routing step is active between watch-list and project-map

2. **Routing precedence (AC: order)**  
   **When** `NOTEBOOK_SMART_ROUTING=1` and resolution is running  
   **Then** precedence is:
   - **Step 1 — env IDs:** `NOTEBOOKLM_NOTEBOOK_IDS` (process env or `~/.hermes/session-close.env`) wins when non-empty — **unchanged**
   - **Step 2 — watch-list:** one or more `watch: true` registry entries win — **unchanged**
   - **Step 3 — smart routing (NEW):** `extractScoringTopic(contextPack)` → `scoreNotebooks(topic, registry)` → `disambiguateRoute(result, registry)`; if `ROUTED`, return single target
   - **Step 4 — project-map:** parse `NotebookLM-Project-Map.md` — **unchanged fallback**
   - **Step 5 — empty:** return `[]` — **unchanged**

3. **Smart routing step (AC: routing)**  
   **Given** smart routing is active and env/watch did not resolve  
   **When** `disambiguateRoute` returns `{ status: 'ROUTED', id, title }`  
   **Then** return exactly one target:
   ```js
   [{ notebook_id: id, title, source_name: 'CNS Vault Export', source_type: 'file', file_path: exportPath }]
   ```
   **When** `disambiguateRoute` returns `{ status: 'NO_ROUTE' }`  
   **Then** fall through to project-map (no error, no log)

4. **Context passing (AC: context)**  
   **When** `readNotebookLmTargets(vaultRoot, exportPath, options)` is called  
   **Then** `options.contextPack` carries the context for topic extraction (may be `undefined` when called without smart routing)  
   **And** `extractScoringTopic` is called with `options.contextPack` (or `undefined` → returns `""` → scorer returns NO_ROUTE → falls through — safe)

   **When** `buildContextPack` in `prepare-context.mjs` calls `readNotebookLmTargets`  
   **Then** it passes a partial context object `{ sprint, recent_stories }` as `options.contextPack`  
   (The full pack isn't ready yet; these two fields are collected before the call.)

5. **Logging (AC: log)**  
   **When** smart routing produces a ROUTED result  
   **Then** `process.stderr.write` (or `console.error`) logs:  
   `[smart-routing] ROUTED → <title> (<id>) via <reason>`  
   **When** smart routing produces NO_ROUTE  
   **Then** no log output (silent fall-through, not an error)  
   **When** smart routing throws (any error in scorer/disambiguator)  
   **Then** log `[smart-routing] error: <message>` to stderr and fall through — never crash fan-out

6. **Tests (AC: tests)**  
   **Then** `tests/smart-routing.test.mjs` uses `node:test` + `node:assert/strict`, fixtures only (no live `nlm`, no network)  
   **And** covers at minimum:
   - Flag unset → smart routing skipped; returns watch-list (or project-map if watch empty)
   - Flag set, disambiguator ROUTED → single target returned with correct shape
   - Flag set, disambiguator NO_ROUTE → falls through to project-map fixture
   - Flag set, watch-list populated → watch-list still wins (smart routing never reached)
   - Flag set, env IDs set → env still wins (smart routing never reached)
   - Flag set, scorer/disambiguator throws → falls through gracefully (no crash)
   - Context passed to extractor: contextPack with sprint active_epics → scoring topic used

   **And** `bash scripts/verify.sh` passes

7. **Scope boundaries (AC: non-goals)**  
   **Then** this story does **not**:
   - Change the env-IDs or watch-list precedence levels
   - Call `nlm` or any network API
   - Change `scoreNotebooks` or `disambiguateRoute` implementations
   - Add vault IO, WriteGate, or MCP tool changes
   - Alter the context pack schema fields (only passes existing fields as `contextPack`)
   - Auto-run `sync-notebooks` (registry must be pre-synced by operator)

## Tasks / Subtasks

- [x] Add `smartRoute(registry, exportPath, contextPack)` helper to `read-sources.mjs` — calls `extractScoringTopic` → `scoreNotebooks` → `disambiguateRoute`; returns target array or `null` (AC: routing, log)
- [x] Wire `smartRoute` into `readNotebookLmTargets` at Step 3 behind `NOTEBOOK_SMART_ROUTING` flag (AC: flag, order)
- [x] Update `buildContextPack` in `prepare-context.mjs` to pass `{ sprint, recent_stories }` as `options.contextPack` to `readNotebookLmTargets` (AC: context)
- [x] Add `tests/smart-routing.test.mjs` (AC: tests)
- [x] Run `bash scripts/verify.sh` (AC: tests)

## Dev Notes

### Pipeline call chain

```js
// Inside readNotebookLmTargets, after watch-list check:
if (process.env.NOTEBOOK_SMART_ROUTING && isTruthy(process.env.NOTEBOOK_SMART_ROUTING)) {
  const result = await smartRoute(registry, exportPath, options.contextPack);
  if (result) return result;
}
// fall through to project-map
```

```js
async function smartRoute(registry, exportPath, contextPack) {
  try {
    const topic = extractScoringTopic(contextPack);
    const scoreResult = scoreNotebooks(topic, registry);
    const route = disambiguateRoute(scoreResult, registry);
    if (route.status === 'ROUTED') {
      process.stderr.write(`[smart-routing] ROUTED → ${route.title} (${route.id}) via ${route.reason}\n`);
      return [{ notebook_id: route.id, title: route.title, source_name: 'CNS Vault Export', source_type: 'file', file_path: exportPath }];
    }
    return null; // NO_ROUTE → fall through
  } catch (err) {
    process.stderr.write(`[smart-routing] error: ${err instanceof Error ? err.message : String(err)}\n`);
    return null; // error → fall through
  }
}
```

### `isTruthy` helper

Check that the env var is not `'0'`, `'false'`, or `''`:
```js
function isTruthy(val) {
  return val !== '0' && val !== 'false' && val !== '';
}
```

### Context passing from `buildContextPack`

In `prepare-context.mjs`, the call to `readNotebookLmTargets` is currently:
```js
const notebooklm_targets = await readNotebookLmTargets(paths.vaultRoot, exportPath);
```

By the time this line executes, `sprint` and `recent_stories` are already assembled. Change to:
```js
const notebooklm_targets = await readNotebookLmTargets(paths.vaultRoot, exportPath, {
  contextPack: { sprint, recent_stories },
});
```

This passes just the two fields that `extractScoringTopic` uses. The full pack isn't needed and isn't ready yet.

### Import additions to `read-sources.mjs`

```js
import { scoreNotebooks } from './notebook-scorer.mjs';
import { disambiguateRoute, extractScoringTopic } from './notebook-disambiguate.mjs';
```

### Test approach

Use the exported `readNotebookLmTargets` function with a `registryPath` pointing to a temp fixture file and `contextPack` injected via `options`. Set/unset `NOTEBOOK_SMART_ROUTING` via `process.env` before each test case and restore it after.

For tests that verify smart routing runs the pipeline, use a registry fixture with a known `domain` and a `contextPack` whose topic keywords map to that domain via the scorer's F1 threshold.

**Example fixture for ROUTED test:**
```js
const registry = [
  { id: 'abc-123', title: 'CNS Vault Architecture', watch: false, domain: 'cns-brain', last_updated: null },
];
const contextPack = {
  sprint: { active_epics: [{ id: 'epic-50', stories: ['50-5-smart-routing ready-for-dev'] }] },
};
// extractScoringTopic → "smart routing" (slug keywords from story basename)
// scoreNotebooks("smart routing", registry) → likely NO_ROUTE (topic doesn't match cns-brain)
// So for a ROUTED test use a topic that matches:
const contextPack2 = {
  sprint: { active_epics: [{ id: 'epic-cns', stories: ['50-5-cns-vault-brain in-progress'] }] },
};
// extractScoringTopic → "cns vault brain" → scores against cns-brain domain → ROUTED
```

Actually, the simplest approach for tests is to use a registry entry whose domain/title matches a keyword that `extractScoringTopic` would produce. For the cns-brain domain, keywords include "cns", "vault", "brain". A story slug like `50-5-cns-vault-router` → keywords `["cns", "vault", "router"]` → F1 against `["cns", "vault", "pake", "brain", "cns", "brain"]` domain tokens.

Alternatively, pass a simple `contextPack` where `recent_stories[0].basename` contains words that match a registry entry's domain/title directly.

### Falsy env flag values

Treat `NOTEBOOK_SMART_ROUTING` as falsy when: not set, empty string, `'0'`, `'false'`. All other values (including `'1'`, `'true'`, `'yes'`) are truthy.

### Project structure

| Path | Action |
|------|--------|
| `scripts/session-close/lib/read-sources.mjs` | MODIFY — add `smartRoute` helper + wire into `readNotebookLmTargets` |
| `scripts/session-close/prepare-context.mjs` | MODIFY — pass `{ sprint, recent_stories }` as `options.contextPack` |
| `tests/smart-routing.test.mjs` | NEW |

### Architecture compliance

- **Spec-first:** No `specs/cns-vault-contract/` changes (repo-local operator tooling)
- **Verify gate:** `bash scripts/verify.sh` mandatory before done
- **WriteGate:** N/A
- **Security:** No secrets handled; smart routing reads only registry IDs/titles and sprint data

### Previous story intelligence

- **50-3 scorer:** `scoreNotebooks(topic, registry)` → `{ status: 'OK'|'NO_ROUTE', matches }`. SCORE_THRESHOLD = 0.75.
- **50-4 disambiguator:** `disambiguateRoute(scoreResult, registry)` → `{ status: 'ROUTED'|'NO_ROUTE', id, title, reason }`. `extractScoringTopic(contextPack)` → string ≤60 chars.
- **50-2 watch-list:** `notebookTargetsFromWatchRegistry(entries, exportPath)` — already imported in `read-sources.mjs`.
- **50-1 registry:** `readRegistry(registryPath)` + `DEFAULT_REGISTRY_PATH` already imported from `sync-notebooks.mjs`.

## References

- [Source: `scripts/session-close/lib/read-sources.mjs` — current `readNotebookLmTargets`, `notebookTargetsFromWatchRegistry`]
- [Source: `scripts/session-close/lib/notebook-scorer.mjs` — `scoreNotebooks` contract]
- [Source: `scripts/session-close/lib/notebook-disambiguate.mjs` — `disambiguateRoute`, `extractScoringTopic` contracts]
- [Source: `scripts/session-close/prepare-context.mjs` — `buildContextPack` call site]
- [Source: `50-4-disambiguation.md` — API contracts, forward context for 50-5]
- [Source: `50-2-watch-flag-fanout.md` — precedence order, registry IO patterns]
- [Source: `50-3-conservative-notebook-scorer.md` — SCORE_THRESHOLD, F1 semantics]

## Dev Agent Record

### Agent Model Used

Sonnet 4.6 (dev-story)

### Debug Log References

- `bash scripts/verify.sh` — VERIFY PASSED (2026-05-29), 219 node tests + vitest + cns-dashboard

### Implementation Plan

- Added `isTruthy(val)` helper (falsy = `""`, `"0"`, `"false"`; all other strings truthy).
- Added `smartRoute(registry, exportPath, contextPack)` — calls `extractScoringTopic` → `scoreNotebooks` → `disambiguateRoute`; logs ROUTED to stderr; returns target array or `null`; catches errors and falls through with stderr log.
- Wired `smartRoute` into `readNotebookLmTargets` after watch-list step; reads `NOTEBOOK_SMART_ROUTING` env var; calls `smartRoute` only when flag is truthy.
- Updated `readNotebookLmTargets` signature: `options.contextPack?: unknown` added; `registry` variable promoted in scope so it is available to `smartRoute` call even on registry-read-error (uses `[]` fallback).
- Updated `buildContextPack` in `prepare-context.mjs` to pass `{ sprint, recent_stories }` as `options.contextPack` to `readNotebookLmTargets` (both fields assembled before the call).

### Completion Notes List

- Routing precedence unchanged for env IDs and watch-list; smart routing inserts at Step 3 (between watch-list and project-map), guarded by `NOTEBOOK_SMART_ROUTING` flag.
- 12 new tests in `tests/smart-routing.test.mjs` covering flag gate (unset/0/false), ROUTED shape, sprint.active_epics topic path, NO_ROUTE fall-through, precedence (watch/env still win), and error resilience (empty registry, null/undefined contextPack).
- Tests isolate `HOME`, `NOTEBOOKLM_NOTEBOOK_IDS`, and `NOTEBOOK_SMART_ROUTING` env vars per test via `withIsolatedEnv` helper; no live nlm or network.
- `verify.sh` PASSED: 219 node tests (206 prior + 12 new + 1 adjusted) plus vitest and cns-dashboard.

### File List

- `scripts/session-close/lib/read-sources.mjs` (modified)
- `scripts/session-close/prepare-context.mjs` (modified)
- `tests/smart-routing.test.mjs` (new)

### Review Findings

- [x] [Review][Patch] Missing test: scorer/disambiguator throws → graceful fallthrough [tests/smart-routing.test.mjs]
- [x] [Review][Patch] `route.reason` can be `undefined` — log prints `via undefined` without guard [scripts/session-close/lib/read-sources.mjs:smartRoute]
- [x] [Review][Patch] No test for `NOTEBOOK_SMART_ROUTING=""` (empty string, falsy per spec, not exercised) [tests/smart-routing.test.mjs]
- [x] [Review][Defer] ROUTED target includes `title` field; env-ID targets do not — inconsistent shape across source types — deferred, pre-existing pattern
- [x] [Review][Defer] `process.stderr.write` in smartRoute vs `console.error` in adjacent catch block — style inconsistency, no functional impact — deferred, pre-existing
- [x] [Review][Defer] `route.title`/`route.id` undefined if disambiguateRoute violates ROUTED contract — pre-existing contract concern from 50-4 — deferred, pre-existing

### Change Log

- 2026-05-29: Story 50-5 created — smart routing pipeline wire-up behind NOTEBOOK_SMART_ROUTING flag.
- 2026-05-29: Implemented smartRoute helper + flag gate in readNotebookLmTargets; contextPack passed from buildContextPack; 12 tests; verify.sh PASSED → status: review.
