---
story_id: 64-5
epic: 64
title: ranked-push-integration
status: review
baseline_commit: a7a1fc5
operator_brief: 2026-06-08
predecessors: 64-2, 64-3, 64-4
blocks: epic-64-retrospective
---

# Story 64.5: Ranked push integration — scoreDigestSignals orchestrator

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a **CNS operator consuming "What Matters Now" in the Nexus cockpit**,
I want **`scoreDigestSignals` to orchestrate 64-2..64-4 into a single ranked, disposition-labeled signal array that morning digest pushes to Convex in `rankScore` order**,
so that **`getDigestSignalsForRun` returns operator-prioritized intelligence without manual re-sort, `personalRelevance` drives ordering at 0.30 weight (ADR-E64-002), and the digest pipeline stays deterministic with regression-locked `rankScore` and stable tie-breaks**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 64: Intelligence Scoring Engine v1 — **64-5 is the orchestration + integration gate**; completes Epic 64 core chain |
| **Repo** | **Omnipotent.md only** — extend `score-digest-signals.mjs`, `task-prompt.md`, tests; **no** cns-dashboard changes (64-1 schema + read-side sort already landed) |
| **Predecessors** | **64-2** (five dimension scorers), **64-3** (`deriveDisposition`), **64-4** (`normalizeEngagement` + momentum Path A wiring) — all **done** at `a7a1fc5` |
| **Normative spec** | `architecture-epic-64-scoring-engine.md` **§4.1** (orchestrator exports), **§6.3** (execution order), **§7** (disposition after rankScore), **§8** (rankScore composite + sort), **§9** (degraded mode) |
| **FR IDs** | FR-13 (`computeRankScore`), FR-14 (ranked push order), FR-15 (notebook routing independence) |
| **Out of scope** | Convex mutations / validators (64-1 done); dashboard UI rank rendering; `pick-signal-notebook.mjs` routing changes; GitHub/Reddit **adapters** (Epic 65); live Convex reads for novelty history during cron; `last30days` dependency (ADR-E64-005); changing dimension formulas (locked 64-2), disposition table (locked 64-3), or normalization caps (locked 64-4) |

### Problem (current state)

`score-digest-signals.mjs` exports dimension scorers, `normalizeEngagement`, and `deriveDisposition` but **no** `computeRankScore` or `scoreDigestSignals`. Morning digest builds `digest_push_payload` with legacy section-order `rank` and **omits** `scores`, `disposition`, `normalizedEngagement`, `rankScore`. `push-digest-convex.mjs` already passthroughs scored fields unchanged (64-1 fixture test exists) — the missing link is **compute + sort + task-prompt wiring** before `DIGEST_PUSH_JSON` is stringified.

### Operator brief (binding)

1. **Architecture §8.1 weight table is normative AC** — `personalRelevance` **0.30** (anti-drift: cannot be zeroed); weights sum 1.00; absent `normalizedEngagement` redistributes **0.05 → momentum** (0.25 momentum weight).
2. **§6.3 execution order inside orchestrator** — `normalizeEngagement` → dimension scores (momentum last, fed normalized value) → `computeRankScore` → `deriveDisposition(scores, rankScore)`.
3. **Omnipotent.md only** — one orchestrator + task-prompt integration + tests; `bash scripts/verify.sh` green; Hermes skill sync after script edits.

## Acceptance Criteria

### 1. `computeRankScore` export and weight contract (AC: FR-13, architecture §8.1–8.2)

**Given** `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs`
**When** the module is imported
**Then** it exports `computeRankScore(scores, normalizedEngagement)` where `scores` has all five dimension keys (0–100 integers)

**And** exports named weight constants (anti-drift surface):

| Constant | Value |
|----------|-------|
| `RANK_WEIGHT_PERSONAL` | `0.30` |
| `RANK_WEIGHT_RELEVANCE` | `0.20` |
| `RANK_WEIGHT_MOMENTUM` | `0.20` |
| `RANK_WEIGHT_MOMENTUM_NO_ENGAGEMENT` | `0.25` |
| `RANK_WEIGHT_URGENCY` | `0.15` |
| `RANK_WEIGHT_NOVELTY` | `0.10` |
| `RANK_WEIGHT_NORMALIZED_ENGAGEMENT` | `0.05` |

**When `normalizedEngagement` is finite (0–100):**

```
rankScore = round(clamp(
  0.30 * personalRelevance
  + 0.20 * relevance
  + 0.20 * momentum
  + 0.15 * urgency
  + 0.10 * novelty
  + 0.05 * normalizedEngagement,
  0, 100))
```

**When `normalizedEngagement` is `null` / `undefined` / non-finite:**

```
rankScore = round(clamp(
  0.30 * personalRelevance
  + 0.20 * relevance
  + 0.25 * momentum
  + 0.15 * urgency
  + 0.10 * novelty,
  0, 100))
```

**And** function is **pure** — no env reads, no side effects
**And** same inputs always yield same integer output (determinism)

### 2. Mandatory `computeRankScore` fixture rows (AC: FR-13 regression lock)

**Given** controlled dimension inputs
**When** `computeRankScore` runs
**Then** outputs match **exactly**:

| personalRelevance | relevance | momentum | urgency | novelty | normalizedEngagement | Expected `rankScore` |
|-------------------|-----------|----------|---------|---------|---------------------|----------------------|
| 80 | 60 | 50 | 40 | 30 | 60 | **58** |
| 80 | 60 | 50 | 40 | 30 | `null` | **58** |
| 0 | 0 | 0 | 0 | 0 | `null` | **0** |
| 100 | 100 | 100 | 100 | 100 | 100 | **100** |

**Mandatory tests:** one dedicated test per table row — named or commented with row label. Do not substitute approximate assertions.

### 3. `scoreDigestSignals` orchestrator — per-signal pipeline (AC: §4.1, §6.3, §7)

**Given** an array of digest signal objects `{ section, sourceType, title, summary?, url?, score?, externalId?, sourceMetadata? }` and a loaded `ScoringContext`
**When** `scoreDigestSignals(signals, ctx)` runs (sync; `ctx` pre-loaded — caller may use `loadScoringContext` first)
**Then** for **each** input signal it:

1. Computes `normalizedEngagement = normalizeEngagement(signal)` (may be `null`)
2. Builds `scores`:

   ```
   relevance       = scoreRelevance(signal, ctx)
   personalRelevance = scorePersonalRelevance(signal, ctx)
   novelty         = scoreNovelty(signal, ctx)
   urgency         = scoreUrgency(signal, ctx)
   momentum        = scoreMomentum(signal, normalizedEngagement, ctx)
   ```

3. Computes `rankScore = computeRankScore(scores, normalizedEngagement)`
4. Computes `disposition = deriveDisposition(scores, rankScore)`
5. Returns enriched signal spreading original fields plus:
   - `scores` (all five keys)
   - `disposition`
   - `rankScore`
   - `normalizedEngagement` **only when finite** — **omit key when null** (Convex strict contract: never `null`)

**And** preserves all original signal keys (`section`, `sourceType`, `title`, `url`, `externalId`, `sourceMetadata`, legacy top-level `score`, etc.)
**And** does **not** mutate the input array in place — returns a new array

### 4. Sort, rank assignment, and stable tie-break (AC: FR-14, architecture §8.3)

**Given** multiple scored signals
**When** `scoreDigestSignals` completes
**Then** returned array is sorted by `rankScore` **descending**
**And** each signal's `rank` is reassigned **1..N** in sorted order (`1` = highest `rankScore`)
**And** when two signals have equal `rankScore`, **stable tie-break** preserves pre-sort input order (lower original index wins higher rank position among ties — i.e. stable sort by descending rankScore)

**Mandatory sort fixture (FR-14):**

| Signal | personalRelevance (via ctx) | Other dims held equal | Expected relative order |
|--------|----------------------------|----------------------|-------------------------|
| A | high personal overlap | same base relevance/novelty/urgency; A has HN points | **A before B** |
| B | low personal overlap | same | **B after A** |

Test must assert `result[0].rankScore > result[1].rankScore` and `result[0].rank === 1`.

### 5. CLI / env integration helper (AC: task-prompt terminal wiring)

**Given** `score-digest-signals.mjs` run as main (`node score-digest-signals.mjs`)
**When** env provides:

| Env | Purpose |
|-----|---------|
| `DIGEST_SIGNALS_JSON` | JSON array of unscored signals (same shape as `digest_push_payload.signals`) |
| `DIGEST_RUN_AT` | ms epoch (optional; passed through to `loadScoringContext`) |
| Plus existing scoring context env from §4.2 (`CNS_REPO_ROOT`, `MORNING_DIGEST_PROJECT_ENTITIES`, `DIGEST_NOVELTY_HISTORY_JSON`, etc.) |

**Then** script:

1. Parses `DIGEST_SIGNALS_JSON` (invalid/missing → stderr warning, exit **0**, stdout `[]` or passthrough per §9 degraded intent)
2. `await loadScoringContext(env)`
3. `scoreDigestSignals(signals, ctx)`
4. Writes **stdout** single JSON array of scored signals (no extra logging on stdout)
5. Exit **0** on success

**And** stderr uses prefix `score-digest-signals:` for warnings/errors
**And** scoring failure (thrown error) → stderr warning, exit **0**, stdout is **unscored** input signals with original `rank` preserved (architecture §9 degraded mode)

### 6. `task-prompt.md` post-post integration (AC: FR-14 pipeline wiring)

**Given** `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` post-post §9 section
**When** the agent builds `digest_push_payload`
**Then** documentation requires this **insertion after signal mapping, before** `JSON.stringify(digest_push_payload)`:

1. Invoke scoring terminal:

   ```
   SCORE_SCRIPT = resolved_repo_root + "/scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs"
   DIGEST_SIGNALS_JSON = JSON.stringify(digest_push_payload.signals)
   DIGEST_RUN_AT = digest_start_ms
   terminal: node score-digest-signals.mjs with env (timeout ≤ 30s)
   ```

2. Parse stdout JSON array → replace `digest_push_payload.signals`
3. On scoring failure/empty stdout → **continue with unscored signals** (§9); push still fires (fire-and-forget)

**And** update scoring fields bullet from "optional until 64-5" → **populated by scoring step** (omit only on degraded failure)
**And** update `rank` bullet: assigned from `rankScore` sort (not legacy section index)
**And** document `DIGEST_NOVELTY_HISTORY_JSON` preference: **`{ title, sourceType, seenAt? }[]`** when operator/history available (unblocks novelty rule 65 — see deferred-work.md 64-2 item)
**And** **no** changes to Source 6 notebook routing steps (FR-15)

### 7. `push-digest-convex.mjs` contract preservation (AC: FR-14 passthrough)

**Given** pre-scored `DIGEST_PUSH_JSON` with signals sorted by `rankScore` desc and `rank` 1..N
**When** `pushDigestToConvex` runs
**Then** `addDigestSignal` mutation order matches payload array order (existing loop — **no code change required** unless regression found)
**And** existing test `passes scored signal fields through to addDigestSignal unchanged` remains green

**Optional extend:** add test asserting mutation call **order** matches descending `rankScore` when payload is pre-sorted (documents FR-14 contract).

### 8. Notebook routing independence (AC: FR-15)

**Given** `pick-signal-notebook.mjs`
**When** this story is complete
**Then** there is **no** import from `score-digest-signals.mjs` in notebook routing modules
**And** `tests/morning-digest-pick-signal-notebook.test.mjs` passes unchanged (run via `verify.sh`)

### 9. Scope boundary and regression gate (AC: verify)

**Given** implementation complete
**When** inspecting exports
**Then** stories 64-2..64-4 pure functions remain behavior-identical (no formula changes)
**And** all existing `morning-digest-score-signals.test.mjs` tests remain green
**And** `bash scripts/install-hermes-skill-morning-digest.sh` run after script + task-prompt edits
**And** `bash scripts/verify.sh` green

## Tasks / Subtasks

- [x] **T1** Implement `computeRankScore` + weight constants in `score-digest-signals.mjs` (AC: 1, 2)
  - [x] Export anti-drift weight constants
  - [x] Both engagement-present and engagement-absent branches with `round` + `clamp` at final step only
- [x] **T2** Implement `scoreDigestSignals(signals, ctx)` orchestrator (AC: 3, 4)
  - [x] §6.3 execution order per signal
  - [x] Stable descending sort + `rank` reassignment
  - [x] Omit `normalizedEngagement` key when null
- [x] **T3** Add CLI main block for `DIGEST_SIGNALS_JSON` scoring (AC: 5)
  - [x] §9 degraded mode: try/catch → stderr warning, passthrough unscored, exit 0
- [x] **T4** Update `task-prompt.md` post-post scoring step + novelty history object[] note (AC: 6)
  - [x] Bump task-prompt version comment if present
- [x] **T5** Extend tests (AC: 2, 4, 7, 9)
  - [x] `computeRankScore` four fixture rows
  - [x] `scoreDigestSignals` sort fixture (personalRelevance drives order)
  - [x] Orchestrator integration: HN signal with `sourceMetadata.points` → populated `normalizedEngagement` + Path A momentum + full scored shape
  - [x] Optional: push-convex mutation order test
  - [x] Add `tests/hermes-morning-digest-skill.test.mjs` assertion for `score-digest-signals.mjs` in task-prompt (mirror 61-5 push pattern)
- [x] **T6** Hermes skill sync + verify gate (AC: 9)
  - [x] `bash scripts/install-hermes-skill-morning-digest.sh`
  - [x] `bash scripts/verify.sh`

## Dev Notes

### Architecture compliance (normative)

| ADR / Section | Requirement for 64-5 |
|---------------|---------------------|
| ADR-E64-001 | Scoring in Omnipotent.md only — no Convex compute |
| ADR-E64-002 | `rankScore` is ordering SSOT; `rank` reflects sort position |
| ADR-E64-003 | Orchestrator calls `normalizeEngagement` then `scoreMomentum` — momentum never reads raw engagement |
| §8.1 | `personalRelevance` weight **0.30** — export constants |
| §8.3 | Descending sort; stable tie-break on input order |
| §9 | Scoring throw → unscored push; must not block Discord post |
| FR-15 | No `score-digest-signals` import in `pick-signal-notebook.mjs` |

### Current file state (`score-digest-signals.mjs`)

**Exports today (64-4 baseline):** `clamp`, cap constants, `logNorm`, `normalizeEngagement`, `f1Score`, `tokenizeSignalText`, `normalizeTitle`, watchlist/sprint parsers, `loadScoringContext`, five `score*` functions, `overlapRatio`, `recencyScore`, `breakingBonus`, `trendProxyForSignal`, `scoreMomentum`, `deriveDisposition`.

**Missing (this story):** `computeRankScore`, `scoreDigestSignals`, CLI `main`, weight constants.

**Update header comment:** `Stories 64-2, 64-3, 64-4` → `Stories 64-2..64-5`.

### Orchestrator implementation sketch (normative shape — dev may adjust private helpers)

```javascript
/**
 * @param {DigestSignal[]} signals
 * @param {ScoringContext} ctx
 * @returns {Array<DigestSignal & { scores: DimensionScores, disposition: string, rankScore: number, rank: number, normalizedEngagement?: number }>}
 */
export function scoreDigestSignals(signals, ctx) {
  const enriched = signals.map((signal, originalIndex) => {
    const normalizedEngagement = normalizeEngagement(signal);
    const scores = {
      relevance: scoreRelevance(signal, ctx),
      personalRelevance: scorePersonalRelevance(signal, ctx),
      novelty: scoreNovelty(signal, ctx),
      urgency: scoreUrgency(signal, ctx),
      momentum: scoreMomentum(signal, normalizedEngagement, ctx),
    };
    const rankScore = computeRankScore(scores, normalizedEngagement);
    const disposition = deriveDisposition(scores, rankScore);
    const out = { ...signal, scores, disposition, rankScore, _oi: originalIndex };
    if (normalizedEngagement != null && Number.isFinite(normalizedEngagement)) {
      out.normalizedEngagement = normalizedEngagement;
    }
    return out;
  });

  enriched.sort((a, b) => {
    if (b.rankScore !== a.rankScore) return b.rankScore - a.rankScore;
    return a._oi - b._oi;
  });

  return enriched.map(({ _oi, ...signal }, index) => ({
    ...signal,
    rank: index + 1,
  }));
}
```

**Disposition order note:** `deriveDisposition` is called **after** `rankScore` so rules 2–3 (`priority`, `ignore`) can evaluate. Rule 1 (`escalate`) ignores `rankScore` — already implemented in 64-3.

### `computeRankScore` reference implementation

```javascript
export function computeRankScore(scores, normalizedEngagement) {
  const { personalRelevance, relevance, momentum, urgency, novelty } = scores;
  const hasEngagement =
    normalizedEngagement != null && Number.isFinite(normalizedEngagement);
  const raw = hasEngagement
    ? RANK_WEIGHT_PERSONAL * personalRelevance +
      RANK_WEIGHT_RELEVANCE * relevance +
      RANK_WEIGHT_MOMENTUM * momentum +
      RANK_WEIGHT_URGENCY * urgency +
      RANK_WEIGHT_NOVELTY * novelty +
      RANK_WEIGHT_NORMALIZED_ENGAGEMENT * normalizedEngagement
    : RANK_WEIGHT_PERSONAL * personalRelevance +
      RANK_WEIGHT_RELEVANCE * relevance +
      RANK_WEIGHT_MOMENTUM_NO_ENGAGEMENT * momentum +
      RANK_WEIGHT_URGENCY * urgency +
      RANK_WEIGHT_NOVELTY * novelty;
  return clamp(Math.round(raw), 0, 100);
}
```

### Task-prompt integration point (read before editing)

**File:** `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md`

**Current flow (post-post §9):**

1. Build `digest_push_payload` from parsed source outputs (signal mapping table)
2. `JSON.stringify` → `DIGEST_PUSH_JSON` → `push-digest-convex.mjs`

**Target flow:**

1. Build unscored `digest_push_payload.signals` (same mapping table — engagement fields `points`/`commentCount` for HN)
2. **Score** via `score-digest-signals.mjs` CLI → replace `signals`
3. Stringify full payload → push → keyword candidates (unchanged §10)

**Preserve:** fire-and-forget exit 0 semantics; strict-schema contract (never `null` optional keys); `digest_start_ms` → `DIGEST_RUN_AT`.

### `push-digest-convex.mjs` (read-only unless regression)

```148:155:scripts/hermes-skill-examples/morning-digest/scripts/push-digest-convex.mjs
    for (const signal of payload.signals) {
      if (!signal || typeof signal !== 'object') {
        continue;
      }
      await postMutation(fetchFn, convexEnv, ADD_PATH, {
        signal: { ...signal, digestRunId },
      });
    }
```

Loop preserves array order — scored payload order **is** Convex insert order. No field stripping.

### Novelty history enrichment (deferred-work closure)

`deferred-work.md` (64-2 review): novelty rule **65** unreachable with `string[]` history. **64-5 task-prompt** should document injecting `DIGEST_NOVELTY_HISTORY_JSON` as:

```json
[{"title":"Prior HN story","sourceType":"hackernews","seenAt":1749000000000}]
```

`loadScoringContext` / `parseNoveltyHistoryJson` already accept this shape — no module change required unless adding a small `buildNoveltyHistoryEntries(signals)` export is useful for tests (optional, not required).

### Previous story intelligence

**64-4:**

- §6.3 two-step contract: `normalizeEngagement` → `scoreMomentum` — orchestrator must wire, not reimplement
- Omit `normalizedEngagement` from output when null — same rule for orchestrator output
- Test style: mandatory exact fixture rows; `assert.equal` not ranges

**64-3:**

- `deriveDisposition(scores, rankScore)` — call after `computeRankScore`
- §7.1 fixture tests must stay green

**64-2:**

- All dimension functions pure; `loadScoringContext` async — CLI awaits it
- ADR-E64-003 momentum guard test must stay green
- Hermes install gate after morning-digest script edits

**64-1:**

- When `scores` present, all five keys required for Convex validators
- Scored push round-trip test already in `morning-digest-push-convex.test.mjs`

### Git intelligence (recent Epic 64 work)

| Commit | Relevance |
|--------|-----------|
| `a7a1fc5` | 64-4 `normalizeEngagement` — **immediate baseline** |
| `f1513d3` | 64-3 `deriveDisposition` |
| `14c77b0` | 64-2 dimension scorers + momentum guard |
| `cfdbfd3` | 64-1 scored payload passthrough test pattern |

### Project structure notes

| Path | Change |
|------|--------|
| `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs` | **UPDATE** — `computeRankScore`, `scoreDigestSignals`, weight constants, CLI main |
| `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` | **UPDATE** — scoring step in post-post §9 |
| `tests/morning-digest-score-signals.test.mjs` | **EXTEND** — rankScore fixtures + orchestrator + sort |
| `tests/morning-digest-push-convex.test.mjs` | **OPTIONAL EXTEND** — mutation order assertion |
| `tests/hermes-morning-digest-skill.test.mjs` | **EXTEND** — task-prompt documents scoring script |
| `push-digest-convex.mjs` | **NO CHANGE** (expected) |
| `pick-signal-notebook.mjs` | **NO CHANGE** |
| `cns-dashboard/` | **NO CHANGE** |

### Testing requirements

| File | Action |
|------|--------|
| `tests/morning-digest-score-signals.test.mjs` | **EXTEND** — primary gate: `computeRankScore` rows, `scoreDigestSignals` pipeline + sort |
| `tests/morning-digest-push-convex.test.mjs` | **Run** (+ optional order test) |
| `tests/morning-digest-pick-signal-notebook.test.mjs` | **Run unchanged** — FR-15 |
| `tests/hermes-morning-digest-skill.test.mjs` | **EXTEND** — task-prompt scoring wiring |

**Gate:** `bash scripts/verify.sh` green before marking done.

### WriteGate / security

No WriteGate, `vault_log_action`, or `security.md` changes. No operator approval required.

### References

- [Source: `_bmad-output/planning-artifacts/architecture-epic-64-scoring-engine.md` §1.2, §4.1, §6.3, §8, §9, §10, §11]
- [Source: `_bmad-output/planning-artifacts/prd-epic-64-intelligence-scoring-engine.md` §4.5 FR-13..FR-15]
- [Source: `_bmad-output/implementation-artifacts/64-4-engagement-normalization.md` — §6.3 execution order preview]
- [Source: `_bmad-output/implementation-artifacts/64-3-derived-disposition.md` — disposition after rankScore]
- [Source: `_bmad-output/implementation-artifacts/64-2-scoring-engine-five-dimensions.md` — dimension exports + scope boundary]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — novelty rule 65 / object[] history]
- [Source: `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs` — extend in place]
- [Source: `scripts/hermes-skill-examples/morning-digest/scripts/push-digest-convex.mjs` — passthrough loop]
- [Source: `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` — post-post §9 signal mapping]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor Agent)

### Debug Log References

- Verified engagement-absent branch uses `RANK_WEIGHT_MOMENTUM_NO_ENGAGEMENT` (0.25), not 0.20 — row 2 fixture locks rankScore 58 parity with engagement-present row.
- Orchestrator calls `deriveDisposition(scores, rankScore)` only after `computeRankScore` (§6.3 order).

### Completion Notes List

- Added `computeRankScore`, eight anti-drift weight constants, `scoreDigestSignals` orchestrator (§6.3 pipeline, stable descending sort, rank 1..N), and CLI via `DIGEST_SIGNALS_JSON` with §9 degraded passthrough.
- Updated `task-prompt.md` post-post §9: scoring terminal before push, `DIGEST_NOVELTY_HISTORY_JSON` object[] preference, rank/scoring field bullets.
- Extended score-signals, push-convex (mutation order), and hermes skill tests. Hermes skill synced; `bash scripts/verify.sh` green.

### File List

- `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs`
- `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md`
- `tests/morning-digest-score-signals.test.mjs`
- `tests/morning-digest-push-convex.test.mjs`
- `tests/hermes-morning-digest-skill.test.mjs`

## Change Log

- 2026-06-09: Story 64-5 — ranked push integration (`computeRankScore`, `scoreDigestSignals`, task-prompt scoring step, tests).
- 2026-06-09: Code review — clean pass; all AC satisfied; Epic 64 core chain closed.

### Review Findings

- [x] [Review] Clean pass — 0 patch, 0 decision-needed. Acceptance Auditor: all 9 AC groups PASS. Pre-existing edge cases (empty-title novelty, CVE regex, batch degraded-mode) deferred to Epic 65 / deferred-work; not introduced by 64-5.
