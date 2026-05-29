---
baseline_commit: cd931b5f2847c19ff1025da5024a6b0e2e2f4ca2
---

# Story 50.4: Disambiguation

Status: done

Epic: **50** (NotebookLM Full Integration)  
Tracked in sprint-status as: **`50-4-disambiguation`**

**Operator intent:** Add a **deterministic, offline** disambiguation layer that resolves a `NotebookScoreResult` (from Story 50-3) to a single notebook target. When the scorer returns one clear match, auto-select it. When it returns multiple, apply a structured tiebreak: prefer watch-flagged notebooks first, then take the top-ranked entry. Also deliver a `extractScoringTopic(contextPack)` helper that derives a short scoring topic from the session context pack, so 50-5 can feed topics into the scorer without guessing. No Hermes skill wiring, no session-close changes (50-5), no LLM, no network.

## Story

As an **operator**,  
I want **a disambiguation function that resolves multi-match scorer results to a single notebook target, plus a topic extractor that pulls a scoring topic from the context pack**,  
so that **Story 50-5 can wire the full scorer → disambiguate → route pipeline without implementing its own resolution policy**.

## Acceptance Criteria

1. **Disambiguation module (AC: module)**  
   **Given** a `NotebookScoreResult` and a registry array  
   **When** `disambiguateRoute(scoreResult, registry)` is called from `scripts/session-close/lib/notebook-disambiguate.mjs`  
   **Then** the function is **pure** (no `fs`, no `fetch`, no `child_process`, no env reads)  
   **And** accepts `scoreResult` typed as `NotebookScoreResult` (from 50-3) and `registry` as `NotebookRegistryEntry[]`

2. **Resolution policy (AC: policy)**  
   **When** `scoreResult.status === 'NO_ROUTE'`  
   **Then** return `{ status: 'NO_ROUTE', id: null, title: null, reason: 'no-route' }`

   **When** `scoreResult.status === 'OK'` and `matches.length === 1`  
   **Then** return `{ status: 'ROUTED', id: matches[0].id, title: matches[0].title, reason: 'single-match' }`

   **When** `scoreResult.status === 'OK'` and `matches.length > 1`  
   **Then** apply tiebreak **in this order**:
   - **Step 1 — watch-flag preference:** collect matches whose `id` is in the registry with `watch: true`; if exactly one is watch-flagged among the top matches, return it with `reason: 'watch-preferred'`
   - **Step 2 — top-ranked:** if zero or multiple are watch-flagged (no single winner), take `matches[0]` (already sorted by score desc → title asc → id asc by 50-3) with `reason: 'top-ranked'`  
   **And** never return more than one candidate

3. **Return shape (AC: shape)**  
   **Then** return type is:
   ```js
   /**
    * @typedef {{ status: 'ROUTED', id: string, title: string, reason: 'single-match' | 'watch-preferred' | 'top-ranked' }
    *         | { status: 'NO_ROUTE', id: null, title: null, reason: 'no-route' }} DisambiguationResult
    */
   ```
   **And** `id` and `title` are always the registry entry values (non-null only when `status: 'ROUTED'`)

4. **Topic extractor (AC: topic)**  
   **When** `extractScoringTopic(contextPack)` is called from the same module  
   **Then** derive a short topic string (≤ 60 chars, keyword-like) from the context pack without LLM  
   **And** extraction priority order:
   - **P1:** `contextPack.sprint?.active_epics` — join the epic `id` values of in-progress epics (e.g., `"epic-50 epic-49"`)
   - **P2:** `contextPack.recent_stories` — join the first story's key slug (e.g., `"50-3-conservative-notebook-scorer"`)
   - **P3:** fallback `""` (empty string → scorer returns NO_ROUTE, gracefully handled)  
   **And** the function strips numeric prefixes and hyphens from story keys into keywords (e.g., `"50-3-conservative-notebook-scorer"` → `"conservative notebook scorer"`)  
   **And** the function is **pure** (no IO)

5. **Edge inputs (AC: edges)**  
   **When** `registry` is `null`, `undefined`, or not an array  
   **Then** treat as `[]` (no watch-flagged entries available; tiebreak falls to top-ranked)  
   **When** `scoreResult` is malformed (missing `status` or `matches`)  
   **Then** return `{ status: 'NO_ROUTE', id: null, title: null, reason: 'no-route' }`  
   **When** `contextPack` is `null`, `undefined`, or missing expected fields  
   **Then** `extractScoringTopic` returns `""` without throwing

6. **Tests (AC: tests)**  
   **Then** `tests/notebook-disambiguate.test.mjs` uses `node:test` + `node:assert/strict`  
   **And** uses **fixtures only** — no live `nlm`, no network  
   **And** covers at minimum:
   - NO_ROUTE passthrough → `{ status: 'NO_ROUTE', reason: 'no-route' }`
   - Single match → `{ status: 'ROUTED', reason: 'single-match' }`
   - Multi-match, one watch-flagged → `reason: 'watch-preferred'`, correct id
   - Multi-match, none watch-flagged → `reason: 'top-ranked'`, first match returned
   - Multi-match, multiple watch-flagged → `reason: 'top-ranked'` (no single winner from watch)
   - Null/undefined registry → tiebreak falls to top-ranked
   - Malformed scoreResult → NO_ROUTE
   - `extractScoringTopic`: active epics string from context pack
   - `extractScoringTopic`: recent story key slug fallback
   - `extractScoringTopic`: empty fallback when contextPack has no usable fields  
   **And** `bash scripts/verify.sh` passes

7. **Scope boundaries (AC: non-goals)**  
   **Then** this story does **not**:
   - Wire into `readNotebookLmTargets` or session-close orchestration (50-5)
   - Call `scoreNotebooks` itself — accepts the already-scored result
   - Send Discord messages or operator prompts
   - Use LLM, embeddings, or fuzzy string libraries
   - Change vault IO, WriteGate, or `specs/cns-vault-contract/`

## Tasks / Subtasks

- [x] Implement `notebook-disambiguate.mjs`: `disambiguateRoute`, `extractScoringTopic` (AC: module, policy, shape, topic, edges)
- [x] Add `tests/notebook-disambiguate.test.mjs` (AC: tests)
- [x] Run `bash scripts/verify.sh` (AC: tests)

## Dev Notes

### API contract (for 50-5)

```js
/**
 * @typedef {import('./notebook-scorer.mjs').NotebookScoreResult} NotebookScoreResult
 * @typedef {import('./sync-notebook-registry.mjs').NotebookRegistryEntry} NotebookRegistryEntry
 * @typedef {{ status: 'ROUTED', id: string, title: string, reason: 'single-match' | 'watch-preferred' | 'top-ranked' }
 *         | { status: 'NO_ROUTE', id: null, title: null, reason: 'no-route' }} DisambiguationResult
 */

/**
 * @param {NotebookScoreResult} scoreResult
 * @param {NotebookRegistryEntry[]} registry
 * @returns {DisambiguationResult}
 */
export function disambiguateRoute(scoreResult, registry) { ... }

/**
 * Extract a short scoring topic string from the context pack (no IO, no LLM).
 * Returns "" when no usable fields are present.
 * @param {unknown} contextPack
 * @returns {string}
 */
export function extractScoringTopic(contextPack) { ... }
```

Consumers (50-5) call:
```js
const scoreResult = scoreNotebooks(extractScoringTopic(pack), registry);
const route = disambiguateRoute(scoreResult, registry);
if (route.status === 'ROUTED') { /* use route.id */ }
```

### Why watch-flag tiebreak before top-ranked

The watch flag represents explicit operator intent — a notebook was specifically opted into automation. If the scorer returns two high-scoring notebooks and one is watch-flagged, respecting that flag is the most conservative, operator-aligned behavior. Only when the watch signal is ambiguous (none or multiple flagged) do we fall back to pure score ranking.

### `extractScoringTopic` design

The function is intentionally shallow — it only uses the top-level `sprint.active_epics` array and `recent_stories` array from the context pack. Both are already produced by `prepare-context.mjs` in Story 48-1. No re-reading of files, no inference.

**Topic extraction examples:**

| Context pack state | `extractScoringTopic` output |
|--------------------|------------------------------|
| `active_epics: [{id: 'epic-50'}, {id: 'epic-49'}]` | `"epic 50 epic 49"` |
| No active epics; `recent_stories: [{basename: '50-3-conservative-notebook-scorer', ...}]` | `"conservative notebook scorer"` |
| Neither field present | `""` |

Strip `epic-` prefix → `"epic 50"` (the hyphen becomes a space via tokenizer, leaving `["epic", "50"]` — "50" is dropped as single char... wait, "50" is 2 chars, OK). Actually the tokenizer keeps tokens ≥ 2 chars, so "50" is kept.

Actually: `"epic-50 epic-49"` → tokenizer gives `["epic", "50", "epic", "49"]`. Dedup (Set) → `["epic", "50", "49"]`. That will score against notebook domains. `"50"` won't match any domain keywords (it's a number), but `"epic"` might loosely match; the real signal is thin. Better to clean it: strip the `epic-` prefix to get just `"50 49"` and prepend the top story slug keywords.

On reflection, the cleanest P1 topic is to take **the first in-progress epic's id** and also include the most recent story's keyword slug. For instance: `"notebook scorer conservative"` when recent story is `50-3-conservative-notebook-scorer`.

**Recommended implementation sketch:**
```js
export function extractScoringTopic(contextPack) {
  if (!contextPack || typeof contextPack !== 'object') return '';
  
  const parts = [];
  
  // P1: active epic IDs → slug keywords
  const epics = contextPack?.sprint?.active_epics;
  if (Array.isArray(epics) && epics.length > 0) {
    // take up to 2 epics, extract their story slugs or just epic ID
    for (const epic of epics.slice(0, 2)) {
      const stories = Array.isArray(epic.stories) ? epic.stories : [];
      if (stories.length > 0) {
        // e.g. "50-3-conservative-notebook-scorer review" → extract slug keywords
        const slug = stories[0].split(' ')[0]; // "50-3-conservative-notebook-scorer"
        parts.push(...slugToKeywords(slug));
      }
    }
  }
  
  // P2: recent story slug
  if (parts.length === 0) {
    const stories = contextPack?.recent_stories;
    if (Array.isArray(stories) && stories.length > 0) {
      parts.push(...slugToKeywords(stories[0].basename ?? ''));
    }
  }
  
  return parts.slice(0, 8).join(' ').slice(0, 60).trim();
}

function slugToKeywords(slug) {
  return slug.toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(t => t.length >= 2 && !/^\d+$/.test(t)); // drop pure numbers like "50", "3"
}
```

This produces topics like `"conservative notebook scorer"` or `"cns vault architect"` which score well against the domain lexicon.

### Watch-flag lookup

The `registry` parameter is the same array shape as `NotebookRegistryEntry`. Build a `Set<string>` of watched IDs before iterating matches:

```js
const watchedIds = new Set(
  (Array.isArray(registry) ? registry : [])
    .filter(r => r && r.watch === true && typeof r.id === 'string')
    .map(r => r.id)
);
```

### Project structure

| Path | Action |
|------|--------|
| `scripts/session-close/lib/notebook-disambiguate.mjs` | NEW |
| `tests/notebook-disambiguate.test.mjs` | NEW |

### Testing standards

- Same stack as `tests/notebook-scorer.test.mjs` — `node:test`, `node:assert/strict`, inline fixture objects
- No fixture JSON file needed (inline registry arrays are sufficient)
- `npm test` auto-picks up `tests/*.test.mjs`
- Assert exact `status`, `reason`, `id`, `title` — no loose checks

### Architecture compliance

- **Spec-first:** No `specs/cns-vault-contract/` changes (repo-local session-close lib)
- **Verify gate:** `bash scripts/verify.sh` mandatory before done
- **WriteGate:** N/A
- **Security:** No secrets; registry IDs are non-sensitive

### Epic 50 forward context (do not implement here)

| Story | Planned use of disambiguator |
|-------|------------------------------|
| **50-5** Smart routing | Call `extractScoringTopic(pack)` → `scoreNotebooks(topic, registry)` → `disambiguateRoute(result, registry)` → if `ROUTED`, use `route.id` as the single fan-out target; otherwise fall through to watch-list or project-map |

### Previous story intelligence

- **50-3:** `scoreNotebooks(topic, registry)` returns `{ status: 'OK'|'NO_ROUTE', matches: [...] }`. Matches sorted score desc → title asc → id asc. F1 uses set cardinalities (patched in code review). Threshold 0.75.
- **50-3 scorer contract:** `matches[0]` is always the highest-confidence result when `status === 'OK'`.
- **50-2:** `readNotebookLmTargets` precedence: env IDs → watch-list → project-map. Story 50-5 will add scorer routing before project-map fallback — this story only delivers the disambiguation policy, not the routing wire-up.
- **50-1:** Registry schema `{ id, title, watch, domain, last_updated }`. `watch` is boolean.

### Git intelligence

Recent Epic 50 commits:
- `cd931b5` — 50-3 conservative notebook scorer — F1 overlap, 0.75 threshold, NO_ROUTE (with code review patch: set cardinalities)
- `6a64784` — 50-1,50-2: notebook registry sync + watch-flag session-close fanout
- `ca642b7` — 50-1 initial registry sync

Follow established `.mjs` + `node:test` patterns; one logical commit for 50-4.

## References

- [Source: operator brief — Epic 50 / 50-4 disambiguation]
- [Source: `50-3-conservative-notebook-scorer.md` — scorer contract, NotebookScoreResult type]
- [Source: `50-2-watch-flag-fanout.md` — watch-flag precedence, registry shape]
- [Source: `50-1-notebook-registry-sync.md` — registry schema, NotebookRegistryEntry]
- [Source: `scripts/session-close/lib/notebook-scorer.mjs` — scoreNotebooks, NotebookScoreResult]
- [Source: `scripts/session-close/prepare-context.mjs` — contextPack shape: sprint.active_epics, recent_stories]
- [Source: `tests/notebook-scorer.test.mjs` — test patterns for this module layer]

## Dev Agent Record

### Agent Model Used

Composer (dev-story)

### Completion Notes List

- Implemented pure `disambiguateRoute(scoreResult, registry)` with NO_ROUTE passthrough, single-match routing, watch-flag tiebreak (exactly one flagged → `watch-preferred`), and top-ranked fallback; malformed inputs and null registry handled per AC edges.
- Implemented pure `extractScoringTopic(contextPack)`: P1 joins active epic ids, P2 slug-keywords from first recent story basename, P3 empty string; max 60 chars.
- Registry lookup ensures routed `id`/`title` come from registry entries when available.
- Added 13 test cases in `tests/notebook-disambiguate.test.mjs` covering all AC test scenarios.
- `bash scripts/verify.sh` passes (206 node tests + vitest + cns-dashboard).

### File List

- `scripts/session-close/lib/notebook-disambiguate.mjs` (new)
- `tests/notebook-disambiguate.test.mjs` (new)

### Review Findings

- [x] [Review][Patch] Null/non-object match elements crash `resolveRoutedEntry` and `watchFlagged` filter [`scripts/session-close/lib/notebook-disambiguate.mjs:28,44`]
- [x] [Review][Patch] `resolveRoutedEntry` fallback returns unguarded `match.title` — non-string propagates into ROUTED result [`scripts/session-close/lib/notebook-disambiguate.mjs:30`]
- [x] [Review][Patch] Test "falls back to top-ranked when registry is not an array" uses single-element matches and asserts `single-match` — never exercises the `top-ranked` path; non-array registry gap untested under multi-match [`tests/notebook-disambiguate.test.mjs`]
- [x] [Review][Patch] Truncation test vacuously weak — `assert.ok(topic.length <= 60)` passes for `""` with no lower-bound assertion [`tests/notebook-disambiguate.test.mjs`]
- [x] [Review][Patch] `isValidScoreResult` conflates valid `{ status: 'NO_ROUTE' }` (no `matches` field) with malformed input — correct output but wrong semantic path; missing test for `{ status: 'NO_ROUTE' }` without `matches` [`scripts/session-close/lib/notebook-disambiguate.mjs:25`]
- [x] [Review][Defer] `slugToKeywords` allows 2-char stopwords ("in", "to", "of") — semantic noise in topic string [`scripts/session-close/lib/notebook-disambiguate.mjs`] — deferred, pre-existing
- [x] [Review][Defer] `DisambiguationResult` typedef not exported — JSDoc DX gap, consumers must duplicate type [`scripts/session-close/lib/notebook-disambiguate.mjs`] — deferred, pre-existing
- [x] [Review][Defer] `slugToKeywords` `token.length >= 2` filter is an undocumented spec addition (spec only specifies stripping numeric prefixes and hyphens) — benign for CNS story slugs [`scripts/session-close/lib/notebook-disambiguate.mjs`] — deferred, pre-existing

## Change Log

- 2026-05-29: Story 50-4 — disambiguation module + topic extractor (create-story).
- 2026-05-29: Implemented `notebook-disambiguate.mjs` + tests; verify.sh green; status → review.

## Story completion status

- Ultimate context engine analysis completed — comprehensive developer guide created
- Status: **done**
