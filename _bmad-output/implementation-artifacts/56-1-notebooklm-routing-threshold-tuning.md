---
story_id: 56-1
epic: 56
title: notebooklm-routing-threshold-tuning
status: done
baseline_commit: 02bbecf
---

# Story 56.1: NotebookLM routing threshold tuning

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

Epic: **56** (NotebookLM routing calibration — operator brief 2026-06-02)  
Tracked in sprint-status as: **`56-1-notebooklm-routing-threshold-tuning`**

## Story

As the **CNS operator running morning digest and `/notebook-query`**,  
I want **NotebookLM routing to accept meaningful but weak F1 matches via a soft-route floor**,  
so that **trend keywords and partial questions route to the best available notebook instead of always returning NO_ROUTE when scores sit between 0.20 and 0.74**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 56: NotebookLM routing calibration (operator brief) |
| **Predecessor** | **55-2** (Google Trends scores now non-zero); **53-3** (NO_ROUTE diagnostic reasons); **50-3** (F1 scorer, hard threshold 0.75); **52-1** (morning digest pick-signal pipeline) |
| **Problem** | After 55-2, morning digest trend signals flow with real F1 scores **0.01–0.23** against watched notebooks. All fail the **0.75 hard threshold** → `pick-signal-notebook.mjs` and `/notebook-query` return NO_ROUTE despite meaningful partial overlap. Threshold was set conservatively in 50-3 before production signal data existed. |
| **Root metric** | **F1 overlap** on token sets — `(2 × \|A ∩ B\|) / (\|A\| + \|B\|)` — **not** cosine similarity, **not** Google Trends `normalizedValue`. Per-entry score = `max(titleF1, domainF1)`. |
| **Recommended fix** | **Option (b) soft-route** — keep hard threshold 0.75 for high-confidence matches; when no hard match, route if best F1 ≥ **0.20** with `reason: 'soft_match'`. Do **not** globally lower hard threshold to 0.35 (would increase false positives on unrelated queries and break 50-3 regression intent). |
| **In scope** | `scripts/session-close/lib/notebook-scorer.mjs`, `resolve-notebook.mjs`, `pick-signal-notebook.mjs`, tests |
| **Out of scope** | Notebook registry, Convex schema, dashboard, task-prompt Discord copy (unless ROUTED `soft_match` needs one-line note), vault IO, WriteGate |

### Operator brief (binding)

1. Audit scorer — 0.75 is F1 hard cutoff inside `scoreNotebooks`.
2. Calibrate from real signal band (0.01–0.23 production) — soft floor **0.20** captures meaningful overlap without routing noise.
3. Implement soft-route fallback when no notebook clears hard threshold but best score > soft floor.
4. Extend `reason` field (53-3 contract) with **`soft_match`** on ROUTED soft paths.
5. Update tests; `bash scripts/verify.sh` green.

## Acceptance Criteria

### 1. Scorer audit and exported constants (AC: scorer)

**Given** `scripts/session-close/lib/notebook-scorer.mjs`  
**When** the dev agent completes this story  
**Then** `SCORE_THRESHOLD` remains **0.75** (hard match)  
**And** `SOFT_ROUTE_FLOOR` is exported as **0.20**  
**And** a new exported helper **`rankAllMatches(topic, registry)`** returns all valid rows ranked by score (no threshold filter), using identical tokenization/F1/domain-lexicon logic as `scoreNotebooks`  
**And** Dev Agent Record documents why 0.20 was chosen (short trend phrases vs multi-token notebook titles produce low F1 even when semantically related).

### 2. Soft-route resolution (AC: routing)

**Given** `scoreNotebooks(topic, watchedRegistry)` returns `NO_ROUTE`  
**When** `rankAllMatches` top entry has `score >= SOFT_ROUTE_FLOOR`  
**Then** routing resolves to **`ROUTED`** with:
- `id`, `title` from top-ranked entry
- `reason: 'soft_match'`
- `domain` enriched from registry (same as existing ROUTED paths)

**When** best score **< SOFT_ROUTE_FLOOR** (including 0.00 on zero overlap)  
**Then** result remains **`NO_ROUTE`** with existing diagnostic reasons (`below_threshold: best=...` in resolver; `no-route` in pick-signal unless enriched).

**When** `scoreNotebooks` returns `OK` (hard match ≥ 0.75)  
**Then** behavior unchanged — disambiguator reasons remain `single-match` | `watch-preferred` | `top-ranked`.

### 3. Morning digest routes on soft floor (AC: digest)

**Given** trend signals like `"AI agent orchestration"` or `"local LLM routing"` that score **≥ 0.20 and < 0.75** against a watched notebook  
**When** `pickSignalNotebook(signals, watchedRegistry)` runs  
**Then** `route.status === 'ROUTED'`  
**And** `route.reason === 'soft_match'`  
**And** `winning_signal` and `winning_score` reflect the winning signal  
**And** remove the **duplicate** local `SCORE_THRESHOLD = 0.75` gate in `pick-signal-notebook.mjs` (lines 15, 117–118) — soft/hard logic must use scorer exports only.

### 4. `/notebook-query` soft-route (AC: notebook-query)

**Given** a real question with partial overlap scoring **≥ 0.20 and < 0.75**  
**When** `resolve-notebook.mjs` runs  
**Then** stdout JSON emits `route.status === 'ROUTED'` with `reason: 'soft_match'`  
**And** hard matches (≥ 0.75) still route with disambiguator reasons unchanged.

**Given** genuinely unrelated text (best F1 **< 0.20**, e.g. `"linkedin strategy posts"` against CNS/AI watch registry → 0.00)  
**Then** `NO_ROUTE` with `below_threshold: best=...` (53-3 contract preserved).

### 5. Reason field contract (AC: reason)

**Then** `DisambiguationResult`-style ROUTED output may include **`soft_match`** as a valid `reason` value alongside `single-match`, `watch-preferred`, `top-ranked`  
**And** NO_ROUTE diagnostic reasons from 53-3 remain unchanged  
**And** do **not** emit `soft_match` on NO_ROUTE.

### 6. Tests and verify gate (AC: test)

**Then** update/add cases in:
- `tests/notebook-scorer.test.mjs` — `rankAllMatches`, exported constants, soft-floor boundary
- `tests/hermes-notebook-query-skill.test.mjs` — soft-route CLI case + preserve TC-1..TC-9 hard-route regressions
- `tests/morning-digest-pick-signal-notebook.test.mjs` — soft-route signal case; keep strong-match tests (≥ 0.75)

**And** existing below-threshold NO_ROUTE tests (`linkedin strategy posts`, `unrelated xyz topic`) still pass  
**And** `bash scripts/verify.sh` passes.

### 7. Scope guards (AC: scope)

**Then** this story does **not** change notebook registry sync, Convex schema, dashboard, or `infer-notebook-domain.mjs` lexicon table.

## Tasks / Subtasks

- [x] **T1** Export `SCORE_THRESHOLD`, `SOFT_ROUTE_FLOOR`, implement `rankAllMatches` in `notebook-scorer.mjs` (AC: 1)
- [x] **T2** Add shared `resolveWithSoftFallback(topic, watchedRegistry)` helper (scorer lib or small `notebook-route.mjs` colocated in session-close/lib — prefer scorer exports + thin helper to avoid triplicating `bestWatchedMatch` in resolver and pick-signal) (AC: 2)
- [x] **T3** Wire `resolve-notebook.mjs` — soft-route before NO_ROUTE `below_threshold` branch; reuse helper instead of duplicating ranking logic (AC: 4, 5)
- [x] **T4** Wire `pick-signal-notebook.mjs` — cross-signal winner uses soft fallback; delete local `SCORE_THRESHOLD` duplicate (AC: 3)
- [x] **T5** Extend disambiguator types/comments if needed for `soft_match` reason (minimal — can set reason in resolver/pick-signal without changing disambiguator if hard path unchanged) (AC: 5)
- [x] **T6** Update tests in three test files; run `bash scripts/verify.sh` (AC: 6)
- [x] **T7** Record production score band evidence and threshold rationale in Dev Agent Record (AC: 1)

### Review Findings

- [x] [Review][Patch] Hard-route score must match disambiguated notebook, not always `matches[0]` [`scripts/session-close/lib/notebook-route.mjs:25-26`]
- [x] [Review][Patch] `resolveNotebookRoute` should filter `watch: true` internally so unwatched rows cannot soft-route [`scripts/session-close/lib/notebook-route.mjs:30-39`]
- [x] [Review][Patch] `resolveForQuestion` test helper should call `resolveNotebookRoute` for production-path parity [`tests/hermes-notebook-query-skill.test.mjs:45-48`]
- [x] [Review][Defer] `read-sources.mjs` `smartRoute` still hard-only — session-close parity follow-up, out of 56-1 scope [`scripts/session-close/lib/read-sources.mjs:249-250`] — deferred, pre-existing path not in story file list
- [x] [Review][Defer] Soft-route path runs `scoreNotebooks` then `rankAllMatches` (duplicate F1 work) [`scripts/session-close/lib/notebook-route.mjs:20-30`] — deferred, perf optimization
- [x] [Review][Defer] `belowThresholdReason(null)` returns `no_watched_notebooks` though callers pre-check registry [`scripts/session-close/lib/notebook-route.mjs:55-57`] — deferred, unreachable in current callers

## Dev Notes

### Critical path correction — scorer location

The canonical scorer is **`scripts/session-close/lib/notebook-scorer.mjs`**. Hermes skill scripts import it via `CNS_REPO_ROOT/scripts/session-close/lib/` — there is **no** `scripts/hermes-skill-examples/notebook-query/scripts/notebook-scorer.mjs`. Do not create a duplicate scorer under hermes-skill-examples.

### What 0.75 represents (audit)

```6:6:scripts/session-close/lib/notebook-scorer.mjs
const SCORE_THRESHOLD = 0.75;
```

```44:57:scripts/session-close/lib/notebook-scorer.mjs
export function f1(a, b) {
  const setA = new Set(a);
  const setB = new Set(b);
  // ...
  return (2 * intersection) / (setA.size + setB.size);
}
```

```132:138:scripts/session-close/lib/notebook-scorer.mjs
    const titleScore = roundScore(f1(queryTokens, titleTokens));
    const domainScore = roundScore(f1(queryTokens, domainTokens));
    const score = roundScore(Math.max(titleScore, domainScore));
    if (score >= SCORE_THRESHOLD) {
      matches.push({ id: entry.id, title: entry.title, score });
    }
```

**Interpretation:** Token-set F1 between query and notebook title **or** domain lexicon. Short trend phrases (2–4 tokens) against long titles (3–5 tokens) rarely reach 0.75 even with good semantic fit. Example: query `["ai","agent","orchestration"]` vs title `["ai","factory","blueprint"]` → intersection 1, F1 = 2/(3+3) ≈ **0.33** (would soft-route at floor 0.20).

### Why soft-route over lowering hard threshold

| Approach | Pros | Cons |
|----------|------|------|
| Lower hard to ~0.35 | Simple one-line change | Routes weak/unrelated queries; breaks 50-3 "conservative" contract; `smart-routing.test.mjs` and session-close fan-out false positives |
| **Soft floor 0.20 (recommended)** | Hard path unchanged; digest + partial questions get best-effort notebook; NO_ROUTE when truly unrelated (< 0.20) | Slightly more code; need shared helper |

Production band **0.01–0.23** after 55-2: floor **0.20** routes the upper band; scores **0.01–0.19** stay NO_ROUTE (genuine noise).

### Duplicate logic to consolidate

**resolve-notebook.mjs** already implements `bestWatchedMatch()` (53-3) — mirrors scorer ranking without threshold:

```120:155:scripts/hermes-skill-examples/notebook-query/scripts/resolve-notebook.mjs
function bestWatchedMatch(topic, registry) {
  // ... same f1/tokenize/domainTokens pattern ...
}
```

**pick-signal-notebook.mjs** redundantly re-checks threshold after `scoreNotebooks` already filtered:

```15:15:scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs
const SCORE_THRESHOLD = 0.75;
```

```117:119:scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs
    if (top.score < SCORE_THRESHOLD) {
      continue;
    }
```

**Action:** Move ranking + soft/hard resolution into session-close lib; resolver and pick-signal call one helper. Delete resolver-local duplicate after migration (or thin-wrap exported helper).

### Recommended helper API

```js
// scripts/session-close/lib/notebook-scorer.mjs (or notebook-route.mjs)
export const SCORE_THRESHOLD = 0.75;
export const SOFT_ROUTE_FLOOR = 0.20;

/** @returns {{ id, title, score }[]} ranked, no threshold */
export function rankAllMatches(topic, registry) { /* ... */ }

/**
 * @returns {{ status: 'ROUTED', id, title, reason, score } 
 *         | { status: 'NO_ROUTE', best: { title, score } | null }}
 */
export function resolveNotebookRoute(topic, registry) {
  const hard = scoreNotebooks(topic, registry);
  if (hard.status === 'OK') {
    const route = disambiguateRoute(hard, registry);
    return { ...route, score: hard.matches[0]?.score };
  }
  const ranked = rankAllMatches(topic, registry);
  const top = ranked[0];
  if (top && top.score >= SOFT_ROUTE_FLOOR) {
    return { status: 'ROUTED', id: top.id, title: top.title, reason: 'soft_match', score: top.score };
  }
  return { status: 'NO_ROUTE', best: top ?? null };
}
```

**Note:** Importing `disambiguateRoute` from scorer module creates a dependency cycle if disambiguate imports scorer. Prefer keeping `resolveNotebookRoute` in a new **`notebook-route.mjs`** that imports both, or implement soft/hard orchestration only in Hermes scripts importing all three. Avoid circular imports.

### pick-signal cross-signal algorithm (preserve 52-1)

After soft-route per signal:
1. For each deduped signal, call `resolveNotebookRoute(signal, watchedRegistry)`.
2. Collect ROUTED candidates with `{ signal, signalIndex, route, score }`.
3. Pick global winner: highest score → earliest signalIndex → title → id (existing `candidateBeatsIncumbent`).
4. If no ROUTED candidate, return NO_ROUTE.

### resolve-notebook.mjs integration

Ordered checks (preserve 53-3):
1. `no_watched_notebooks`
2. `empty_question`
3. Hard route via `scoreNotebooks` + `disambiguateRoute`
4. **NEW:** soft route if best ≥ 0.20 → ROUTED + `soft_match` + domain enrichment
5. Else NO_ROUTE + `below_threshold: best=...` using best from rank

### Reason field matrix (post-56-1)

| `route.status` | `route.reason` values |
|----------------|----------------------|
| `ROUTED` (hard) | `single-match`, `watch-preferred`, `top-ranked` |
| `ROUTED` (soft) | **`soft_match`** |
| `NO_ROUTE` | `no_watched_notebooks`, `empty_question`, `below_threshold: best=...`, `no-route` (pick-signal only if not enriched) |

### Test fixtures to add

| Case | Input | Registry | Expected |
|------|-------|----------|----------|
| Soft-route digest | `["ai factory blueprint architecting"]` (partial) | `watchRegistry` | ROUTED `ai-watch-1`, reason `soft_match`, score ≥ 0.20 |
| Hard-route unchanged | `"CNS vault architecture"` | `watchRegistry` | ROUTED `cns-watch-1`, reason ≠ `soft_match` |
| True NO_ROUTE | `"unrelated xyz topic"` or `"linkedin strategy posts"` | `watchRegistry` | NO_ROUTE, best < 0.20 |
| Floor boundary | Craft query scoring exactly ~0.19 vs ~0.21 | minimal fixture | NO_ROUTE vs ROUTED |

Use `rankAllMatches` in tests to discover stable fixture strings rather than guessing scores.

### Files to touch

| File | Action |
|------|--------|
| `scripts/session-close/lib/notebook-scorer.mjs` | UPDATE — export constants, `rankAllMatches` |
| `scripts/session-close/lib/notebook-route.mjs` | NEW (optional) — `resolveNotebookRoute` if cycle-free |
| `scripts/hermes-skill-examples/notebook-query/scripts/resolve-notebook.mjs` | UPDATE — soft-route; dedupe via shared helper |
| `scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs` | UPDATE — soft-route; remove duplicate threshold |
| `tests/notebook-scorer.test.mjs` | UPDATE |
| `tests/hermes-notebook-query-skill.test.mjs` | UPDATE |
| `tests/morning-digest-pick-signal-notebook.test.mjs` | UPDATE |

### Out of scope (do not implement)

- Changing `infer-notebook-domain.mjs` DOMAIN_RULES
- Convex `notebook_query_log` schema
- Dashboard panels
- Lowering global hard threshold to 0.35 without soft-route distinction
- WriteGate / vault mutations

### Previous story intelligence (55-2)

- Fixed Google Trends **normalizedValue** (mean aggregation); signals now flow to digest.
- Explicitly deferred threshold change to this story.
- F1 notebook scores are independent of trend normalizedValue — do not conflate.
- [Source: `_bmad-output/implementation-artifacts/55-2-google-trends-normalized-value-fix.md`]

### Previous story intelligence (53-3)

- Added `bestWatchedMatch` and NO_ROUTE diagnostics in resolver only.
- Scope excluded scorer changes — **56-1 is the intended follow-up** to tune routing.
- Preserve `below_threshold` format when soft-route does not apply.
- [Source: `_bmad-output/implementation-artifacts/53-3-add-reason-field-to-no-route-responses.md`]

### Previous story intelligence (50-3)

- F1 max(title, domain), threshold 0.75, pure function, no IO.
- [Source: `_bmad-output/implementation-artifacts/50-3-conservative-notebook-scorer.md`]

### Git context

Recent lineage: `02bbecf` (55-3 cron), `d9df5f9` (55-2 trends fix), `38218d3` (55-1 digest trigger). Follow 53-3 / 51-1 test patterns: fixture-only, `node:test`, `verify.sh` gate.

### Architecture compliance

| Rule | Action |
|------|--------|
| Spec-first | Read-only — no vault contract changes |
| Verify gate | `bash scripts/verify.sh` before done |
| WriteGate | Not touched |
| Pure scorer | `scoreNotebooks` / `rankAllMatches` remain pure (no IO) |

### Deferred work reference

- Duplicate tokenizer in `infer-notebook-domain.mjs` vs `notebook-scorer.mjs` — still deferred; do not consolidate in this story.
- `below_threshold: best=unknown (0.00)` edge case — deferred from 53-3 review; optional test if touched.

### References

- [Source: `scripts/session-close/lib/notebook-scorer.mjs`] — F1, threshold, tokenization
- [Source: `scripts/session-close/lib/notebook-disambiguate.mjs`] — hard-route disambiguation
- [Source: `scripts/hermes-skill-examples/notebook-query/scripts/resolve-notebook.mjs`] — CLI resolver, 53-3 reasons
- [Source: `scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs`] — cross-signal picker
- [Source: `tests/notebook-scorer.test.mjs`, `tests/hermes-notebook-query-skill.test.mjs`, `tests/morning-digest-pick-signal-notebook.test.mjs`]
- [Source: `_bmad-output/implementation-artifacts/50-3-conservative-notebook-scorer.md`]
- [Source: `_bmad-output/implementation-artifacts/52-1-morning-digest-notebooklm-synthesis.md`]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md`]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor)

### Debug Log References

- Production score band after 55-2: F1 **0.01–0.23** on trend signals vs watched notebooks; example `"ai agent orchestration"` → **0.3333** vs `AI Factory Blueprint` (soft-routes); `"linkedin strategy posts"` → **0.00** (NO_ROUTE).
- Soft floor **0.20** chosen: routes upper production band without globally lowering hard 0.75; short trend phrases (2–4 tokens) vs 3–5 token titles rarely reach 0.75 even with semantic fit (F1 = 2×|∩|/(|A|+|B|)).
- Boundary fixtures: `"ai alpha beta gamma delta epsilon zeta"` → exactly **0.20** (ROUTED); one extra token → **0.1818** (NO_ROUTE).
- `pickSignalNotebook` filters `watch: true` before routing so unwatched registry rows cannot soft-route (regression guard for mixedRegistry test).

### Completion Notes List

- Exported `SCORE_THRESHOLD` (0.75) and `SOFT_ROUTE_FLOOR` (0.20); refactored shared `scoreAllEntries` for `scoreNotebooks` and `rankAllMatches`.
- Added `notebook-route.mjs` with `resolveNotebookRoute` and `belowThresholdReason`; removed duplicate `bestWatchedMatch` from resolver.
- Wired soft-route into `resolve-notebook.mjs` and `pick-signal-notebook.mjs`; removed local `SCORE_THRESHOLD` duplicate.
- Extended `DisambiguationResult` typedef with `soft_match`.
- Added soft-route + boundary tests in three test files; synced Hermes skill installs; `bash scripts/verify.sh` green (378 tests).

### File List

- `scripts/session-close/lib/notebook-scorer.mjs` (modified)
- `scripts/session-close/lib/notebook-route.mjs` (new)
- `scripts/session-close/lib/notebook-disambiguate.mjs` (modified)
- `scripts/hermes-skill-examples/notebook-query/scripts/resolve-notebook.mjs` (modified)
- `scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs` (modified)
- `tests/notebook-scorer.test.mjs` (modified)
- `tests/hermes-notebook-query-skill.test.mjs` (modified)
- `tests/morning-digest-pick-signal-notebook.test.mjs` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)

## Change Log

- 2026-06-02: Soft-route floor 0.20 for NotebookLM routing; shared `resolveNotebookRoute` helper; tests and Hermes skill parity sync.
