---
title: Epic 64 — Intelligence Scoring Engine v1
status: final
created: 2026-06-08
updated: 2026-06-08
epicScope: epic-64
workflowType: prd
inputDocuments:
  - _bmad-output/planning-artifacts/sprint-change-proposal-2026-06-08.md
  - _bmad-output/planning-artifacts/epics.md
  - project-context.md
  - scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs
  - scripts/hermes-skill-examples/morning-digest/scripts/push-digest-convex.mjs
relatedPrd:
  - _bmad-output/planning-artifacts/prd-epic-44-trend-intelligence-layer-1.md
  - _bmad-output/planning-artifacts/prd-epic-45-trend-intelligence-engine.md
relatedArchitecture:
  - _bmad-output/planning-artifacts/architecture-epic-64-scoring-engine.md
classification:
  projectType: internal-tool
  domain: ai-orchestration-control-plane
  complexity: medium
  projectContext: brownfield
repos:
  scoringCompute: Omnipotent.md
  schemaPersistence: cns-dashboard
---

# PRD: Epic 64 — Intelligence Scoring Engine v1

**Author:** Chris Taylor  
**Date:** 2026-06-08  
**Product:** CNS Nexus Intelligence — morning-digest signal scoring and ranking  
**Epic:** 64  
**Status:** Final

## 0. Document Purpose

This PRD is the normative product contract for Epic 64 story authoring (`64-1` through `64-5`; parallel quick wins `64-6`, `64-7` are out of scope here but referenced where they feed scoring inputs). Downstream consumers: `/bmad-create-story`, `/bmad-create-architecture`, and `/bmad-dev-story`.

The document anchors vocabulary in §3 Glossary. Functional requirements use globally numbered FR IDs. Assumptions inferred without operator confirmation are tagged `[ASSUMPTION]` and indexed in §9.

**Primary inputs:** Approved operator brief in `sprint-change-proposal-2026-06-08.md` (locked decisions, schema sketch, story table). **Anti-drift guardrails** for personal relevance and dimension separation are normative — not implementation suggestions.

---

## 1. Vision

The CNS morning digest already collects multi-source intelligence — Google Trends, NewsAPI headlines, Perplexity synthesis, arXiv, HackerNews — and pushes `digestSignals` to Convex (Epic 61). Epic 63 delivered the Nexus Intelligence Cockpit UI to consume those signals. What is missing is the **Nexus-native scoring layer**: every signal still arrives as an unordered title with at most a legacy optional `score` field and source-ordered `rank`. The operator cannot answer "what matters *to me* right now?" from structured data alone.

Epic 64 closes that gap. Each `digestSignal` receives **five named dimension scores** (0–100), a **cross-source normalized engagement** value, a **derived disposition**, and a composite **`rankScore`** that orders the "What Matters Now" feed. Scoring executes in the Omnipotent.md digest pipeline **before** Convex push (ADR-E64-001). Convex stores and sorts; it does not compute scores.

This is the differentiator that justified splitting Epic 64 from source-adapter work (now Epic 65). Adapter expansion without scoring would produce more noise, not more judgment. The Nexus intelligence principle applies: **every signal is scored for personal relevance — not just market motion.**

---

## 2. Target User

### 2.1 Jobs To Be Done

- **Prioritize attention** — See which digest signals deserve action today versus background monitoring, without re-reading every headline manually.
- **Trust the ranking** — Know that ordering reflects topical fit, personal fit, novelty, momentum, and urgency as distinct factors — not a single opaque heuristic.
- **Feed downstream surfaces** — Provide ranked `digestSignals` so Epic 63 cockpit and future Nexus UI can sort by `rankScore` without re-implementing scoring.
- **Preserve operator context** — Score personal relevance against active sprint, watchlist, and current projects using thin v1 keyword/entity matching (vault-semantic scoring deferred).

### 2.2 Non-Users (v1)

- External API consumers (no public scoring API in v1).
- Multi-tenant operators (single-tenant CNS operator only).
- Dashboard UI implementers (Epic 64 delivers data contract only; UI rendering is separate cns-dashboard work).

### 2.3 Key User Journeys

**UJ-1. Chris opens Nexus after the morning digest cron runs.**

- **Persona + context:** Single-tenant CNS operator; active sprint on Epic 64 scoring; watchlist includes AI orchestration and agent-framework keywords.
- **Entry state:** Morning digest completed overnight; Convex holds today's `digestRun` and `digestSignals`.
- **Path:** Operator opens cns-dashboard Nexus cockpit → inspects signal list sorted by `rankScore` → top signal shows high `personalRelevance` (matches sprint keywords) and high `momentum` (HN points normalized) → disposition `priority` surfaces for quick triage.
- **Climax:** Operator identifies one signal to investigate before external research — without opening NewsAPI, HN, or arXiv separately.
- **Resolution:** Operator drills into signal detail (Epic 63 UI) or kicks off Hermes research; ranked order persisted for session.

**UJ-2. Hermes morning-digest skill completes a run.**

- **Persona + context:** Automated cron/session-close path; no human in the loop during scoring.
- **Entry state:** `DIGEST_SOURCES_JSON` populated from collectors; `buildDigestSignals` produces signal candidates.
- **Path:** Scoring module computes five dimensions + `normalizedEngagement` + disposition + `rankScore` → `push-digest-convex.mjs` sends pre-scored payload → Convex `getRecentDigestSignals` returns rank-ordered rows.
- **Climax:** Push succeeds; every signal row includes populated `scores.personalRelevance` independent of `scores.relevance`.
- **Resolution:** Discord digest post proceeds; failures are stderr-only per existing fire-and-forget contract.

---

## 3. Glossary

| Term | Definition |
|------|------------|
| **digestSignal** | A single intelligence item in a `digestRun` — title, `sourceType`, optional URL/metadata, and (after Epic 64) `scores`, `disposition`, `rankScore`. |
| **digestRun** | One morning-digest execution for a calendar date; parent of many `digestSignals`. |
| **scores** | Object on `digestSignal` holding five **named** dimension fields (0–100). SSOT for dimension values (ADR-E64-002). |
| **relevance** | Dimension: topical fit to watchlist themes and intelligence domains (market/topic motion). **Not** a proxy for personal fit. |
| **personalRelevance** | Dimension: fit to operator's active sprint, current projects, and personal watchlist via thin v1 keyword/entity match. **MUST** be stored and computed independently of `relevance`. |
| **novelty** | Dimension: how genuinely new the signal is versus recently surfaced digest history. |
| **momentum** | Dimension: acceleration / engagement velocity; **requires** `normalizedEngagement` when raw engagement exists (ADR-E64-003). |
| **urgency** | Dimension: time sensitivity or near-term action need. |
| **normalizedEngagement** | Single 0–100 value after cross-source normalization of raw engagement (stars, upvotes, points, comment counts). Raw values MUST NOT be compared across sources. |
| **rankScore** | Composite 0–100 ordering key for "What Matters Now"; digest-side SSOT for sort order pushed to Convex. |
| **disposition** | Derived categorical label: `priority`, `watch`, `ignore`, or `escalate` — computed from dimension scores (64-3). |
| **keywordCandidates** | Epic 62 Convex table; terms derived from digest signals. Feeds personal-relevance keyword inputs. |
| **buildDigestSignals** | Omnipotent.md function assembling signal candidates from digest sources (trends → headlines → Perplexity → arXiv → HN). Source-order cap 10; **not** the ranking SSOT after Epic 64. |
| **What Matters Now** | Ranked digest signal ordering by `rankScore` — distinct from NotebookLM notebook routing (`pick-signal-notebook.mjs`). |
| **ADR-E64-001** | Scoring compute lives in Omnipotent.md digest scripts; Convex is schema + persistence + read-side sort only. |
| **last30days** | Reference codebook at `~/ai-factory/projects/last30days-skill-reference`. Never installed, imported, or subprocess-called in CNS (ADR-E64-005). |

---

## 4. Features

### 4.1 Schema Extension for Scored Signals (64-1)

**Description:** Extend cns-dashboard Convex validators and digest mutations to accept and persist score fields. Update Omnipotent.md `push-digest-convex.mjs` push contract. All new fields optional during migration for backward compatibility. Realizes UJ-1, UJ-2.

**Functional Requirements:**

#### FR-1: digestSignals scores object

The system persists a `scores` object on each `digestSignal` with exactly five named numeric fields, each 0–100: `relevance`, `personalRelevance`, `novelty`, `momentum`, `urgency`.

**Consequences (testable):**
- Convex validator rejects `scores` missing any of the five keys when `scores` is present.
- `personalRelevance` and `relevance` are separate fields; a payload with only `relevance` does not satisfy the `scores` contract.
- Legacy rows without `scores` remain readable; queries do not fail on null/missing scores.

**Out of Scope:** Server-side score computation in Convex functions.

#### FR-2: Disposition, normalizedEngagement, rankScore fields

The system accepts optional `disposition` (`priority` | `watch` | `ignore` | `escalate`), `normalizedEngagement` (0–100), and `rankScore` (0–100) on `digestSignal` input.

**Consequences (testable):**
- Invalid `disposition` literals are rejected at validator boundary.
- `getRecentDigestSignals` (or equivalent read query) sorts by `rankScore` descending when present, with stable tie-breaker on `rank` or `_creationTime` documented in architecture.

#### FR-3: sourceMetadata engagement extension

The system extends `sourceMetadataValidator` with optional `stars`, `forks`, `upvotes`, `points`, `commentCount` for cross-source normalization inputs (64-4).

**Consequences (testable):**
- HN signals can carry `points`; future GitHub signals can carry `stars`/`forks` without schema migration beyond 64-1.
- Fields are optional; sources without engagement omit them.

#### FR-4: Push contract alignment

`push-digest-convex.mjs` sends score fields in `DIGEST_PUSH_JSON` signals array matching Convex validators.

**Consequences (testable):**
- Fixture test proves round-trip: scored payload → push shape → validator acceptance.
- `bash scripts/verify.sh` passes including cns-dashboard tests when `CNS_DASHBOARD_ROOT` is set.

**Feature-specific NFRs:**
- Cross-repo touch isolated to 64-1; scoring stories 64-2..64-5 are Omnipotent.md only.

---

### 4.2 Five-Dimension Scoring Engine (64-2)

**Description:** New or extended Node module (e.g. `score-digest-signals.mjs`) computes all five dimension scores for each signal candidate before Convex push. Integrates into morning-digest pipeline after `buildDigestSignals` produces candidates and before push. Realizes UJ-2.

**Functional Requirements:**

#### FR-5: Independent personalRelevance computation

The scoring engine computes `personalRelevance` using thin v1 keyword/entity matching against operator context: active sprint keywords, `~/.hermes/trend-watchlist.yaml` watchlist terms, and current project names/entities from configured inputs. **`personalRelevance` MUST NOT be folded into, derived from, or substituted by `relevance`.**

**Consequences (testable):**
- Fixture: signal matching sprint keyword yields `personalRelevance` > signal with only topical watchlist match, even when `relevance` is equal.
- Fixture: signal with high market topicality and zero personal keyword overlap has high `relevance` and low `personalRelevance`.
- No vault-semantic embedding or PAKE retrieval in v1 code path.

**Anti-drift (normative):** Any implementation that merges personal and topical fit into a single score violates this PRD. Vault-semantic personal relevance is explicitly deferred to a post–Epic 64 epic.

#### FR-6: Relevance dimension

The scoring engine computes `relevance` (0–100) as topical fit to watchlist themes and intelligence domain keywords — independent of sprint/project context.

**Consequences (testable):**
- Documented algorithm uses watchlist + domain keyword overlap (tokenization consistent with existing `notebook-scorer.mjs` patterns where applicable).
- `relevance` is populated for every scored signal in a digest run.

#### FR-7: Novelty dimension

The scoring engine computes `novelty` (0–100) measuring signal newness versus recent `digestSignals` / digest history for the workspace.

**Consequences (testable):**
- Repeated title from prior run within configured lookback window scores lower novelty than first appearance.
- Lookback window and dedupe rules documented in addendum; defaults `[ASSUMPTION: 7-day lookback, case-insensitive title match]`.

#### FR-8: Momentum dimension (pre-normalization inputs)

The scoring engine computes `momentum` (0–100) using engagement velocity and cross-source normalized engagement when available. Raw cross-source engagement MUST NOT be compared directly.

**Consequences (testable):**
- When `sourceMetadata` lacks engagement fields, momentum uses non-engagement proxies (e.g. trend `normalizedValue`, source-type weighting) documented in architecture.
- When engagement exists, momentum consumes `normalizedEngagement` from FR-10, not raw `points`/`stars`.

#### FR-9: Urgency dimension

The scoring engine computes `urgency` (0–100) for time-sensitive signals (recency, explicit time-bound language, rapidly moving topics).

**Consequences (testable):**
- Fixture: breaking-news headline scores higher urgency than week-old arXiv preprint with same relevance.
- Algorithm documented; no LLM call required in v1 `[ASSUMPTION]`.

**Notes:** Epic 62 `keywordCandidates` may supplement personal-relevance token sets; scoring engine reads from configured files/env, not live Convex queries during cron `[ASSUMPTION: keyword snapshot passed in digest env or read from last push]`.

---

### 4.3 Derived Disposition (64-3)

**Description:** Composite rules map dimension scores to a single `disposition` label per signal. Realizes UJ-1.

**Functional Requirements:**

#### FR-10: Disposition derivation

The system assigns exactly one `disposition` per scored signal: `priority`, `watch`, `ignore`, or `escalate`, from documented thresholds on dimension scores and `rankScore`.

**Consequences (testable):**
- Fixture matrix: high `personalRelevance` + high `urgency` → `priority` or `escalate` per threshold table in addendum.
- Low scores across dimensions → `ignore`.
- Every pushed signal in a scored run includes `disposition`.

**Out of Scope:** Operator override of disposition in v1 UI.

---

### 4.4 Cross-Source Engagement Normalization (64-4)

**Description:** Normalize raw engagement metrics from heterogeneous sources onto common 0–100 `normalizedEngagement` before momentum calculation. Realizes UJ-1, UJ-2.

**Functional Requirements:**

#### FR-11: Per-source normalization

The system maps source-specific raw engagement (`stars`, `forks`, `upvotes`, `points`, `commentCount`) to `normalizedEngagement` using per-source calibration documented in architecture (percentile, log-scaling, or capped linear — not raw comparison).

**Consequences (testable):**
- Fixture: HN story with 500 points and GitHub repo with 500 stars produce comparable `normalizedEngagement` within documented tolerance — not equal raw values copied.
- Sources without engagement omit `normalizedEngagement`; momentum falls back per FR-8.

#### FR-12: Normalization before momentum

`momentum` computation MUST consume `normalizedEngagement` when engagement metadata is present. Raw `points`/`stars`/`upvotes` MUST NOT be compared across `sourceType` values.

**Consequences (testable):**
- Unit test asserts momentum path rejects cross-source raw comparison (lint or explicit guard).

**Anti-drift (normative):** Treating cross-source engagement normalization as "polish" or deferring it past Epic 64 violates the approved sprint-change proposal (locked decision #6).

---

### 4.5 Ranked Digest Push — "What Matters Now" (64-5)

**Description:** Compute `rankScore`, sort signals descending, assign `rank` field for push order, integrate into morning-digest skill path. Distinct from NotebookLM routing. Realizes UJ-1, UJ-2.

**Functional Requirements:**

#### FR-13: rankScore composite

The system computes `rankScore` (0–100) from weighted combination of five dimensions and `normalizedEngagement` per documented weights in architecture addendum.

**Consequences (testable):**
- Weights sum to 1.0; `personalRelevance` has non-zero weight in composite (cannot be zeroed out).
- Same inputs produce deterministic `rankScore` (no randomness).

#### FR-14: Ranked push order

`push-digest-convex.mjs` sends signals sorted by `rankScore` descending; each signal's `rank` field reflects sort position (1 = highest).

**Consequences (testable):**
- End-to-end fixture: two signals with different `personalRelevance` order correctly in push payload.
- Convex query returns same relative order by `rankScore`.

#### FR-15: Notebook routing independence

`pick-signal-notebook.mjs` NotebookLM routing continues unchanged in purpose; `rankScore` does not replace `winning_signal` selection for notebook pick.

**Consequences (testable):**
- Scoring module is separable from notebook route; no regression in notebook routing tests.

**Out of Scope:** Dashboard UI changes to render ranked feed (separate cns-dashboard epic/story).

---

## 5. Non-Goals (Explicit)

- **GitHub, Reddit, RSS source adapters** — Epic 65.
- **Vault-semantic personal relevance** (PAKE embeddings, vault note similarity) — post–Epic 64 epic.
- **Convex-side scoring compute** — violates ADR-E64-001.
- **last30days as dependency** — no `package.json` entry, import, or subprocess (ADR-E64-005).
- **Dashboard 8-feed UI rendering** — cns-dashboard separate work; Epic 63 cockpit consumes data when ready.
- **ProductHunt, X/Twitter adapters** — follow-on backlog.
- **LLM-based scoring** in v1 — deterministic/heuristic scoring only `[ASSUMPTION]`.
- **Folding `personalRelevance` into `relevance`** — permanently out of scope (anti-drift).

---

## 6. MVP Scope

### 6.1 In Scope

- Convex schema extension + push contract (64-1).
- Five named dimension scores with independent `personalRelevance` (64-2).
- Disposition derivation (64-3).
- Cross-source engagement normalization (64-4).
- `rankScore` ordering and ranked push (64-5).
- Fixture tests + `verify.sh` gate for all touchpoints.
- Thin personal relevance: keyword/entity vs sprint, watchlist, projects.

### 6.2 Out of Scope for MVP

| Item | Reason |
|------|--------|
| New source adapters | Epic 65 |
| Vault-semantic relevance | Deferred differentiator; v1 thin match only |
| Nexus UI rank rendering | Separate dashboard story |
| 64-6 NewsAPI / 64-7 arXiv fixes | Parallel quick wins (done); improve inputs, not scoring contract |
| Epic 66 Hermes AI wiring | Renumbered from old Epic 64+ scope |

---

## 7. Success Metrics

**Primary**

- **SM-1:** 100% of `digestSignals` in a scored morning-digest run include populated `scores` with all five named dimensions. Validates FR-1, FR-5–FR-9.
- **SM-2:** `personalRelevance` is statistically independent of `relevance` in fixture suite (correlation not forced; distinct test cases). Validates FR-5 anti-drift.
- **SM-3:** `getRecentDigestSignals` order matches `rankScore` descending for scored runs. Validates FR-2, FR-14.

**Secondary**

- **SM-4:** `bash scripts/verify.sh` green after each story merge. Validates FR-4.
- **SM-5:** Operator can identify top-3 "What Matters Now" signals from Convex data without manual re-sort. Validates UJ-1.

**Counter-metrics (do not optimize)**

- **SM-C1:** Raw signal volume — do not maximize ingest count; scoring quality over quantity.
- **SM-C2:** `relevance` alone as sort key — do not optimize topical fit at expense of `personalRelevance` (would recreate pre-Nexus generic feed).

---

## 8. Open Questions

1. **Active sprint keyword source** — File path or env var for sprint keywords at scoring time? `[ASSUMPTION: sprint-status.yaml story titles + epic labels tokenized]`
2. **Current projects list** — Static config in `~/.hermes/trend-ingest.env` vs vault read? `[ASSUMPTION: env/config only in v1 — no vault IO in scoring path]`
3. **rankScore weight table** — Exact weights for five dimensions + engagement; architecture doc owns numeric defaults pending operator confirm.
4. **Novelty lookback** — 7 vs 14 days of digest history for dedupe.
5. **Disposition thresholds** — Exact cutoffs for `escalate` vs `priority`; finalize in architecture-epic-64.

---

## 9. Assumptions Index

- §4.2 FR-7 — 7-day novelty lookback, case-insensitive title match.
- §4.2 FR-9 — Urgency uses heuristic/recency rules, no LLM in v1.
- §4.2 Notes — Keyword context from env/config snapshot, not live Convex read during cron.
- §8 — Sprint keywords derived from `sprint-status.yaml` / epic metadata.
- §8 — Current projects from operator config only; no vault-semantic retrieval in v1.

---

## 10. Cross-Cutting NFRs

| NFR | Requirement |
|-----|-------------|
| **Determinism** | Same inputs → same scores (fixture-stable). |
| **Backward compatibility** | Unscored legacy signals remain valid in Convex. |
| **Failure isolation** | Scoring failure must not block Discord digest post; stderr + exit semantics align with existing push fire-and-forget pattern `[ASSUMPTION: score failure logs warning, pushes unscored or skips push per architecture]`. |
| **Testability** | Pure functions for dimension scoring and normalization; fixture JSON under `tests/fixtures/`. |
| **Operator home** | `resolveOperatorHome()` for config paths in any new scripts touching `~/.hermes/` (Epic 65 constraint applies to new adapter code; scoring scripts should align). |
| **Verify gate** | No story marked done without `bash scripts/verify.sh` green. |

---

## 11. Constraints and Guardrails

### Personal relevance anti-drift (normative)

From approved `sprint-change-proposal-2026-06-08.md` locked decisions:

1. **`personalRelevance` is a first-class dimension** — stored, computed, and weighted independently.
2. **v1 algorithm is thin keyword/entity match** against active sprint, watchlist, current projects — not vault semantics.
3. **Vault-semantic personal relevance is deferred** — must not be partially introduced under the guise of "improving" v1.
4. **Nexus principle:** "every signal scored for personal relevance — not just market motion."

### Reference code policy

- `last30days-skill` is reference-only for engagement pattern study (Epic 65 HN optional upgrade).
- Epic 64 MUST NOT add last30days to dependency graph.

### Repo boundary

| Layer | Repo |
|-------|------|
| Scoring compute | Omnipotent.md |
| Schema + persistence + read sort | cns-dashboard |
| Push | Omnipotent.md `push-digest-convex.mjs` |

---

## 12. Integration and Dependencies

| Dependency | Relationship |
|------------|--------------|
| Epic 61 (morning digest push) | Foundation; `digestSignals` table exists |
| Epic 62 (`keywordCandidates`) | Feeds personal-relevance keyword inputs |
| Epic 63 (Nexus cockpit UI) | Consumer of ranked signals; not blocked by Epic 64 |
| Epic 56 (`buildDigestSignals` / notebook routing) | Coexists; different purpose than `rankScore` |
| Epic 64-6, 64-7 (done) | Improved source quality for scoring inputs |
| Epic 65 (adapters) | Soft dependency for engagement metadata richness; 64-4 must work with HN `points` today |

---

## 13. Story Traceability (Epic 64)

| Story | PRD coverage |
|-------|----------------|
| 64-1 | FR-1 – FR-4 |
| 64-2 | FR-5 – FR-9 |
| 64-3 | FR-10 |
| 64-4 | FR-11 – FR-12 |
| 64-5 | FR-13 – FR-15 |

**Parallel (out of PRD scope):** 64-6 NewsAPI tightening, 64-7 arXiv env fix — completed.

---

## 14. Downstream Handoffs

| Workflow | Artifact |
|----------|----------|
| `/bmad-create-architecture` | `architecture-epic-64-scoring-engine.md` — ADR-E64-001..005, weight tables, normalization algorithm |
| `/bmad-create-story` | Stories 64-1..64-5 against FR IDs above |
| `/bmad-dev-story` | Implementation in Omnipotent.md + cns-dashboard (64-1 only) |
