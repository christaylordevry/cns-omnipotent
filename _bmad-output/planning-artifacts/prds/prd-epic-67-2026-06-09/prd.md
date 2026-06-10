---
title: Epic 67 — Signal Quality + Source Expansion
status: final
created: 2026-06-09
updated: 2026-06-09
epicScope: epic-67
workflowType: prd
inputDocuments:
  - Operator brief (2026-06-09)
  - docs/ADR-E67-001-last30days-codebook-only.md
  - _bmad-output/planning-artifacts/prds/prd-epic-66-2026-06-09/prd.md
  - _bmad-output/planning-artifacts/prds/prd-epic-65-2026-06-09/prd.md
  - _bmad-output/planning-artifacts/architecture-epic-66-nexus-agent-orchestration.md
  - _bmad-output/implementation-artifacts/epic-65-retro-2026-06-09.md
  - _bmad-output/implementation-artifacts/65-9-surface-intelligence-scoring-inspector-drawer.md
  - project-context.md
relatedPrd:
  - _bmad-output/planning-artifacts/prds/prd-epic-65-2026-06-09/prd.md
  - _bmad-output/planning-artifacts/prds/prd-epic-66-2026-06-09/prd.md
relatedArchitecture:
  - docs/ADR-E67-001-last30days-codebook-only.md
classification:
  projectType: internal-tool
  domain: ai-orchestration-control-plane
  complexity: medium
  projectContext: brownfield
repos:
  adaptersCompute: Omnipotent.md
  schemaPersistence: cns-dashboard
  operatorConfig: ~/.hermes
---

# PRD: Epic 67 — Signal Quality + Source Expansion

**Author:** Chris Taylor  
**Date:** 2026-06-09  
**Product:** CNS Nexus Intelligence — morning-digest signal quality, scoring depth, and source expansion  
**Epic:** 67  
**Status:** Final

## 0. Document Purpose

This PRD is the normative product contract for Epic 67 story authoring (`67-1` through `67-6`). Downstream consumers: `/bmad-create-architecture`, `/bmad-create-epics-and-stories`, `/bmad-create-story`, and `/bmad-dev-story`.

The document anchors vocabulary in §3 Glossary. Functional requirements use globally numbered FR IDs scoped to this epic (`FR-1` through `FR-N`). Assumptions inferred without operator confirmation are tagged `[ASSUMPTION]` and indexed in §9.

**Primary inputs:** Operator brief (2026-06-09) — GitHub/RSS live validation, Reddit OAuth retry, personalRelevance v2 via `nexus-goals.yaml`, Signal Seeds chip → Inspector wiring, ProductHunt adapter (Source 10), Compare smoke test. **Binding architecture:** ADR-E67-001 (`last30days` codebook-only; Node/TS adapters; no Python subprocesses). **Normative upstream:** Epic 65 adapters (Sources 7–9), Epic 64 scoring, Epic 66 inspector actions (Compare now unblocked via `NEXUS_COMPARE_ENABLED`).

**Gate pattern (normative):** Story **67-1 (live digest validation)** is the **production-readiness gate** for Epic 65 GitHub/RSS adapters before operator declares ingest healthy. Story **67-2 (Reddit credentials)** is **operator-gated** — implementation proceeds only after OAuth app creation succeeds or documents explicit NO-GO.

---

## 1. Vision

Epic 66 shipped inspector AI actions (Explain, Trace, Compare, Ask AI) via OpenRouter. Epic 65 added GitHub, Reddit (OAuth), and RSS adapters to the morning-digest pipeline. Seven ingest sources are configured, but **signal quality is inconsistent in production**: GitHub and RSS were added today and never validated in a live digest run; `personalRelevance` scored zero until env/symlink fixes this session; Reddit remains blocked on OAuth credentials; Signal Seeds chips display terms but do not open the inspector because `term` ≠ `topicSlug`.

Epic 67 closes the gap between **adapter existence** and **operator-trusted intelligence**. The operator needs a morning digest that reliably produces 30+ scored signals, surfaces GitHub/RSS/ProductHunt rows in the inspector with meaningful dimension scores, ranks project-relevant headlines via an expanded personalRelevance model, and lets chip clicks drill into the same inspector surface used for hero/anomaly topics. Compare — now enabled — must be smoke-tested across two digest runs before production reliance.

This epic expands coverage with **one new native adapter** (ProductHunt, Source 10) and deepens scoring UX wiring without reopening the scoring engine architecture. Screen 10, X/Twitter, LinkedIn, and multi-tenant workspace enforcement remain deferred.

---

## 2. Target User

### 2.1 Jobs To Be Done

- **Trust the digest** — Confirm GitHub, RSS, and (when credentialed) Reddit signals appear in Convex with correct `sourceType`, engagement metadata, and scored dimensions after a real cron run — not just fixture tests.
- **See what matters to me** — Have signals mentioning current focus areas score higher on `personalRelevance` than generic market motion, using operator-defined goal phrases beyond sprint tokens.
- **Drill from seeds** — Click a Signal Seeds chip and land in the Intelligence Inspector for that keyword without manual slug hunting.
- **Track what's being built** — Surface daily Product Hunt launches as high-signal "what's shipping" intelligence in the same ranked feed.
- **Validate Compare** — Prove the Compare action produces meaningful week-over-week diffs now that the feature flag is on.

### 2.2 Non-Users (v1)

- Trend-ingest pipeline operators (Epic 44 remains separate).
- External API consumers.
- Multi-workspace tenants (`workspaceId` enforcement deferred).

### 2.3 Key User Journeys

**UJ-1. Chris reviews the first live digest with Epic 65 adapters.**

- **Persona + context:** CNS operator; GitHub queries and RSS feeds configured in `trend-ingest.env`; morning digest cron just completed.
- **Entry state:** Nexus cockpit open; latest `digestRunId` selected.
- **Path:** Operator scans ranked feed → filters mentally for GitHub/RSS badges → opens inspector on a GitHub repo signal → Signal Intelligence panel shows `personalRelevance > 0` when title matches project entities.
- **Climax:** ≥30 scored signals in run; GitHub `stars` and RSS entries visible with non-zero `rankScore`.
- **Resolution:** Operator records validation artifact (67-1); confidence to demo Compare and Trace on new sources.
- **Edge case:** Source fails → digest shows `(source unavailable: …)` for that section only; other sources still push.

**UJ-2. Chris configures focus goals for personalRelevance v2.**

- **Persona + context:** Operator maintaining `~/.hermes/nexus-goals.yaml` with 5–10 phrases ("Nexus intelligence", "agent orchestration", etc.).
- **Entry state:** Goals file created from example template; next digest run scheduled.
- **Path:** Digest runs → `scorePersonalRelevance` applies 2× weight to goal phrase token matches → sprint tokens still contribute at base weight.
- **Climax:** Signal mentioning a goal phrase ranks above generic headline with equal market `relevance`.
- **Resolution:** Inspector shows elevated `personalRelevance` bar on matched signals.

**UJ-3. Chris clicks a Signal Seeds chip.**

- **Persona + context:** Signal Seeds rail shows `displayTerm` "AI agents" with `term` `ai-agents`.
- **Entry state:** Inspector closed; hero chart visible.
- **Path:** Operator clicks chip body (not Track/Dismiss) → system resolves `topicSlug` via keyword match → inspector opens on matching topic.
- **Climax:** Same drawer experience as selecting topic from anomaly feed.
- **Resolution:** Operator investigates without copy-pasting keywords.
- **Edge case:** No matching trend topic → no inspector open; optional status message.

**UJ-4. Chris smoke-tests Compare after two digest runs.**

- **Persona + context:** `NEXUS_COMPARE_ENABLED=true`; same watchlist keyword stable across two days.
- **Entry state:** Two `digestRun` rows within 7-day lookback share `digestFocusKeyword`.
- **Path:** Inspector → Compare → prior-run signals loaded → streamed diff narrative.
- **Climax:** Diff mentions source or score change between runs.
- **Resolution:** Smoke test documented (67-6); Compare trusted for production demos.

---

## 3. Glossary

| Term | Definition |
|------|------------|
| **digestSignal** | Single intelligence row in a `digestRun` — title, `section`, `sourceType`, optional URL/metadata, and (after scoring) `scores`, `disposition`, `rankScore`. |
| **digestSourceTypeValue** | Convex union literal for `sourceType`. Epic 65 added `github`, `reddit`, `rss`. Epic 67 adds `producthunt`. |
| **Source 7 / 8 / 9 / 10** | Morning-digest adapter ordinals: GitHub (7), Reddit OAuth (8), RSS (9), ProductHunt (10). |
| **scorePersonalRelevance** | Epic 64 pure function in `score-digest-signals.mjs` — F1 token overlap against `personalTokens` plus epic numeric bonus. Epic 67 extends token sources and weighting. |
| **personalTokens** | Token set derived from sprint-status.yaml, `MORNING_DIGEST_PROJECT_ENTITIES`, personal watchlist keywords, and keyword candidates. Epic 67 adds **goalTokens** from `nexus-goals.yaml` at higher weight. |
| **nexus-goals.yaml** | Operator-authored file at `~/.hermes/nexus-goals.yaml` — 5–10 focus phrases for personalRelevance v2. Not vault-managed. |
| **Signal Seeds** | `keywordCandidates` chips in `NexusSignalSeedsRail.svelte` — `term` (storage key) vs `displayTerm` (UI label). |
| **topicSlug** | Canonical slug for trend topics in Nexus cockpit; inspector selection key. |
| **DIGEST_PUSH_JSON** | Pre-push payload assembled in morning-digest task-prompt §9; scored before Convex push. |
| **resolveOperatorHome()** | Hermes-safe home directory resolver — mandatory in all new adapter scripts (never raw `os.homedir()`). |
| **last30days** | Reference codebook at `~/ai-factory/projects/last30days-skill-reference`. ADR-E67-001: never runtime dependency. |
| **NEXUS_COMPARE_ENABLED** | Convex env flag gating Compare action server-side. Now `true` per operator session. |
| **Live digest validation** | Full morning-digest run (non-dry-run trend-ingest) with Convex push — distinct from unit/fixture tests. |

---

## 4. Features

### 4.1 Live Digest Validation — GitHub + RSS (67-1)

**Description:** Execute and document the first production-quality morning digest run that includes Epic 65 GitHub and RSS adapters, verifying signal count, source attribution, scoring fields, and inspector visibility. Realizes UJ-1. This story is the **gate** for declaring Epic 65 adapter integration production-ready.

**Functional Requirements:**

#### FR-1: Live digest run with scored signal floor

The operator (or automated smoke script invoked by story) runs one complete morning-digest path with Convex push enabled. The resulting `digestRun` contains **≥30** `digestSignals` rows with `rankScore` and full `scores` object populated.

**Consequences (testable):**
- Convex query by `digestRunId` returns ≥30 signals with `rankScore` defined.
- Scoring degraded mode (omitted scores) affects <10% of signals unless operator documents upstream failure.

#### FR-2: GitHub and RSS source attribution

The same live run includes **≥1** signal with `sourceType: 'github'` (with `sourceMetadata.stars`) and **≥1** with `sourceType: 'rss'`.

**Consequences (testable):**
- Inspector opens on GitHub signal → Signal Intelligence panel renders (65-9 contract).
- RSS signals include `section: 'rss'` and valid `sourceType: 'rss'`.

#### FR-3: Validation artifact

Story author produces `67-1-live-digest-validation.md` with run timestamp, `digestRunId`, per-`sourceType` counts, and pass/fail against addendum A4 checklist.

**Consequences (testable):**
- Artifact committed under `_bmad-output/implementation-artifacts/`.
- Epic 65 retro P1 action ("live digest with new sources not yet operator-validated") marked resolved in sprint close notes.

---

### 4.2 Reddit Source — OAuth Retry + Live Wiring (67-2)

**Description:** Retry Reddit app creation at `old.reddit.com/prefs/apps` (captcha blocker from Epic 65), wire `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT` into `~/.hermes/trend-ingest.env`, configure subreddit watchlist, and validate live digest output. Realizes UJ-1 edge path for Source 8.

**Functional Requirements:**

#### FR-4: Reddit credential configuration

When OAuth app creation succeeds, `~/.hermes/trend-ingest.env` contains valid `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, and `REDDIT_USER_AGENT`. Subreddits configured: `MachineLearning`, `LocalLLaMA`, `SideProject`, `entrepreneur`, `devops`, `artificial`, `singularity`.

**Consequences (testable):**
- `hermes-run-reddit.sh` stdout JSON includes `posts[]` with ≥1 entry on manual run.
- `trend-ingest.env.example` documents all Reddit keys (no secrets committed).

#### FR-5: Reddit signals in live digest

On successful credential path, at least one live digest run includes **≥1** `digestSignal` with `sourceType: 'reddit'` and `sourceMetadata.upvotes` for normalization.

**Consequences (testable):**
- Reddit failure degrades to `(source unavailable: …)` without aborting digest.
- If OAuth app creation **fails** after retry, story documents NO-GO with operator notes; FR-5 waived; epic completable without Reddit.

**Notes:**
- Operator action required for captcha/OAuth — developer story wires and validates only.
- Password-grant path from 65-3 remains; no public-JSON production path.

---

### 4.3 personalRelevance v2 — nexus-goals.yaml (67-3)

**Description:** Extend `loadScoringContext()` and `scorePersonalRelevance()` to read operator focus phrases from `~/.hermes/nexus-goals.yaml`. Goal phrase token matches receive **higher weight** than sprint-status tokens. Existing sources (`MORNING_DIGEST_PROJECT_ENTITIES`, sprint tokens, watchlist) remain. Realizes UJ-2.

**Functional Requirements:**

#### FR-6: Goals file loader

`score-digest-signals.mjs` loads `nexus-goals.yaml` from `resolveOperatorHome()` path. File contains 5–10 `goals[].phrase` strings. Missing or malformed file → empty goal set; no throw; digest continues.

**Consequences (testable):**
- Unit tests cover present file, missing file, empty goals array.
- `scripts/nexus-goals.yaml.example` shipped in Omnipotent.md repo.

#### FR-7: Weighted personalRelevance scoring

Goal phrase tokens contribute at **2× weight** vs sprint-status tokens in `scorePersonalRelevance` F1 computation. `MORNING_DIGEST_PROJECT_ENTITIES` weight unchanged from v1 unless architecture documents explicit tier `[ASSUMPTION: entities remain 1×]`.

**Consequences (testable):**
- Fixture signal "Nexus intelligence cockpit ships scoring panel" with goal phrase "Nexus intelligence cockpit" scores `personalRelevance` ≥15 points higher than identical signal without goals file.
- At least one live digest signal shows `personalRelevance > 0` when title matches project entity or goal phrase (validates operator session env fix + v2 compound).

**Notes:**
- Schema draft in addendum A2; architecture may add `weight` per phrase.
- No Convex schema change — scoring remains pre-push in morning-digest path.

---

### 4.4 Signal Seeds Chip → Inspector Wiring (67-4)

**Description:** Wire chip body click in `NexusSignalSeedsRail.svelte` to open the Intelligence Inspector for the matching trend topic. Resolves `displayTerm` / `term` → `topicSlug` mismatch deferred from 65-9 T0. Realizes UJ-3.

**Functional Requirements:**

#### FR-8: Chip click opens inspector

Clicking the chip main body (excluding Track/Dismiss icon buttons) calls `setSelectedTopicSlug` with the resolved slug for that seed's keyword.

**Consequences (testable):**
- Click "AI agents" chip → inspector opens when a trend topic exists with matching `headerMeta.keyword` or slug `ai-agents`.
- Track/Dismiss clicks do not open inspector.
- Component test or e2e covers at least one positive match and one no-match path.

#### FR-9: Slug resolution utility

Shared util normalizes `displayTerm` and topic keywords (case-fold, whitespace collapse) before match. Algorithm per addendum A3.

**Consequences (testable):**
- Util exported from `nexus-signal-seeds.ts` or sibling; unit tests for exact match, slug fallback, no match.
- No duplicate normalization logic diverging from `resolveScoredDigestSignal`.

---

### 4.5 ProductHunt Adapter — Source 10 (67-5)

**Description:** Add daily Product Hunt launches to morning-digest via Node.js adapter following imperative stdout threading pattern (Epics 64–65). Free API; high signal for "what's being built." Realizes UJ-1 extension for launch intelligence.

**Functional Requirements:**

#### FR-10: producthunt digestSourceTypeValue

Extend `digestSourceTypeValue` in cns-dashboard with `producthunt` literal. Validators, push tests, and morning-digest mapping table updated.

**Consequences (testable):**
- Push payload with `sourceType: 'producthunt'` passes validator.
- `bash scripts/verify.sh` green cross-repo.

#### FR-11: fetch-producthunt-signals.mjs adapter

New script emits stdout JSON `{"launches":[...]}` or `{"error":"..."}`; exit 0 on failure; uses `resolveOperatorHome()` and `mergeTrendIngestEnv`; reads `PRODUCTHUNT_API_TOKEN` from `~/.hermes/trend-ingest.env`.

**Consequences (testable):**
- Fixture tests: stdout → `digestSignal` mapping → `normalizeEngagement` round-trip.
- Hermes wrapper `hermes-run-producthunt.sh` added; task-prompt Source 10 section documents terminal invocation.
- `buildDigestSignals` extended for `producthunt` key; source ordering documented in skill changelog.

#### FR-12: Live digest includes ProductHunt

At least one live or staging digest run after 67-5 merge includes ≥1 `producthunt` signal with `sourceMetadata.upvotes` (or documented engagement field per addendum A1).

**Consequences (testable):**
- Signal appears in ranked feed and inspector with scoring panel when scores present.

**Notes:**
- Study `last30days-skill-reference` for field mapping only — ADR-E67-001 prohibits subprocess.
- May require `normalizeEngagement` branch for `producthunt` if not covered by existing upvote path — scope within 67-5.

---

### 4.6 Compare Action Smoke Test (67-6)

**Description:** With `NEXUS_COMPARE_ENABLED=true`, execute operator smoke test across ≥2 digest runs sharing the same topic keyword. Document results per Epic 66 architecture smoke-gate intent. Realizes UJ-4.

**Functional Requirements:**

#### FR-13: Two-run Compare validation

Operator runs morning digest **twice** within 7 days such that the same `digestFocusKeyword` produces matchable `digestSignals` in both runs. Compare action on inspector produces streamed diff (or structured empty-state if legitimately no delta).

**Consequences (testable):**
- `investigationSessions` row created with `action: compare` and non-empty `response` when prior run exists.
- Artifact `67-6-compare-smoke-test.md` records dates, topic slug, session id, pass/fail per addendum A6.

#### FR-14: Compare flag documentation

Operator guide or story artifact confirms both `NEXUS_COMPARE_ENABLED` (Convex) and `PUBLIC_NEXUS_COMPARE_ENABLED` (client, if production UI) settings used during test.

**Consequences (testable):**
- Compare button enabled in tested environment (not `COMPARE_DISABLED_TITLE` tooltip state).

---

## 5. Non-Goals (Explicit)

- **Screen 10 Investigation workspace** — deferred to Epic 68.
- **X/Twitter adapter** — deferred; study `last30days-skill-reference` when epic starts.
- **LinkedIn adapter** — deferred.
- **Multi-tenant `workspaceId` enforcement** — deferred.
- **Python subprocess ingest** — prohibited by ADR-E67-001.
- **Forking/running last30days-skill** — deprecated; reference-only.
- **Scoring formula redesign** — personalRelevance v2 extends inputs/weights only; disposition and rankScore weights unchanged unless bug found.
- **Replacing Epic 44 trend-ingest** — morning-digest path only.

---

## 6. MVP Scope

### 6.1 In Scope

- Live digest validation artifact for GitHub + RSS (67-1).
- Reddit OAuth retry + env wiring + live validation when credentials obtained (67-2).
- `nexus-goals.yaml` loader + weighted personalRelevance (67-3).
- Signal Seeds chip → inspector slug resolution (67-4).
- ProductHunt adapter Source 10 + schema literal (67-5).
- Compare smoke test documentation (67-6).
- `trend-ingest.env.example` updates for new env keys.
- Cross-repo tests + `bash scripts/verify.sh` on all implementation stories.

### 6.2 Out of Scope for MVP

| Item | Reason |
|------|--------|
| Screen 10 (Epic 68) | Operator brief explicit deferral |
| X/Twitter, LinkedIn | Operator brief explicit deferral |
| Multi-tenant workspaceId | Operator brief explicit deferral |
| Google Trends watchlist edit | Operator updated 14 keywords this session — validate only if 67-1 fails GT section |
| HN engagement upgrade (65-5) | Still waived |
| Automatic Compare on digest publish | Operator-initiated only (Epic 66) |
| Vault WriteGate for nexus-goals | Operator file in `~/.hermes`, not AI-Context |

---

## 7. Success Metrics

**Primary**

- **SM-1:** Morning digest live run produces **≥30** scored signals per run (7-day rolling median). Validates FR-1.
- **SM-2:** **≥1** signal per enabled source type (`github`, `rss`, `producthunt`; `reddit` when credentialed) appears in Convex with correct `sourceType` and engagement metadata. Validates FR-2, FR-5, FR-12.
- **SM-3:** **≥1** signal with `scores.personalRelevance > 0` when title matches project entity or goal phrase. Validates FR-7.
- **SM-4:** Signal Seeds chip click opens inspector on matching topic (manual QA + automated util test). Validates FR-8.

**Secondary**

- **SM-5:** Compare smoke test artifact complete with successful diff on ≥1 topic pair. Validates FR-13.
- **SM-6:** `bash scripts/verify.sh` green after each story merge. Validates engineering gate.

**Counter-metrics (do not optimize)**

- **SM-C1:** Raw signal count above 50 — risks noise; cap per-source limits in env remain authoritative.
- **SM-C2:** personalRelevance max on every signal — goal is discrimination, not uniform inflation.

---

## 8. Open Questions

1. **ProductHunt API tier** — GraphQL token approval latency; fallback to RSS/Atom if API denied? Architecture decides in 67-5 `[ASSUMPTION: free developer token available]`.
2. **Goal phrase weight** — 2× default sufficient or per-phrase `weight` in YAML required day one? Addendum A2 allows optional override.
3. **Reddit captcha retry** — operator browser/session dependent; 67-2 may complete as NO-GO without blocking epic.
4. **Chip click when topic not in trend index** — open inspector empty vs toast only? PRD assumes no open on no match (FR-8).
5. **67-1 automation** — fully manual operator run vs scripted `hermes-run-morning-digest` smoke? Story author picks; artifact required either way.

---

## 9. Assumptions Index

- Epic 66 inspector actions shipped and stable — §1.
- `personalRelevance` zero root cause fixed via env + symlink this session — §1, FR-7.
- `NEXUS_COMPARE_ENABLED=true` already set — §1, FR-13.
- Google Trends 14-keyword watchlist current — §6.2.
- `MORNING_DIGEST_PROJECT_ENTITIES` remains 1× weight; goals 2× — FR-7, addendum A2.
- ProductHunt free API sufficient for daily digest — §8 Q1.
- Reddit 65-3 OAuth password-grant path unchanged — FR-4, FR-5.
- No Python in ingest pipeline — ADR-E67-001, §5.

---

## 10. Cross-Cutting NFRs

| Attribute | Requirement |
|-----------|-------------|
| **Performance** | New adapters respect existing per-source timeout (15s GitHub precedent); digest total wall clock ≤ existing cron budget `[ASSUMPTION: 10 min Hermes timeout]`. |
| **Security** | API tokens in `~/.hermes/trend-ingest.env` only; never committed; Reddit OAuth secrets server-side. |
| **Reliability** | Per-source exit-0-on-failure; degraded section bullets; digest never aborts on single adapter failure. |
| **Maintainability** | All adapters follow `fetch-*-signals.mjs` + `hermes-run-*.sh` pattern; `resolveOperatorHome()` mandatory. |
| **Observability** | 67-1 artifact captures per-source counts; optional stderr diagnostics for goals file load. |

---

## 11. Integration and Dependencies

| Dependency | Relationship |
|------------|--------------|
| **Epic 64** | Scoring engine (`scoreDigestSignals`, five dimensions, `normalizeEngagement`). |
| **Epic 65** | GitHub (7), Reddit (8), RSS (9) adapters — validated in 67-1/67-2. |
| **Epic 66** | Compare action smoke test (67-6); OpenRouter investigation provider. |
| **Story 65-9** | Inspector Signal Intelligence panel; chip wiring completes T0 deferral. |
| **ADR-E67-001** | Node/TS only; last30days reference-only. |
| **Epic 65 retro P1** | Live digest validation — closed by 67-1. |
| **cns-dashboard** | Schema literal for `producthunt`; Signal Seeds UI (67-4). |

---

## 12. Constraints and Guardrails

- **ADR-E67-001:** No Python subprocesses; no last30days runtime dependency.
- **resolveOperatorHome():** Required in all new scripts — never `os.homedir()` alone.
- **BMAD stories only** — no cowboy edits across repos.
- **Verify gate:** `bash scripts/verify.sh` before story done.
- **WriteGate:** `nexus-goals.yaml` is operator Hermes config, not vault AI-Context.
- **Package age:** No npm packages &lt;14 days old without operator approval (project security rule).

---

## 13. Story Map (implementation order)

| Story | Title | Repo | Gate / deps | FRs |
|-------|-------|------|-------------|-----|
| **67-1** | Live digest validation — GitHub + RSS | Omnipotent.md (+ operator) | **Gate** — production readiness for Epic 65 adapters | FR-1–FR-3 |
| **67-3** | personalRelevance v2 — nexus-goals.yaml | Omnipotent.md | Parallel with 67-1 | FR-6, FR-7 |
| **67-4** | Signal Seeds chip → Inspector | cns-dashboard | Parallel with 67-1 | FR-8, FR-9 |
| **67-2** | Reddit OAuth retry + live wiring | Omnipotent.md (+ operator) | Operator OAuth prerequisite | FR-4, FR-5 |
| **67-5** | ProductHunt adapter (Source 10) | Omnipotent.md + cns-dashboard | After 67-1 validates adapter pattern | FR-10–FR-12 |
| **67-6** | Compare smoke test + documentation | cns-dashboard (+ operator) | Requires ≥2 digest runs; best after 67-1 | FR-13, FR-14 |

**Recommended sequencing:**

1. **67-1** first (validates pipeline health).
2. **67-3** + **67-4** in parallel (scoring + UX; no adapter deps).
3. **67-2** when operator completes Reddit app (may slip).
4. **67-5** after 67-1 green (schema + adapter).
5. **67-6** last (needs two runs with stable keywords — may span calendar days).

**Epic completable without:** Reddit (67-2 NO-GO) — FR-5 waived; SM-2 reddit clause skipped.

---

## 14. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Live digest still &lt;30 signals | SM-1 fail | Tune per-source caps; verify watchlist + queries in 67-1 artifact |
| Reddit captcha blocks again | No Reddit signals | Document NO-GO; epic proceeds; retro captures blocker |
| Goals file ignored (path wrong) | personalRelevance flat | `resolveOperatorHome()` tests; example file + env docs |
| Chip slug mismatch edge cases | Frustrating no-op clicks | FR-9 util tests; optional aria-live feedback |
| ProductHunt API rate limits | Empty Source 10 | Degraded mode; env toggle `MORNING_DIGEST_PRODUCTHUNT_ENABLED` |
| Compare smoke blocked by single run | FR-13 incomplete | Run digest twice manually; document wait in 67-6 |

---

## 15. Why Now

Epic 66 made the inspector actionable; Epic 65 broadened sources — but **production confidence lags code merge**. The operator cannot demo Nexus intelligence to stakeholders while GitHub/RSS are unvalidated, personalRelevance reads zero, chips don't open the inspector, and Compare lacks a smoke record. Epic 67 is the **quality and coverage hardening** pass that turns adapter code into trusted daily intelligence — one new high-signal source (ProductHunt) and scoring that reflects what the operator actually cares about this quarter.
