---
story_id: 72-6
epic: 72
title: polymarket-gamma-api-adapter
status: done
baseline_commit: aebe05771748033597628417769bb7c6f822b6c6
operator_brief: 2026-06-20
predecessors: 72-1, 72-2, 72-5, 68-1, 68-4, 70-1
blocks: none
repo: cross-repo (Omnipotent.md adapters + cns-dashboard schema)
fr_ids: FR-1, FR-2, FR-3, FR-4, FR-5
priority: P1
---

# Story 72.6: Polymarket Gamma API Adapter (Source 17)

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a **CNS operator receiving the morning digest**,
I want **a Polymarket Gamma API adapter (fully public, no auth) wired as Source 17**,
so that **prediction-market sentiment — real-money implied probabilities on elections, AI milestones, crypto, and macro events — enters the digest as a genuinely distinct signal type from social engagement metrics, with full registry/orchestrator parity and Convex validators that cannot repeat the 72-5 viewCount / contributor-metadata drift failure**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 72 — Source Expansion (continues after YouTube 72-1/72-2, ScrapeCreators 72-3/72-5) |
| **Priority** | **P1** — adds unique “money on the line” sentiment; **no vendor key, no credit budget** — fully independent of 72-3/72-5 |
| **Repo** | **Cross-repo** — schema: `cns-dashboard/convex/validators.ts`; adapters + pipeline: Omnipotent.md |
| **Predecessors** | **72-5** (registry parity + canonical fixture pattern), **72-2** (parity test gate), **72-1** (query-watchlist adapter shape), **68-1** (dedup), **68-4** (schema literals), **70-1** (orchestrator) |
| **Vendor** | Polymarket **Gamma API** — `https://gamma-api.polymarket.com` — **no API key, no wallet, no OAuth** |
| **Out of scope** | CLOB trading/order placement; wallet/position endpoints; npm Polymarket SDK; `last30days` subprocess; vault writes; removing existing sources |

### Operator brief (binding — 2026-06-20)

| Requirement | Value |
|-------------|-------|
| Auth | **None** — public REST only |
| Base URL | `https://gamma-api.polymarket.com` |
| Core endpoints | `GET /events`, `GET /markets` (query params: `limit`, `closed=false`, `active=true`, optional `tag_slug`); `GET /public-search?q=` for keyword discovery |
| Market fields | `question`, `outcomes[]`, `outcomePrices[]` (1:1 JSON strings → parse to arrays), `volume` / `volumeNum`, `volume24hr`, `liquidity` / `liquidityNum`, `endDate`, `slug`, `conditionId`, `id` |
| Signal value | Implied probability from `outcomePrices` — aggregated trader belief, distinct from likes/views/upvotes |
| Engagement weight | **`volume24hr`** (fallback `volumeNum`) as primary engagement-equivalent; optional **price delta** over last N hours via CLOB `GET /prices-history` when env enables it — analogous to upvotes/likes elsewhere |
| Rate limits | Gamma general **4,000 req / 10s**; `/markets` **300 req / 10s**; `/public-search` **350 req / 10s** — add basic backoff/retry on 429/throttle (Cloudflare queues, does not hard-fail digest) |
| Pattern | Mirror **GitHub/YouTube query-watchlist** adapter shape (`fetch-*-signals.mjs` + `hermes-run-*.sh`) |
| Watchlist env | **`MORNING_DIGEST_POLYMARKET_KEYWORDS`** and/or **`MORNING_DIGEST_POLYMARKET_TAG_SLUGS`** — finalize shape in **T0 spike** after confirming Gamma filter params (see Dev Notes) |
| Registry | Source **17** — extend parity lists + `digestSourceTypeValue` / `digestSectionValue` / badges / orchestrator |
| Validator gate (critical) | **Before marking done:** every field emitted to `sourceMetadata` (`volume`, `liquidity`, `outcomes`, `outcomePrices`, `leadingOutcome`, `leadingProbability`, etc.) must exist on **`digestSignalInputValidator` → `sourceMetadataValidator`** and nested `contributingSources[]` if copied by dedupe. Build **`tests/fixtures/polymarket-digest-signal.fixture.mjs`** calling real **`buildDigestPushPayload()`** — same SSOT pattern as Pinterest (72-5 review patch). |

### Problem (current state)

| Gap | Today |
|-----|--------|
| No Polymarket adapter | Sources 1–16 wired; no `fetch-polymarket-signals.mjs` |
| Schema | `digestSourceTypeValue` / `digestSectionValue` lack `polymarket` |
| Metadata | No validator fields for prediction-market probability / liquidity / volume |
| Orchestrator | `COLLECT_ADAPTER_TASK_KEYS` ends at `pinterest` |
| Registry parity | 16 rows in `DIGEST_SOURCE_SECTION_MAP` / `DIGEST_SOURCE_HEALTH_REGISTRY` |
| Scoring/dedup | No `normalizeEngagement` or `SOURCE_PRIORITY` branch for `polymarket` |
| Collection order | Skill/task-prompt ends at Source 16 before Perplexity |

### Target pipeline touchpoints

```text
… → hermes-run-pinterest.sh (16)
  → hermes-run-polymarket.sh → fetch-polymarket-signals.mjs   ← NEW Source 17
  → hermes-run-perplexity.sh (Source 3)
  → pick-signal-notebook / §9 map / dedupe / score / push
```

**Collection order update:** `… → 15 → 16 → **17** → 3 → 6`

---

## Acceptance Criteria

### 1. Schema literals + prediction-market metadata (AC: FR-1)

**Given** cns-dashboard digest signal validators
**When** extended for Polymarket
**Then** `digestSourceTypeValue` adds `v.literal('polymarket')`
**And** `digestSectionValue` adds `v.literal('polymarket')`
**And** `sourceMetadataValidator` adds optional fields for every key the adapter pushes (minimum set):

| Field | Validator | Notes |
|-------|-----------|-------|
| `leadingOutcome` | `v.optional(v.string())` | Highest-probability outcome label |
| `leadingProbability` | `v.optional(v.number())` | 0–1 implied probability |
| `outcomes` | `v.optional(v.array(v.string()))` | Parsed from API JSON string |
| `outcomePrices` | `v.optional(v.array(v.number()))` | Parsed probabilities, same order as `outcomes` |
| `volumeUsd` | `v.optional(v.number())` | Total or 24h volume — document which in Completion Notes |
| `liquidityUsd` | `v.optional(v.number())` | From `liquidityNum` / `liquidity` |
| `publishedAt` | already exists | Market `endDate` or `updatedAt` |
| `upvotes` | already exists | **Optional mapping:** `volume24hr` for scoring reuse |

**And** nested `sourceMetadata.contributingSources[]` includes any engagement keys dedupe may copy (`upvotes`, `volumeUsd` if added to `ENGAGEMENT_FIELDS`, etc.)
**And** push payloads with `sourceType`/`section` `polymarket` pass **`digest:addDigestSignal`** (real mutation)
**And** unknown literals still rejected

**Apply in:** `cns-dashboard/convex/validators.ts` + `cns-dashboard/tests/convex/digest.test.ts`

**Validator wiring checklist (mandatory before done):**

1. Trace `digest:addDigestSignal` in `cns-dashboard/convex/digest.ts` → confirm `digestSignalInputValidator`.
2. Implement §9 mapping in `build-digest-push-payload.mjs` first.
3. List every key written to `signal.sourceMetadata` for Polymarket.
4. Confirm each key on `sourceMetadataValidator` (+ nested contributor schema if in `ENGAGEMENT_FIELDS`).
5. Add `tests/fixtures/polymarket-digest-signal.fixture.mjs` exporting `buildCanonicalPolymarketDigestSignal()` via **`buildDigestPushPayload()`**.
6. Import fixture in `digest.test.ts` → call `t.mutation('digest:addDigestSignal', …)` → assert stored document.
7. Extend `tests/morning-digest-build-payload.test.mjs` with Polymarket builder path (72-5 review lesson).

Reference: `_bmad-output/implementation-artifacts/spec-morning-digest-convex-contributor-engagement-validator.md`

### 2. Gamma API HTTP client contract (AC: FR-2)

**Given** `fetch-polymarket-signals.mjs`
**When** calling Polymarket Gamma API
**Then** base URL `https://gamma-api.polymarket.com`
**And** **no auth headers** — public endpoints only
**And** **no new npm dependencies** — Node built-in `fetch` only
**And** credentials via `mergeTrendIngestEnv()` + `resolveOperatorHome()` for env loading (no secrets to load)
**And** HTTP timeout **15s** per request; **100ms** delay between watchlist iterations
**And** retry with exponential backoff on **429** / **5xx** (max **3** attempts, cap total adapter runtime under wrapper timeout)
**And** process **always exits 0** — failures return `{"error":"<short reason>"}` stdout (≤120 chars)

**T0 spike (blocking design — document in Completion Notes):**

Confirm watchlist strategy and lock env var names:

| Strategy | Endpoint | Env var | When to use |
|----------|----------|---------|-------------|
| Keyword search | `GET /public-search?q={kw}&limit_per_type=5&events_status=active` | `MORNING_DIGEST_POLYMARKET_KEYWORDS` | Operator AI/tech/macro keyword focus (recommended primary) |
| Tag slug filter | `GET /markets?tag_slug={slug}&closed=false&active=true&limit=10` | `MORNING_DIGEST_POLYMARKET_TAG_SLUGS` | Category-style watchlist (e.g. `politics`, `crypto`) |
| Fallback browse | `GET /markets?closed=false&active=true&order=volume24hr&limit=20` | only when both lists empty | **Reject at config** — require at least one watchlist |

**Require at least one** of keywords or tag slugs when enabled (fail fast with `missing-watchlist`).

**Optional price delta (v1 if time permits, else defer with stderr note):**

- Env `MORNING_DIGEST_POLYMARKET_PRICE_DELTA_HOURS` (default `0` = off)
- When > 0: for top **5** markets by volume, call CLOB `GET https://clob.polymarket.com/prices-history?market={conditionId}&interval=1h&fidelity=60` (max **5** extra requests)
- Compute delta for leading outcome; store in stdout `priceDelta24h` → push as optional `sourceMetadata.normalizedValue` **only if** validator extended — otherwise embed in `summary` string only

### 3. Polymarket adapter stdout contract (AC: FR-2, FR-3)

**Given** `fetch-polymarket-signals.mjs`
**When** enabled and configured
**Then** stdout success shape:

```json
{
  "markets": [
    {
      "question": "Will Google have the best AI model at the end of June 2026?",
      "url": "https://polymarket.com/market/will-google-have-the-best-ai-model-at-the-end-of-june-2026",
      "marketId": "631139",
      "conditionId": "0x0bd1b836a2494f80aaee62927cf01e5f6fceb19114e96fc517c6440aea4576e4",
      "slug": "will-google-have-the-best-ai-model-at-the-end-of-june-2026",
      "outcomes": ["Yes", "No"],
      "outcomePrices": [0.42, 0.58],
      "leadingOutcome": "No",
      "leadingProbability": 0.58,
      "volumeUsd": 15988722.19,
      "volume24hrUsd": 300444.42,
      "liquidityUsd": 70032.71,
      "endDate": "2026-06-30T00:00:00.000Z",
      "updatedAt": "2026-06-20T03:53:39.319Z"
    }
  ]
}
```

**And** stdout key is **`markets[]` only** — distinct from `pins[]`, `videos[]`, `events[]` (Google Trends), `launches[]`, etc.

**Parsing rules:**

- API returns `outcomes` and `outcomePrices` as **JSON strings** — `JSON.parse` both; coerce prices to numbers
- `leadingOutcome` / `leadingProbability` = argmax of `outcomePrices`
- `volumeUsd` ← `volumeNum` ?? parseFloat(`volume`)
- `volume24hrUsd` ← `volume24hr` ?? `volume24hrClob`
- `liquidityUsd` ← `liquidityNum` ?? parseFloat(`liquidity`)
- `url` ← `https://polymarket.com/market/${slug}` (fallback `conditionId`-based if slug missing)
- Dedupe by `conditionId` or `marketId` across keyword/tag fetches
- Respect `MORNING_DIGEST_POLYMARKET_MAX_MARKETS` (default **15**, hard max **30**)
- Filter **`closed=true`** and **`active=false`** markets client-side even if API returns them

**Failure stdout examples:** `polymarket disabled`, `missing-watchlist`, `http-429`, `http-5xx`, `parse-error`

**Exports:** `runPolymarketFetch(env, options)` with injectable `fetch` + fixtures (mirror `runGithubFetch` / `runYoutubeFetch`)

| Variable | Purpose | Default |
|----------|---------|---------|
| `MORNING_DIGEST_POLYMARKET_KEYWORDS` | Comma-separated search terms | optional |
| `MORNING_DIGEST_POLYMARKET_TAG_SLUGS` | Comma-separated Gamma tag slugs | optional |
| `MORNING_DIGEST_POLYMARKET_ENABLED` | Falsy: `0`, `false`, `no`, `off` | enabled |
| `MORNING_DIGEST_POLYMARKET_MAX_MARKETS` | Global cap after dedupe | `15` |
| `MORNING_DIGEST_POLYMARKET_PER_KEYWORD` | Max markets per keyword search | `5` |
| `MORNING_DIGEST_POLYMARKET_PER_TAG` | Max markets per tag slug | `5` |
| `MORNING_DIGEST_POLYMARKET_MIN_VOLUME24HR` | Skip illiquid markets | `0` |
| `MORNING_DIGEST_POLYMARKET_PRICE_DELTA_HOURS` | CLOB history lookback; `0` disables | `0` |

### 4. Shell wrapper + Hermes contract (AC: FR-4)

**Given** `scripts/session-close/hermes-run-polymarket.sh`
**When** invoked from Hermes `terminal(...)` with `workdir=resolved_repo_root`
**Then** HOME isolation remap matches `hermes-run-youtube.sh` / `hermes-run-pinterest.sh`
**And** thin `exec node` on `fetch-polymarket-signals.mjs`
**And** stdout reads **`markets[]` only**
**And** wrapper timeout **45s** (same tier as Pinterest)

### 5. Source 17 in task-prompt.md + SKILL.md (AC: FR-4)

**Given** morning-digest task contract
**When** Source 17 is added
**Then** insert **after Source 16 (Pinterest), before Source 3 (Perplexity)**
**And** update strict collection order: `… → 16 → **17** → 3 → 6`
**And** REQUIRED SOURCES checklist adds row **17 | Polymarket**
**And** Steps 9–16 gate becomes **Steps 9–17 gate**
**And** Source 3 gate: Perplexity fires **after Source 17**

**Source 17 block includes:**

- `terminal(command="bash scripts/session-close/hermes-run-polymarket.sh", workdir=resolved_repo_root, timeout=45)`
- Imperative stdout: `pm_stdout` → `JSON.parse` → `pm_json.markets[]` only
- Failure: **Polymarket** header + `- (source unavailable: <short reason>)` → continue to Source 3
- Discord bullets: `- <question> — <leadingOutcome> <leadingProbability>% · $<volume24hr> 24h vol` (human-readable; use `%` not raw 0–1)

**§9 mapping table** adds:

| Section | sourceType | Source data | title | summary | url | externalId |
|---------|------------|-------------|-------|---------|-----|------------|
| `polymarket` | `polymarket` | Source 17 `markets[]` | `question` | `<leadingOutcome> <pct>% · vol $<volume24hr> · liq $<liquidity>` (truncate 200) | `url` | `marketId` or `sha256(conditionId).slice(0,16)` |

**§9 sourceMetadata (Convex push — validator-bound fields only):**

| stdout field | digestSignal field | Notes |
|--------------|-------------------|-------|
| `outcomes` | `sourceMetadata.outcomes` | string array |
| `outcomePrices` | `sourceMetadata.outcomePrices` | number array |
| `leadingOutcome` | `sourceMetadata.leadingOutcome` | |
| `leadingProbability` | `sourceMetadata.leadingProbability` | 0–1 |
| `volumeUsd` | `sourceMetadata.volumeUsd` | total volume |
| `volume24hrUsd` | `sourceMetadata.upvotes` | **scoring analog** — 24h trading volume |
| `liquidityUsd` | `sourceMetadata.liquidityUsd` | |
| `endDate` / `updatedAt` | `sourceMetadata.publishedAt` | prefer `endDate` for urgency scoring |

**Do not push** raw API blobs, `conditionId`, or `slug` as metadata keys unless added to validator first (`externalId` / url carry identity).

**digest_sources assembly** adds `"polymarket": [...]` with `volume24hrUsd` + `leadingProbability` for ranking in `buildDigestSignals`

**Strict-schema unions** extend `section` and `sourceType` with `polymarket`

### 6. Orchestrator + registry parity (AC: FR-4, FR-5)

**Given** `collectAdapterOutputs()` in `scripts/run-digest-convex-completion.mjs`
**When** deterministic digest runs
**Then** add task after `pinterest`:

```javascript
['polymarket', () => runWrapper('hermes-run-polymarket.sh', mergedEnv, 45_000)],
```

**And** extend `COLLECT_ADAPTER_TASK_KEYS` + `COLLECT_ADAPTER_WRAPPER_BY_KEY` in same commit

**Registry parity (72-2 guard — update ALL in one commit):**

| Location | Add |
|----------|-----|
| `DIGEST_SOURCE_SECTION_MAP` | `polymarket` row + label patterns |
| `SECTION_LITERAL_TO_SOURCE_KEY` | `polymarket` |
| `cns-dashboard/convex/lib/digest_source_registry.ts` | 17th health row |
| `cns-dashboard/convex/validators.ts` | literals + metadata fields |
| `cns-dashboard/src/lib/utils/nexus-digest-feed.ts` | badge `PM` |
| `ADAPTER_PAYLOAD_ARRAY_KEYS` | add `markets` (if not already present for this source path) |
| `tests/digest-source-registry-parity.test.mjs` | must pass without weakening assertions |

**Note:** `ADAPTER_PAYLOAD_ARRAY_KEYS` already includes `events` and `launches` for other sources — Polymarket uses **`markets`** key; ensure parity test expects **17** collect keys and **17** health rows.

**Verify:** `bash scripts/verify.sh` fails if any list drifts.

### 7. Scoring + dedup branches (AC: FR-5)

**Given** `score-digest-signals.mjs`
**When** `normalizeEngagement` for `polymarket`
**Then** primary signal = **`sourceMetadata.upvotes`** mapped from `volume24hrUsd`:
- **1.0** × `logNorm(upvotes, RD_UPVOTES_CAP)` when volume24hr > 0
- When volume24hr missing/zero → fall back to `volumeUsd` with same logNorm
- When both missing/zero → `null` (Path B momentum)
**And** optional boost: if `leadingProbability` present and `priceDelta24h` in metadata (future), add **0.15** weight — skip if not implemented
**And** `SOURCE_PRIOR.polymarket = 9` (high-signal macro/forecast tier — between twitter 9 and producthunt 8)
**And** `TREND_PROXY_PRIOR.polymarket = 45` (distinct forecast signal)
**And** extend `DigestSourceType` typedef

**Given** `dedupe-digest-signals.mjs`
**When** merge priority resolves clusters
**Then** add `polymarket: 4` to `SOURCE_PRIORITY` (headline overlap with news/rss — slightly below reddit:3, above default 0)
**And** if `volumeUsd` added to metadata for provenance, consider adding to `ENGAGEMENT_FIELDS` **only if** validator nested contributor schema updated

**Do not** modify merge algorithm core, rankScore weights, or disposition thresholds.

### 8. buildDigestSignals integration (AC: FR-4)

**Given** `pick-signal-notebook.mjs`
**When** `digest_sources.polymarket` present
**Then** export `extractPolymarketSignals()` — top **2** questions by `volume24hrUsd` desc (fallback `volumeUsd`)
**And** insert after Pinterest, before title dedupe cap-10
**And** extend `signalsFromParsedInput()` guard keys

### 9. Tests + verify gate (AC: FR-5)

**Given** implementation complete
**When** `bash scripts/verify.sh` runs
**Then** all tests pass including:

- `tests/fixtures/polymarket-digest-signal.fixture.mjs` — **NEW** — `buildCanonicalPolymarketDigestSignal()` via production `buildDigestPushPayload()`
- `cns-dashboard/tests/convex/digest.test.ts` — imports fixture; **`addDigestSignal accepts polymarket signal with full prediction-market metadata`**
- `tests/morning-digest-build-payload.test.mjs` — Polymarket builder + metadata key guard (mirror Pinterest)
- `cns-dashboard/tests/lib/nexus-digest-feed.test.ts` — `formatDigestSourceBadge('polymarket')` → `'PM'`
- `cns-dashboard/tests/convex/digest-source-health.test.ts` — **17** registry rows
- `tests/morning-digest-polymarket-adapter.test.mjs` (new) — config, JSON string parse for outcomes/prices, leading outcome, dedupe, disabled/missing-watchlist, 429 retry, `buildCanonicalPolymarketDigestSignal` shape
- `tests/morning-digest-score-signals.test.mjs` (extend) — polymarket `normalizeEngagement` from volume24hr → upvotes
- `tests/morning-digest-push-convex.test.mjs` (extend) — sourceType passthrough
- `tests/hermes-morning-digest-skill.test.mjs` (extend) — Source 17 block, `markets[]` threading, §9 rows, collection order
- `tests/morning-digest-pick-signal-notebook.test.mjs` (extend) — extract helper
- `tests/digest-source-registry-parity.test.mjs` — green (structural)
- `tests/run-digest-convex-completion.test.mjs` (extend) — polymarket success/error outcome counts
- `tests/digest-run-outcome.test.mjs` (extend) — polymarket success/error outcome counts

**And** `bash scripts/install-hermes-skill-morning-digest.sh` after script/wrapper changes
**And** **no live Polymarket calls in CI** — mock `fetch` with fixtures from captured Gamma responses

**Mandatory pre-done validator audit (repeat from AC 1):**

```bash
# In cns-dashboard — must pass before claiming done
npm test -- tests/convex/digest.test.ts
# In Omnipotent.md
bash scripts/verify.sh
```

### 10. Anti-drift boundaries (AC: scope)

**Given** this story's scope
**When** implementation completes
**Then** there is **no** trading/auth/wallet integration
**And** **no** API key env var
**And** **no** ScrapeCreators dependency
**And** **no** `last30days` import/subprocess
**And** Pinterest/TikTok/YouTube adapters unchanged except shared constants if needed

---

## Tasks / Subtasks

- [x] **T0** Spike Gamma watchlist params — lock env var names; document in Completion Notes (AC: 2, 3)
- [x] **T1** `cns-dashboard/convex/validators.ts` — `polymarket` literals + prediction-market metadata fields + nested contributor alignment (AC: 1)
- [x] **T2** `tests/fixtures/polymarket-digest-signal.fixture.mjs` + `digest.test.ts` + `morning-digest-build-payload.test.mjs` — **full mutation fixture via production builder** (AC: 1, 9)
- [x] **T3** `fetch-polymarket-signals.mjs` + `hermes-run-polymarket.sh` (AC: 2, 3, 4)
- [x] **T4** Registry parity sweep — SECTION_MAP, HEALTH_REGISTRY, SECTION_LITERAL_TO_SOURCE_KEY, badges, `markets` in `ADAPTER_PAYLOAD_ARRAY_KEYS` (AC: 6)
- [x] **T5** `run-digest-convex-completion.mjs` — collect task + JSDoc (AC: 6)
- [x] **T6** `score-digest-signals.mjs` + `dedupe-digest-signals.mjs` (AC: 7)
- [x] **T7** `pick-signal-notebook.mjs` + `build-digest-push-payload.mjs` — extract helper + §9 mapping (AC: 8)
- [x] **T8** `task-prompt.md` + `SKILL.md` — Source 17, gates, §9, collection order (AC: 5)
- [x] **T9** Omnipotent.md + dashboard tests (AC: 9)
- [x] **T10** **Validator audit** — trace every emitted metadata field to `digestSignalInputValidator`; document in Completion Notes (AC: 1, 9)
- [x] **T11** Verify + Hermes sync (AC: 9)
  - [x] `bash scripts/verify.sh` green
  - [x] `bash scripts/install-hermes-skill-morning-digest.sh`

### Review Findings

- [x] [Review][Patch] Dual-path stdout shape not proven in tests — add `parseMarketsListResponse` / tag-only `runPolymarketFetch` and assert keyword vs tag paths produce identical field sets via shared `mapMarketItem` (before `buildDigestPushPayload`) [`tests/morning-digest-polymarket-adapter.test.mjs`]
- [x] [Review][Patch] Cross-path dedupe untested — same `conditionId` from keyword search + tag fetch should yield one row [`tests/morning-digest-polymarket-adapter.test.mjs`]
- [x] [Review][Patch] §9 `externalId` fallback omits `conditionId` hash per AC 5 — uses `shortSha256(url)` when `marketId` absent [`build-digest-push-payload.mjs:482`]
- [x] [Review][Patch] Total fetch failure stdout is generic `polymarket fetch failed` — story AC lists `http-429` / `http-5xx` / `parse-error` for downstream outcome parsers [`fetch-polymarket-signals.mjs:477-478`]
- [x] [Review][Patch] `run-digest-convex-completion.test.mjs` missing polymarket success/error outcome counts (AC 9 explicit; `digest-run-outcome.test.mjs` has them) [`tests/run-digest-convex-completion.test.mjs`]
- [x] [Review][Patch] `minVolume24hr` filter untested — missing `volume24hrUsd` coerced to 0 and excluded when threshold > 0 [`fetch-polymarket-signals.mjs:243-246`]
- [x] [Review][Patch] Secondary test gaps — 5xx retry path, polymarket `normalizeEngagement` null when both volumes zero, `extractPolymarketSignals` `volumeUsd` fallback ranking [`tests/morning-digest-polymarket-adapter.test.mjs`, `tests/morning-digest-score-signals.test.mjs`, `tests/morning-digest-pick-signal-notebook.test.mjs`]
- [x] [Review][Defer] Adapter `maxMarkets` cap uses first-seen order not volume rank — `extractPolymarketSignals` sorts later; not required in adapter AC [`fetch-polymarket-signals.mjs:234-255`] — deferred, pre-existing design pattern
- [x] [Review][Defer] Partial watchlist HTTP failure + empty success on another item yields `{ markets: [] }` without stdout degradation hint — stderr-only logging matches soft-fail digest pattern [`fetch-polymarket-signals.mjs:445-464`] — deferred, intentional resilience

---

## Dev Notes

### Cross-repo workflow (critical)

1. Schema + registry in `../cns-dashboard/`
2. Adapters + tests in Omnipotent.md
3. Verify: `bash scripts/verify.sh` from Omnipotent.md (`CNS_DASHBOARD_ROOT` to override)

### Canonical adapter pattern (mirror — do not reinvent)

| Concern | Copy from |
|---------|-----------|
| Query-watchlist loop | `fetch-github-signals.mjs`, `fetch-youtube-signals.mjs` |
| Public HTTP + backoff | `fetch-arxiv-rss.mjs`, `fetch-github-signals.mjs` — 15s timeout, exit-0 errors |
| Env merge / operator home | `fetch-arxiv-rss.mjs` — `mergeTrendIngestEnv`, `resolveOperatorHome` |
| Shell wrapper | `hermes-run-pinterest.sh` |
| §9 + mutation fixture SSOT | `tests/fixtures/pinterest-digest-signal.fixture.mjs` + `build-digest-push-payload.mjs` |
| Registry parity | `72-5` — extend all lists in **one commit** |
| Source N task-prompt | Insert 17 after 16 block in `72-5` story |

### Polymarket Gamma API reference (verified 2026-06-20)

**Base:** `https://gamma-api.polymarket.com` — no authentication

**List active markets:**

```http
GET /markets?limit=10&closed=false&active=true
```

**Tag-filtered markets:**

```http
GET /markets?tag_slug=politics&closed=false&active=true&limit=10
```

**Keyword search (returns events + nested markets):**

```http
GET /public-search?q=AI&limit_per_type=5&events_status=active
```

**Outcomes/prices (API shape — strings, not arrays):**

```json
{
  "outcomes": "[\"Yes\", \"No\"]",
  "outcomePrices": "[\"0.42\", \"0.58\"]"
}
```

**Rate limits (Gamma):** general 4,000 req/10s; `/markets` 300 req/10s; `/public-search` 350 req/10s. Throttling queues requests — implement backoff, do not abort digest.

**Docs:** https://docs.polymarket.com/developers/gamma-markets-api/overview , https://docs.polymarket.com/api-reference/rate-limits.md

**Optional CLOB price history (only when `MORNING_DIGEST_POLYMARKET_PRICE_DELTA_HOURS` > 0):**

```http
GET https://clob.polymarket.com/prices-history?market={conditionId}&interval=1h&fidelity=60
```

Limit: **5** markets max per run to stay within CLOB 1,000 req/10s.

### Dedup implementation sketch

```javascript
function marketDedupeKey(row) {
  const conditionId = String(row.conditionId ?? '').trim();
  if (conditionId) return `pm:${conditionId}`;
  const marketId = String(row.marketId ?? row.id ?? '').trim();
  if (marketId) return `pm:id:${marketId}`;
  const url = normalizeUrl(row.url);
  if (url) return `pm:url:${url}`;
  return null;
}
```

### Validator wiring lesson (2026-06-20 — mandatory)

Production failure class: adapter emits fields validators do not declare → **`digest:addDigestSignal` rejects entire push**. Fix is validator alignment + regression test calling the **real mutation**, not a hand-rolled test double.

**For Polymarket, before done:**

1. Build `tests/fixtures/polymarket-digest-signal.fixture.mjs` using **`buildDigestPushPayload()`**.
2. Import into `digest.test.ts` and invoke mutation.
3. Any new metadata key (`liquidityUsd`, `outcomePrices`, …) → add to `sourceMetadataValidator` **and** nested `contributingSources[]` if dedupe copies it.
4. Map `volume24hrUsd` → `upvotes` for scoring reuse; still emit `volumeUsd` / `liquidityUsd` if pushed.

### WriteGate / security

- **No vault writes** — read-only HTTP adapters
- **No AGENTS.md edit** required (Operator Guide env docs optional — may land in 72-4)
- **No secrets** — no API keys
- **No new npm packages**

### Files to touch

| File | Action |
|------|--------|
| `../cns-dashboard/convex/validators.ts` | UPDATE |
| `../cns-dashboard/convex/lib/digest_source_registry.ts` | UPDATE — 1 row |
| `../cns-dashboard/src/lib/utils/nexus-digest-feed.ts` | UPDATE — badge `PM` |
| `../cns-dashboard/tests/convex/digest.test.ts` | UPDATE — polymarket mutation via fixture |
| `../cns-dashboard/tests/convex/digest-source-health.test.ts` | UPDATE — 17 rows |
| `../cns-dashboard/tests/lib/nexus-digest-feed.test.ts` | UPDATE |
| `../cns-dashboard/tests/lib/nexus-source-health.test.ts` | UPDATE |
| `tests/fixtures/polymarket-digest-signal.fixture.mjs` | NEW |
| `scripts/hermes-skill-examples/morning-digest/scripts/fetch-polymarket-signals.mjs` | NEW |
| `scripts/session-close/hermes-run-polymarket.sh` | NEW |
| `scripts/hermes-skill-examples/morning-digest/scripts/adapter-result.mjs` | UPDATE — confirm `markets` in payload keys |
| `scripts/hermes-skill-examples/morning-digest/scripts/parse-digest-source-outcomes.mjs` | UPDATE |
| `scripts/lib/digest-source-registry-parity.mjs` | UPDATE |
| `scripts/run-digest-convex-completion.mjs` | UPDATE |
| `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs` | UPDATE |
| `scripts/hermes-skill-examples/morning-digest/scripts/dedupe-digest-signals.mjs` | UPDATE |
| `scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs` | UPDATE |
| `scripts/hermes-skill-examples/morning-digest/scripts/build-digest-push-payload.mjs` | UPDATE |
| `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` | UPDATE |
| `scripts/hermes-skill-examples/morning-digest/SKILL.md` | UPDATE |
| `tests/morning-digest-polymarket-adapter.test.mjs` | NEW |
| `tests/morning-digest-build-payload.test.mjs` | UPDATE |
| `tests/morning-digest-score-signals.test.mjs` | UPDATE |
| `tests/morning-digest-push-convex.test.mjs` | UPDATE |
| `tests/hermes-morning-digest-skill.test.mjs` | UPDATE |
| `tests/morning-digest-pick-signal-notebook.test.mjs` | UPDATE |
| `tests/run-digest-convex-completion.test.mjs` | UPDATE |
| `tests/digest-run-outcome.test.mjs` | UPDATE |

**Do NOT edit:** ScrapeCreators adapters, dedupe merge core, rankScore weights, CLOB trading paths

### Example operator env (`~/.hermes/trend-ingest.env`)

```bash
# No API key required
MORNING_DIGEST_POLYMARKET_KEYWORDS=AI model,Claude,GPT-5,Bitcoin ETF,Fed rate cut
MORNING_DIGEST_POLYMARKET_TAG_SLUGS=crypto,politics
MORNING_DIGEST_POLYMARKET_MAX_MARKETS=15
MORNING_DIGEST_POLYMARKET_MIN_VOLUME24HR=1000
```

### Testing notes

- Fixture must use **string** `outcomes` / `outcomePrices` from API → assert parser coerces to arrays
- Duplicate `conditionId` across keyword + tag fetch — assert single output row
- Empty search → exit 0 with `markets: []` — **not** throw
- `buildCanonicalPolymarketDigestSignal()` → metadata keys ⊆ `sourceMetadataValidator`
- Parity test must fail if developer adds schema literal but forgets SECTION_MAP

---

## Previous Story Intelligence

| Story | Learning |
|-------|----------|
| **72-5** | Canonical fixture via `buildDigestPushPayload()` — **do not hand-roll** `digest.test.ts` payloads; map engagement to existing fields where possible (`upvotes`); registry parity in one commit |
| **72-3** | Distinct stdout array key per source — Polymarket uses `markets[]` |
| **72-2** | **Registry drift is the default failure mode** — patch ALL lists in one commit; parity test is structural gate |
| **72-1** | Query-watchlist adapter shape; public API with soft quota guard; cross-repo verify |
| **viewCount bug (2026-06-20)** | Test via **`digest:addDigestSignal`**, not validator file existence alone; nested `contributingSources[]` must match dedupe output |
| **67-5** | ProductHunt upvotes → `normalizeEngagement` pattern — mirror for `volume24hr` → `upvotes` |
| **70-1** | `collectAdapterOutputs` is cron SSOT — wire orchestrator in same commit as skill |

---

## Git Intelligence

Follow Epic 72 commits: Node `.mjs` adapters, thin bash wrappers, contract tests in `hermes-morning-digest-skill.test.mjs`, registry parity in same commit as schema literals. 72-5 pattern: adapter + orchestrator + parity + fixture SSOT + digest.test.ts in one logical change.

---

## Latest Tech Information

**Source:** Polymarket docs + live Gamma API probe (2026-06-20)

- Gamma API fully public at `https://gamma-api.polymarket.com` — no API key
- `outcomes` / `outcomePrices` returned as JSON **strings** — must parse client-side
- `volume24hr`, `volumeNum`, `liquidityNum` available on market objects for engagement weighting
- `/public-search?q=` returns nested events with markets — suitable for keyword watchlists
- `/markets?tag_slug=` filters by tag slug — suitable for category watchlists
- Rate limits enforced via Cloudflare throttling (429) — backoff/retry required, not hard-fail
- CLOB `prices-history` available for optional delta signal — separate host `clob.polymarket.com`

---

## Project Context Reference

- Constitution: `specs/cns-vault-contract/AGENTS.md` — no direct AI-Context edits
- Nexus principle: `project-context.md` — adapters in Node; no last30days subprocess
- Validator bugfix spec: `_bmad-output/implementation-artifacts/spec-morning-digest-convex-contributor-engagement-validator.md`
- Epic 72 handoff: `docs/HANDOFF-2026-06-20-post-epic72-3-session.md`
- Verify gate: `bash scripts/verify.sh` mandatory before done
- Mutation audit: N/A (read-only adapters)

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

- T0 live Gamma probe confirmed `public-search` returns `events[].markets[]`; stdout uses `markets[]` only (avoids Google Trends `events[]` collision).
- Operator guidance (2026-06-20): **keyword-only primary** — `MORNING_DIGEST_POLYMARKET_KEYWORDS` is the documented default path; `MORNING_DIGEST_POLYMARKET_TAG_SLUGS` remains optional secondary.

### Completion Notes List

- **T0 watchlist lock:** Primary = `MORNING_DIGEST_POLYMARKET_KEYWORDS` via `GET /public-search?q=`; secondary = `MORNING_DIGEST_POLYMARKET_TAG_SLUGS` via `GET /markets?tag_slug=`; at least one required (`missing-watchlist`); no fallback browse when both empty.
- **Adapter:** `fetch-polymarket-signals.mjs` — Node `fetch`, 15s timeout, 100ms watchlist delay, exponential backoff on 429/5xx (max 3), always exit 0; parses JSON-string `outcomes`/`outcomePrices`; maps `volume24hrUsd` for engagement.
- **volumeUsd semantics:** `sourceMetadata.volumeUsd` = total market volume (`volumeNum`); `sourceMetadata.upvotes` = 24h volume (`volume24hrUsd`) for scoring reuse.
- **Validator audit (T10):** Emitted keys: `outcomes`, `outcomePrices`, `leadingOutcome`, `leadingProbability`, `volumeUsd`, `upvotes`, `liquidityUsd`, `publishedAt` — all on `sourceMetadataValidator`; `conditionId`/`slug` excluded (identity via `externalId`/`url`).
- **Registry:** 17 rows across health registry, SECTION_MAP, validators, badges (`PM`), orchestrator collect task, `ADAPTER_PAYLOAD_ARRAY_KEYS` (`markets`).
- **Collection order:** `… → 16 → 17 → 3 → 6`; Steps 9–17 gate; Source 3 fires after Source 17.
- **Price delta:** `MORNING_DIGEST_POLYMARKET_PRICE_DELTA_HOURS` deferred (stderr note when > 0).
- **Verify:** `bash scripts/verify.sh` green; Hermes skill synced via `install-hermes-skill-morning-digest.sh`.

### File List

- `../cns-dashboard/convex/validators.ts`
- `../cns-dashboard/convex/lib/digest_source_registry.ts`
- `../cns-dashboard/src/lib/utils/nexus-digest-feed.ts`
- `../cns-dashboard/tests/convex/digest.test.ts`
- `../cns-dashboard/tests/convex/digest-source-health.test.ts`
- `../cns-dashboard/tests/lib/nexus-digest-feed.test.ts`
- `../cns-dashboard/tests/lib/nexus-source-health.test.ts`
- `tests/fixtures/polymarket-digest-signal.fixture.mjs`
- `scripts/hermes-skill-examples/morning-digest/scripts/fetch-polymarket-signals.mjs`
- `scripts/session-close/hermes-run-polymarket.sh`
- `scripts/hermes-skill-examples/morning-digest/scripts/adapter-result.mjs`
- `scripts/lib/digest-source-registry-parity.mjs`
- `scripts/run-digest-convex-completion.mjs`
- `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs`
- `scripts/hermes-skill-examples/morning-digest/scripts/dedupe-digest-signals.mjs`
- `scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs`
- `scripts/hermes-skill-examples/morning-digest/scripts/build-digest-push-payload.mjs`
- `scripts/hermes-skill-examples/morning-digest/scripts/parse-digest-source-outcomes.mjs`
- `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md`
- `scripts/hermes-skill-examples/morning-digest/SKILL.md`
- `tests/morning-digest-polymarket-adapter.test.mjs`
- `tests/morning-digest-build-payload.test.mjs`
- `tests/morning-digest-score-signals.test.mjs`
- `tests/morning-digest-push-convex.test.mjs`
- `tests/hermes-morning-digest-skill.test.mjs`
- `tests/morning-digest-pick-signal-notebook.test.mjs`
- `tests/run-digest-convex-completion.test.mjs`
- `tests/digest-run-outcome.test.mjs`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-06-20: Story 72-6 — Polymarket Gamma API adapter (Source 17), keyword-primary watchlist, full registry/orchestrator parity, validator-bound fixture SSOT.

---

## Story Completion Status

- Status: **done**
- Implementation complete; `bash scripts/verify.sh` green; Hermes skill synced.
- Code review patches applied (dual-path tests, externalId, error stdout, orchestrator tests).
- Keyword-primary watchlist documented; tag slugs optional secondary per operator guidance.
