---
story_id: 64-2
epic: 64
title: scoring-engine-five-dimensions
status: review
baseline_commit: 433b412
operator_brief: 2026-06-08
predecessors: 64-1
blocks: 64-3, 64-4, 64-5
---

# Story 64.2: Scoring engine v1 — five named dimensions

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a **CNS operator running the morning digest pipeline**,
I want **a `score-digest-signals.mjs` module that computes five independent dimension scores (0–100) for each digest signal candidate using the locked architecture algorithms**,
so that **Epic 64 stories 64-3..64-5 can derive disposition, normalize engagement, and rank-push without reimplementing dimension logic, and `personalRelevance` remains provably independent from `relevance`**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 64: Intelligence Scoring Engine v1 — **64-2 is the scoring compute gate**; blocks 64-3, 64-4, 64-5 |
| **Repo** | **Omnipotent.md only** — no cns-dashboard changes (64-1 schema is done) |
| **Predecessor** | **64-1** (done) — `scores` object, `sourceMetadata` engagement fields, push contract docs |
| **Normative spec** | `architecture-epic-64-scoring-engine.md` §4, §5 (dimension algorithms + calibration bands + novelty lookback table) |
| **FR IDs** | FR-5 (`personalRelevance`), FR-6 (`relevance`), FR-7 (`novelty`), FR-8 (`momentum` Path B + Path A guard), FR-9 (`urgency`) |
| **Out of scope** | `deriveDisposition` (64-3); `normalizeEngagement` implementation (64-4); `computeRankScore` / `scoreDigestSignals` orchestrator (64-5); task-prompt Source 6 integration (64-5); Convex mutations; dashboard UI; vault/PAKE reads; last30days dependency (ADR-E64-005) |

### Problem (current state)

No `score-digest-signals.mjs` exists. Morning digest assembles signal candidates via `buildDigestSignals()` but pushes **unscored** payloads. Convex validators (64-1) accept optional `scores` — this story implements the compute layer that will populate them.

### Operator brief (binding)

1. **Omnipotent.md only** — one new module + tests; no cross-repo touch.
2. **Reuse `tokenizeForScoring` + `f1` from `notebook-scorer.mjs`** — do not duplicate stopword lists.
3. **No live Convex reads during cron** — novelty history and keyword snapshots via env injection only.
4. `bash scripts/verify.sh` must pass before marking done.

## Acceptance Criteria

### 1. Module exports and scoring context (AC: FR-5..FR-9 foundation)

**Given** the normative module path `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs`
**When** the module is imported
**Then** it exports: `loadScoringContext`, `tokenizeSignalText`, `scoreRelevance`, `scorePersonalRelevance`, `scoreNovelty`, `scoreUrgency`, `scoreMomentum`
**And** `loadScoringContext(env)` resolves:
  - watchlist domain keywords from `~/.hermes/trend-watchlist.yaml` (excluding `personal:` category)
  - sprint tokens from `_bmad-output/implementation-artifacts/sprint-status.yaml` (or `MORNING_DIGEST_SPRINT_STATUS_PATH`)
  - project entities from `MORNING_DIGEST_PROJECT_ENTITIES` (comma-separated)
  - personal watchlist terms from watchlist `personal:` category if present
  - optional `DIGEST_KEYWORD_CANDIDATES_JSON` personal terms
  - novelty history from `DIGEST_NOVELTY_HISTORY_JSON` (`string[]` titles) or empty array
  - run timestamp from `DIGEST_RUN_AT` ms epoch or `Date.now()` at score time
**And** sprint tokenization includes epic keys (`epic-64`), in-progress story title tokens, and `epic-N` numeric tokens; minimum token length 2 via `tokenizeForScoring`
**And** `tokenizeSignalText(title, summary?)` delegates to `tokenizeForScoring` on `title + ' ' + (summary ?? '')`

### 2. Shared F1 primitive (AC: anti-drift §4.3)

**Given** token sets `tokensA` and `tokensB`
**When** any dimension uses overlap scoring
**Then** `f1Score(tokensA, tokensB) = round(clamp(f1(tokensA, tokensB) * 100, 0, 100))` where `f1` is imported from `scripts/session-close/lib/notebook-scorer.mjs`
**And** `clamp(x, min, max) = max(min, min(max, x))`

### 3. `relevance` dimension — topical fit (AC: FR-6; normative §5.1)

**Given** a signal with `title` and optional `summary`
**When** `scoreRelevance(signal, ctx)` runs
**Then** `relevance = f1Score(signalTokens, domainTokens)` where `domainTokens` excludes watchlist `personal:` entries
**And** output is integer 0–100 inclusive

**Normative calibration bands (interpretation — tests MUST hit representative scores in each band):**

| Band | Range | Condition (f1 before ×100) |
|------|-------|----------------------------|
| Off-topic | 0–20 | f1 < 0.05 |
| Peripheral | 21–50 | 0.05 ≤ f1 < 0.25 |
| On-theme | 51–75 | 0.25 ≤ f1 < 0.50 |
| Core theme | 76–100 | f1 ≥ 0.50 |

**Degraded mode:** missing watchlist file → `relevance = 25` (neutral peripheral per architecture §9).

### 4. `personalRelevance` dimension — operator fit (AC: FR-5; normative §5.2)

**Given** a signal and scoring context with sprint/project/personal tokens
**When** `scorePersonalRelevance(signal, ctx)` runs
**Then** `base = f1Score(signalTokens, personalTokens)` where `personalTokens` = union of sprint tokens, project entities, watchlist `personal:` keywords, optional keyword-candidate personal terms
**And** `epicBonus = 15` if any epic numeric token from active in-progress epics appears in `signalTokens`, else `0`
**And** `personalRelevance = clamp(base + epicBonus, 0, 100)`
**And** `scoreRelevance` **must not** read sprint or project tokens (disjoint token sets by construction)

**Normative calibration bands (interpretation — tests MUST hit representative scores):**

| Band | Range | Condition |
|------|-------|-----------|
| No personal overlap | 0–20 | base < 0.05 and epicBonus = 0 |
| Adjacent | 21–50 | 0.05 ≤ base < 0.25 |
| Active work | 51–75 | 0.25 ≤ base < 0.50 OR epicBonus > 0 with base ≥ 0.15 |
| Direct hit | 76–100 | base ≥ 0.50 OR (epicBonus > 0 AND base ≥ 0.35) |

**Anti-drift fixtures (mandatory):**
- Signal A: high domain/watchlist overlap, zero sprint/project overlap → high `relevance`, low `personalRelevance` (bands per tables above).
- Signal B: same topical overlap as A but matches sprint keyword → `personalRelevance` strictly greater than A; `relevance` may be equal.
- `personalRelevance` is **not** `f(relevance)` — prove with controlled token sets.

### 5. `novelty` dimension — history dedupe (AC: FR-7; normative §5.3 — **primary anti-drift surface**)

**Given** novelty history from `DIGEST_NOVELTY_HISTORY_JSON` (or empty)
**When** `scoreNovelty(signal, ctx)` runs
**Then** lookback is **7 calendar days** of prior signal titles per workspace (case-insensitive)
**And** title match key is `normalize(title) = title.trim().toLowerCase()`
**And** token overlap is `overlapRatio(a, b) = |intersection(tokenize(a), tokenize(b))| / max(1, |tokenize(a)|)` using `tokenizeSignalText` / `tokenizeForScoring`
**And** novelty score is determined by **first matching rule wins** in this **normative table** (exact scores — do not substitute continuous formulas):

| Condition | novelty |
|-----------|---------|
| Exact normalized title in history | **10** |
| overlapRatio ≥ 0.60 with any history title | **25** |
| overlapRatio ≥ 0.30 with any history title | **45** |
| Same `sourceType` seen in history but title novel | **65** |
| First appearance in lookback window | **90** |
| First appearance ever (empty history) | **100** |

**Degraded mode:** absent `DIGEST_NOVELTY_HISTORY_JSON` → treat history as empty → all signals score **100** (last row). Architecture §9 "novelty ≥ 75" is satisfied.

**Mandatory novelty fixtures:**
- Exact title repeat in history → **10**
- Paraphrase with overlapRatio ≥ 0.60 → **25** (not 10, not interpolated)
- Paraphrase with 0.30 ≤ overlapRatio < 0.60 → **45**
- Novel title but same `sourceType` in history → **65**
- First title in non-empty history window → **90**
- Empty history → **100**

### 6. `urgency` dimension — time sensitivity (AC: FR-9; normative §5.4)

**Given** a signal with `sourceMetadata.publishedAt` and/or digest run time
**When** `scoreUrgency(signal, ctx)` runs
**Then** no LLM calls — heuristic only
**And** `recency` from age of `publishedAt` (or run time fallback) uses:

| Age | recency |
|-----|---------|
| ≤ 6 hours | 95 |
| ≤ 24 hours | 80 |
| ≤ 72 hours | 55 |
| ≤ 7 days | 35 |
| > 7 days or unknown | 15 |

**And** `breaking` = 20 if title matches `\b(breaking|launch|released|announces|emergency|critical|cve-\d|outage|today)\b` (case-insensitive), else 0
**And** `sourcePrior` by `sourceType`: newsapi=15, hackernews=10, google_trends=10, deep_signal=5, arxiv=0
**And** `urgency = clamp(round(0.7 * recency + 0.2 * sourcePrior + breaking), 0, 100)`

**Fixture:** breaking-news headline within 6h scores higher urgency than week-old arXiv preprint with equal relevance tokens.

### 7. `momentum` dimension — engagement velocity stub (AC: FR-8 partial; normative §5.5)

**Given** a signal without `normalizedEngagement` (64-4 not yet wired)
**When** `scoreMomentum(signal, normalizedEngagement, ctx)` runs with `normalizedEngagement` undefined/null
**Then** **Path B** applies: `momentum = clamp(round(trendProxy), 0, 100)`
**And** `trendProxy` by `sourceType`:

| sourceType | trendProxy |
|------------|------------|
| google_trends | `normalizedValue * 100` from linked trend row if present; else 40 |
| hackernews | 45 |
| newsapi | 35 |
| arxiv | 25 |
| deep_signal | 50 |

**Given** caller passes `normalizedEngagement` (0–100) explicitly (mock/stub for tests; real value from 64-4 later)
**When** Path A applies
**Then** `momentum = clamp(round(0.75 * normalizedEngagement + 0.25 * trendProxy), 0, 100)`
**And** implementation **must not** read `sourceMetadata.points`, `stars`, `upvotes`, or `commentCount` directly inside `scoreMomentum` (ADR-E64-003 guard — test or explicit code comment + lint path)

**Out of scope for 64-2:** implementing `normalizeEngagement()` (64-4). Path A is testable with injected `normalizedEngagement` only.

### 8. No pipeline integration or downstream compute (AC: anti-drift)

**Given** this story's scope boundary
**When** implementation completes
**Then** there is **no** `deriveDisposition`, `computeRankScore`, or `scoreDigestSignals` orchestrator (64-3, 64-5)
**And** **no** changes to `push-digest-convex.mjs`, `task-prompt.md` Source 6, or `pick-signal-notebook.mjs`
**And** `tests/morning-digest-pick-signal-notebook.test.mjs` passes unchanged (routing regression gate)
**And** no Convex live queries during `loadScoringContext`
**And** no last30days import/subprocess (ADR-E64-005)

### 9. Test file and verify gate (AC: architecture §11)

**Given** new file `tests/morning-digest-score-signals.test.mjs`
**When** tests run via `npm test`
**Then** coverage includes: all five dimension functions, F1 primitive, novelty table rows (§5.3), personal≠relevance anti-drift pair, urgency recency/breaking, momentum Path B + Path A with injected normalizedEngagement, degraded modes (missing watchlist, empty novelty history)
**And** `bash scripts/verify.sh` passes green

## Tasks / Subtasks

- [x] **T1** Create `score-digest-signals.mjs` (AC: 1, 2)
  - [x] Import `tokenizeForScoring`, `f1` from `../../../session-close/lib/notebook-scorer.mjs` (relative from morning-digest/scripts)
  - [x] Implement `clamp`, `f1Score`, `loadScoringContext`, `tokenizeSignalText`
  - [x] Watchlist YAML reader: exclude `personal:` from domain tokens; include for personal tokens
  - [x] Sprint-status parser: in-progress epics/stories only; epic numeric token extraction
- [x] **T2** Dimension functions (AC: 3–7)
  - [x] `scoreRelevance` per §5.1 bands + degraded relevance=25
  - [x] `scorePersonalRelevance` per §5.2 bands + epicBonus
  - [x] `scoreNovelty` per §5.3 **locked score table** + 7-day lookback filter on history titles
  - [x] `scoreUrgency` per §5.4 recency/breaking/sourcePrior formula
  - [x] `scoreMomentum` Path B + Path A with ADR-E64-003 raw-field guard
- [x] **T3** Tests `tests/morning-digest-score-signals.test.mjs` (AC: 3–7, 9)
  - [x] Novelty: one test per normative table row (10, 25, 45, 65, 90, 100)
  - [x] Relevance/personalRelevance: band boundary fixtures + anti-drift pair (FR-5)
  - [x] Urgency: breaking vs stale arXiv
  - [x] Momentum: Path B static priors; Path A with mocked normalizedEngagement
  - [x] Degraded: missing watchlist → 25; empty history → novelty 100
- [x] **T4** Verify gate (AC: 9)
  - [x] `bash scripts/verify.sh` green
  - [x] Confirm `morning-digest-pick-signal-notebook.test.mjs` untouched and passing

### Review Findings

- [x] [Review][Patch] personalRelevance calibration bands incomplete per AC §4 — tests cover anti-drift + epic bonus only; missing representative fixtures for adjacent (21–50) and active work (51–75) bands [tests/morning-digest-score-signals.test.mjs:119]
- [x] [Review][Patch] 7-day novelty lookback filter has no dedicated test — `loadScoringContext` excludes entries with `seenAt` older than 7 days but this behavior is untested [score-digest-signals.mjs:398-404]
- [x] [Review][Patch] Missing code comment documenting string[] history without `seenAt` treated as full lookback set (required by story Dev Notes) [score-digest-signals.mjs:399-404]
- [x] [Review][Defer] Novelty rule 65 unreachable when `DIGEST_NOVELTY_HISTORY_JSON` is normative `string[]` (no `sourceType` on entries) — falls through to 90 until orchestration enriches history (64-5); object[] extension is tested but not v1 default [score-digest-signals.mjs:496-501] — deferred, v1 string[] contract per story Dev Notes

## Dev Notes

### Architecture compliance

| ADR | Requirement for 64-2 |
|-----|----------------------|
| **ADR-E64-001** | Scoring compute in Omnipotent.md; no Convex scoring |
| **ADR-E64-002** | Five named keys in `scores` when present — this story produces the values, not push yet |
| **ADR-E64-003** | `scoreMomentum` must not read raw cross-source engagement fields |
| **ADR-E64-004** | `personalRelevance` independent; fixtures prove ≠ f(`relevance`) |
| **ADR-E64-005** | No last30days dependency |

### Primary drift risks (read before coding)

1. **Novelty:** Implementers often replace the discrete §5.3 table with a continuous `100 - overlap*100` formula. **Wrong.** Use first-match-wins with exact scores 10/25/45/65/90/100.
2. **Novelty lookback:** Must filter history to **7 calendar days** — not 14, not "all history."
3. **Bands:** §5.1 and §5.2 band tables are interpretation boundaries for tests — the **formula** is F1-based; bands validate fixtures land in correct ranges.
4. **personalRelevance:** Do not fold sprint tokens into `domainTokens` or `relevance`.
5. **momentum:** Do not read HN `points` in 64-2 — wait for 64-4 `normalizeEngagement`.

### Reuse — notebook-scorer.mjs (do not duplicate)

```33:58:scripts/session-close/lib/notebook-scorer.mjs
export function tokenizeForScoring(text) {
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2 && !SCORING_STOPWORDS.has(token));
}

export function f1(a, b) {
  // ... set intersection F1
}
```

Import path from `morning-digest/scripts/`: `../../../session-close/lib/notebook-scorer.mjs` (mirror `pick-signal-notebook.mjs` pattern).

### Watchlist YAML shape (expected)

Read `~/.hermes/trend-watchlist.yaml` via `resolveOperatorHome` pattern from `fetch-arxiv-rss.mjs`. Keywords may be flat strings or categorized; architecture references `personal:` category exclusion for domain tokens. If YAML has no categories, treat all keywords as domain-only.

### Sprint-status parsing hints

From `sprint-status.yaml` `development_status`:
- Collect keys matching `epic-N` with status `in-progress` → tokens `epic`, `N`, story keys for same epic with `in-progress`
- Story keys like `64-2-scoring-engine-five-dimensions` → tokenize title slug

### Novelty history env contract

```json
// DIGEST_NOVELTY_HISTORY_JSON
["Title from prior run", "Another headline"]
```

Filter to titles within 7 days of `DIGEST_RUN_AT` when timestamps are not available on history entries — v1 assumes orchestration layer supplies pre-filtered titles OR titles are all within window. **If only titles without dates:** treat entire array as lookback set (document in code comment). Prefer: filter by optional `{ title, seenAt }` if orchestration later adds it — **not required in 64-2**; string[] is normative per architecture §4.2.

### Signal shape (minimal for scoring)

```javascript
{
  title: string,
  summary?: string,
  sourceType: 'newsapi' | 'hackernews' | 'google_trends' | 'arxiv' | 'deep_signal',
  sourceMetadata?: { publishedAt?: string, normalizedValue?: number },
  // trend link for google_trends: optional ctx lookup
}
```

### Momentum Path A test pattern (64-2 only)

```javascript
const momentum = scoreMomentum(signal, 80, ctx); // injected normalizedEngagement
// expect clamp(round(0.75 * 80 + 0.25 * trendProxy))
```

### Previous story intelligence (64-1)

- Schema accepts optional `scores` with five required keys when parent present — 64-2 outputs match those key names exactly.
- HN contract: `sourceMetadata.points` / `commentCount` exist for 64-4 — **do not use in 64-2 momentum**.
- Test style: `node:test` + fixture objects; extend pattern from `morning-digest-push-convex.test.mjs` / `morning-digest-newsapi.test.mjs`.
- 64-1 verify gate: `bash scripts/verify.sh` includes cns-dashboard — 64-2 should not require cns-dashboard file changes but verify must stay green.

### Git intelligence (recent Epic 64 work)

| Commit | Relevance |
|--------|-----------|
| `433b412` | 64-1 review closure — baseline |
| `cfdbfd3` | 64-1 validators + push contract — scored payload shape reference |
| `e7b2bfb` | 64-6: `.mjs` module + dedicated test file pattern |
| `92646fe` | 64-7: `resolveOperatorHome` + env contract documentation style |

### Project structure notes

| Path | Change |
|------|--------|
| `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs` | **NEW** |
| `tests/morning-digest-score-signals.test.mjs` | **NEW** |
| `scripts/session-close/lib/notebook-scorer.mjs` | **READ ONLY** — import, do not fork tokenization |
| `push-digest-convex.mjs` | **NO CHANGE** |
| `pick-signal-notebook.mjs` | **NO CHANGE** |
| `task-prompt.md` | **NO CHANGE** (64-5) |

### Testing requirements

| File | Action |
|------|--------|
| `tests/morning-digest-score-signals.test.mjs` | **NEW** — primary gate for this story |
| `tests/morning-digest-pick-signal-notebook.test.mjs` | **Run unchanged** — routing regression |
| `tests/morning-digest-push-convex.test.mjs` | **No changes** — scored push is 64-5 |

**Gate:** `bash scripts/verify.sh` green before marking done.

### References

- [Source: `_bmad-output/planning-artifacts/architecture-epic-64-scoring-engine.md` §4.1–4.3, §5.1–5.5, §9, §11]
- [Source: `_bmad-output/planning-artifacts/prd-epic-64-intelligence-scoring-engine.md` §4.2 FR-5..FR-9]
- [Source: `_bmad-output/planning-artifacts/architecture-epic-64-scoring-engine.md` §12 — Novelty lookback **7 days** (locked)]
- [Source: `_bmad-output/implementation-artifacts/64-1-digest-signals-schema-extension.md` — schema key names + anti-drift scope]
- [Source: `scripts/session-close/lib/notebook-scorer.mjs` — `tokenizeForScoring`, `f1`]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-06-08.md` — five distinct dimension fields]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

- Novelty 45-band fixture required overlapRatio in [0.30, 0.60); initial paraphrase landed at ≥0.60 (25 row).
- Anti-drift test uses identical signal title across contexts so relevance stays equal while personalRelevance diverges.
- Hermes skill install gate required `bash scripts/install-hermes-skill-morning-digest.sh` after adding `score-digest-signals.mjs`.

### Completion Notes List

- Added `score-digest-signals.mjs` with all five dimension scorers, `loadScoringContext`, shared F1 primitive, watchlist/sprint/novelty env resolution.
- Novelty uses first-match-wins locked table (10/25/45/65/90/100); history supports string[] plus optional `{title, sourceType, seenAt}` objects.
- `personalRelevance` uses disjoint personal token set + epicBonus; fixtures prove independence from `relevance`.
- `scoreMomentum` Path B static priors; Path A accepts injected `normalizedEngagement` only (ADR-E64-003 guard).
- 20 tests in `morning-digest-score-signals.test.mjs`; full `bash scripts/verify.sh` green (642 vitest + node tests).

### Review patch closure (2026-06-09)

- Added `personalRelevance` calibration band fixtures (adjacent 21–50, active work 51–75).
- Added 7-day novelty lookback filter test (`seenAt` outside window excluded; undated entries retained).
- Documented string[] history without `seenAt` as full lookback set in `loadScoringContext`.
- Re-synced Hermes skill via `install-hermes-skill-morning-digest.sh`; verify green (22 score-signals tests).

### File List

- `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs` (NEW)
- `tests/morning-digest-score-signals.test.mjs` (NEW)

### Change Log

- 2026-06-09: Story 64-2 — five-dimension scoring engine module + test suite; Hermes skill sync via install script.
