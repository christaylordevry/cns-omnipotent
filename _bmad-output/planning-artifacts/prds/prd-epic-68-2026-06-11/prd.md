---
title: Epic 68 — Source Expansion: X/Twitter, Bluesky, Cross-Source Dedup
status: final
created: 2026-06-11
updated: 2026-06-11
epicScope: epic-68
workflowType: prd
inputDocuments:
  - Operator brief (2026-06-11)
  - docs/ADR-E67-001-last30days-codebook-only.md
  - _bmad-output/planning-artifacts/prds/prd-epic-67-2026-06-09/prd.md
  - _bmad-output/planning-artifacts/architecture-epic-67-signal-quality-source-expansion.md
  - _bmad-output/implementation-artifacts/deferred-work.md
  - project-context.md
relatedPrd:
  - _bmad-output/planning-artifacts/prds/prd-epic-67-2026-06-09/prd.md
  - _bmad-output/planning-artifacts/prds/prd-epic-65-2026-06-09/prd.md
relatedArchitecture:
  - docs/ADR-E67-001-last30days-codebook-only.md
classification:
  projectType: internal-tool
  domain: ai-orchestration-control-plane
  complexity: medium-high
  projectContext: brownfield
repos:
  adaptersCompute: Omnipotent.md
  schemaPersistence: cns-dashboard
  operatorConfig: ~/.hermes
---

# PRD: Epic 68 — Source Expansion: X/Twitter, Bluesky, Cross-Source Dedup

**Author:** Chris Taylor  
**Date:** 2026-06-11  
**Product:** CNS Nexus Intelligence — morning-digest social sources, deduplication, and people-aware scoring  
**Epic:** 68  
**Status:** Final

## 0. Document Purpose

This PRD is the normative product contract for Epic 68 story authoring (`68-1` through `68-8`). Downstream consumers: `/bmad-create-architecture`, `/bmad-create-epics-and-stories`, `/bmad-create-story`, and `/bmad-dev-story`.

The document anchors vocabulary in §3 Glossary. Functional requirements use globally numbered FR IDs scoped to this epic (`FR-1` through `FR-N`). Assumptions inferred without operator confirmation are tagged `[ASSUMPTION]` and indexed in §9.

**Primary inputs:** Operator brief (2026-06-11) — X/Twitter (Source 11), Bluesky (Source 12), cross-source deduplication, people tracking for `personalRelevance`. **Binding architecture:** ADR-E67-001 (`last30days-skill-reference` at `~/ai-factory/projects/last30days-skill-reference` is codebook-only; never import/exec). **Normative upstream:** Epic 67 scoring (`nexus-goals.yaml`, five dimensions), Epic 65/67 adapter stdout pattern, eight active digest sources today (Google Trends, NewsAPI, Perplexity, arXiv, HackerNews, GitHub, RSS, ProductHunt).

**Gate pattern (normative):** Story **68-8 (live digest validation)** is the production-readiness gate for Epic 68. Story **68-6 (X/Twitter adapter)** is **operator-gated** on `X_BEARER_TOKEN` in `~/.hermes/trend-ingest.env` — epic completable with Bluesky + dedup + people tracking if X credentials unavailable.

---

## 1. Vision

Epic 67 expanded ProductHunt (Source 10), deepened `personalRelevance` via `nexus-goals.yaml`, and validated GitHub/RSS in live digest runs. The morning digest now ingests **eight active source families**, but three quality gaps remain:

1. **Narrative blind spot** — Breaking AI/tech discourse happens on X and Bluesky hours before it reaches HackerNews or NewsAPI. The operator sees repo stars and launch votes but misses founder threads, researcher reactions, and community sentiment shifts.
2. **Duplicate noise** — The same story routinely appears as an HN post, a NewsAPI headline, an RSS entry, and a tweet. Title-only dedup in `pick-signal-notebook.mjs` caps notebook routing but does not merge duplicate **digestSignals** with combined engagement metadata before Convex push.
3. **People-blind scoring** — `personalRelevance` matches goal phrases and sprint tokens but does not boost signals from **known founders and researchers** the operator tracks.

Epic 68 closes these gaps with two native social adapters (Sources 11–12), a cross-source deduplication layer that collapses duplicate stories into one ranked signal with provenance, and a people watchlist that elevates posts from tracked handles. Signal value prioritization drives story order: **dedup first** (quality multiplier on all sources), **Bluesky second** (free AT Protocol, active AI community, no credential friction for public feeds), **people tracking third** (personal relevance depth), **X/Twitter fourth** (highest narrative value but credential-gated and rate-budget constrained on Basic tier).

Screen 10 Investigation workspace, LinkedIn, YouTube, and multi-tenant workspace enforcement remain deferred.

---

## 2. Target User

### 2.1 Jobs To Be Done

- **Catch narrative early** — See AI/tech discourse from curated X accounts and Bluesky feeds in the same ranked digest as HN and NewsAPI, without opening each platform.
- **Trust signal density** — When OpenAI ships a model, read one merged signal showing HN points + tweet likes + Bluesky reposts — not three near-identical rows.
- **Follow people who matter** — Have posts from tracked founders/researchers score higher on `personalRelevance` than generic headlines with equal market relevance.
- **Preserve pipeline reliability** — Social adapters degrade gracefully (`{"error":"..."}` exit 0); dedup never drops all cluster members; missing people file never aborts digest.

### 2.2 Non-Users (v1)

- Trend-ingest pipeline operators (Epic 44 remains separate).
- External API consumers.
- Reddit operators (67-2 OAuth still deferred).

### 2.3 Key User Journeys

**UJ-1. Chris reads a deduplicated launch story.**

- **Persona + context:** CNS operator; morning digest cron completed; OpenAI model release covered by HN, NewsAPI, and X.
- **Entry state:** Nexus cockpit; latest `digestRunId` selected.
- **Path:** Operator scans ranked feed → sees single "GPT-5 preview" signal → inspector shows `contributingSources: [hackernews, newsapi, twitter]` with combined engagement.
- **Climax:** `dedupClusterSize: 3`; rankScore reflects aggregate community motion.
- **Resolution:** Operator trusts digest density; no manual cross-checking across tabs.
- **Edge case:** URL normalization fails → title fingerprint cluster still merges; worst case two rows (document in 68-8 artifact).

**UJ-2. Chris tracks Karpathy on Bluesky and X.**

- **Persona + context:** Operator maintains `~/.hermes/nexus-people.yaml` with `karpathy` handles.
- **Entry state:** Bluesky and X adapters enabled; people loader active.
- **Path:** Digest runs → Karpathy post appears → `scorePersonalRelevance` adds people-match bonus → ranks above generic "LLM benchmarks" headline.
- **Climax:** Inspector `personalRelevance` bar visibly higher; `sourceMetadata.authorHandle` matches watchlist.
- **Resolution:** Operator adjusts people list quarterly without code changes.

**UJ-3. Chris enables X/Twitter after adding API credentials.**

- **Persona + context:** Operator adds `X_BEARER_TOKEN` to `trend-ingest.env`; curated account list includes AI lab leads.
- **Entry state:** X section previously `(source unavailable: X credentials not configured)`.
- **Path:** Digest runs → X adapter fetches recent tweets from watch accounts + optional search queries → maps to `sourceType: 'twitter'` signals.
- **Climax:** ≥1 twitter signal in live run with `likes`/`reposts` in metadata.
- **Resolution:** Narrative layer complements HN/GitHub technical signals.

**UJ-4. Chris runs digest without X credentials.**

- **Persona + context:** Operator has Bluesky + dedup + people tracking live; X token not yet provisioned.
- **Entry state:** `MORNING_DIGEST_X_ENABLED=false` or missing token.
- **Path:** Digest completes → X section shows unavailable → Bluesky + other sources push normally.
- **Climax:** Epic 68 validation artifact passes without twitter rows.
- **Resolution:** Operator adds X credentials when Basic tier app approved.

---

## 3. Glossary

| Term | Definition |
|------|------------|
| **digestSignal** | Single intelligence row in a `digestRun` — title, `section`, `sourceType`, URL/metadata, scoring fields after `scoreDigestSignals()`. |
| **Source 11 / 12** | Morning-digest adapter ordinals: X/Twitter (11), Bluesky (12). |
| **digestSourceTypeValue** | Convex union literal for `sourceType`. Epic 68 adds `twitter` and `bluesky`. |
| **cross-source dedup** | Merge pass collapsing duplicate stories across sources into one canonical `digestSignal` with `sourceMetadata.contributingSources[]`. Distinct from title-only dedup in `pick-signal-notebook.mjs`. |
| **contributingSources** | Array on merged signals listing each source that reported the same story cluster, with per-source engagement snapshots. |
| **nexus-people.yaml** | Operator file at `~/.hermes/nexus-people.yaml` — founder/researcher watchlist with platform handles. Not vault-managed. |
| **people-match bonus** | Fixed increment to `personalRelevance` when signal author or title matches a watched person (addendum A2). |
| **resolveOperatorHome()** | Hermes-safe home resolver — mandatory in all new adapter scripts. |
| **last30days** | Reference codebook at `~/ai-factory/projects/last30days-skill-reference`. ADR-E67-001: never runtime dependency. |
| **normalizeEngagement()** | Epic 64 function in `score-digest-signals.mjs` — Epic 68 adds `twitter` and `bluesky` branches. |
| **DIGEST_PUSH_JSON** | Pre-push payload in morning-digest task-prompt §9; dedup runs before scoring/push assembly. |

---

## 4. Features

Stories are numbered by **implementation dependency**; §6.2 lists **signal-value priority** for sprint ordering when parallelizing.

### 4.1 Cross-Source Deduplication (68-1)

**Description:** After all adapters map raw fetches to `digestSignal` candidates and before `scoreDigestSignals()`, run a deduplication pass that clusters duplicate stories by normalized URL, title fingerprint, and temporal proximity. Emit one canonical signal per cluster with merged `contributingSources` engagement metadata. Realizes UJ-1.

**Functional Requirements:**

#### FR-1: Dedup cluster engine

Implement `dedupeDigestSignals(signals)` in Omnipotent.md exporting testable cluster/merge functions. Algorithm per addendum A4.

**Consequences (testable):**
- Fixture: HN + NewsAPI + RSS same URL → 1 output signal, `contributingSources.length === 3`.
- Fixture: same story different URLs (HN redirect vs canonical) → merged when domain+path or title fingerprint matches.
- Unmergeable signals pass through unchanged.
- Unit tests in `tests/morning-digest-dedup-signals.test.mjs`.

#### FR-2: Pipeline integration

Wire dedup into digest push assembly path (task-prompt §9 / `write-digest-push-artifact.mjs` or dedicated pre-score script). Dedup runs on full candidate set, not notebook routing cap.

**Consequences (testable):**
- `bash scripts/verify.sh` green.
- Task-prompt documents dedup step ordering: adapters → map → **dedup** → score → push.
- Merged signals retain primary `sourceType` of winner; `contributingSources` preserves losers.

#### FR-3: Convex metadata contract

Extend `sourceMetadataValidator` in cns-dashboard to accept optional `contributingSources` array and `dedupClusterSize` number. Schema story may split as 68-1b if needed.

**Consequences (testable):**
- Push payload with merged metadata passes validator.
- Inspector can display cluster size when present (display optional — no UI story required in 68-1).

**Notes:**
- Reuse URL normalization patterns from `fetch-rss-signals.mjs` and vault dedup guard (31-2) where applicable.
- Do not remove title dedup in `pick-signal-notebook.mjs` — orthogonal concern.

---

### 4.2 People Tracking Layer (68-2, 68-3)

**Description:** Operator-authored people watchlist drives `personalRelevance` boosts for signals authored by or mentioning tracked founders/researchers. Complements `nexus-goals.yaml` (67-3) without replacing it. Realizes UJ-2.

**Functional Requirements:**

#### FR-4: People file loader

`score-digest-signals.mjs` loads `nexus-people.yaml` from `resolveOperatorHome()`. Schema per addendum A2. Missing/malformed → empty set; no throw.

**Consequences (testable):**
- Exports `parseNexusPeopleYaml`, `loadNexusPeople` for unit tests.
- `scripts/nexus-people.yaml.example` shipped with 8–12 sample AI/tech figures.
- Max 30 people enforced; stderr diagnostic on truncate.

#### FR-5: personalRelevance v3 people bonus

When `sourceMetadata.authorHandle` matches a loaded handle: **+20** `personalRelevance` (clamp 0–100). When title/summary F1 against `person.name` ≥ 0.3: **+10**. Stacks with goal-weighted F1 from 67-3.

**Consequences (testable):**
- Fixture: Karpathy tweet with people file → `personalRelevance` ≥20 points higher than without.
- Fixture: headline mentioning "Dario Amodei" without handle match still gets name bonus when configured.
- No changes to `rankScore` weights unless architecture documents bug — bonus flows through existing `RANK_WEIGHT_PERSONAL`.

#### FR-6: Adapter author handle emission

X and Bluesky adapters (68-5, 68-6) populate `sourceMetadata.authorHandle` on mapped digestSignals. Existing sources unaffected in 68-2/68-3.

**Consequences (testable):**
- Mapping tests assert `authorHandle` present on fixture stdout rows.
- People bonus testable with mock signals before live adapters land.

**Notes:**
- Story **68-2** = loader + example file; **68-3** = scoring bonus (Omnipotent.md only, parallel to Bluesky adapter).

---

### 4.3 Bluesky Adapter — Source 12 (68-4, 68-5)

**Description:** Add Bluesky public feed reads via AT Protocol for curated AI community actors. Free API; no credentials required for v1 public `getAuthorFeed` path. Realizes UJ-2, UJ-4.

**Functional Requirements:**

#### FR-7: bluesky digestSourceTypeValue

Extend `digestSourceTypeValue` and `digestSectionValue` in cns-dashboard with `bluesky` literal (68-4 schema gate).

**Consequences (testable):**
- Push with `sourceType: 'bluesky'` passes validator.
- Pattern mirrors 67-5b/67-5c ProductHunt literal adds.

#### FR-8: fetch-bluesky-signals.mjs adapter

New script at `scripts/hermes-skill-examples/morning-digest/scripts/fetch-bluesky-signals.mjs`. Stdout `{"posts":[...]}` or `{"error":"..."}` exit 0. Uses `resolveOperatorHome()`, `mergeTrendIngestEnv`. Env keys per addendum A3.

**Consequences (testable):**
- Fixture tests: stdout → digestSignal mapping → `normalizeEngagement` round-trip.
- Hermes wrapper `hermes-run-bluesky.sh`; task-prompt Source 12 section.
- Rate limiting: max 1 request per actor + resolveHandle; 100ms delay between actors `[ASSUMPTION]`.
- Study last30days `bluesky.py` read-only for AT Protocol endpoint shapes.

#### FR-9: Bluesky engagement normalization

Add `case 'bluesky':` to `normalizeEngagement()` with weighted likes/reposts/replies/quotes per addendum A3.

**Consequences (testable):**
- `SOURCE_PRIOR` and `TREND_PROXY_PRIOR` entries for `bluesky`.
- `buildDigestSignals` / task-prompt §9 mapping row for bluesky key.

#### FR-10: Live digest includes Bluesky

At least one live or staging run includes ≥1 `bluesky` signal (68-8 gate).

**Consequences (testable):**
- Signal in ranked feed with non-null engagement normalization.

---

### 4.4 X/Twitter Adapter — Source 11 (68-6, 68-7)

**Description:** Add X/Twitter recent search and/or curated account timeline via official X API v2 (Basic tier — 500k tweets/month). Operator supplies bearer token. Realizes UJ-3.

**Functional Requirements:**

#### FR-11: twitter digestSourceTypeValue

Extend `digestSourceTypeValue` and `digestSectionValue` with `twitter` literal (may combine with FR-7 in single schema story 68-4).

**Consequences (testable):**
- Push with `sourceType: 'twitter'` passes validator.

#### FR-12: fetch-x-signals.mjs adapter

New script calling X API v2 `GET /2/tweets/search/recent` and/or user timeline endpoints. Stdout `{"posts":[...]}` per addendum A1. Exit 0 on failure. `resolveOperatorHome()` mandatory.

**Consequences (testable):**
- Reads `X_BEARER_TOKEN` from `~/.hermes/trend-ingest.env`.
- Respects `MORNING_DIGEST_X_MAX_TWEETS` budget cap per run.
- Fixture tests with mocked fetch; no live API in CI.
- `trend-ingest.env.example` documents X keys (no secrets).
- Hermes wrapper `hermes-run-x.sh`; task-prompt Source 11 section.

#### FR-13: X engagement normalization

Add `case 'twitter':` to `normalizeEngagement()` with X weights from last30days codebook (addendum A1).

**Consequences (testable):**
- `SOURCE_PRIOR` / `TREND_PROXY_PRIOR` for `twitter`.
- Monthly budget guard logs stderr warning when approaching configurable threshold `[ASSUMPTION: warn at 80% of 500k/month estimated from run count]`.

#### FR-14: Operator-gated X availability

When `X_BEARER_TOKEN` missing, adapter returns `{"error":"X credentials not configured"}`; digest continues.

**Consequences (testable):**
- Task-prompt shows `(source unavailable: …)` for X section only.
- Epic 68 completable without FR-14 live rows (68-8 documents NO-GO path for X).

---

### 4.5 Live Digest Validation (68-8)

**Description:** Execute production-quality digest run validating dedup, Bluesky, people bonus, and optionally X. Realizes UJ-1 through UJ-4 validation paths.

**Functional Requirements:**

#### FR-15: Validation artifact

Story produces `68-8-live-digest-validation.md` with run timestamp, `digestRunId`, per-`sourceType` counts, dedup cluster stats, people-boost examples, pass/fail against addendum A6.

**Consequences (testable):**
- Artifact under `_bmad-output/implementation-artifacts/`.
- ≥30 scored signals; ≥1 bluesky; dedup cluster with ≥2 contributing sources.

#### FR-16: Cross-epic regression

Live run confirms Epic 67 sources (ProductHunt, GitHub, RSS) still present — no adapter regression.

**Consequences (testable):**
- Per-source counts documented; failures triaged as hotfix not Epic 68 scope creep.

---

## 5. Non-Goals (Explicit)

- **Screen 10 Investigation workspace** — separate epic (was mislabeled deferral in 67 PRD).
- **Reddit OAuth (67-2)** — remains deferred; not blocking Epic 68.
- **Bluesky authenticated search** — optional future; v1 public actor feeds only.
- **Python subprocess / last30days runtime** — prohibited by ADR-E67-001.
- **Scoring engine redesign** — people bonus extends `personalRelevance`; rankScore weights unchanged.
- **LinkedIn, YouTube, TikTok adapters** — deferred.
- **Multi-tenant `workspaceId`** — deferred.
- **Replacing Epic 44 trend-ingest** — morning-digest path only.

---

## 6. MVP Scope

### 6.1 In Scope

- Cross-source dedup with `contributingSources` metadata (68-1).
- `nexus-people.yaml` loader + personalRelevance v3 bonus (68-2, 68-3).
- Bluesky Source 12 adapter + schema + normalization (68-4, 68-5).
- X/Twitter Source 11 adapter + schema + normalization (68-6, 68-7).
- Live validation artifact (68-8).
- Hermes task-prompt + wrapper scripts + `verify.sh` tests for all above.

### 6.2 Story Table — Prioritized by Signal Value

| Priority | Story | Title | Signal value rationale |
|----------|-------|-------|------------------------|
| **P0** | **68-1** | Cross-source dedup engine + pipeline wire | Immediate quality gain on all 8+ sources; reduces feed noise before new sources add volume |
| **P1** | **68-4** | Schema literals (`twitter`, `bluesky`) | Gate for any social push — small, unblocks adapters |
| **P1** | **68-5** | Bluesky adapter Source 12 + integration | Free AT Protocol; active AI community; no credential blocker |
| **P2** | **68-2** | People watchlist loader + example file | Deepens personalRelevance for operator-specific figures |
| **P2** | **68-3** | personalRelevance v3 people bonus | Makes people tracking meaningful in ranked feed |
| **P3** | **68-6** | X/Twitter adapter Source 11 | Highest narrative signal but credential + rate-budget gated |
| **P3** | **68-7** | X integration + env docs + budget guard | Operator-dependent; degrades gracefully without token |
| **Gate** | **68-8** | Live digest validation artifact | Confirms production readiness per addendum A6 |

**Suggested sprint sequencing:** `68-1` → `68-4` → `68-5` ∥ `68-2` → `68-3` → `68-6` → `68-7` → `68-8`

**FR traceability:**

| Story | FR IDs |
|-------|--------|
| 68-1 | FR-1, FR-2, FR-3 |
| 68-2 | FR-4 |
| 68-3 | FR-5, FR-6 |
| 68-4 | FR-7, FR-11 |
| 68-5 | FR-8, FR-9, FR-10 |
| 68-6 | FR-12, FR-13, FR-14 |
| 68-7 | FR-12, FR-13, FR-14 (integration-only delta) |
| 68-8 | FR-15, FR-16 |

### 6.3 Out of Scope (v1)

- Nexus inspector UI for `contributingSources` chip display (follow-up UX story).
- Automated X monthly quota telemetry to Convex.
- Bluesky firehose / global search without actor list.

---

## 7. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Dedup effectiveness | ≥20% reduction in push candidate count on typical run (when ≥3 sources active) | 68-8 artifact: pre/post dedup counts |
| Bluesky coverage | ≥1 bluesky signal per live run | Convex `sourceType` filter |
| People boost | ≥1 signal with people-match bonus when watchlist configured | Scoring fixture + live sample |
| X coverage (when credentialed) | ≥1 twitter signal per live run | Convex filter; waived if NO-GO |
| Pipeline reliability | 0 digest aborts from 68 scope features | Cron + Discord post completes |
| Verify gate | `bash scripts/verify.sh` green before each story merge | CI / local |

**Counter-metric:** Dedup over-merge rate — <5% of clusters manually flagged as false positives in 68-8 review.

---

## 8. Dependencies and Risks

| Dependency | Impact | Mitigation |
|------------|--------|------------|
| cns-dashboard validator deploy | Push blocked until literals live | Schema story 68-4 first; mirror 67-5b pattern |
| `X_BEARER_TOKEN` operator action | X section unavailable | FR-14 graceful degrade; 68-8 pass without X |
| X API rate/budget limits | Truncated X coverage | Per-run cap; monthly warn threshold |
| AT Protocol public endpoint changes | Bluesky adapter break | Fixture tests; env override for AppView host |
| ADR-E67-001 | Scope creep into last30days subprocess | Architecture gate in code review |

---

## 9. Assumptions Index

| Tag | Assumption |
|-----|------------|
| `[ASSUMPTION: X Basic tier]` | Operator provisions X Developer app with Basic tier (500k tweets/month). |
| `[ASSUMPTION: X_LIKES_CAP]` | Engagement caps in addendum A1 unless architecture revises. |
| `[ASSUMPTION: dedup title threshold]` | Jaccard ≥ 0.85 for title fingerprint clustering. |
| `[ASSUMPTION: entities remain 1×]` | `MORNING_DIGEST_PROJECT_ENTITIES` weight unchanged from 67-3. |
| `[ASSUMPTION: Bluesky public feeds]` | `getAuthorFeed` works without auth for public actors on `api.bsky.app`. |
| `[ASSUMPTION: twitter literal]` | Convex literal is `twitter` not `x` for consistency with engagement branch naming. |

---

## 10. Related Artifacts

| Artifact | Path |
|----------|------|
| Addendum (technical) | `_bmad-output/planning-artifacts/prds/prd-epic-68-2026-06-11/addendum.md` |
| Decision log | `_bmad-output/planning-artifacts/prds/prd-epic-68-2026-06-11/.decision-log.md` |
| ADR-E67-001 | `docs/ADR-E67-001-last30days-codebook-only.md` |
| Epic 67 PRD | `_bmad-output/planning-artifacts/prds/prd-epic-67-2026-06-09/prd.md` |
| last30days reference | `~/ai-factory/projects/last30days-skill-reference` |
| Adapter scripts dir | `scripts/hermes-skill-examples/morning-digest/scripts/` |

**Next steps:** `/bmad-create-architecture` for ADR-E68-* decisions, then `/bmad-create-story` starting with **68-1** (dedup).
