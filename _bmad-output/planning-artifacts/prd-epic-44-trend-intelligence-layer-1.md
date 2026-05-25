---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-02b-vision
  - step-02c-executive-summary
  - step-03-success
  - step-04-journeys
  - step-05-domain
  - step-06-innovation
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-polish
  - step-12-complete
architectureDecisions:
  signalWritePath: ingestSignalBatch
  dashboardSnapshotUnchanged: true
  elicitationApplied: "2026-05-26"
status: complete
completedAt: "2026-05-26"
inputDocuments:
  - user-provided-epic-44-scope
  - _bmad-output/planning-artifacts/prd-epic-42-cns-dashboard.md
  - _bmad-output/planning-artifacts/architecture-epic-42-cns-dashboard.md
  - _bmad-output/implementation-artifacts/42-8-trend-stub-panel.md
  - _bmad-output/implementation-artifacts/42-2-convex-schema-and-ingest-mutation.md
  - CLAUDE.md
  - _bmad-output/implementation-artifacts/deferred-work.md
  - scripts/dashboard-sync.ts
workflowType: prd
documentCounts:
  briefCount: 0
  researchCount: 0
  brainstormingCount: 0
  projectDocsCount: 6
epicScope: epic-44
outputRepo: cns-dashboard
cnsRepoTouch: scripts/trend-ingest.py only
relatedPrd:
  - _bmad-output/planning-artifacts/prd-epic-42-cns-dashboard.md
relatedArchitecture:
  - _bmad-output/planning-artifacts/architecture-epic-42-cns-dashboard.md
operatorDiscovery:
  primaryPain: "Decision latency — no signal layer before run-chain or content investment"
  valueUnlock: "Research prioritisation and niche timing inside CNS without external tool context-switch"
  cronSchedule:
    news: "*/15 * * * *"
    reddit: "*/15 * * * *"
    google_trends: "0 * * * *"
  watchlistConfig: "~/.hermes/trend-watchlist.yaml"
classification:
  projectType: web_app
  domain: ai-orchestration-control-plane
  complexity: medium
  projectContext: brownfield
provisioning:
  cnsDashboardRepo: live
  convexProduction: amiable-ox-862.convex.cloud
  dashboardUrl: https://cns-dashboard-three.vercel.app
---

# Product Requirements Document - Epic 44: CNS Trend Intelligence Layer 1 — Signal Ingestion Pipeline

**Author:** Chris Taylor  
**Date:** 2026-05-26  
**Product:** CNS Trend Intelligence — external signal ingestion into Convex  
**Epic:** 44  
**Status:** Complete (2026-05-26)  
**Repository:** `cns-dashboard` (schema + panel); CNS repo touch limited to `scripts/trend-ingest.py`

## Repository & Hard Constraints

| Constraint | Value |
|------------|-------|
| Dashboard repo | `cns-dashboard` — extend Convex schema, ingest mutations, TrendStubPanel |
| CNS repo touch | `scripts/trend-ingest.py` + operator config (`~/.hermes/trend-ingest.env`, `~/.hermes/trend-watchlist.yaml`) **only** |
| CNS repo off-limits | package.json, tsconfig, verify.sh, AGENTS.md, vault-io MCP, all existing `src/` and `scripts/dashboard-sync.ts` |
| Ingestion runtime | WSL Python on cron — **no** Vercel Python deployment |
| Push path | Convex HTTP API + deploy key via **`ingestSignalBatch`** mutation — `ingestDashboardSnapshot` **unchanged** |
| Watchlist | `~/.hermes/trend-watchlist.yaml` — operator-defined keywords; no hardcoded keywords |
| Cron cadence | News + Reddit: every 15 min; Google Trends: every 60 min (pytrends rate limits) |
| Production | Convex `amiable-ox-862.convex.cloud`; dashboard `https://cns-dashboard-three.vercel.app` |

## Executive Summary

Epic 44 adds **Layer 1 trend signal ingestion** to the CNS control plane. The operator currently commits run-chain cycles and content effort without a unified signal that a watchlist topic is gaining momentum — decision latency forces context-switching to Google Trends, Reddit, and news sites outside the CNS.

This epic delivers a **scheduled Python ingestion pipeline** (`scripts/trend-ingest.py` in the Omnipotent.md repo only) that reads operator-defined keywords from `~/.hermes/trend-watchlist.yaml`, collects normalised signals from three V1 sources (Google Trends via pytrends, Reddit via PRAW, News via NewsAPI), and pushes them to production Convex via HTTP API with deploy key — the same isolation pattern as Epic 42's `dashboard-sync.ts`. The **cns-dashboard** repo extends Convex with four new tables (`signalEvents`, `trendTopics`, `signalSources`, `watchlist`), adds **`ingestSignalBatch`** mutation and trend queries (leaving `ingestDashboardSnapshot` unchanged), and replaces the Epic 42 **TrendStubPanel** mock data with live `trendTopics` (momentum score, source badges). No intelligence scoring (Epic 45), no interactive pop-outs (Epic 46), no hosted microservice (Option A).

**Target user:** Single-tenant CNS operator. **Cadence:** News and Reddit every 15 minutes; Google Trends every 60 minutes (pytrends rate limits). **Success moment:** Operator opens the pinned dashboard tab and sees which watchlist topics are moving — before opening external research tools or kicking off run-chain.

### What Makes This Special

**Signals inside the ops surface.** Epic 42 answers "is the system healthy?" Epic 44 answers "what should I prioritise?" in the same dashboard — no new tab, no browser API keys, no vault writes.

**Same safety-by-architecture as dashboard-sync.** WSL Python cron → Convex HTTP push → SvelteKit subscriptions. CNS repo touch limited to `scripts/trend-ingest.py` and operator config. package.json, tsconfig, verify.sh, AGENTS.md, and vault-io MCP remain untouched.

**Operator-owned watchlist.** Keywords are never hardcoded; the ingest script reads `~/.hermes/trend-watchlist.yaml`. The operator controls what the signal layer monitors.

**Honest Layer 1.** Raw normalised `SignalEvent` records and aggregated `trendTopics` — no fabricated scores or lifecycle staging beyond basic momentum aggregation. Epic 45 owns the intelligence engine; Epic 46 owns rich UI.

**Migration-ready schema.** Convex tables designed for future Option A (hosted microservice) without breaking the dashboard contract.

**Core insight:** Decision latency is an architecture gap, not a research skill gap. Epic 42 proved sync-to-Convex works for internal state; Epic 44 applies the same pattern to external world signals.

**Value proposition:** See momentum on your watchlist topics before you commit run-chain or content effort — inside the CNS dashboard, not in three separate browser tabs.

## Project Classification

| Dimension | Value |
|-----------|-------|
| **Project Type** | Web app (SvelteKit panel + Convex) + scheduled data pipeline (Python cron on WSL) |
| **Domain** | AI orchestration control plane — personal operator tooling |
| **Complexity** | Medium — three external APIs, normalisation contract, dual-repo boundary; single-tenant and no scoring engine limit scope |
| **Project Context** | Brownfield — live cns-dashboard (Vercel + Convex `amiable-ox-862`); CNS repo adds one script only |
| **CNS repo constraint** | `scripts/trend-ingest.py` + supporting operator config only |
| **Output repo** | `cns-dashboard` — Convex schema extension + TrendStubPanel replacement |

## Success Criteria

### User Success

- **Time-to-prioritisation:** Operator opens the dashboard and identifies the top 3 moving watchlist topics by momentum in **< 15 seconds** — without opening Google Trends, Reddit, or a news site.
- **Zero external context-switch for routine scans:** Daily research prioritisation uses the trend panel only; external tools are for deep dives, not "what's heating up?"
- **Pre-commitment signal:** Operator can defer or accelerate run-chain / content work based on visible momentum **before** starting a BMAD cycle on a cold topic.
- **Trust in data honesty:** Panel shows source badges (google_trends, reddit, news) and does not display fabricated live numbers; stub badge "Coming in Epic 44" is removed when live data is present.
- **Emotional success moment:** Operator glances at the trend panel and thinks **"I know what to research today"** — not "I should check Trends again."

### Business Success

Single-operator internal tool — no market metrics. Success = **operational ROI**:

- **Decision latency reduced:** At least one run-chain or content cycle per month explicitly chosen or skipped based on dashboard trend data (operator self-report acceptable).
- **Watchlist utility:** Operator maintains `~/.hermes/trend-watchlist.yaml` with ≥3 active keywords within 2 weeks of ship.
- **Pipeline reliability:** Ingest runs on schedule for 7 consecutive days without manual intervention (cron + env configured).

### Technical Success

- **CNS isolation:** `bash scripts/verify.sh` passes with only `scripts/trend-ingest.py` (+ docs/story artifacts) added to Omnipotent.md; no changes to package.json, tsconfig, verify.sh, AGENTS.md, vault-io, or `dashboard-sync.ts`.
- **Ingest push:** `trend-ingest.py` pushes normalised `SignalEvent` payloads to Convex via HTTP API; secrets only in `~/.hermes/trend-ingest.env` (mode 600).
- **Schema contract:** Four tables live in production Convex: `signalEvents`, `trendTopics`, `signalSources`, `watchlist`; **`ingestDashboardSnapshot` and Epic 42 tables unchanged**.
- **Source health:** `signalSources` reflects last_run, status, and error_count per source; operator can diagnose a dead API without reading cron logs.
- **Panel replacement:** `TrendStubPanel` uses `useQuery` on `trendTopics`; mock em-dash metrics and Epic 44 badge removed when data exists.
- **Rate-limit respect:** Google Trends collector runs at most hourly; News/Reddit at 15-min cadence without sustained 429 failures.

### Measurable Outcomes

| Metric | Target |
|--------|--------|
| Watchlist keywords ingested per run | ≥1 keyword from YAML (skip run if file empty — logged, not silent) |
| Signal events per successful ingest | ≥1 event per configured keyword per active source (or explicit zero with metadata) |
| `trendTopics` freshness | `last_updated` within 2× source cron window (30 min news/reddit, 2 h trends) |
| Convex push success rate | ≥95% of cron runs complete with HTTP 200 over 7-day window |
| Dashboard panel load | Trend panel renders top N topics (default 10) with momentum + badges in <2s after subscription |

## Product Scope

### MVP — Epic 44 (this epic)

| # | Capability | Required |
|---|------------|----------|
| 1 | `scripts/trend-ingest.py` + `~/.hermes/trend-ingest.env` | Yes |
| 2 | `~/.hermes/trend-watchlist.yaml` contract + ingest reader | Yes |
| 3 | Collectors: pytrends, PRAW, NewsAPI | Yes |
| 4 | Convex tables + **`ingestSignalBatch`** + queries | Yes |
| 5 | Hermes/WSL cron (15m news/reddit, 60m trends) | Yes |
| 6 | `signalSources` health rows | Yes |
| 7 | `TrendStubPanel` → live `trendTopics` | Yes |
| 8 | `SignalEvent` normalisation (0–1 value, -1–1 momentum) | Yes |

**Explicitly excluded from MVP:** Hiring signals, competitor monitoring, sentiment analysis, intelligence engine/scoring (Epic 45), interactive pop-outs/charts (Epic 46), Option A hosted microservice, changes to `dashboard-sync.ts`.

### Growth (post–Epic 44, pre–45)

- Discord alert when momentum crosses threshold on a watchlist keyword
- Manual "ingest now" trigger from Hermes
- Historical sparklines (requires event retention policy)
- Per-region watchlist entries beyond `global` default

### Vision (Epic 45+)

- Intelligence engine: lifecycle_stage, composite scoring, PAKE correlation
- Epic 46: interactive drill-down, topic detail pop-outs, correlation views
- Option A: hosted microservice replaces Python script without schema break
- Tie trend signals to run-chain auto-suggest / CNS-Daily-Rhythm panel

## User Journeys

### Journey 1: Chris — Morning research prioritisation (primary, success path)

**Opening scene:** Tuesday 7:15 AM. Chris opens the pinned CNS dashboard after coffee. Vault health is green, Hermes is active — but the question today is not "is the system OK?" It is **"which niche deserves a run-chain this week?"** Yesterday he almost kicked off a BMAD research cycle on "AI agent orchestration" without checking whether the topic was cooling externally.

**Rising action:** Chris scrolls to **Trend Intelligence**. The Epic 44 badge is gone. Three watchlist topics show positive momentum with source badges: `google_trends`, `reddit`, `news`. "Programmatic SEO tools" is flat; "local LLM routing" is spiking on Reddit and News; "Obsidian AI plugins" has modest search volume but rising momentum.

**Climax:** In under 15 seconds Chris decides: **prioritise local LLM routing**, defer programmatic SEO, park Obsidian plugins for Friday. He never opens Google Trends or a Reddit tab.

**Resolution:** He starts a focused PAKE seed in Cursor on local LLM routing — run-chain effort aligned with external signal, not gut feel. Decision latency dropped from "open four tools and compare" to "one dashboard glance."

**Requirements revealed:** Live `trendTopics` query; momentum score display; per-source badges; top-N sort by momentum; remove stub/mock UI when data exists.

### Journey 2: Chris — Choosing *not* to run-chain (primary, edge case)

**Opening scene:** Thursday afternoon. Chris is excited about a podcast-inspired niche idea and reaches for `/bmad-create-story` — then habit-checks the dashboard first.

**Rising action:** Trend panel shows the keyword is **flat or negative momentum** across all three sources. `signalSources` shows healthy ingest (last_run recent) — the silence is real signal, not a broken pipeline.

**Climax:** Chris explicitly **skips** run-chain on that topic and logs a mental note: "revisit if momentum crosses 0.3." No false confidence from mock data.

**Resolution:** A week of run-chain capacity preserved for a hotter topic. Trust in honest Layer 1 data prevents wasted synthesis cycles.

**Requirements revealed:** Distinguish "no data" vs "flat signal"; `signalSources` health visible (ingest OK); negative/neutral momentum legible in UI; no fabricated positive trends.

### Journey 3: Chris — First-time watchlist and cron setup (operations)

**Opening scene:** Epic 44 just shipped. Chris has API keys for NewsAPI and Reddit; Google Trends needs no key but rate limits matter.

**Rising action:** Chris creates `~/.hermes/trend-watchlist.yaml` with five keywords, copies `trend-ingest.env.example` to `~/.hermes/trend-ingest.env` (chmod 600), runs install script for three cron lines (15m news/reddit, 60m trends). First manual run: `python scripts/trend-ingest.py --dry-run` shows normalised events; second run pushes to Convex.

**Climax:** Dashboard trend panel populates within 30 minutes. `signalSources` rows show `ok` for all three sources.

**Resolution:** Signal layer is operational without touching Omnipotent.md `package.json` or vault-io. Operator owns keywords in YAML forever — no redeploy to add a topic.

**Requirements revealed:** Watchlist YAML schema + validation; env file contract; cron installer docs; dry-run mode; `signalSources` upsert; operator guide update in vault.

### Journey 4: Chris — NewsAPI failure recovery (troubleshooting)

**Opening scene:** Monday morning. Trend panel shows Reddit and Google Trends badges but News is stale. Chris suspects API quota, not Convex.

**Rising action:** Chris checks `signalSources` in dashboard (or ingest log): `news` status `error`, `error_count` incremented, `last_run` 45 minutes ago. Reddit and trends still updating — partial pipeline degradation, not total outage.

**Climax:** Chris rotates NewsAPI key in `trend-ingest.env`, runs manual ingest. Next cron tick: `news` returns `ok`; article_count signals resume for watchlist keywords.

**Resolution:** Diagnosis took minutes without grep-ing Python tracebacks. Other sources never blocked the full ingest run (per-source error isolation).

**Requirements revealed:** Per-source status in `signalSources`; non-fatal source failures; stderr/log path documented; ingest continues for healthy sources; optional stale indicator in panel footer.

### Journey Requirements Summary

| Capability area | Journeys |
|-----------------|----------|
| Trend panel (live data) | 1, 2 |
| Momentum + source badges | 1, 2 |
| `signalSources` health | 2, 3, 4 |
| Watchlist YAML + cron setup | 3 |
| Per-source error isolation | 4 |
| Honest empty/flat states | 2 |
| CNS repo isolation | 3 |

## Domain-Specific Requirements

### Compliance & Regulatory

- **No regulated data in scope.** Signal layer ingests public/search/news/reddit metrics only — no PII, no vault note bodies, no operator credentials in Convex payloads.
- **Third-party ToS adherence:** PRAW (Reddit API), NewsAPI, and Google Trends (pytrends unofficial) each impose rate limits and acceptable-use rules — ingest must respect documented limits; sustained 429/403 triggers `signalSources` error state, not silent retry storms.
- **API key hygiene:** NewsAPI and Reddit credentials live only in `~/.hermes/trend-ingest.env` (mode 600); never in Convex, Vercel, git, or dashboard bundle — aligned with Epic 42 WriteGate/secret-scan philosophy.

### Technical Constraints

- **Rate-limit domain rules:**

  | Source | Cadence | Domain constraint |
  |--------|---------|-------------------|
  | NewsAPI | 15 min | Free/dev tier daily caps — document quota in operator guide |
  | Reddit (PRAW) | 15 min | OAuth token refresh; respect Reddit API rate headers |
  | Google Trends (pytrends) | 60 min | Unofficial API — backoff on 429; no sub-hourly polling |

- **Normalisation contract:** All sources map to unified `SignalEvent` shape; cross-source momentum comparison only valid after `normalized_value` (0.0–1.0) — document per-source normalisation method in PRD data contract.
- **Retention:** `signalEvents` append-only with TTL or cap policy (implementation decision) — avoid unbounded Convex storage on 15-min cadence.
- **Browser trust boundary:** Trend panel reads Convex only — no direct calls to Reddit/News/Google from SvelteKit (same as Epic 42 vault boundary).

### Integration Requirements

| Integration | Role | Failure mode |
|-------------|------|--------------|
| `~/.hermes/trend-watchlist.yaml` | Keyword source of truth | Empty file → skip ingest, log warning |
| `~/.hermes/trend-ingest.env` | API keys + Convex URL + deploy key | Missing var → non-zero exit, no partial secret leak |
| Convex HTTP API | Signal push target | HTTP error → update `signalSources`, stderr log |
| Hermes/WSL cron | Scheduler | Missed tick → stale `last_updated` visible in panel |
| Epic 42 dashboard tables | Orthogonal | Signal ingest must not break `ingestDashboardSnapshot` |

### Risk Mitigations

| Risk | Mitigation |
|------|------------|
| pytrends breakage (unofficial API) | Isolate collector module; `signalSources` shows trends-specific errors; other sources continue |
| Reddit API policy change | PRAW version pinned; monitor deprecation notices |
| NewsAPI quota exhaustion | Surface `error_count`; operator guide documents upgrade path |
| Keyword injection via YAML | Validate YAML schema; reject paths/scripts in keyword strings |
| False momentum from normalisation bugs | Unit tests per collector; metadata preserves raw `value` alongside `normalized_value` |
| CNS repo scope creep | Code review gate: diff limited to `scripts/trend-ingest.py` + story artifacts |

## Innovation & Novel Patterns

### Detected Innovation Areas

1. **Control-plane signal bridge.** Personal AI ops stacks typically lack a unified external signal layer. Epic 44 applies the Epic 42 trust model — cron on operator machine → Convex push → read-only browser — to Google Trends, Reddit, and News.
2. **Unified `SignalEvent` normalisation.** Search volume, mention velocity, and article count normalise to comparable `normalized_value` and `momentum` fields for cross-source ranking in one panel.
3. **Operator-owned watchlist as config.** Keywords in `~/.hermes/trend-watchlist.yaml` decouple monitoring intent from deploy cycles.
4. **Migration-ready Layer 1.** Convex schema stable for Option A microservice swap without breaking dashboard queries.

### Market Context & Competitive Landscape

| Alternative | Gap Epic 44 fills |
|-------------|-----------------|
| Google Trends / Reddit / News tabs | Fragmented; no link to run-chain or PAKE workflow |
| Generic trend SaaS | Not wired to personal CNS; no operator watchlist control |
| Scoring in Epic 44 | Scope creep — Layer 1 defers intelligence to Epic 45 |

**Positioning:** Internal CNS infrastructure — not competing with trend SaaS.

### Validation Approach

| Claim | Validation |
|-------|------------|
| Reduces context-switching | One run-chain decision influenced by panel within 30 days |
| Cross-source normalisation useful | Top `trendTopics` rank matches operator intuition on ≥2 test keywords |
| Epic 42 pattern re-use | `verify.sh` green; only `trend-ingest.py` added to CNS repo |
| Schema migration-ready | Option A documented; `getTrendTopics` contract stable |

### Risk Mitigation

| Risk | Fallback |
|------|----------|
| Normalisation misleading | Raw `value` + `metadata` preserved; Epic 45 adds scoring |
| pytrends unreliable | Per-source isolation in `signalSources` |
| Layer 1 feels thin | Honest UI — "raw signals"; Epic 46 adds depth |

## Web App Specific Requirements

### Project-Type Overview

Epic 44 extends the existing **SvelteKit SPA** (`cns-dashboard`) with live `trendTopics` via Convex subscription. Ingestion is WSL Python cron — not browser code. Dual surface: **read** in browser, **write** via HTTP from operator machine only.

### Technical Architecture Considerations

| Question | Epic 44 answer |
|----------|----------------|
| SPA or MPA? | **SPA** — trend panel is one grid cell on existing dashboard |
| Browser support? | **Desktop 1280px+** (inherits Epic 42) |
| SEO needed? | **No** — password-protected; no public indexing |
| Real-time? | **Yes** — `convex-svelte` `useQuery`; no polling |
| Accessibility? | **Yes** — dual-encoded status, screen-reader labels on momentum and badges |

### Browser Matrix

| Browser | Support |
|---------|---------|
| Chrome/Edge (desktop) | Primary |
| Firefox (desktop) | Supported |
| Mobile | Out of scope |

### Responsive Design

- Fits existing 6-panel grid; top N topics scroll within panel card
- Source badges wrap at 1280px grid width

### Performance Targets

| Target | Value |
|--------|-------|
| Trend panel hydrate | <2s after page load |
| Browser query | Top 10 `trendTopics` only — no full event history scan |

### SEO Strategy

Not applicable — password-gated Vercel deployment.

### Accessibility Level

- `aria-labelledby` on trend section
- Momentum values with text + `aria-label`
- Source badges with visible text labels (not color-only)
- Stale source: text status alongside color

### Implementation Considerations

- Replace `TrendStubPanel` mocks with `useQuery(api.trends.getTrendTopics)`
- Remove "Coming in Epic 44" badge when live data exists
- Empty state: actionable copy pointing to `~/.hermes/trend-watchlist.yaml`
- No new routes; Python ingest uses HTTP — no new npm deps in CNS repo

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP approach:** Problem-solving MVP — watchlist → ingest → Convex → live panel. No scoring engine, charts, or Discord alerts.

**Validated learning goal:** Operator changes at least one research/run-chain decision based on dashboard trend data within 30 days of ship.

**Resource requirements:** Solo operator + AI dev stories. Python (pytrends, PRAW, requests), Convex schema/mutations, Svelte panel update. No new CNS npm dependencies.

### MVP Feature Set (Phase 1 — Epic 44)

**Core user journeys supported:** Morning prioritisation; skip run-chain on flat topic; watchlist + cron setup; per-source failure recovery.

**Must-have capabilities:** `trend-ingest.py`, watchlist YAML, three collectors, four Convex tables, **`ingestSignalBatch`** (separate from dashboard snapshot), `getTrendTopics` query, `signalSources` health, cron (15m/60m), tightened SignalEvent contract (see below).

**Explicit cuts:** Intelligence scoring (Epic 45), interactive UI (Epic 46), hiring/competitor/sentiment, Option A microservice, changes to `dashboard-sync.ts` or `ingestDashboardSnapshot`.

### Post-MVP Features

**Phase 2 (Growth):** Discord momentum alerts; manual ingest trigger; sparklines + retention policy; per-region watchlist.

**Phase 3 (Epic 45–46+):** Intelligence engine; rich UI; Option A microservice; run-chain auto-suggest.

### Risk Mitigation Strategy

| Risk | MVP mitigation |
|------|----------------|
| pytrends instability | Hourly cadence; per-keyword isolation; partial-run semantics; stale flags |
| Normalisation bugs | Documented methods; raw values in metadata; unit tests |
| Concurrent cron collision | Merge upserts on `trendTopics`; idempotent `signalEvents`; separate mutation |
| CNS repo creep | Hard constraint + verify.sh gate |

## Signal Ingest Data Contract

Data contract between `scripts/trend-ingest.py` (CNS repo) and `cns-dashboard` Convex schema. Epic 45 intelligence engine builds on this contract — **breaking changes require migration plan**.

### Write Path

| Mutation | Caller | Scope |
|----------|--------|-------|
| `ingestDashboardSnapshot` | `dashboard-sync.ts` | Epic 42 tables only — **unchanged in Epic 44** |
| `ingestSignalBatch` | `trend-ingest.py` | `signalEvents`, `trendTopics`, `signalSources`, `watchlist` |

Concurrent runs (15m news/reddit cron vs 60m trends cron) use **merge semantics** — never clear-and-replace signal tables.

### SignalEvent (required fields)

| Field | Type | Notes |
|-------|------|-------|
| `topicSlug` | string | Stable key (slugified keyword); join key across tables |
| `keyword` | string | Display label from watchlist |
| `source` | `google_trends` \| `reddit` \| `news` | |
| `signal_type` | `search_volume` \| `mention_count` \| `article_count` | |
| `value` | number | Raw source value |
| `normalized_value` | number | 0.0–1.0 per method below |
| `momentum` | number | -1.0–1.0 per formula below |
| `region` | string | Default `global` |
| `windowHours` | number | e.g. 24, 168 |
| `collected_at` | number | Unix ms |
| `dedupeKey` | string | Hash of `topicSlug\|source\|signal_type\|windowStart` — unique index |
| `ingestRunId` | string | UUID per script invocation |
| `metadata` | object | Source-specific + `normalisationMethod` |

### Normalisation Methods (documented)

| Source | Raw metric | `normalized_value` | `metadata.normalisationMethod` |
|--------|------------|-------------------|-------------------------------|
| Google Trends | interest 0–100 | `interest / 100` | `trends_interest_over_100` |
| Reddit | mention count in window | min-max vs keyword's 7-day self-history | `reddit_7d_minmax` |
| News | article count in window | min-max vs keyword's 7-day self-history | `news_7d_minmax` |

### Momentum Formula

Per `(topicSlug, source, region)`:

```
momentum = clamp((norm_now - norm_prior) / max(norm_prior, ε), -1, 1)
```

Where `norm_prior` = `normalized_value` from the last successful event for the same tuple. First observation: `momentum = 0`.

### trendTopics (materialised aggregate)

| Field | Type | Notes |
|-------|------|-------|
| `topicSlug` | string | Unique index |
| `keyword` | string | Display |
| `sources` | string[] | Active source names |
| `sourceBreakdown` | array | `{ source, normalizedValue, momentum, collectedAt, stale }` per source |
| `momentum_score` | number | Aggregate for panel sort (implementation-defined from breakdown) |
| `volume` | number | Optional aggregate raw volume |
| `lifecycle_stage` | string | **Deferred to Epic 45** — field reserved, nullable |
| `last_updated` | number | Unix ms |

**Write pattern:** MERGE upsert by `topicSlug` — update `sourceBreakdown` entry for the ingesting source only; do not overwrite other sources' entries.

### signalSources

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | `google_trends`, `reddit`, `news` — unique index |
| `status` | string | `ok` \| `partial` \| `error` |
| `last_run` | number | Unix ms |
| `error_count` | number | Incremented on failure |
| `last_error` | string \| null | Most recent error message |

### watchlist

Synced from YAML snapshot at each ingest run start. Fields: `topicSlug`, `keyword`, `region` (default `global`), `added_at`.

### signalEvents Retention

Append-only. MVP policy: retain last **90 days** OR last **500 events per topicSlug** (whichever implementation chooses — must be documented in operator guide). Required for Epic 45 historical analysis.

### pytrends Partial-Run Semantics

- Per-keyword try/catch — one failure does not abort other keywords or sources.
- On 429/403: **stop trends loop for this run**; exponential backoff before next cron (≥15 min).
- Captcha/empty response: treat as **source error** — do **not** write `normalized_value: 0`.
- Partial success: write events for successful keywords; `signalSources.google_trends.status = partial` if any keyword succeeded before failure.
- Exit code `0` if Convex push succeeds with ≥1 event or source health updated; non-zero only on total failure (env missing, Convex unreachable).

### Convex Index Plan

| Table | Index | Purpose |
|-------|-------|---------|
| `signalEvents` | `by_dedupeKey` (unique) | Idempotent insert |
| `signalEvents` | `by_topicSlug_collected_at` | Epic 45 history queries |
| `trendTopics` | `by_topicSlug` (unique) | Merge upsert |
| `signalSources` | `by_name` (unique) | Per-source health |
| `watchlist` | `by_topicSlug` (unique) | YAML sync |

## Functional Requirements

### Watchlist Management

- **FR1:** Operator can define watchlist keywords in `~/.hermes/trend-watchlist.yaml` without modifying application code.
- **FR2:** System can validate watchlist YAML schema and reject malformed or unsafe keyword entries.
- **FR3:** System can derive a stable `topicSlug` from each watchlist keyword for cross-run identity.
- **FR4:** System can snapshot the watchlist at ingest run start so mid-run edits do not corrupt the current batch.
- **FR5:** System can sync the watchlist snapshot to the Convex `watchlist` table on each ingest run.
- **FR6:** System can skip ingest with a logged warning when the watchlist file is empty or missing.

### Signal Collection & Ingestion

- **FR7:** System can collect Google Trends search-volume signals for each watchlist keyword via pytrends.
- **FR8:** System can collect Reddit mention-count signals for each watchlist keyword via PRAW.
- **FR9:** System can collect News article-count signals for each watchlist keyword via NewsAPI.
- **FR10:** System can run News and Reddit collectors on a 15-minute schedule.
- **FR11:** System can run the Google Trends collector on a 60-minute schedule.
- **FR12:** System can normalise all source metrics into the unified `SignalEvent` contract documented in this PRD.
- **FR13:** System can compute momentum per `(topicSlug, source, region)` using the documented formula.
- **FR14:** System can assign a unique `dedupeKey` and `ingestRunId` to each ingest batch for idempotency and traceability.
- **FR15:** System can isolate errors per keyword within a source so one failed keyword does not abort other keywords.
- **FR16:** System can isolate errors per source so one failed source does not block other sources in the same or concurrent runs.
- **FR17:** System can abort the Google Trends loop for the current run on 429/403 and apply backoff before the next scheduled run.
- **FR18:** System can distinguish valid zero-signal observations from source API failures without writing false zero normalised values.
- **FR19:** Operator can run ingest in dry-run mode to preview normalised events without pushing to Convex.
- **FR20:** System can load API keys and Convex credentials from `~/.hermes/trend-ingest.env` only.

### Signal Storage & Convex Integration

- **FR21:** System can push signal batches to Convex via HTTP API using the deploy key.
- **FR22:** System can write signal data through **`ingestSignalBatch`** without modifying `ingestDashboardSnapshot`.
- **FR23:** System can insert `signalEvents` idempotently using the `dedupeKey` unique index.
- **FR24:** System can merge-update `trendTopics` by `topicSlug` without overwriting unrelated source entries in `sourceBreakdown`.
- **FR25:** System can upsert `signalSources` health rows per source on each ingest run.
- **FR26:** System can mark individual sources in `sourceBreakdown` as stale when their data exceeds the freshness window for that source.
- **FR27:** System can retain historical `signalEvents` per the documented retention policy for Epic 45 downstream use.

### Trend Visibility (Dashboard)

- **FR28:** Operator can view top watchlist topics ranked by aggregate momentum on the Trend Intelligence panel.
- **FR29:** Operator can view per-topic momentum score and contributing source badges (`google_trends`, `reddit`, `news`).
- **FR30:** Operator can view which sources contributed to each topic via `sourceBreakdown` (or equivalent panel representation).
- **FR31:** Operator can distinguish topics with no ingest data, flat signal, and active momentum from panel presentation.
- **FR32:** Operator can see stale or errored source status for a topic when a source failed or is outside its freshness window.
- **FR33:** Dashboard can receive updated trend data via Convex subscription without manual page refresh.
- **FR34:** Operator can see actionable empty-state guidance when watchlist or ingest is not yet configured.
- **FR35:** System can remove Epic 42 placeholder/mock trend metrics and the "Coming in Epic 44" badge when live data exists.

### Source Health & Operations

- **FR36:** Operator can view per-source ingest health (`ok`, `partial`, `error`), last run time, and error count from the dashboard or documented operator surfaces.
- **FR37:** Operator can view the most recent error message for a failed source when available.
- **FR38:** System can log ingest outcomes to a documented log path for operator troubleshooting.
- **FR39:** Operator can install scheduled cron jobs for news/reddit (15m) and trends (60m) from documented install instructions.
- **FR40:** System can complete ingest with partial success when at least one source or keyword succeeds and Convex push succeeds.

### System Safety & Boundaries

- **FR41:** Dashboard performs no direct calls to Google Trends, Reddit, or News APIs from the browser.
- **FR42:** Dashboard performs no vault writes during trend panel interactions.
- **FR43:** Ingest process performs no vault filesystem mutations.
- **FR44:** Ingest process excludes credentials and secret-pattern content from data pushed to Convex.
- **FR45:** CNS repository production code changes are limited to addition of `scripts/trend-ingest.py` (story artifacts excluded).
- **FR46:** System leaves Epic 42 `ingestDashboardSnapshot`, `dashboard-sync.ts`, vault-io MCP, and CNS `src/` unchanged.

## Non-Functional Requirements

### Performance

- **NFR-P1:** Trend panel populates top 10 `trendTopics` within **2 seconds** of Convex subscription hydrate (desktop, warm cache).
- **NFR-P2:** `getTrendTopics` query returns only materialised aggregates — no full-table scan of `signalEvents` in the browser path.
- **NFR-P3:** Single-source ingest run (one cron tick, all watchlist keywords for that source) completes within **120 seconds** on operator WSL environment.
- **NFR-P4:** Operator can identify top 3 moving topics within **15 seconds** of opening the dashboard (time-to-prioritisation).

### Security

- **NFR-S1:** NewsAPI, Reddit, and Convex deploy credentials exist only in `~/.hermes/trend-ingest.env` (mode **600**) — never in git, Vercel, or frontend bundle.
- **NFR-S2:** No API keys, tokens, or credential-pattern matches are stored in Convex by the ingest process.
- **NFR-S3:** Ingest reads vault-adjacent paths only as configured in watchlist/env — **zero** vault filesystem writes.
- **NFR-S4:** Dashboard production URL remains Vercel password-protected (inherits Epic 42) — no application-level auth code added.
- **NFR-S5:** Convex stores signal metrics and topic metadata only — no note bodies, AGENTS.md content, or operator PII.

### Reliability

- **NFR-R1:** Scheduled ingest completes successfully on **≥ 95%** of cron firings per source over a 7-day window (excluding operator-configured downtime).
- **NFR-R2:** Ingest failures produce stderr/log entries without crashing the cron scheduler.
- **NFR-R3:** Partial source failure leaves other sources and keywords updating — no single-point total outage except Convex unreachable.
- **NFR-R4:** `bash scripts/verify.sh` passes in Omnipotent.md with only `scripts/trend-ingest.py` added to production code paths.
- **NFR-R5:** `trendTopics.last_updated` is within **2×** the source cron window when that source is healthy (30 min news/reddit, 2 h trends).
- **NFR-R6:** pytrends 429/403 on keyword N aborts remaining trends keywords for that run only — prior keywords' data remains valid.

### Accessibility

- **NFR-A1:** Trend panel inherits Epic 42 dark-theme **WCAG AA** contrast for body text.
- **NFR-A2:** Momentum values and source badges use text labels — not color alone (NFR-A3 partial from Epic 42).
- **NFR-A3:** Empty and error states are screen-reader perceivable via text status, not icon-only affordances.

### Integration

- **NFR-I1:** Ingest pushes to Convex production deployment `amiable-ox-862` via HTTP mutation API + deploy key.
- **NFR-I2:** `ingestDashboardSnapshot` (3-min dashboard sync) and `ingestSignalBatch` (15m/60m trend ingest) operate on **orthogonal tables** with no cross-mutation.
- **NFR-I3:** Watchlist authority is `~/.hermes/trend-watchlist.yaml` — Convex `watchlist` table is a mirror, not the edit surface.
- **NFR-I4:** Third-party APIs: Reddit (PRAW), News (NewsAPI), Google Trends (pytrends) — each isolated behind a collector module with documented rate limits.

## Requirement Traceability

| Journey | Success criteria | Functional requirements |
|---------|------------------|-------------------------|
| Morning prioritisation | Time-to-prioritisation, zero context-switch | FR28–FR31, FR33; NFR-P4 |
| Skip run-chain (flat topic) | Pre-commitment signal, trust | FR31–FR32, FR18; NFR-R3 |
| Watchlist + cron setup | Pipeline reliability, watchlist utility | FR1–FR6, FR39–FR40, FR19–FR20 |
| NewsAPI failure recovery | Source health, partial degradation | FR16–FR17, FR36–FR38; NFR-R3, NFR-R6 |
| Read-only safety (all) | CNS isolation, trust boundary | FR41–FR46; NFR-S1–S5 |
| Epic 45 foundation | Retention, contract stability | FR12–FR14, FR27; Signal Ingest Data Contract |
