---
title: Epic 65 — Native Source Adapter Expansion v1
status: final
created: 2026-06-09
updated: 2026-06-09
epicScope: epic-65
workflowType: prd
inputDocuments:
  - _bmad-output/planning-artifacts/sprint-change-proposal-2026-06-08.md
  - _bmad-output/planning-artifacts/architecture-epic-64-scoring-engine.md
  - _bmad-output/planning-artifacts/prd-epic-64-intelligence-scoring-engine.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/implementation-artifacts/epic-64-retro-2026-06-09.md
  - project-context.md
relatedPrd:
  - _bmad-output/planning-artifacts/prd-epic-64-intelligence-scoring-engine.md
relatedArchitecture:
  - _bmad-output/planning-artifacts/architecture-epic-64-scoring-engine.md
  - _bmad-output/planning-artifacts/architecture-epic-65-native-source-adapters.md
classification:
  projectType: internal-tool
  domain: ai-orchestration-control-plane
  complexity: medium
  projectContext: brownfield
repos:
  adaptersCompute: Omnipotent.md
  schemaPersistence: cns-dashboard
---

# PRD: Epic 65 — Native Source Adapter Expansion v1

**Author:** Chris Taylor  
**Date:** 2026-06-09  
**Product:** CNS Nexus Intelligence — morning-digest native source adapters  
**Epic:** 65  
**Status:** Final

## 0. Document Purpose

This PRD is the normative product contract for Epic 65 story authoring (`65-1` through `65-5`). Downstream consumers: `/bmad-create-architecture`, `/bmad-create-story`, and `/bmad-dev-story`.

The document anchors vocabulary in §3 Glossary. Functional requirements use globally numbered FR IDs continuing from Epic 64 (FR-16+). Assumptions inferred without operator confirmation are tagged `[ASSUMPTION]` and indexed in §9.

**Primary inputs:** Approved operator brief in `sprint-change-proposal-2026-06-08.md` (locked decisions, story table, MIT/reference policy). **Normative upstream for signal shape:** `architecture-epic-64-scoring-engine.md` §3 (`digestSignals` schema contract), §6 (`normalizeEngagement` per-source maps). Adapters **must** emit matching `sourceType` literals and `sourceMetadata` engagement fields — Epic 64 scoring already implements github/reddit normalization branches before adapters exist (Epic 64 retro finding).

**Gate pattern (normative):** Story **65-2 (Reddit public-JSON spike)** is the **risk gate** for **65-3 (Reddit adapter or credential fallback)** — the same structural role **64-1** plays for **64-2 through 64-5**. No full Reddit adapter story may start until 65-2 documents pass/fail criteria for unattended scheduled use.

---

## 1. Vision

Epic 64 delivered the Nexus-native scoring layer: five dimension scores, cross-source engagement normalization, disposition, and `rankScore` ordering. The morning digest still ingests only Google Trends, NewsAPI, Perplexity, arXiv, and HackerNews. High-signal developer and community sources — **GitHub trending/repos**, **Reddit discussions**, and **curated RSS/Substack feeds** — remain outside the pipeline. The operator sees market motion without the repos, threads, and newsletters that drive day-to-day engineering judgment.

Epic 65 closes the ingest gap with **CNS-native Node/TypeScript adapters** that collect from these sources, map rows into the existing **`digestSignal` contract**, attach **engagement metadata** in shapes Epic 64's `normalizeEngagement()` already expects, and integrate into the morning-digest cron path. Scoring, ranking, and Convex push semantics are **not reimplemented** — adapters are metadata-rich emitters feeding the live `scoreDigestSignals` orchestrator.

The Nexus intelligence principle applies: **`last30days` is a codebook, not a dependency.** Reference logic at `~/ai-factory/projects/last30days-skill-reference` informs fetch patterns and engagement field choices; every line of production adapter code is owned in Node with fixture tests and `verify.sh` gates. Reddit carries the highest operational risk (rate limits, blocking, credential needs under unattended cron) — hence the **spike-before-adapter** gate mirroring Epic 64's schema-first discipline.

---

## 2. Target User

### 2.1 Jobs To Be Done

- **Broaden intelligence surface** — Surface GitHub repos, Reddit threads, and curated newsletters in the same ranked digest feed as existing sources, without opening each platform separately.
- **Feed the scoring engine** — Emit `sourceMetadata.stars`/`forks`, `upvotes`/`commentCount`, and related fields so Epic 64 `normalizedEngagement` and `momentum` reflect real community signal, not static source priors.
- **Trust unattended cron** — Know Reddit (and other adapters) were validated for scheduled headless runs before production integration — not discovered as production incidents.
- **Preserve pipeline boundaries** — Keep morning-digest adapters distinct from Epic 44 trend-ingest collectors; avoid split-brain Reddit strategy.

### 2.2 Non-Users (v1)

- Trend-ingest pipeline operators (Epic 44 Reddit collector remains separate).
- Dashboard UI implementers (Epic 63 consumes ranked signals; no new UI in Epic 65).
- External API consumers (no public adapter API).

### 2.3 Key User Journeys

**UJ-1. Chris reviews the morning digest after Epic 65 lands.**

- **Persona + context:** CNS operator; watchlist includes agent frameworks and LLM tooling; active sprint on Nexus intelligence.
- **Entry state:** Morning digest cron completed; Epic 64 scoring live; new sources enabled in `~/.hermes/trend-ingest.env`.
- **Path:** Operator opens Nexus cockpit → sees GitHub repo and Reddit thread in `rankScore` order → inspects `sourceMetadata.stars` / `upvotes` → `normalizedEngagement` and `momentum` reflect engagement, not flat HN-style prior.
- **Climax:** A GitHub repo matching sprint keywords ranks above generic headlines because `personalRelevance` + engagement normalization compound.
- **Resolution:** Operator investigates top signal via Hermes or external link; Convex row audit trail shows correct `sourceType` and metadata.

**UJ-2. Hermes morning-digest cron collects from new adapters.**

- **Persona + context:** Automated unattended run; no human in loop.
- **Entry state:** Fetch scripts for GitHub, Reddit (post-spike), and RSS configured; `DIGEST_PUSH_JSON` assembly includes new sections.
- **Path:** Each adapter stdout JSON → signal mapping table → `scoreDigestSignals` → Convex push with scored fields.
- **Climax:** Reddit adapter succeeds under cron because 65-2 spike documented acceptable error/rate-limit profile; degraded mode omits section on failure without aborting digest.
- **Resolution:** Discord digest shows new sections or `(source unavailable: …)` bullets per existing cross-source failure contract.

**UJ-3. Developer runs Reddit spike before adapter (65-2 gate).**

- **Persona + context:** Amelia implementing Epic 65; spike story must complete before 65-3.
- **Entry state:** Spike script exists; simulates 3+ unattended fetch cycles against public JSON endpoints.
- **Path:** Spike records latency, HTTP status distribution, empty-result rate, block indicators → documents GO/NO-GO for public-JSON path vs credential fallback branch for 65-3.
- **Climax:** Spike artifact in story file gives operator confidence or triggers credential-only 65-3 branch.
- **Resolution:** 65-3 story file references spike outcome; no full adapter work starts on ambiguous spike results.

---

## 3. Glossary

| Term | Definition |
|------|------------|
| **digestSignal** | Single intelligence row in a `digestRun` — title, `section`, `sourceType`, optional URL/metadata, and (after scoring) `scores`, `disposition`, `rankScore`. Adapters produce **unscored** rows matching Convex strict validator contract. |
| **digestSourceTypeValue** | Convex union literal for `sourceType`. Epic 64 supports `google_trends`, `newsapi`, `arxiv`, `hackernews`, `deep_signal`. Epic 65 adds `github`, `reddit`, `rss`. |
| **sourceMetadata** | Optional object on `digestSignal` holding engagement and auxiliary fields. Epic 64 validators accept `stars`, `forks`, `upvotes`, `points`, `commentCount`, `publishedAt`, etc. Adapters **must** populate per-source fields documented in §4 and addendum. |
| **normalizeEngagement** | Epic 64 pure function mapping per-source raw engagement to 0–100. GitHub reads `stars`/`forks`; Reddit reads `upvotes`/`commentCount`. Adapters must not pre-normalize — emit raw counts only. |
| **DIGEST_PUSH_JSON** | Pre-push payload assembled in morning-digest task-prompt §9; `signals[]` scored by `scoreDigestSignals` before `push-digest-convex.mjs`. |
| **buildDigestSignals** | Source-order assembly for NotebookLM routing (cap 10 titles). Adapter integration may extend `digest_sources` keys; ranking SSOT remains `rankScore` after scoring. |
| **Morning-digest path** | Hermes `morning-digest` skill → task-prompt Sources 1–6+ → Convex push. Epic 65 adapters attach here. |
| **Trend-ingest path** | Epic 44 `trend-ingest.py` / collectors including `44-3-2` Reddit — **distinct pipeline**, separate config and Convex tables. Epic 65 Reddit adapter does not replace or call trend-ingest collectors. |
| **last30days** | Reference codebook at `~/ai-factory/projects/last30days-skill-reference`. Read-only study material (ADR-E64-005 extends to Epic 65). Never installed, imported, or subprocess-called. |
| **65-2 spike gate** | Reddit public-JSON spike story. **Blocks 65-3.** Documents unattended cron viability before full Reddit adapter. Analogous to 64-1 blocking 64-2..64-5. |
| **Public-JSON path** | Reddit fetch via unauthenticated `.json` endpoints (pattern studied from last30days reference). Subject to 65-2 validation. |
| **Credential fallback** | 65-3 branch when spike fails: OAuth/app-token Reddit API or operator-approved credential path — scope defined in architecture after spike outcome. |

---

## 4. Features

### 4.1 Schema Extension for New Source Types (65-1 precursor)

**Description:** Extend cns-dashboard `digestSourceTypeValue` and morning-digest signal mapping contract to accept `github`, `reddit`, and `rss` literals before adapter rows reach Convex. Cross-repo touch paired with first adapter story (65-1). Realizes UJ-1, UJ-2.

**Functional Requirements:**

#### FR-1: digestSourceTypeValue literals

The system extends `digestSourceTypeValue` in `cns-dashboard/convex/validators.ts` with `github`, `reddit`, and `rss` literals. Apply to all validators consuming `sourceType` on digest signals.

**Consequences (testable):**
- Push payload with `sourceType: 'github'` passes validator; unknown literal still rejected.
- `digestSignalInputValidator` and row validator remain in sync.
- cns-dashboard digest tests extended; `bash scripts/verify.sh` green with `CNS_DASHBOARD_ROOT` set.

#### FR-2: Morning-digest section and sourceType mapping

Task-prompt signal mapping table and strict-schema contract document new sections:

| section | sourceType | Engagement fields in sourceMetadata |
|---------|------------|--------------------------------------|
| `github` | `github` | `stars` (required for normalization), `forks` (optional) |
| `reddit` | `reddit` | `upvotes` (required for normalization), `commentCount` (optional) |
| `rss` | `rss` | none required; `publishedAt` when available |

**Consequences (testable):**
- Every new signal includes both `section` and `sourceType` per existing strict contract.
- Optional keys omitted when absent — never `null`.
- Fixture round-trip: adapter-shaped payload → validator acceptance.

**Out of Scope:** Scoring algorithm changes (Epic 64 locked).

---

### 4.2 GitHub Adapter (65-1)

**Description:** Node fetch script collecting GitHub repository signals (trending, starred, or watchlist-driven queries per architecture) and emitting stdout JSON consumed by morning-digest assembly. Maps to `digestSignal` rows with `sourceMetadata.stars` and `sourceMetadata.forks`. Realizes UJ-1, UJ-2.

**Functional Requirements:**

#### FR-3: GitHub fetch and stdout contract

A CNS-native Node script (e.g. `fetch-github-signals.mjs`) fetches GitHub data via REST API, respects config in `~/.hermes/trend-ingest.env`, uses `resolveOperatorHome()` for all config paths, and prints JSON to stdout:

```json
{
  "repos": [
    {
      "title": "<repo full name or display title>",
      "url": "<html_url>",
      "stars": 1234,
      "forks": 56,
      "publishedAt": "<ISO8601 optional>"
    }
  ]
}
```

On failure: `{"error":"<short reason>"}`; exit 0 per existing digest fetch conventions.

**Consequences (testable):**
- Fixture tests with mocked HTTP responses prove parsing and field mapping.
- No `last30days` import or subprocess.
- Hermes wrapper script (e.g. `hermes-run-github.sh`) follows arXiv/HN wrapper patterns.

#### FR-4: GitHub digestSignal emission shape

GitHub adapter output maps to `digestSignal` objects satisfying Epic 64 engagement contract:

- `section`: `github`
- `sourceType`: `github`
- `title`, `url`, `externalId` (stable hash)
- `sourceMetadata.stars`: number (required when repo has star count)
- `sourceMetadata.forks`: number when available
- `sourceMetadata.publishedAt`: ISO string when available

After `scoreDigestSignals`, `normalizeEngagement` produces non-null value when `stars` present (architecture §6.1 github branch).

**Consequences (testable):**
- Integration fixture: GitHub signal through `normalizeEngagement` yields 0–100 consistent with `{stars: N, forks: M}` caps (`GH_STARS_CAP`, `GH_FORKS_CAP`).
- `momentum` uses `normalizedEngagement` (Path A) — unit test guard from Epic 64 holds.
- GitHub section appears in Discord digest and Convex push when enabled; `(source unavailable: …)` when disabled/failed.

**Feature-specific NFRs:**
- Soft dependency on Epic 64-1 schema (engagement fields) and FR-1 literals — 65-1 includes FR-1 work or immediately follows it in same story.

---

### 4.3 Reddit Public-JSON Spike (65-2) — Risk Gate

**Description:** Spike story validating Reddit public-JSON fetch viability for **unattended scheduled cron** before any full Reddit adapter implementation. **This story is the gate for 65-3** — structurally equivalent to 64-1 gating 64-2 through 64-5. Realizes UJ-3.

**Functional Requirements:**

#### FR-5: Spike script and unattended simulation

A Node spike script (e.g. `spike-reddit-public-json.mjs`) performs repeated headless fetches against configured subreddits/queries using public JSON endpoints only. Simulation includes **minimum three consecutive fetch cycles** with cron-realistic delays (e.g. 3–5 minute spacing) `[ASSUMPTION]`.

**Consequences (testable):**
- Spike logs: HTTP status codes, response times, parse success rate, empty result rate, rate-limit/block indicators (429, 403, captcha markers).
- Spike exits 0; documents results in story artifact — not production adapter code.
- No credentials required for spike path (public JSON only).

#### FR-6: Spike pass/fail criteria (gate for 65-3)

Spike story documents explicit GO/NO-GO:

| Outcome | Criteria (minimum) | 65-3 branch |
|---------|-------------------|-------------|
| **PASS (public-JSON GO)** | ≥80% fetch cycles return parseable JSON with ≥1 post; no sustained block pattern; p95 latency <15s | 65-3 implements public-JSON adapter |
| **FAIL (public-JSON NO-GO)** | Sustained 429/403, empty results on >50% cycles, or parse failures indicating HTML/block pages | 65-3 implements credential fallback path only |
| **PARTIAL** | Intermittent failures | Operator decision recorded; 65-3 story must cite mitigation (backoff, reduced subreddit set, or credential path) |

**Consequences (testable):**
- Story 65-3 file **cannot** be authored until 65-2 status is `done` with documented outcome.
- Sprint-status / story metadata: 65-2 `blocks: 65-3`.
- No Reddit rows in production `DIGEST_PUSH_JSON` until 65-3 completes (spike alone does not enable production Reddit ingest).

**Anti-drift (normative):** Starting 65-3 full adapter work before 65-2 spike completion violates this PRD — same class of error as starting 64-2 before 64-1 schema landed.

**Out of Scope:** Production Reddit adapter (65-3); Convex schema changes beyond FR-1 (if not yet landed).

---

### 4.4 Reddit Adapter or Credential Fallback (65-3)

**Description:** Full Reddit adapter for morning-digest path, branching on 65-2 spike outcome. Emits `digestSignal` rows with `sourceMetadata.upvotes` and `sourceMetadata.commentCount`. **Blocked by 65-2.** Realizes UJ-1, UJ-2.

**Functional Requirements:**

#### FR-7: Reddit fetch branching on spike outcome

65-3 implements exactly one primary fetch strategy as determined by 65-2:

- **Public-JSON GO:** CNS-native public JSON fetch (translated from last30days reference patterns, not imported).
- **NO-GO or operator override:** Credential-based Reddit API path using env vars in `~/.hermes/trend-ingest.env` (architecture defines OAuth vs script-app token).

**Consequences (testable):**
- Story references 65-2 artifact with GO/NO-GO decision linked.
- stdout JSON shape:

```json
{
  "posts": [
    {
      "title": "<post title>",
      "url": "<permalink>",
      "upvotes": 42,
      "commentCount": 7,
      "publishedAt": "<ISO8601 optional>"
    }
  ]
}
```

#### FR-8: Reddit digestSignal emission shape

Reddit adapter maps to:

- `section`: `reddit`
- `sourceType`: `reddit`
- `sourceMetadata.upvotes`: number (required for normalization)
- `sourceMetadata.commentCount`: number when available

**Consequences (testable):**
- `normalizeEngagement` reddit branch yields 0–100 when `upvotes` present (architecture §6.1).
- Fixture: reddit signal with `{upvotes: 500, commentCount: 50}` scores momentum via Path A.
- Production cron: Reddit section degrades gracefully on failure — digest continues.

**Out of Scope:** Epic 44 trend-ingest Reddit collector changes; PRAW/Python runtime.

---

### 4.5 Curated RSS / Substack Adapter (65-4)

**Description:** Node adapter fetching operator-curated feed URLs from config (`MORNING_DIGEST_RSS_FEEDS` or equivalent in `~/.hermes/trend-ingest.env`). Uses `rss-parser` (npm, security policy compliant). Realizes UJ-1, UJ-2.

**Functional Requirements:**

#### FR-9: RSS fetch and stdout contract

RSS adapter fetches configured feeds, dedupes by URL/title, caps entries per feed and total, emits:

```json
{
  "entries": [
    {
      "title": "<entry title>",
      "url": "<link>",
      "publishedAt": "<ISO8601 optional>",
      "author": "<optional>"
    }
  ]
}
```

**Consequences (testable):**
- Fixture tests with static RSS XML samples.
- Config disable flag returns `{"error":"rss disabled"}` exit 0.
- `resolveOperatorHome()` for env merge via existing `mergeTrendIngestEnv` pattern.

#### FR-10: RSS digestSignal emission shape

RSS maps to:

- `section`: `rss`
- `sourceType`: `rss`
- No engagement fields required (`normalizeEngagement` returns null — momentum uses Path B trendProxy).
- `sourceMetadata.publishedAt` when available; `sourceMetadata.author` optional if validator extended or nested consistently.

**Consequences (testable):**
- RSS signals score through full five dimensions without `normalizedEngagement`.
- `rankScore` uses momentum weight redistribution per Epic 64 §8.2 (no engagement present).

**Soft dependency:** FR-1 literals landed (64-1 engagement schema already live).

---

### 4.6 HN Engagement Scoring Upgrade (65-5, Optional)

**Description:** Optional improvement to HN collector mapping so `fetch-hn-rss.mjs` consistently emits `sourceMetadata.points` and `sourceMetadata.commentCount` (architecture §3.2 HN mapping) and optionally adopts engagement patterns studied from last30days reference. **Not required for Epic 65 completion.** Realizes UJ-1 marginally.

**Functional Requirements:**

#### FR-11: HN metadata alignment (optional)

When implemented, HN stories map RSS `score` → `sourceMetadata.points` and `comments` → `sourceMetadata.commentCount` on push path (may partially exist post-64-1).

**Consequences (testable):**
- HN signals achieve Path A momentum when points present.
- No regression in existing HN fetch tests.

**Out of Scope:** Epic completion gate — epic may close with 65-1..65-4 only.

---

### 4.7 Morning Digest Pipeline Integration (cross-cutting)

**Description:** Wire new adapters into Hermes morning-digest skill, task-prompt source list, `digest_sources` assembly, and `DIGEST_PUSH_JSON` mapping. Realizes UJ-2.

**Functional Requirements:**

#### FR-12: Skill and task-prompt integration

Morning-digest SKILL.md and task-prompt add source collection steps for GitHub, Reddit (post-65-3), and RSS with independent failure isolation (existing constraint #7).

**Consequences (testable):**
- Each source invoked via Hermes `terminal` with documented timeout.
- `digest_sources` JSON includes `github`, `reddit`, `rss` keys when sources succeed.
- Scoring step unchanged — adapters feed pre-scoring `signals[]`; `scoreDigestSignals` remains SSOT.

#### FR-13: Verify and fixture gate

All Epic 65 stories require `bash scripts/verify.sh` green before done.

**Consequences (testable):**
- New test files under `tests/` for each adapter and integration mapping.
- Hermes skill sync after script changes per team agreement (Epic 64 retro).

#### FR-16: Reference code and runtime policy

Epic 65 code **must not** add `last30days` to any `package.json`, import graph, or subprocess invocation. Node/TypeScript only. `resolveOperatorHome()` for all `~/.hermes/` paths — no `os.homedir()` / `Path.home()`.

**Consequences (testable):**
- Repo grep CI or review checklist: no `last30days` imports.
- New scripts use existing `mergeTrendIngestEnv` / `resolveOperatorHome` from arXiv/HN modules.

---

## 5. Non-Goals (Explicit)

- **ProductHunt, X/Twitter, TikTok, Polymarket** — follow-on backlog per sprint-change source roadmap.
- **Python runtime or PRAW** for Reddit — Node only; last30days Python is reference-only.
- **last30days as dependency** — no install, import, subprocess (extends ADR-E64-005).
- **Scoring/ranking reimplementation** — Epic 64 owns `scoreDigestSignals`, `normalizeEngagement`, `rankScore`.
- **Vault-semantic relevance** — deferred post–Epic 64.
- **Dashboard UI for new source badges** — cns-dashboard separate work.
- **Epic 44 trend-ingest Reddit collector changes** — distinct pipeline boundary.
- **Skipping 65-2 spike before 65-3** — permanently out of scope (anti-drift).

---

## 6. MVP Scope

### 6.1 In Scope

- `digestSourceTypeValue` extension for `github`, `reddit`, `rss` (FR-1).
- GitHub adapter with engagement metadata (65-1).
- **Reddit public-JSON spike as gate** (65-2) — mandatory before 65-3.
- Reddit adapter or credential fallback per spike outcome (65-3).
- Curated RSS/Substack adapter (65-4).
- Morning-digest skill/task-prompt integration (FR-12).
- Fixture tests + `verify.sh` for all deliverables.
- MIT attribution / clean-room reimplementation policy (addendum).

### 6.2 Out of Scope for MVP

| Item | Reason |
|------|--------|
| 65-5 HN upgrade | Optional; epic completable without it |
| Nexus UI source-type icons | Dashboard separate story |
| Live Convex novelty history wiring | Epic 64 retro T1 — parallel, not adapter blocker |
| ProductHunt / X adapters | Sprint-change roadmap medium term |
| Trend-ingest pipeline unification | Architectural boundary — document only |

---

## 7. Success Metrics

**Primary**

- **SM-1:** GitHub, Reddit (post-65-3), and RSS signals appear in Convex `digestSignals` with correct `sourceType` and engagement metadata when sources enabled. Validates FR-2, FR-4, FR-8, FR-10.
- **SM-2:** GitHub and Reddit signals produce non-null `normalizedEngagement` when raw engagement present; `momentum` uses Path A. Validates FR-4, FR-8, Epic 64 §6 integration.
- **SM-3:** 65-2 spike artifact documents GO/NO-GO before 65-3 merges. Validates FR-5, FR-6 gate discipline.

**Secondary**

- **SM-4:** `bash scripts/verify.sh` green after each story. Validates FR-13.
- **SM-5:** Morning digest completes with one or more new sources unavailable — no full abort. Validates FR-12 cross-source failure contract.

**Counter-metrics (do not optimize)**

- **SM-C1:** Raw ingest volume — do not maximize post/title count at expense of signal quality or rate-limit bans.
- **SM-C2:** Reddit spike success at any cost — do not bypass spike with credential shortcuts that hide public-JSON cron risk.

---

## 8. Open Questions

1. **GitHub query strategy** — Trending vs search vs watchlist repos? Architecture doc owns query selection `[ASSUMPTION: env-configured query list]`.
2. **RSS feed list source** — Comma-separated URLs in `trend-ingest.env` vs separate YAML file?
3. **buildDigestSignals slot budget** — How to allocate cap-10 across 8 source types? Architecture owns ordering.
4. **Reddit credential fallback scope** — OAuth app vs read-only token; finalize after 65-2 spike in architecture.
5. **FR-1 timing** — Same story as 65-1 or separate 65-0 schema touch? `[ASSUMPTION: bundled into 65-1 as first AC group]`.
6. **Live digest smoke before 65-1 cron** — Epic 64 retro recommends operator validation before adapter production — operator gate vs story AC?

---

## 9. Assumptions Index

- §4.2 FR-3 — GitHub REST with optional token; unauthenticated limits OK for v1.
- §4.3 FR-5 — Three fetch cycles with cron-realistic spacing for spike simulation.
- §4.5 FR-9 — `rss-parser` npm package meeting 14-day age policy at install.
- §8 — GitHub queries env-configured; RSS URLs in `trend-ingest.env`.
- §8 — FR-1 schema extension bundled with 65-1.
- Epic 64 retro — Live scored digest smoke recommended before production adapter cron.

---

## 10. Cross-Cutting NFRs

| NFR | Requirement |
|-----|-------------|
| **Failure isolation** | Adapter failure must not abort digest; stderr + unavailable section bullet. |
| **Unattended cron safety** | Reddit spike validates before production Reddit ingest (FR-5, FR-6). |
| **Determinism** | Fixture-stable parsing and mapping; no LLM in adapter path. |
| **Operator home** | `resolveOperatorHome()` everywhere; config via `~/.hermes/trend-ingest.env`. |
| **Verify gate** | `bash scripts/verify.sh` green before story done. |
| **Strict Convex contract** | No `null` optional fields; omit keys when absent (task-prompt §9). |
| **Engagement shape fidelity** | Raw counts only — adapters never emit pre-normalized engagement scores. |

---

## 11. Constraints and Guardrails

### Engagement metadata contract (normative — from Epic 64 architecture §3.2, §6.1)

Adapters **must** emit raw engagement fields matching `normalizeEngagement` switch branches:

| sourceType | Required for normalization | Optional | normalizeEngagement formula |
|------------|---------------------------|----------|----------------------------|
| `github` | `sourceMetadata.stars` | `forks` | `0.85 * logNorm(stars, 50000) + 0.15 * logNorm(forks, 5000)` |
| `reddit` | `sourceMetadata.upvotes` | `commentCount` | `0.75 * logNorm(upvotes, 10000) + 0.25 * logNorm(commentCount, 2000)` |
| `rss` | — | `publishedAt` | omit `normalizedEngagement`; momentum Path B |

**Rule:** Never compare raw GitHub stars to Reddit upvotes in adapter code — normalization is Epic 64's job.

### digestSignal strict contract (from task-prompt §9)

Every pushed signal requires: `section`, `sourceType`, `title`, `rank` (post-scoring). Optional: `url`, `summary`, `externalId`, `sourceMetadata`, scored fields after `scoreDigestSignals`.

### Pipeline boundary (Epic 44 vs Epic 65)

| Path | Reddit implementation | Purpose |
|------|----------------------|---------|
| Trend-ingest (Epic 44) | `44-3-2` collector | Keyword/trend intelligence layer |
| Morning-digest (Epic 65) | 65-2 spike → 65-3 adapter | Ranked `digestSignals` for Nexus cockpit |

No shared fetch module required in v1; document boundary in architecture. Do not route morning-digest through trend-ingest.py.

### Reference code policy

- Study `~/ai-factory/projects/last30days-skill-reference` for fetch URL patterns, field extraction, rate-limit handling ideas.
- Clean-room reimplementation in Node; MIT attribution in addendum where algorithmically derived.
- ADR-E64-005 applies: zero runtime coupling.

### Gate discipline summary

```
64-1 (schema) ──blocks──▶ 64-2, 64-3, 64-4, 64-5

65-2 (Reddit spike) ──blocks──▶ 65-3 (Reddit adapter)

65-1, 65-4 — soft depend on Epic 64 scoring live; FR-1 literals required before Convex push of new types
65-2 — no schema dependency; may run parallel to 65-1
65-5 — optional; no blockers
```

---

## 12. Integration and Dependencies

| Dependency | Relationship |
|------------|--------------|
| Epic 64 (complete) | Scoring engine, `normalizeEngagement` github/reddit branches, push contract |
| Epic 64-1 schema | `sourceMetadata` engagement fields live |
| Epic 61 (digest push) | Foundation pipeline |
| Epic 63 (Nexus UI) | Read-side consumer of new source types |
| Epic 44 (trend-ingest) | Separate Reddit path — boundary only |
| Epic 62 (`keywordCandidates`) | Unchanged; may ingest terms from new sources later |
| cns-dashboard | FR-1 validator extension (cross-repo touch) |

**Recommended execution order** (from approved sprint-change, refined):

1. Epic 65 PRD (this document) + architecture
2. `/bmad-create-story 65-2` — Reddit spike (parallel, no schema dep)
3. `/bmad-create-story 65-1` — FR-1 + GitHub adapter (after or parallel with 65-2)
4. `/bmad-create-story 65-3` — **only after 65-2 done**
5. `/bmad-create-story 65-4` — RSS adapter
6. `/bmad-create-story 65-5` — optional HN upgrade

---

## 13. Story Traceability (Epic 65)

| Story | PRD coverage | Blocks / blocked by |
|-------|--------------|---------------------|
| **65-1** | FR-1, FR-2, FR-3, FR-4, FR-16 | Soft: Epic 64 scoring live |
| **65-2** | FR-5, FR-6, FR-16 | **Gate — blocks 65-3** |
| **65-3** | FR-7, FR-8, FR-16 | **Blocked by 65-2** |
| **65-4** | FR-9, FR-10, FR-16 | Soft: FR-1 |
| **65-5** (optional) | FR-11 | — |

**Parallelism:** 65-2 may start immediately (no schema dependency). 65-1 and 65-4 may proceed in parallel with 65-2. **65-3 must not start until 65-2 is done** — same gate role as 64-1 for the scoring chain.

---

## 14. Downstream Handoffs

| Workflow | Artifact |
|----------|----------|
| `/bmad-create-architecture` | `architecture-epic-65-native-source-adapters.md` — fetch URLs, env vars, GitHub query strategy, Reddit branches, RSS config, pipeline diagram |
| `/bmad-create-story 65-2` | Spike story first (gate); may parallel 65-1 authoring |
| `/bmad-create-story 65-1` | GitHub + FR-1 schema |
| `/bmad-create-story 65-3` | After 65-2 spike artifact |
| `/bmad-dev-story` | Omnipotent.md adapters + cns-dashboard validators (65-1 FR-1) |

**Normative upstream for signal shapes:** `architecture-epic-64-scoring-engine.md` §3, §6 — do not duplicate algorithm tables in stories; reference architecture sections.
