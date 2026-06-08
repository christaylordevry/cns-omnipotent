---
title: Epic 64 — Intelligence Scoring Engine v1 Architecture
status: complete
created: 2026-06-09
updated: 2026-06-09
epicScope: epic-64
workflowType: architecture
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
completedAt: 2026-06-09
inputDocuments:
  - _bmad-output/planning-artifacts/prd-epic-64-intelligence-scoring-engine.md
  - _bmad-output/planning-artifacts/sprint-change-proposal-2026-06-08.md
  - _bmad-output/planning-artifacts/prds/prd-epic-64-2026-06-08/addendum.md
  - project-context.md
  - cns-dashboard/convex/validators.ts
  - cns-dashboard/convex/digest.ts
  - scripts/hermes-skill-examples/morning-digest/scripts/push-digest-convex.mjs
  - scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs
  - scripts/session-close/lib/notebook-scorer.mjs
relatedPrd:
  - _bmad-output/planning-artifacts/prd-epic-64-intelligence-scoring-engine.md
repos:
  scoringCompute: Omnipotent.md
  schemaPersistence: cns-dashboard
---

# Architecture: Epic 64 — Intelligence Scoring Engine v1

**Author:** Chris Taylor (architecture workflow)  
**Date:** 2026-06-09  
**Status:** Complete — normative for stories 64-1 through 64-5

## 0. Document Purpose

This architecture is the **normative technical contract** for Epic 64 story authoring and implementation. It owns:

- ADR-E64-001 through ADR-E64-005
- Numeric weight tables, threshold tables, and calibration constants
- Per-dimension and per-source algorithms
- Schema extensions and pipeline integration points
- Story-to-section traceability for `/bmad-create-story` and `/bmad-dev-story`

**Primary inputs:** `prd-epic-64-intelligence-scoring-engine.md`, `sprint-change-proposal-2026-06-08.md` (approved 2026-06-08).

**Downstream consumers:** Stories 64-1..64-5; Epic 63 Nexus cockpit (read-side consumer); Epic 65 adapters (engagement metadata emitters).

---

## 1. System Context

### 1.1 Current state (brownfield)

| Component | Location | Today |
|-----------|----------|-------|
| Signal assembly | `pick-signal-notebook.mjs` → `buildDigestSignals()` | Source-order cap 10; trends → headlines → Perplexity → arXiv → HN |
| Notebook routing | `pick-signal-notebook.mjs` | `winning_signal` via `notebook-scorer.mjs` F1 — **unchanged purpose** |
| Convex push | `push-digest-convex.mjs` | `DIGEST_PUSH_JSON` → `createDigestRun` + `addDigestSignal` |
| Schema | `cns-dashboard/convex/validators.ts` | Optional legacy `score`; no dimension fields |
| Read queries | `cns-dashboard/convex/digest.ts` | `getDigestSignalsForRun` sorts by `rank` ascending |
| HN engagement | `fetch-hn-rss.mjs` | Parses `score`/`comments` from RSS description — **not yet in push metadata** |

### 1.2 Target state (Epic 64)

```
digest_sources (collectors)
    → buildDigestSignals()          # candidate titles (still source-order assembly)
    → enrichSignalMetadata()        # attach sourceType, url, engagement raw fields
    → scoreDigestSignals()          # NEW: 5 dims + normalizedEngagement + disposition + rankScore
    → sortByRankScore()             # descending rankScore
    → push-digest-convex.mjs        # pre-scored DIGEST_PUSH_JSON
    → Convex digestSignals          # persist only; no server-side scoring
    → getDigestSignalsForRun        # sort by rankScore desc when present
```

**Parallel path (unchanged):** `pick-signal-notebook.mjs` continues NotebookLM routing independently of `rankScore`.

### 1.3 Repo boundary

| Layer | Repo | Responsibility |
|-------|------|----------------|
| Scoring compute | Omnipotent.md | `score-digest-signals.mjs` (new), morning-digest integration |
| Push contract | Omnipotent.md | `push-digest-convex.mjs` |
| Schema + persistence | cns-dashboard | `validators.ts`, `digest.ts` (64-1 only cross-repo touch) |
| UI rendering | cns-dashboard | **Out of scope** — Epic 63 consumes data when ready |

---

## 2. Architecture Decision Records

### ADR-E64-001 — Scoring compute lives in Omnipotent.md digest pipeline

**Status:** Accepted  
**Context:** Epic 64 requires five dimension scores, disposition, normalization, and `rankScore` before Convex persistence. Convex is reactive read infrastructure; scoring is batch cron work.  
**Decision:** All scoring logic executes in Omnipotent.md Node scripts **after** `buildDigestSignals()` produces candidates and **before** `push-digest-convex.mjs` sends `DIGEST_PUSH_JSON`. Convex mutations validate and store; Convex queries sort. **No scoring in Convex functions.**  
**Consequences:**
- Stories 64-2..64-5 are Omnipotent.md-only.
- 64-1 extends cns-dashboard validators + one Omnipotent.md push-contract update.
- Unit tests live in Omnipotent.md `tests/` with fixture JSON.

---

### ADR-E64-002 — `scores` object is SSOT for dimensions; `rankScore` is SSOT for ordering

**Status:** Accepted  
**Context:** Legacy optional `score` field exists on `digestSignals`. PRD requires five named dimensions.  
**Decision:**
- `digestSignals.scores` holds the five dimension values (0–100 each). When `scores` is present, all five keys are required.
- `digestSignals.rankScore` is the composite ordering key for "What Matters Now."
- Legacy `score` remains optional for backward compatibility; **must not** be used as a proxy for any dimension or `rankScore`.
- `rank` field on push reflects sort position (1 = highest `rankScore`) and is the stable tie-breaker after `rankScore`.

**Consequences:**
- Validators reject partial `scores` objects.
- Read queries prefer `rankScore` over legacy `rank` for ordering when `rankScore` is present.

---

### ADR-E64-003 — Raw engagement never compared cross-source

**Status:** Accepted  
**Context:** HN `points`, GitHub `stars`, Reddit `upvotes` live on incomparable scales. HN RSS already exposes points/comments (`fetch-hn-rss.mjs`).  
**Decision:**
- Per-source normalization produces `normalizedEngagement` (0–100) using source-specific calibration (§6).
- `momentum` consumes `normalizedEngagement` when engagement metadata exists.
- Raw `points`/`stars`/`upvotes`/`commentCount` are stored in `sourceMetadata` for audit only; **must not** feed cross-source comparisons or `rankScore` directly.

**Consequences:**
- 64-4 implements `normalizeEngagement(signal)` as a pure function with per-source tables.
- Unit test asserts momentum path does not read raw cross-source engagement fields.

---

### ADR-E64-004 — Personal relevance v1 is thin keyword/entity match; vault-semantic deferred

**Status:** Accepted  
**Context:** Nexus principle: every signal scored for personal relevance — not just market motion. Vault IO / PAKE embeddings are out of scope for v1.  
**Decision:**
- `personalRelevance` is computed independently from `relevance` using a separate token set (§5.2).
- v1 inputs: active sprint keywords, operator project entities, watchlist `personal` terms — all from config/files/env snapshot at scoring time.
- No Convex live queries, no vault reads, no embedding similarity in v1.

**Consequences:**
- Merging personal and topical fit into one score violates PRD and this ADR.
- Story 64-2 fixtures must prove `personalRelevance` ≠ f(`relevance`) for controlled inputs.

---

### ADR-E64-005 — last30days is reference codebook only

**Status:** Accepted  
**Context:** Approved sprint-change locked decision #4.  
**Decision:** `~/ai-factory/projects/last30days-skill-reference` is read-only study material. Epic 64 **must not** add last30days to `package.json`, import graph, or subprocess calls.  
**Consequences:** Engagement normalization and HN parsing are CNS-native implementations in Node.

---

## 3. Schema Contract (Story 64-1)

### 3.1 `digestSignals` field extensions

Primary file: `cns-dashboard/convex/validators.ts`

```typescript
// NEW — all optional for backward compatibility during migration
scores: v.optional(v.object({
  relevance: v.number(),           // 0–100 inclusive
  personalRelevance: v.number(),     // 0–100 inclusive
  novelty: v.number(),             // 0–100 inclusive
  momentum: v.number(),            // 0–100 inclusive
  urgency: v.number(),             // 0–100 inclusive
})),
disposition: v.optional(v.union(
  v.literal('priority'),
  v.literal('watch'),
  v.literal('ignore'),
  v.literal('escalate'),
)),
normalizedEngagement: v.optional(v.number()), // 0–100 inclusive
rankScore: v.optional(v.number()),              // 0–100 inclusive
```

Apply identically to `digestSignalInputValidator` and `digestSignalRowValidator`.

**Validation rules:**
- When `scores` is provided, all five keys required; each value `>= 0 && <= 100`.
- When `normalizedEngagement` or `rankScore` provided, value `>= 0 && <= 100`.
- Invalid `disposition` literal → validator rejection.

### 3.2 `sourceMetadata` engagement extension

```typescript
// Extend sourceMetadataValidator
stars: v.optional(v.number()),
forks: v.optional(v.number()),
upvotes: v.optional(v.number()),
points: v.optional(v.number()),        // HN points
commentCount: v.optional(v.number()),
publishedAt: v.optional(v.string()),   // already exists — used by urgency
```

**HN mapping (64-1 push contract):** `fetch-hn-rss.mjs` `score` → `sourceMetadata.points`; `comments` → `sourceMetadata.commentCount`.

### 3.3 Read-side sort (64-1)

Update `getDigestSignalsForRun` in `digest.ts`:

```typescript
.sort((a, b) => {
  const aRank = a.rankScore ?? null;
  const bRank = b.rankScore ?? null;
  if (aRank != null && bRank != null && aRank !== bRank) {
    return bRank - aRank; // rankScore descending
  }
  if (aRank != null && bRank == null) return -1;
  if (aRank == null && bRank != null) return 1;
  if (a.rank !== b.rank) return a.rank - b.rank; // legacy ascending rank
  return 0; // stable; _creationTime tie-break deferred to Convex collect order
})
```

Return mapper must include new fields: `scores`, `disposition`, `normalizedEngagement`, `rankScore`.

### 3.4 Push contract (`push-digest-convex.mjs`)

`DIGEST_PUSH_JSON.signals[]` entries may include all new fields. Push script passes them through unchanged to `addDigestSignal`. Fixture round-trip test required (FR-4).

---

## 4. Scoring Module Design (Stories 64-2..64-5)

### 4.1 New module

**Path:** `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs`

**Exports (normative):**

| Function | Purpose | Story |
|----------|---------|-------|
| `loadScoringContext(env)` | Resolve watchlist, sprint tokens, project entities, novelty history | 64-2 |
| `tokenizeSignalText(title, summary?)` | Reuse `tokenizeForScoring` from `notebook-scorer.mjs` | 64-2 |
| `scoreRelevance(signal, ctx)` | Topical dimension | 64-2 |
| `scorePersonalRelevance(signal, ctx)` | Personal dimension | 64-2 |
| `scoreNovelty(signal, ctx)` | History dedupe | 64-2 |
| `scoreUrgency(signal, ctx)` | Recency + patterns | 64-2 |
| `normalizeEngagement(signal)` | Per-source 0–100 | 64-4 |
| `scoreMomentum(signal, normalizedEngagement, ctx)` | Engagement + proxies | 64-2, 64-4 |
| `deriveDisposition(scores, rankScore)` | Categorical label | 64-3 |
| `computeRankScore(scores, normalizedEngagement)` | Composite ordering | 64-5 |
| `scoreDigestSignals(signals, ctx)` | Orchestrator → scored + sorted array | 64-5 |

**Integration point:** Morning-digest task-prompt Source 6 (post-collectors) calls `scoreDigestSignals` before building `DIGEST_PUSH_JSON`.

### 4.2 Scoring context inputs (v1)

| Input | Source | Env / path | Used by |
|-------|--------|------------|---------|
| Watchlist domain keywords | `~/.hermes/trend-watchlist.yaml` | file via `resolveOperatorHome()` | `relevance` |
| Sprint keywords | `_bmad-output/implementation-artifacts/sprint-status.yaml` | `CNS_REPO_ROOT` relative or `MORNING_DIGEST_SPRINT_STATUS_PATH` | `personalRelevance` |
| Project entities | Operator config | `MORNING_DIGEST_PROJECT_ENTITIES` (comma-separated) | `personalRelevance` |
| Personal watchlist terms | watchlist `personal:` category if present | same YAML | `personalRelevance` |
| Keyword candidates snapshot | Epic 62 output | `DIGEST_KEYWORD_CANDIDATES_JSON` optional | `personalRelevance` supplement |
| Novelty history | Prior digest signal titles | `DIGEST_NOVELTY_HISTORY_JSON` optional; else empty → novelty defaults high | `novelty` |
| Run timestamp | Digest run | `DIGEST_RUN_AT` ms epoch or `Date.now()` at score time | `urgency` |

**Sprint tokenization rule:** Tokenize epic keys (`epic-64`), in-progress story titles, and `epic-N` numeric tokens from `sprint-status.yaml`. Minimum token length 2; use `tokenizeForScoring`.

**No live Convex reads during cron** — history and keyword snapshots must be env-injected by the digest orchestration layer or omitted (degraded mode documented below).

### 4.3 Shared primitives

**Tokenization:** Import `tokenizeForScoring` from `scripts/session-close/lib/notebook-scorer.mjs`. Do not duplicate stopword lists.

**F1 overlap → 0–100:**

```
f1Score(tokensA, tokensB) = round(clamp(f1(tokensA, tokensB) * 100, 0, 100))
```

where `f1` is the existing function in `notebook-scorer.mjs`.

**clamp:**

```
clamp(x, min, max) = max(min, min(max, x))
```

---

## 5. Dimension Algorithms (Story 64-2)

### 5.1 `relevance` (0–100) — topical fit

**Question answered:** "Is this on-theme for my intelligence domains?"

**Token sets:**
- `signalTokens` = tokenize(title + ' ' + (summary ?? ''))
- `domainTokens` = all keywords from `trend-watchlist.yaml` **excluding** `personal:` category entries

**Formula:**

```
relevance = f1Score(signalTokens, domainTokens)
```

**Calibration bands (interpretation):**

| Band | Range | Condition |
|------|-------|-----------|
| Off-topic | 0–20 | f1 < 0.05 |
| Peripheral | 21–50 | 0.05 ≤ f1 < 0.25 |
| On-theme | 51–75 | 0.25 ≤ f1 < 0.50 |
| Core theme | 76–100 | f1 ≥ 0.50 |

---

### 5.2 `personalRelevance` (0–100) — operator fit

**Question answered:** "Does this matter to *my* work right now?"

**Token sets:**
- `signalTokens` as above
- `personalTokens` = union of:
  - sprint tokens (§4.2)
  - project entity tokens from `MORNING_DIGEST_PROJECT_ENTITIES`
  - watchlist `personal:` category keywords
  - optional `DIGEST_KEYWORD_CANDIDATES_JSON` terms tagged `personal`

**Formula:**

```
base = f1Score(signalTokens, personalTokens)
epicBonus = 15 if any epic numeric token (e.g. "64") from active in-progress epics appears in signalTokens else 0
personalRelevance = clamp(base + epicBonus, 0, 100)
```

**Anti-drift:** `personalTokens` and `domainTokens` are disjoint sets by construction. `relevance` must not read sprint or project tokens.

**Calibration bands:**

| Band | Range | Condition |
|------|-------|-----------|
| No personal overlap | 0–20 | base < 0.05 and epicBonus = 0 |
| Adjacent | 21–50 | 0.05 ≤ base < 0.25 |
| Active work | 51–75 | 0.25 ≤ base < 0.50 OR epicBonus > 0 with base ≥ 0.15 |
| Direct hit | 76–100 | base ≥ 0.50 OR (epicBonus > 0 AND base ≥ 0.35) |

---

### 5.3 `novelty` (0–100) — history dedupe

**Lookback:** 7 calendar days of prior signal titles per workspace (case-insensitive).

**History source:** `DIGEST_NOVELTY_HISTORY_JSON` = `string[]` titles. If absent, treat history as empty (all signals get novelty ≥ 75).

**Title match key:** `normalize(title) = title.trim().toLowerCase()`

**Token overlap:** `overlapRatio(a, b) = |intersection(tokenize(a), tokenize(b))| / max(1, |tokenize(a)|)`

**Formula (first matching rule wins):**

| Condition | novelty |
|-----------|---------|
| Exact normalized title in history | 10 |
| overlapRatio ≥ 0.60 with any history title | 25 |
| overlapRatio ≥ 0.30 with any history title | 45 |
| Same `sourceType` seen in history but title novel | 65 |
| First appearance in lookback window | 90 |
| First appearance ever (empty history) | 100 |

---

### 5.4 `urgency` (0–100) — time sensitivity

**No LLM in v1.** Heuristic only.

**Recency score** (`recency`, 0–100) from `sourceMetadata.publishedAt` or digest run time:

| Age | recency |
|-----|---------|
| ≤ 6 hours | 95 |
| ≤ 24 hours | 80 |
| ≤ 72 hours | 55 |
| ≤ 7 days | 35 |
| > 7 days or unknown | 15 |

**Breaking pattern bonus** (`breaking`, 0 or 20): +20 if title matches any (case-insensitive):

```
\b(breaking|launch|released|announces|emergency|critical|cve-\d|outage|today)\b
```

**Source-type prior** (`sourcePrior`):

| sourceType | sourcePrior |
|------------|-------------|
| newsapi | 15 |
| hackernews | 10 |
| google_trends | 10 |
| deep_signal | 5 |
| arxiv | 0 |

**Formula:**

```
urgency = clamp(round(0.7 * recency + 0.2 * sourcePrior + breaking), 0, 100)
```

---

### 5.5 `momentum` (0–100) — engagement velocity

**Requires ADR-E64-003.** Two paths:

**Path A — engagement present** (`normalizedEngagement` computed in 64-4):

```
momentum = clamp(round(0.75 * normalizedEngagement + 0.25 * trendProxy), 0, 100)
```

**Path B — no engagement metadata:**

```
momentum = clamp(round(trendProxy), 0, 100)
```

**`trendProxy` (0–100):**

| sourceType | trendProxy |
|------------|------------|
| google_trends | `normalizedValue * 100` from matching trend row if linked; else 40 |
| hackernews | 45 (static prior — points not used raw) |
| newsapi | 35 |
| arxiv | 25 |
| deep_signal | 50 |

**Guard:** In Path A, implementation must not read `sourceMetadata.points`, `stars`, or `upvotes` directly — only `normalizedEngagement`.

---

## 6. Cross-Source Engagement Normalization (Story 64-4)

### 6.1 Per-source log-scaled maps

**Shared helper:**

```
logNorm(value, cap) = round(clamp(100 * log10(1 + value) / log10(1 + cap), 0, 100))
```

| sourceType | Raw input | cap constant | Formula |
|------------|-----------|--------------|---------|
| hackernews | `points`, `commentCount` | `HN_POINTS_CAP = 500`, `HN_COMMENTS_CAP = 200` | `logNorm(points, 500) * 0.80 + logNorm(commentCount, 200) * 0.20` |
| github | `stars`, `forks` | `GH_STARS_CAP = 50000`, `GH_FORKS_CAP = 5000` | `logNorm(stars, 50000) * 0.85 + logNorm(forks, 5000) * 0.15` |
| reddit | `upvotes`, `commentCount` | `RD_UPVOTES_CAP = 10000`, `RD_COMMENTS_CAP = 2000` | `logNorm(upvotes, 10000) * 0.75 + logNorm(commentCount, 2000) * 0.25` |
| newsapi | — | — | omit `normalizedEngagement` |
| arxiv | — | — | omit `normalizedEngagement` |
| google_trends | `normalizedValue` | already 0–1 | `round(normalizedValue * 100)` when passed via metadata; used for trendProxy not cross-source compare |
| deep_signal | — | — | omit `normalizedEngagement` |

**Rule:** Never compare raw 500 HN points to 500 GitHub stars. Each row uses its own cap.

### 6.2 Fixture tolerance (FR-11)

For calibration regression: HN `{points: 500}` and GitHub `{stars: 500}` must yield `normalizedEngagement` values within **±15 points** of each other (both land in "strong engagement" band 51–85), but must **not** be equal unless caps produce equal logNorm (they won't at equal raw integers — different caps).

### 6.3 Execution order

```
normalizedEngagement = normalizeEngagement(signal)  // may be null
scores.momentum = scoreMomentum(signal, normalizedEngagement, ctx)
```

---

## 7. Disposition Derivation (Story 64-3)

**Evaluated top-to-bottom; first match wins.**

| Priority | disposition | Rule |
|----------|-------------|------|
| 1 | `escalate` | `urgency >= 75` AND (`personalRelevance >= 60` OR `relevance >= 75`) |
| 2 | `priority` | `rankScore >= 70` AND `personalRelevance >= 50` |
| 3 | `ignore` | `rankScore < 40` AND `max(relevance, personalRelevance, novelty, momentum, urgency) < 50` |
| 4 | `watch` | default (all remaining signals) |

**Notes:**
- `escalate` can apply before `rankScore` is computed — use dimension scores only for rule 1.
- `deriveDisposition` accepts `(scores, rankScore)`; rule 1 ignores `rankScore`.
- Every scored signal in a successful run includes `disposition`.

### 7.1 Disposition fixture matrix (required tests)

| Case | relevance | personalRelevance | urgency | rankScore | Expected |
|------|-----------|-------------------|---------|-----------|----------|
| A | 80 | 30 | 80 | 55 | escalate |
| B | 40 | 65 | 80 | 60 | escalate |
| C | 70 | 55 | 40 | 72 | priority |
| D | 30 | 30 | 20 | 35 | ignore |
| E | 55 | 40 | 50 | 55 | watch |

---

## 8. rankScore Composite (Story 64-5)

### 8.1 Weight table (normative)

| Component | Weight |
|-----------|--------|
| personalRelevance | **0.30** |
| relevance | 0.20 |
| momentum | 0.20 |
| urgency | 0.15 |
| novelty | 0.10 |
| normalizedEngagement | 0.05 |

**Sum:** 1.00

**Anti-drift:** `personalRelevance` weight MUST remain 0.30 in v1; cannot be zeroed.

### 8.2 Formula

**When `normalizedEngagement` is present (0–100):**

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

**When `normalizedEngagement` is absent:**

Redistribute engagement weight to momentum:

```
rankScore = round(clamp(
  0.30 * personalRelevance
  + 0.20 * relevance
  + 0.25 * momentum
  + 0.15 * urgency
  + 0.10 * novelty,
  0, 100))
```

**Determinism:** No randomness; integer rounding only at final step.

### 8.3 Ranked push order (FR-14)

1. `scoreDigestSignals` returns signals sorted by `rankScore` descending.
2. Assign `rank` = 1..N in sorted order.
3. `push-digest-convex.mjs` preserves array order in mutation loop.
4. Tie-break: when `rankScore` equal, preserve pre-sort stable order from source assembly (trends before headlines before etc.).

### 8.4 Notebook routing independence (FR-15)

`pick-signal-notebook.mjs` / `winning_signal` selection is **not** driven by `rankScore`. No imports from `score-digest-signals.mjs` into notebook routing. Regression tests in `morning-digest-pick-signal-notebook.test.mjs` must pass unchanged in routing behavior.

---

## 9. Failure and Degraded Modes

| Failure | Behavior |
|---------|----------|
| Scoring module throws | Log stderr warning; push **unscored** signals with source-order `rank`; omit `scores`, `disposition`, `rankScore` |
| Missing watchlist file | `relevance` = 25 (neutral peripheral); continue |
| Missing sprint-status | `personalRelevance` from projects/watchlist only |
| Missing novelty history | All signals treated as novel (novelty ≥ 75) |
| Convex push validation error | Existing behavior: stderr, non-zero exit semantics per push script |

Scoring failure **must not** block Discord digest post (aligns with fire-and-forget push contract).

---

## 10. Story Traceability

| Story | Architecture sections | FR IDs | Key deliverables |
|-------|----------------------|--------|------------------|
| **64-1** | §3 | FR-1..FR-4 | `validators.ts`, `digest.ts` sort, push fixture |
| **64-2** | §4, §5 | FR-5..FR-9 | `score-digest-signals.mjs` dimension functions |
| **64-3** | §7 | FR-10 | `deriveDisposition`, fixture matrix §7.1 |
| **64-4** | §6 | FR-11..FR-12 | `normalizeEngagement`, momentum guard test |
| **64-5** | §8, §4.1 orchestrator | FR-13..FR-15 | `computeRankScore`, sort, task-prompt integration |

### 10.1 Numeric tables summary (quick reference for story authors)

| Table | Section | Story |
|-------|---------|-------|
| Dimension weight / band tables | §5.1–5.5 | 64-2 |
| Engagement cap constants | §6.1 | 64-4 |
| Disposition thresholds | §7 | 64-3 |
| rankScore weights | §8.1 | 64-5 |
| Disposition fixture matrix | §7.1 | 64-3 tests |
| Schema TypeScript | §3.1–3.2 | 64-1 |

---

## 11. Test Requirements

| Test file | Coverage |
|-----------|----------|
| `tests/morning-digest-score-signals.test.mjs` (new) | All dimension functions, disposition matrix, rankScore determinism |
| `tests/morning-digest-push-convex.test.mjs` (extend) | Scored payload round-trip |
| `cns-dashboard/tests/convex/digest.test.ts` (extend) | Validator acceptance, rankScore sort |
| `tests/morning-digest-pick-signal-notebook.test.mjs` | No routing regression |

**Gate:** `bash scripts/verify.sh` green before any story marked done.

---

## 12. Open Questions — Resolved

| PRD open question | Architecture resolution |
|-------------------|-------------------------|
| Sprint keyword source | `sprint-status.yaml` + optional `MORNING_DIGEST_SPRINT_STATUS_PATH` |
| Current projects list | `MORNING_DIGEST_PROJECT_ENTITIES` env only in v1 |
| rankScore weights | §8.1 table (locked) |
| Novelty lookback | 7 days |
| Disposition thresholds | §7 table (locked) |

---

## 13. Out of Scope Reminder

- GitHub/Reddit/RSS adapters (Epic 65)
- Vault-semantic personal relevance
- Convex-side scoring
- Dashboard UI rank rendering
- last30days dependency
- LLM-based scoring

---

## 14. Downstream Handoff

| Next workflow | Action |
|---------------|--------|
| `/bmad-create-story 64-1` | Schema + push contract against §3 |
| `/bmad-create-story 64-2` | Five dimensions against §5 |
| `/bmad-create-story 64-3` | Disposition against §7 |
| `/bmad-create-story 64-4` | Normalization against §6 |
| `/bmad-create-story 64-5` | rankScore + integration against §8 |

**Normative path:** `_bmad-output/planning-artifacts/architecture-epic-64-scoring-engine.md`
