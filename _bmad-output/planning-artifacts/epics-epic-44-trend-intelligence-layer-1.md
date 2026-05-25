---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
status: ready-for-development
completedAt: "2026-05-26"
inputDocuments:
  - _bmad-output/planning-artifacts/prd-epic-44-trend-intelligence-layer-1.md
  - _bmad-output/planning-artifacts/architecture-epic-44-trend-intelligence-layer-1.md
epicScope: epic-44
outputRepo: cns-dashboard
cnsRepoTouch: scripts/trend-ingest.py only
convexDeployment: amiable-ox-862.convex.cloud
relatedPrd:
  - _bmad-output/planning-artifacts/prd-epic-44-trend-intelligence-layer-1.md
relatedArchitecture:
  - _bmad-output/planning-artifacts/architecture-epic-44-trend-intelligence-layer-1.md
---

# CNS Trend Intelligence Layer 1 (Epic 44) — Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for **Epic 44: CNS Trend Intelligence Layer 1 — Signal Ingestion Pipeline**, decomposing requirements from `prd-epic-44-trend-intelligence-layer-1.md` and `architecture-epic-44-trend-intelligence-layer-1.md` into implementable stories.

**Repositories:** Brownfield `cns-dashboard` (Convex schema extension + `TrendStubPanel` live wire-up); CNS repo (`Omnipotent.md`) touch limited to `scripts/trend-ingest.py` and operator config/docs only.

**Hard constraints:** `ingestDashboardSnapshot` and Epic 42 tables frozen; momentum and `trendTopics` merge run **inside Convex only**; no npm deps added to Omnipotent.md; no browser calls to external trend APIs.

## Requirements Inventory

### Functional Requirements

```
FR1: Operator can define watchlist keywords in ~/.hermes/trend-watchlist.yaml without modifying application code.
FR2: System can validate watchlist YAML schema and reject malformed or unsafe keyword entries.
FR3: System can derive a stable topicSlug from each watchlist keyword for cross-run identity.
FR4: System can snapshot the watchlist at ingest run start so mid-run edits do not corrupt the current batch.
FR5: System can sync the watchlist snapshot to the Convex watchlist table on each ingest run.
FR6: System can skip ingest with a logged warning when the watchlist file is empty or missing.
FR7: System can collect Google Trends search-volume signals for each watchlist keyword via pytrends.
FR8: System can collect Reddit mention-count signals for each watchlist keyword via PRAW.
FR9: System can collect News article-count signals for each watchlist keyword via NewsAPI.
FR10: System can run News and Reddit collectors on a 15-minute schedule.
FR11: System can run the Google Trends collector on a 60-minute schedule.
FR12: System can normalise all source metrics into the unified SignalEvent contract documented in the PRD.
FR13: System can compute momentum per (topicSlug, source, region) using the documented formula.
FR14: System can assign a unique dedupeKey and ingestRunId to each ingest batch for idempotency and traceability.
FR15: System can isolate errors per keyword within a source so one failed keyword does not abort other keywords.
FR16: System can isolate errors per source so one failed source does not block other sources in the same or concurrent runs.
FR17: System can abort the Google Trends loop for the current run on 429/403 and apply backoff before the next scheduled run.
FR18: System can distinguish valid zero-signal observations from source API failures without writing false zero normalised values.
FR19: Operator can run ingest in dry-run mode to preview normalised events without pushing to Convex.
FR20: System can load API keys and Convex credentials from ~/.hermes/trend-ingest.env only.
FR21: System can push signal batches to Convex via HTTP API using the deploy key.
FR22: System can write signal data through ingestSignalBatch without modifying ingestDashboardSnapshot.
FR23: System can insert signalEvents idempotently using the dedupeKey unique index.
FR24: System can merge-update trendTopics by topicSlug without overwriting unrelated source entries in sourceBreakdown.
FR25: System can upsert signalSources health rows per source on each ingest run.
FR26: System can mark individual sources in sourceBreakdown as stale when their data exceeds the freshness window for that source.
FR27: System can retain historical signalEvents per the documented retention policy for Epic 45 downstream use.
FR28: Operator can view top watchlist topics ranked by aggregate momentum on the Trend Intelligence panel.
FR29: Operator can view per-topic momentum score and contributing source badges (google_trends, reddit, news).
FR30: Operator can view which sources contributed to each topic via sourceBreakdown (or equivalent panel representation).
FR31: Operator can distinguish topics with no ingest data, flat signal, and active momentum from panel presentation.
FR32: Operator can see stale or errored source status for a topic when a source failed or is outside its freshness window.
FR33: Dashboard can receive updated trend data via Convex subscription without manual page refresh.
FR34: Operator can see actionable empty-state guidance when watchlist or ingest is not yet configured.
FR35: System can remove Epic 42 placeholder/mock trend metrics and the "Coming in Epic 44" badge when live data exists.
FR36: Operator can view per-source ingest health (ok, partial, error), last run time, and error count from the dashboard or documented operator surfaces.
FR37: Operator can view the most recent error message for a failed source when available.
FR38: System can log ingest outcomes to a documented log path for operator troubleshooting.
FR39: Operator can install scheduled cron jobs for news/reddit (15m) and trends (60m) from documented install instructions.
FR40: System can complete ingest with partial success when at least one source or keyword succeeds and Convex push succeeds.
FR41: Dashboard performs no direct calls to Google Trends, Reddit, or News APIs from the browser.
FR42: Dashboard performs no vault writes during trend panel interactions.
FR43: Ingest process performs no vault filesystem mutations.
FR44: Ingest process excludes credentials and secret-pattern content from data pushed to Convex.
FR45: CNS repository production code changes are limited to addition of scripts/trend-ingest.py (story artifacts excluded).
FR46: System leaves Epic 42 ingestDashboardSnapshot, dashboard-sync.ts, vault-io MCP, and CNS src/ unchanged.
```

### NonFunctional Requirements

```
NFR-P1: Trend panel populates top 10 trendTopics within 2 seconds of Convex subscription hydrate (desktop, warm cache).
NFR-P2: getTrendTopics query returns only materialised aggregates — no full-table scan of signalEvents in the browser path.
NFR-P3: Single-source ingest run (one cron tick, all watchlist keywords for that source) completes within 120 seconds on operator WSL environment.
NFR-P4: Operator can identify top 3 moving topics within 15 seconds of opening the dashboard (time-to-prioritisation).
NFR-S1: NewsAPI, Reddit, and Convex deploy credentials exist only in ~/.hermes/trend-ingest.env (mode 600) — never in git, Vercel, or frontend bundle.
NFR-S2: No API keys, tokens, or credential-pattern matches are stored in Convex by the ingest process.
NFR-S3: Ingest reads vault-adjacent paths only as configured in watchlist/env — zero vault filesystem writes.
NFR-S4: Dashboard production URL remains Vercel password-protected (inherits Epic 42) — no application-level auth code added.
NFR-S5: Convex stores signal metrics and topic metadata only — no note bodies, AGENTS.md content, or operator PII.
NFR-R1: Scheduled ingest completes successfully on ≥ 95% of cron firings per source over a 7-day window (excluding operator-configured downtime).
NFR-R2: Ingest failures produce stderr/log entries without crashing the cron scheduler.
NFR-R3: Partial source failure leaves other sources and keywords updating — no single-point total outage except Convex unreachable.
NFR-R4: bash scripts/verify.sh passes in Omnipotent.md with only scripts/trend-ingest.py added to production code paths.
NFR-R5: trendTopics.lastUpdated is within 2× the source cron window when that source is healthy (30 min news/reddit, 2 h trends).
NFR-R6: pytrends 429/403 on keyword N aborts remaining trends keywords for that run only — prior keywords' data remains valid.
NFR-A1: Trend panel inherits Epic 42 dark-theme WCAG AA contrast for body text.
NFR-A2: Momentum values and source badges use text labels — not color alone.
NFR-A3: Empty and error states are screen-reader perceivable via text status, not icon-only affordances.
NFR-I1: Ingest pushes to Convex production deployment amiable-ox-862 via HTTP mutation API + deploy key.
NFR-I2: ingestDashboardSnapshot (3-min dashboard sync) and ingestSignalBatch (15m/60m trend ingest) operate on orthogonal tables with no cross-mutation.
NFR-I3: Watchlist authority is ~/.hermes/trend-watchlist.yaml — Convex watchlist table is a mirror, not the edit surface.
NFR-I4: Third-party APIs: Reddit (PRAW), News (NewsAPI), Google Trends (pytrends) — each isolated behind a collector module with documented rate limits.
```

### Additional Requirements

```
- **Brownfield extension (no new frontend framework):** Extend existing cns-dashboard Convex deployment; Python 3.11+ on WSL for ingest.
- **Dual write path isolation (C1–C3):** trends:ingestSignalBatch only for signal tables; dashboard:ingestDashboardSnapshot frozen — no trend fields on dashboardSnapshotValidator.
- **Server-side materialisation (C2):** Python sends SignalIngestBatch events + health patches + watchlist snapshot only; Convex computes momentum, trendTopics merge, retention prune.
- **Concurrent cron merge (C4):** Merge per (topicSlug, source) on sourceBreakdown; never clear-and-replace trend tables.
- **dedupeKey (C5):** windowStartMs = collectedAt - (windowHours * 3_600_000); floor to UTC hour; sha256_hex(topicSlug|source|signalType|windowStartHour).
- **Retention (C6):** Cap 500 signalEvents per topicSlug; prune oldest after each batch insert inside mutation.
- **momentum_score (C7):** Mean of momentum over non-stale sourceBreakdown entries; 0 if none.
- **Stale thresholds (C8):** News/Reddit > 30 min; Trends > 2 h since collectedAt.
- **topicSlug (C9):** Lowercase trim → non [a-z0-9]+ to - → collapse → max 80 chars.
- **Convex modules:** convex/trendValidators.ts + convex/trends.ts; extend schema.ts only (four new tables).
- **Wire contract:** SignalIngestBatch camelCase JSON; Python mirror type at top of trend-ingest.py; normative over PRD prose if drift.
- **Reddit/News min-max cache:** ~/.hermes/trend-norm-cache.json on operator machine only (not Convex).
- **HTTP push:** Mirror dashboard-sync.ts — POST {CONVEX_URL}/api/mutation, Authorization: Convex {CONVEX_DEPLOY_KEY}, path trends:ingestSignalBatch.
- **Pre-push guard (I5):** Scan serialised batch JSON with config/secret-patterns.json before HTTP.
- **Honest zeros:** Failed API must not emit normalizedValue: 0; skip-write on source error.
- **pytrends partial-run:** Per-keyword try/catch; 429/403 stops trends loop; captcha/empty = source error not zero.
- **watchlist mirror:** Replace semantics in Convex each batch — delete slugs not in batch; YAML remains authority.
- **signalSources errorCount:** Python sends absolute count after run; Convex stores as given; reset on ok per architecture.
- **Production targets:** https://cns-dashboard-three.vercel.app + amiable-ox-862.convex.cloud.
- **Context7:** Convex HTTP mutation API if transport details needed (project rule).
- **CI:** cns-dashboard npm test + convex tests; CNS bash scripts/verify.sh after script changes.
- **Operator artifacts (non-blocking code):** trend-ingest.env.example, cron install snippet, NewsAPI quota docs in operator guide.
```

### UX Design Requirements

_No separate UX Design.md — requirements extracted from PRD § Web App Specific Requirements, § Accessibility, user journeys, and architecture § Queries / Panel._

```
UX-DR1: Trend panel remains one grid cell on existing 6-panel dashboard — no new routes (FR28 partial).
UX-DR2: Top N topics (default 10) scroll within panel card; source badges wrap at 1280px grid width.
UX-DR3: useQuery(api.trends.getTrendTopics) replaces TrendStubPanel mock em-dash metrics when live data exists (FR35).
UX-DR4: Remove "Coming in Epic 44" badge when at least one trendTopics row exists with recent lastUpdated.
UX-DR5: Empty state copy points operator to ~/.hermes/trend-watchlist.yaml and cron setup — actionable, not generic (FR34).
UX-DR6: Per-topic display: momentum score (text + aria-label), source badges with visible text labels google_trends / reddit / news (FR29, NFR-A2).
UX-DR7: Distinguish empty (no ingest), flat (healthy ingest, ~0 momentum), and active momentum in presentation (FR31).
UX-DR8: Stale or errored source indicated in topic row or optional panel footer via getSignalSources — text status not color-only (FR32, FR36–FR37, NFR-A3).
UX-DR9: aria-labelledby on trend section; momentum and badges meet WCAG AA on dark theme (NFR-A1, NFR-A3).
UX-DR10: Real-time updates via convex-svelte useQuery — no polling (FR33).
UX-DR11: Optional signalSources health strip in panel footer — last_run and status per source for Journey 4 troubleshooting.
UX-DR12: Desktop 1280px+ only — inherits Epic 42 browser matrix; mobile out of scope.
```

### FR Coverage Map

| FR | Epic | Description |
|----|------|-------------|
| FR1 | 2 | Watchlist YAML authority |
| FR2 | 2 | YAML validation |
| FR3 | 2 | topicSlug derivation |
| FR4 | 2 | Run-start snapshot |
| FR5 | 1 | Convex watchlist mirror sync |
| FR6 | 2 | Empty watchlist skip |
| FR7 | 3 | Google Trends collector |
| FR8 | 3 | Reddit collector |
| FR9 | 3 | News collector |
| FR10 | 4 | 15m cron news/reddit |
| FR11 | 4 | 60m cron trends |
| FR12 | 3 | SignalEvent normalisation |
| FR13 | 1 | Momentum in Convex |
| FR14 | 1, 2 | dedupeKey + ingestRunId |
| FR15 | 3 | Per-keyword isolation |
| FR16 | 3 | Per-source isolation |
| FR17 | 3 | pytrends 429/403 abort |
| FR18 | 3 | Honest zeros |
| FR19 | 2 | Dry-run mode |
| FR20 | 2 | Env-only secrets |
| FR21 | 2 | HTTP push |
| FR22 | 1 | ingestSignalBatch only |
| FR23 | 1 | Idempotent dedupeKey |
| FR24 | 1 | trendTopics merge |
| FR25 | 1 | signalSources upsert |
| FR26 | 1 | Stale flags in breakdown |
| FR27 | 1 | Retention cap 500 |
| FR28 | 5 | Top topics by momentum |
| FR29 | 5 | Momentum + badges |
| FR30 | 5 | sourceBreakdown display |
| FR31 | 5 | Empty/flat/active states |
| FR32 | 5 | Stale per topic |
| FR33 | 5 | Convex subscription |
| FR34 | 5 | Empty-state guidance |
| FR35 | 5 | Remove stub/mock |
| FR36 | 1, 5 | Source health visibility |
| FR37 | 1, 5 | last_error display |
| FR38 | 4 | Ingest logging |
| FR39 | 4 | Cron install docs |
| FR40 | 2, 3 | Partial success |
| FR41 | 5 | No browser API calls |
| FR42 | 5 | No vault writes |
| FR43 | 2, 3 | No vault mutations from ingest |
| FR44 | 2 | Secret scan pre-push |
| FR45 | 2, 3 | CNS script-only diff |
| FR46 | 1 | Epic 42 freeze |

## Epic List

### Epic 1: Trend Signal Contract & Convex Backend
Operator has a frozen wire contract and server-side ingest that materialises momentum, trendTopics, and source health — Python can push batches without duplicating merge logic or touching Epic 42 tables.

**FRs covered:** FR5, FR13–FR14 (server), FR21–FR27, FR36–FR37 (storage), FR46; NFR-I1–I2, NFR-P2, NFR-S2, NFR-S5

### Epic 2: Python Ingest Skeleton & Watchlist
Operator can configure watchlist and env, dry-run ingest, and push valid batches to production Convex — before external API collectors ship.

**FRs covered:** FR1–FR4, FR6, FR19–FR21, FR38 (partial), FR40 (partial), FR43–FR45; NFR-S1, NFR-S3, NFR-R4

### Epic 3: External Signal Collectors
Watchlist keywords receive normalised signals from Google Trends, Reddit, and News with per-source/per-keyword error isolation and honest failure semantics.

**FRs covered:** FR7–FR18, FR40; NFR-R3, NFR-R6, NFR-I4, NFR-P3

### Epic 4: Scheduled Ingest Operations
Signal layer runs on operator WSL cron (15m / 60m) with documented install, logging, and ≥95% reliability targets.

**FRs covered:** FR10–FR11, FR38–FR39; NFR-R1–R2, NFR-R5

### Epic 5: Live Trend Intelligence Panel
Operator opens the dashboard and prioritises research from live momentum and source badges — under 15 seconds, no external tabs, no stub badge.

**FRs covered:** FR28–FR35, FR41–FR42, FR36–FR37 (UI); NFR-P1, NFR-P4, NFR-A1–A3; UX-DR1–UX-DR12

**Dependency chain:** Epic 1 → Epic 2 → Epic 3 → Epic 4 (Epic 4 can overlap Epic 5 once Epic 2 pushes); Epic 5 requires Epic 1 queries (Epic 1 Story 1.2) — panel can ship with seed/mock Convex data before Epic 3 completes.

---

## Epic 1: Trend Signal Contract & Convex Backend

Operator has a frozen wire contract and server-side ingest that materialises momentum, trendTopics, and source health — Python can push batches without duplicating merge logic or touching Epic 42 tables.

### Story 1.1: Convex trend schema and validators

As a **developer**,
I want **four trend tables and normative validators in cns-dashboard**,
So that **ingestSignalBatch has a typed contract isolated from Epic 42 dashboard tables**.

**Acceptance Criteria:**

**Given** the live cns-dashboard Convex project with Epic 42 tables unchanged
**When** `convex/schema.ts` adds `signalEvents`, `trendTopics`, `signalSources`, and `watchlist` per architecture § Convex Schema
**Then** field names use `camelCase` (`normalizedValue`, `momentumScore`, `lastUpdated`, `sourceBreakdown` with `stale` boolean)
**And** indexes exist: `by_dedupeKey`, `by_topicSlug_collectedAt`, `by_topicSlug` (unique application semantics), `by_name`, `by_topicSlug` on watchlist; `convex/trendValidators.ts` defines `SourceName`, `SignalType`, `SignalEventInput`, `SignalSourcePatch`, `WatchlistEntry`, and `SignalIngestBatch` matching architecture wire contract
**And** no edits to `ingestDashboardSnapshot`, `dashboard.ts` ingest path, or Epic 42 table shapes (FR22, FR46; NFR-I2).

### Story 1.2: ingestSignalBatch mutation with tests

As a **developer**,
I want **`trends:ingestSignalBatch` to validate batches, insert events, compute momentum, merge trendTopics, sync watchlist, and prune retention**,
So that **concurrent 15m and 60m cron runs merge safely without Python-side aggregation**.

**Acceptance Criteria:**

**Given** a valid `SignalIngestBatch` payload
**When** `ingestSignalBatch` runs
**Then** it syncs watchlist mirror (replace: delete slugs not in batch, upsert entries) (FR5)
**And** upserts `signalSources` from patches; for each event, skips insert if `dedupeKey` exists else inserts with momentum: prior null → 0, else clamp formula with ε=1e-6 (FR13, FR23)
**And** rebuilds affected `trendTopics`: merge `sourceBreakdown` per source only; `momentumScore` = mean of non-stale breakdown momentums; `stale` when news/reddit collectedAt > 30 min ago or trends > 2 h (FR24, FR26, C7–C8)
**And** prunes `signalEvents` to ≤500 per `topicSlug` by oldest `collectedAt` (FR27)
**And** returns `{ inserted, skipped, topicsUpdated }`; transaction rolls back on validation failure
**When** tests run in `tests/convex/trends.test.ts`
**Then** idempotent dedupe, merge without overwriting other sources' breakdown arms, and retention cap are covered
**And** `bash scripts/verify.sh` in Omnipotent.md is not required for this story (cns-dashboard repo only).

### Story 1.3: Trend queries getTrendTopics and getSignalSources

As a **CNS operator**,
I want **read-only Convex queries for panel aggregates and source health**,
So that **the browser never scans full signalEvents history**.

**Acceptance Criteria:**

**Given** materialised `trendTopics` and `signalSources` rows exist
**When** the client calls `getTrendTopics({ limit })` defaulting to 10
**Then** results are sorted by `momentumScore` descending with `stripConvexDoc` applied (FR28 partial; NFR-P2)
**When** the client calls `getSignalSources()`
**Then** all sources return sorted by `name` with status, lastRun, errorCount, lastError (FR36–FR37)
**And** queries touch only `trendTopics` and `signalSources` tables — never full `signalEvents` scan in browser path (NFR-P2)
**And** unit tests cover empty tables and multi-topic ordering.

---

## Epic 2: Python Ingest Skeleton & Watchlist

Operator can configure watchlist and env, dry-run ingest, and push valid batches to production Convex — before external API collectors ship.

### Story 2.1: trend-ingest.py skeleton, watchlist module, and dry-run

As a **CNS operator**,
I want **`scripts/trend-ingest.py` to read my watchlist and env, build a batch, and preview without pushing**,
So that **I can validate configuration before enabling collectors or cron**.

**Acceptance Criteria:**

**Given** `~/.hermes/trend-watchlist.yaml` with valid keywords
**When** the script loads the watchlist at run start (snapshot — mid-run edits ignored) (FR4)
**Then** each keyword gets a stable `topicSlug` per architecture C9 (FR3)
**And** YAML schema validation rejects malformed or unsafe entries (FR2); empty or missing file logs warning and exits without Convex push (FR6)
**When** `python scripts/trend-ingest.py --dry-run` runs
**Then** serialised `SignalIngestBatch` prints to stdout with `ingestRunId` UUID and `activeSources` list — no HTTP call (FR19)
**And** credentials load only from `~/.hermes/trend-ingest.env` (FR20, NFR-S1); script is the only new production file in Omnipotent.md diff scope (FR45).

### Story 2.2: HTTP push to ingestSignalBatch with secret guard

As a **CNS operator**,
I want **successful batches pushed to production Convex with the same auth pattern as dashboard-sync**,
So that **trend ingest reuses proven transport without new npm dependencies**.

**Acceptance Criteria:**

**Given** `CONVEX_URL` and `CONVEX_DEPLOY_KEY` in trend-ingest.env (file mode 600)
**When** ingest runs without `--dry-run`
**Then** the script POSTs to `{CONVEX_URL}/api/mutation` with path `trends:ingestSignalBatch`, Authorization `Convex {key}`, camelCase JSON body (FR21, NFR-I1)
**When** serialised batch matches `config/secret-patterns.json`
**Then** push aborts with non-zero exit and no mutation (FR44, NFR-S2)
**When** push succeeds with empty `events` but valid `signalSources` patches
**Then** exit code 0 per partial-run semantics (FR40)
**And** `bash scripts/verify.sh` passes in Omnipotent.md after adding the script (NFR-R4)
**And** `ingestDashboardSnapshot` and `dashboard-sync.ts` are untouched (FR46).

---

## Epic 3: External Signal Collectors

Watchlist keywords receive normalised signals from Google Trends, Reddit, and News with per-source/per-keyword error isolation and honest failure semantics.

### Story 3.1: Google Trends collector (pytrends)

As a **CNS operator**,
I want **hourly Google Trends signals for each watchlist keyword**,
So that **search-volume momentum appears in the trend panel**.

**Acceptance Criteria:**

**Given** watchlist keywords and trends collector invoked with `activeSources: ["google_trends"]`
**When** pytrends returns interest 0–100 for a keyword
**Then** events include `signalType: search_volume`, `normalizedValue: interest/100`, `metadata.normalisationMethod: trends_interest_over_100`, `windowHours`, `collectedAt`, and `dedupeKey` per architecture (FR7, FR12)
**When** a single keyword fails
**Then** other keywords in the run continue (FR15)
**When** 429 or 403 occurs
**Then** the trends loop stops for this run; `signalSources` patch shows `partial` or `error`; no further trends keywords run (FR17, NFR-R6)
**When** captcha or empty response occurs
**Then** no event is written and `normalizedValue: 0` is not used as a failure substitute (FR18)
**And** one failed keyword does not prevent Reddit/News sources in separate cron invocations (FR16).

### Story 3.2: Reddit and News collectors with norm cache

As a **CNS operator**,
I want **Reddit mention and News article counts normalised against my keyword's recent history**,
So that **cross-source ranking in the panel is comparable**.

**Acceptance Criteria:**

**Given** PRAW and NewsAPI credentials in trend-ingest.env
**When** Reddit collector runs on 15-minute cadence
**Then** events use `mention_count` and `reddit_7d_minmax` normalisation using `~/.hermes/trend-norm-cache.json` keyed by `topicSlug|source` (FR8, FR12)
**When** News collector runs on 15-minute cadence
**Then** events use `article_count` and `news_7d_minmax` with the same cache file updated after successful collect (FR9, FR12)
**When** a keyword fails within a source
**Then** other keywords continue (FR15)
**When** a source fails entirely
**Then** other sources in the same script invocation still run and push if Convex accepts the batch (FR16, NFR-R3)
**And** cache file stays on operator machine only — not sent to Convex (architecture I4)
**And** each event includes raw `value` in metadata alongside `normalizedValue` (FR18)
**And** `dedupeKey` and `ingestRunId` are set on every emitted event (FR14).

### Story 3.3: Collector CLI source selection and logging

As a **CNS operator**,
I want **to run one source at a time matching cron schedules and see ingest outcomes in a log file**,
So that **I can debug NewsAPI quota or Reddit token issues without reading cron mail only**.

**Acceptance Criteria:**

**Given** documented CLI flags (e.g. `--source news|reddit|google_trends` or equivalent)
**When** operator runs manual ingest for a single source
**Then** `activeSources` in the batch contains only that source and collectors for others are skipped (FR10–FR11 partial)
**When** ingest completes
**Then** outcomes append to the documented log path with ingestRunId, source, keyword counts, and HTTP result (FR38)
**And** ingest performs no vault filesystem writes (FR43, NFR-S3)
**And** full run completes within 120 seconds for all watchlist keywords for one source on WSL (NFR-P3).

---

## Epic 4: Scheduled Ingest Operations

Signal layer runs on operator WSL cron (15m / 60m) with documented install, logging, and ≥95% reliability targets.

### Story 4.1: Cron install documentation and env example

As a **CNS operator**,
I want **copy-paste cron lines and an env example for trend ingest**,
So that **the pipeline runs every 15 minutes for news/reddit and hourly for trends without editing application code**.

**Acceptance Criteria:**

**Given** Epic 44 implementation stories 2.x and 3.x are mergeable
**When** operator follows install docs
**Then** three cron entries exist: `*/15 * * * *` for news and reddit invocations, `0 * * * *` for google_trends (FR10, FR11, FR39)
**And** `trend-ingest.env.example` lists `CONVEX_URL`, `CONVEX_DEPLOY_KEY`, Reddit, NewsAPI variables with chmod 600 guidance (NFR-S1)
**And** NewsAPI quota tier and upgrade path are documented for Journey 4 (PRD domain requirements)
**And** docs live in operator guide / story artifacts — not in forbidden CNS paths (package.json, verify.sh edits for trend logic).

### Story 4.2: Seven-day pipeline reliability verification

As a **CNS operator**,
I want **confidence that scheduled ingest meets freshness targets**,
So that **I trust the trend panel for daily prioritisation**.

**Acceptance Criteria:**

**Given** cron enabled for 7 days
**When** reviewing `signalSources` and ingest logs
**Then** ≥95% of scheduled firings per source complete with HTTP 200 or documented partial success (NFR-R1)
**And** failures produce stderr/log lines without disabling cron (NFR-R2)
**When** a source is healthy
**Then** `trendTopics.lastUpdated` for topics using that source is within 2× cron window: 30 min news/reddit, 2 h trends (NFR-R5)
**And** operator guide documents how to verify partial degradation (Journey 4).

---

## Epic 5: Live Trend Intelligence Panel

Operator opens the dashboard and prioritises research from live momentum and source badges — under 15 seconds, no external tabs, no stub badge.

### Story 5.1: Wire TrendStubPanel to live Convex queries

As a **CNS operator**,
I want **the Trend Intelligence panel to show live top topics and source health**,
So that **I know what to research today without opening Google Trends or Reddit**.

**Acceptance Criteria:**

**Given** `getTrendTopics` and `getSignalSources` are deployed
**When** I open the dashboard trend panel
**Then** `TrendStubPanel.svelte` uses `useQuery` for top 10 topics sorted by momentum with text labels on momentum and badges (FR28–FR30, FR33; UX-DR3, UX-DR6, UX-DR10)
**When** at least one `trendTopics` row has recent data
**Then** mock em-dash metrics and the "Coming in Epic 44" badge are removed (FR35, UX-DR4)
**When** no watchlist data exists
**Then** empty state copy references `~/.hermes/trend-watchlist.yaml` and cron setup (FR34, UX-DR5)
**And** panel renders within 2s of subscription hydrate on desktop warm cache (NFR-P1)
**And** no fetch to Google, Reddit, or News from the browser (FR41, NFR-I4).

### Story 5.2: Flat, active, and stale signal states in UI

As a **CNS operator**,
I want **to tell flat signal from broken ingest and see stale sources**,
So that **I skip run-chain on cold topics with confidence**.

**Acceptance Criteria:**

**Given** healthy ingest with flat momentum across sources
**When** I view a topic row
**Then** presentation reads as neutral/flat — not as "no data" (FR31, UX-DR7)
**Given** `sourceBreakdown` marks a source stale or `signalSources` shows error
**When** I view the topic or panel footer
**Then** stale/error is visible with text status (FR32, FR36–FR37; UX-DR8, UX-DR11)
**And** `aria-labelledby` and `aria-label` on momentum satisfy screen-reader requirements (NFR-A1–A3, UX-DR9)
**And** operator can identify top 3 moving topics within 15 seconds of page open (NFR-P4)
**And** dashboard performs no vault writes on trend interactions (FR42).

---

## Final Validation Summary

| Check | Result |
|-------|--------|
| FR1–FR46 coverage | All mapped to epics and stories |
| NFR coverage | Addressed in ACs per category |
| UX-DR1–UX-DR12 | Covered in Epic 5 |
| Epic 42 freeze | Story 1.1, 1.2, 2.2, FR46 |
| Convex-before-Python | Epic 1 before Epic 2–3 (architecture handoff) |
| No forward story dependencies | Each story builds on prior epics/stories in chain |
| Starter template | N/A — brownfield extension |

**Status:** Ready for `bmad-create-story` per story ID (e.g. `44-1-1-convex-trend-schema.md`).

**Next steps:** Run `bmad-check-implementation-readiness` (IR) before sprint commit; cut implementation stories from this file in dependency order.
