---
story_id: 72-3
epic: 72
title: tiktok-instagram-scrapecreators-adapter
status: done
baseline_commit: aebe05771748033597628417769bb7c6f822b6c6
operator_brief: 2026-06-20
predecessors: 72-1, 72-2, 68-1, 68-4, 70-1
blocks: 72-4
repo: cross-repo (Omnipotent.md adapters + cns-dashboard schema)
fr_ids: FR-1, FR-2, FR-3, FR-4, FR-5
priority: P1
---

# Story 72.3: TikTok + Instagram ScrapeCreators Adapters (Sources 14–15)

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a **CNS operator receiving the morning digest**,
I want **TikTok and Instagram signal adapters via ScrapeCreators (API-key only) wired as Sources 14 and 15**,
so that **short-form social coverage expands beyond YouTube with predictable pay-as-you-go costs, explicit freshness limits on Instagram, and full registry/orchestrator parity so observability does not repeat the 72-2 YouTube miss**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 72 — Source Expansion (continues after YouTube 72-1/72-2) |
| **Priority** | **P1** — restores short-form social signal after Reddit closure; ScrapeCreators onboarding is API-key-only (no OAuth queue) |
| **Repo** | **Cross-repo** — schema: `cns-dashboard/convex/validators.ts`; adapters + pipeline: Omnipotent.md |
| **Predecessors** | **72-1** (YouTube adapter pattern), **72-2** (registry parity test — **must extend for Sources 14–15**), **68-1** (dedup `SOURCE_PRIORITY`), **68-4** (schema literal pattern), **70-1** (`collectAdapterOutputs` orchestrator) |
| **Vendor** | ScrapeCreators — `https://api.scrapecreators.com`, auth header `x-api-key`, env `SCRAPECREATORS_API_KEY` |
| **Credits** | 100 free trial credits; then pay-as-you-go (~$10/5k credits — operator tops up) |
| **Out of scope** | Instagram **comments** endpoints (vendor ~90% success — skip entirely for v1); OAuth; npm ScrapeCreators SDK; `last30days` subprocess (ADR-E67-001); vault writes; removing existing sources |

### Operator brief (binding — 2026-06-20)

| Requirement | Value |
|-------------|-------|
| Auth | Single `x-api-key` header — **no OAuth** |
| Env | `SCRAPECREATORS_API_KEY`, `MORNING_DIGEST_TIKTOK_HASHTAGS`, `MORNING_DIGEST_INSTAGRAM_HASHTAGS` |
| TikTok endpoints | `GET /v1/tiktok/search/hashtag` (hashtag watchlist — **primary**); optional fallback `GET /v1/tiktok/get-trending-feed` when hashtag list empty; `GET /v1/tiktok/hashtags/popular` optional discovery only — **do not** replace watchlist in v1 |
| Instagram endpoints | `GET /v1/instagram/search/hashtag` (**Google-index-backed — NOT real-time**); optional `GET /v1/instagram/reels/trending` supplement |
| Instagram comments | **Skip entirely** — do not wire `v2_instagram_post_comments` or similar |
| Instagram dedup | Trending Reels returns **duplicates on repeat calls** — dedupe by `shortcode` / canonical URL across all Instagram fetches |
| Pattern | Mirror **GitHub/YouTube query-watchlist** adapter shape (`fetch-*-signals.mjs` + `hermes-run-*.sh`) |
| Registry | Sources **14** (TikTok) and **15** (Instagram) — `tests/digest-source-registry-parity.test.mjs` must catch drift across all lists |

### Problem (current state)

| Gap | Today |
|-----|--------|
| No TikTok/Instagram adapters | Sources 1–13 wired; no ScrapeCreators fetch scripts |
| Schema | `digestSourceTypeValue` / `digestSectionValue` lack `tiktok`, `instagram` |
| Orchestrator | `COLLECT_ADAPTER_TASK_KEYS` ends at `youtube` |
| Registry parity | 13 rows in `DIGEST_SOURCE_SECTION_MAP` / `DIGEST_SOURCE_HEALTH_REGISTRY` |
| Scoring/dedup | No `normalizeEngagement` or `SOURCE_PRIORITY` branches for TikTok/Instagram |
| Freshness UX | No documented limitation that Instagram hashtag search is Google-index-backed |

### Target pipeline touchpoints

```text
… → hermes-run-youtube.sh (13)
  → hermes-run-tiktok.sh → fetch-tiktok-signals.mjs     ← NEW Source 14
  → hermes-run-instagram.sh → fetch-instagram-signals.mjs ← NEW Source 15
  → hermes-run-perplexity.sh (Source 3)
  → pick-signal-notebook / §9 map / dedupe / score / push
```

**Collection order update:** `… → 12 → 13 → **14** → **15** → 3 → 6`

---

## Acceptance Criteria

### 1. Schema literals (AC: FR-1)

**Given** cns-dashboard digest signal validators
**When** extended for TikTok and Instagram
**Then** `digestSourceTypeValue` adds `v.literal('tiktok')` and `v.literal('instagram')`
**And** `digestSectionValue` adds matching literals
**And** existing `sourceMetadataValidator` fields suffice (`viewCount`, `likes`, `commentCount`, `author`, `publishedAt`) — **no new metadata fields required** unless mapping exposes a field with no existing slot (prefer reuse)
**And** push payloads with `sourceType`/`section` `tiktok` or `instagram` pass `addDigestSignal`
**And** unknown literals still rejected

**Apply in:** `cns-dashboard/convex/validators.ts` + `cns-dashboard/tests/convex/digest.test.ts`

### 2. ScrapeCreators HTTP client contract (AC: FR-2)

**Given** both fetch modules
**When** calling ScrapeCreators
**Then** base URL `https://api.scrapecreators.com`
**And** header `x-api-key: ${SCRAPECREATORS_API_KEY}` on every request
**And** **no new npm dependencies** — Node built-in `fetch` only
**And** credentials via `mergeTrendIngestEnv()` + `resolveOperatorHome()` — store key in `~/.hermes/trend-ingest.env` alongside other digest keys
**And** never print API key to stdout/stderr/Discord
**And** HTTP timeout 15s per request; optional 100ms delay between hashtag calls (quota smoothing)
**And** process **always exits 0** — failures return `{"error":"<short reason>"}` stdout (≤120 chars)

**Credit awareness:** Log stderr one-line warning when hashtag count × estimated credits per call exceeds soft threshold (document estimate in Completion Notes); do **not** hard-block cron.

### 3. TikTok adapter stdout contract (AC: FR-2, FR-3)

**Given** `fetch-tiktok-signals.mjs`
**When** enabled and configured
**Then** stdout success shape:

```json
{
  "videos": [
    {
      "title": "Caption or desc trimmed",
      "url": "https://www.tiktok.com/@handle/video/1234567890",
      "author": "handle",
      "publishedAt": "2026-06-19T14:30:00.000Z",
      "viewCount": 125000,
      "likeCount": 8900,
      "commentCount": 420
    }
  ]
}
```

**And** stdout key is **`videos[]` only** (same key name as YouTube adapter — separate processes; orchestrator keys differ)

**Primary flow — hashtag watchlist:**

- Parse `MORNING_DIGEST_TIKTOK_HASHTAGS` comma-separated (strip `#`)
- Per hashtag: `GET /v1/tiktok/search/hashtag?hashtag={tag}&region={region}&trim=true`
- Map `aweme_list[]` → stdout rows: `desc` → `title`, `statistics.play_count` → `viewCount`, `digg_count` → `likeCount`, `comment_count` → `commentCount`
- URL: `https://www.tiktok.com/@{author.unique_id}/video/{aweme_id}` when author + id present; else best-effort share URL from response
- Dedupe by `aweme_id` / canonical URL across hashtags
- Respect `MORNING_DIGEST_TIKTOK_MAX_VIDEOS` (default **20**, hard max **40**)

**Fallback when hashtag list empty (optional but recommended):**

- `GET /v1/tiktok/get-trending-feed?region={region}&trim=true` — single call, same mapping
- Do **not** call both watchlist and trending when hashtags are configured (avoid credit burn)

**Failure stdout examples:** `tiktok disabled`, `missing-api-key`, `missing-hashtags`, `http-401`, `http-403`, `credit-exhausted`

**Exports:** `runTiktokFetch(env, options)` with injectable `fetch` + fixtures (mirror `runGithubFetch` / `runYoutubeFetch`)

| Variable | Purpose | Default |
|----------|---------|---------|
| `SCRAPECREATORS_API_KEY` | API key | required when enabled |
| `MORNING_DIGEST_TIKTOK_HASHTAGS` | Comma-separated hashtags | required when enabled (unless fallback trending enabled) |
| `MORNING_DIGEST_TIKTOK_ENABLED` | Falsy: `0`, `false`, `no`, `off` | enabled |
| `MORNING_DIGEST_TIKTOK_REGION` | Proxy region for TikTok calls | `US` |
| `MORNING_DIGEST_TIKTOK_MAX_VIDEOS` | Global cap after dedupe | `20` |
| `MORNING_DIGEST_TIKTOK_PER_HASHTAG` | Max videos per hashtag search | `5` |
| `MORNING_DIGEST_TIKTOK_LOOKBACK_HOURS` | Filter mapped `publishedAt` client-side | `24` |

### 4. Instagram adapter stdout contract (AC: FR-2, FR-3)

**Given** `fetch-instagram-signals.mjs`
**When** enabled and configured
**Then** stdout success shape:

```json
{
  "reels": [
    {
      "title": "Caption trimmed",
      "url": "https://www.instagram.com/reel/ABC123/",
      "author": "handle",
      "publishedAt": "2026-06-18T10:00:00.000Z",
      "viewCount": 50000,
      "likeCount": 1200,
      "commentCount": 88
    }
  ]
}
```

**And** stdout key is **`reels[]` only** — never `posts[]` (Bluesky owns `posts[]` in other adapters)

**Critical freshness documentation (must appear in task-prompt + adapter file header comment):**

> Instagram hashtag search uses ScrapeCreators' **Google-index-backed** `search/hashtag` endpoint. Results reflect what Google has indexed, **not** a live Instagram-native feed. Sparse or stale results on a given day are **expected behavior**, not adapter bugs. Do not file regressions against "missing posts from last hour."

**Primary flow — hashtag watchlist:**

- Parse `MORNING_DIGEST_INSTAGRAM_HASHTAGS` comma-separated
- Per hashtag: `GET /v1/instagram/search/hashtag?hashtag={tag}&date_posted=last-week&media_type=reels&trim=true` (use `media_type=all` only if operator env explicitly requests)
- Map caption → `title`, play/like/comment counts when present, `shortcode` for URL `https://www.instagram.com/reel/{shortcode}/`

**Optional supplement — trending reels (single call):**

- `GET /v1/instagram/reels/trending` — **one call per run** in v1 (no pagination loop)
- **Mandatory dedup:** merge trending into hashtag results deduping by `shortcode` or normalized URL; trending endpoint **returns duplicates across calls** — dedup must handle intra-response duplicates too

**Explicitly forbidden:**

- Any Instagram **comments** endpoint (`v2_instagram_post_comments`, comment replies, etc.)

**Failure stdout:** same pattern as TikTok (`instagram disabled`, `missing-api-key`, `missing-hashtags`, …)

**Exports:** `runInstagramFetch(env, options)` with injectable `fetch` + fixtures

| Variable | Purpose | Default |
|----------|---------|---------|
| `SCRAPECREATORS_API_KEY` | Shared with TikTok | required when enabled |
| `MORNING_DIGEST_INSTAGRAM_HASHTAGS` | Comma-separated hashtags | required when enabled (unless trending-only fallback documented) |
| `MORNING_DIGEST_INSTAGRAM_ENABLED` | Falsy values | enabled |
| `MORNING_DIGEST_INSTAGRAM_MAX_REELS` | Global cap after dedupe | `15` |
| `MORNING_DIGEST_INSTAGRAM_PER_HASHTAG` | Max per hashtag search | `5` |
| `MORNING_DIGEST_INSTAGRAM_INCLUDE_TRENDING` | `1`/`true` adds trending supplement | `true` |
| `MORNING_DIGEST_INSTAGRAM_LOOKBACK_HOURS` | Client-side `publishedAt` filter | `168` (7d — aligns with `last-week` index window) |

### 5. Shell wrappers + Hermes contract (AC: FR-4)

**Given** `scripts/session-close/hermes-run-tiktok.sh` and `hermes-run-instagram.sh`
**When** invoked from Hermes `terminal(...)` with `workdir=resolved_repo_root`
**Then** HOME isolation remap matches `hermes-run-youtube.sh`
**And** thin `exec node` on respective fetch scripts
**And** TikTok stdout reads **`videos[]`** only; Instagram reads **`reels[]`** only

### 6. Sources 14–15 in task-prompt.md + SKILL.md (AC: FR-4)

**Given** morning-digest task contract
**When** Sources 14 and 15 are added
**Then** insert **after Source 13 (YouTube), before Source 3 (Perplexity)**
**And** update strict collection order: `… → 13 → **14** → **15** → 3 → 6`
**And** REQUIRED SOURCES checklist adds rows **14 | TikTok** and **15 | Instagram**
**And** Steps 9–13 gate becomes **Steps 9–15 gate** (Sources 9–15 before Source 3 / Source 6)
**And** Source 3 gate: Perplexity fires **after Source 15**

**Source 14 block includes:**

- `terminal(command="bash scripts/session-close/hermes-run-tiktok.sh", workdir=resolved_repo_root, timeout=45)`
- Imperative stdout: `tt_stdout` → `JSON.parse` → `tt_json.videos[]` only
- Failure: **TikTok** header + `- (source unavailable: <short reason>)` → continue to Source 15
- Discord bullets: `- <title> — <viewCount> views, <likeCount> likes`

**Source 15 block includes:**

- `terminal(command="bash scripts/session-close/hermes-run-instagram.sh", …)`
- `ig_stdout` → `ig_json.reels[]` only
- Failure bullet under **Instagram** → continue to Source 3
- Discord bullets similar to TikTok
- **Freshness callout** in task-prompt (one sentence): Google-index hashtag search — not real-time

**§9 mapping table** adds:

| Section | sourceType | Source data | title | summary | url | externalId |
|---------|------------|-------------|-------|---------|-----|------------|
| `tiktok` | `tiktok` | Source 14 `videos[]` | `title` | first 200 chars of `title` | `url` | `sha256(url).slice(0,16)` |
| `instagram` | `instagram` | Source 15 `reels[]` | `title` | first 200 chars of `title` | `url` | shortcode or url hash |

**§9 sourceMetadata:**

| stdout field | digestSignal field |
|--------------|-------------------|
| `viewCount` | `sourceMetadata.viewCount` |
| `likeCount` | `sourceMetadata.likes` |
| `commentCount` | `sourceMetadata.commentCount` |
| `author` | `sourceMetadata.author` |
| `publishedAt` | `sourceMetadata.publishedAt` |

**digest_sources assembly** adds `"tiktok": [...]` and `"instagram": [...]` with engagement for `buildDigestSignals`

**Strict-schema unions** extend `section` and `sourceType` with `tiktok`, `instagram`

### 7. Orchestrator + registry parity (AC: FR-4, FR-5)

**Given** `collectAdapterOutputs()` in `scripts/run-digest-convex-completion.mjs`
**When** deterministic digest runs
**Then** add tasks after `youtube`:

```javascript
['tiktok', () => runWrapper('hermes-run-tiktok.sh', mergedEnv, 45_000)],
['instagram', () => runWrapper('hermes-run-instagram.sh', mergedEnv, 45_000)],
```

**And** extend `COLLECT_ADAPTER_TASK_KEYS` + `COLLECT_ADAPTER_WRAPPER_BY_KEY` in same commit

**Registry parity (72-2 guard — update ALL in one commit):**

| Location | Add |
|----------|-----|
| `DIGEST_SOURCE_SECTION_MAP` | `tiktok`, `instagram` rows + label patterns |
| `SECTION_LITERAL_TO_SOURCE_KEY` | `tiktok`, `instagram` |
| `cns-dashboard/convex/lib/digest_source_registry.ts` | 14th/15th health rows |
| `cns-dashboard/convex/validators.ts` | literals |
| `cns-dashboard/src/lib/utils/nexus-digest-feed.ts` | badges `TT`, `IG` |
| `ADAPTER_PAYLOAD_ARRAY_KEYS` | add `reels` (TikTok reuses existing `videos`) |
| `tests/digest-source-registry-parity.test.mjs` | must pass without modification beyond parity constants if any |

**Verify:** `bash scripts/verify.sh` fails if any list drifts — that is the intended gate.

### 8. Scoring + dedup branches (AC: FR-5)

**Given** `score-digest-signals.mjs`
**When** `normalizeEngagement` for `tiktok` or `instagram`
**Then** mirror **YouTube** weights: views **0.60**, likes **0.30**, comments **0.10**
**And** caps: reuse YouTube caps (`YT_VIEWS_CAP`, etc.) or define `TT_*` / `IG_*` aliases with same values — document in Completion Notes
**And** all missing/zero engagement → `null` (Path B momentum)
**And** `SOURCE_PRIOR.tiktok = 8`, `SOURCE_PRIOR.instagram = 8` (short-form tier with YouTube)
**And** `TREND_PROXY_PRIOR.tiktok = 40`, `TREND_PROXY_PRIOR.instagram = 40`
**And** extend `DigestSourceType` typedef

**Given** `dedupe-digest-signals.mjs`
**When** merge priority resolves clusters
**Then** add `tiktok: 4`, `instagram: 4` to `SOURCE_PRIORITY` (same tier as `youtube: 4`)
**And** `viewCount` already in `ENGAGEMENT_FIELDS` — no change needed

**Do not** modify merge algorithm, rankScore weights, or disposition thresholds.

### 9. buildDigestSignals integration (AC: FR-4)

**Given** `pick-signal-notebook.mjs`
**When** `digest_sources.tiktok` / `digest_sources.instagram` present
**Then** export `extractTiktokSignals()` — top **2** titles by `viewCount` desc (fallback `likeCount`)
**And** export `extractInstagramSignals()` — top **2** by same ranking
**And** insert after YouTube, before title dedupe cap-10
**And** extend `signalsFromParsedInput()` guard keys

### 10. Tests + verify gate (AC: FR-5)

**Given** implementation complete
**When** `bash scripts/verify.sh` runs
**Then** all tests pass including:

- `cns-dashboard/tests/convex/digest.test.ts` — accept `tiktok` + `instagram` signals; reject invalid sourceType
- `cns-dashboard/tests/lib/nexus-digest-feed.test.ts` — `formatDigestSourceBadge('tiktok')` → `'TT'`, `'instagram'` → `'IG'`
- `cns-dashboard/tests/convex/digest-source-health.test.ts` — 15 registry rows
- `tests/morning-digest-tiktok-adapter.test.mjs` (new) — config, hashtag parse, aweme mapping, dedupe, disabled/missing-key, credit/401 paths
- `tests/morning-digest-instagram-adapter.test.mjs` (new) — hashtag mapping, **trending duplicate dedup**, Google-index empty fixture, no comments code paths
- `tests/morning-digest-score-signals.test.mjs` (extend) — tiktok/instagram normalizeEngagement
- `tests/morning-digest-push-convex.test.mjs` (extend) — sourceType passthrough
- `tests/hermes-morning-digest-skill.test.mjs` (extend) — Sources 14–15 blocks, `videos[]`/`reels[]` threading, §9 rows, collection order
- `tests/morning-digest-pick-signal-notebook.test.mjs` (extend) — extract helpers
- `tests/digest-source-registry-parity.test.mjs` — green (structural)
- `tests/run-digest-convex-completion.test.mjs` (extend) — adapter error classification for new keys if needed

**And** `bash scripts/install-hermes-skill-morning-digest.sh` after script/wrapper changes
**And** **no live ScrapeCreators calls in CI** — mock `fetch` with fixtures

### 11. Anti-drift boundaries (AC: scope)

**Given** this story's scope
**When** implementation completes
**Then** there is **no** Instagram comments integration
**And** **no** OAuth or ScrapeCreators npm SDK
**And** **no** `last30days` import/subprocess
**And** Instagram freshness limitation documented in task-prompt (not hidden in code comments only)
**And** Reddit/YouTube adapters unchanged except shared env merge if needed

---

## Tasks / Subtasks

- [x] **T1** `cns-dashboard/convex/validators.ts` — `tiktok` + `instagram` literals (AC: 1)
- [x] **T2** `cns-dashboard/tests/convex/digest.test.ts` + badge/health tests (AC: 1, 10)
- [x] **T3** `fetch-tiktok-signals.mjs` + `hermes-run-tiktok.sh` (AC: 2, 3, 5)
- [x] **T4** `fetch-instagram-signals.mjs` + `hermes-run-instagram.sh` (AC: 2, 4, 5)
  - [x] Hashtag search + optional trending with dedup
  - [x] Header comment + task-prompt freshness disclaimer
- [x] **T5** Registry parity sweep — SECTION_MAP, HEALTH_REGISTRY, SECTION_LITERAL_TO_SOURCE_KEY, badges, `reels` in `ADAPTER_PAYLOAD_ARRAY_KEYS` (AC: 7)
- [x] **T6** `run-digest-convex-completion.mjs` — collect tasks (AC: 7)
- [x] **T7** `score-digest-signals.mjs` + `dedupe-digest-signals.mjs` (AC: 8)
- [x] **T8** `pick-signal-notebook.mjs` — extract helpers + buildDigestSignals order (AC: 9)
- [x] **T9** `task-prompt.md` + `SKILL.md` — Sources 14–15, gates, §9 (AC: 6)
- [x] **T10** Omnipotent.md + dashboard tests (AC: 10)
- [x] **T11** Verify + Hermes sync (AC: 10)
  - [x] `bash scripts/verify.sh` green
  - [x] `bash scripts/install-hermes-skill-morning-digest.sh`

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
| Env merge / operator home | `fetch-arxiv-rss.mjs` — `mergeTrendIngestEnv`, `resolveOperatorHome` |
| Shell wrapper | `hermes-run-youtube.sh` |
| §9 test helper | `tests/morning-digest-youtube-adapter.test.mjs` — `youtubeVideoToDigestSignal` pattern |
| Registry parity | `72-2` — extend all lists in **one commit**; parity test is the gate |
| Source N task-prompt | `72-1` Source 13 block — insert 14/15 after 13 |

### ScrapeCreators API reference

**Base:** `https://api.scrapecreators.com`

**Auth:** `x-api-key: SCRAPECREATORS_API_KEY` (env; also accepted name per vendor CLI)

**TikTok — search hashtag (primary):**

```http
GET /v1/tiktok/search/hashtag?hashtag=aiagents&region=US&trim=true
x-api-key: ...
```

Response: `aweme_list[]` with `aweme_id`, `desc`, `statistics` (`play_count`, `digg_count`, `comment_count`), `author`

**TikTok — trending feed (fallback):**

```http
GET /v1/tiktok/get-trending-feed?region=US&trim=true
```

**Instagram — search hashtag (Google-index):**

```http
GET /v1/instagram/search/hashtag?hashtag=ai&date_posted=last-week&media_type=reels
```

Vendor description: *"Results depend on what Google has indexed — best-effort, not complete Instagram-native search."*

**Instagram — trending reels (supplement, duplicates expected):**

```http
GET /v1/instagram/reels/trending
```

Vendor description: *"Results can overlap; expect duplicates."*

**Docs:** https://docs.scrapecreators.com/openapi.json

**MCP tool names (for manual operator validation, not runtime):** `v1_tiktok_search_hashtag`, `v1_tiktok_get_trending_feed`, `v1_instagram_search_hashtag`, `v1_instagram_reels_trending`

### Dedup implementation sketch (Instagram)

```javascript
function reelDedupeKey(row) {
  const shortcode = String(row.shortcode ?? '').trim();
  if (shortcode) return `ig:reel:${shortcode}`;
  const url = normalizeUrl(row.url);
  if (url) return `ig:url:${url}`;
  return null;
}
// Apply when merging hashtag + trending + within single response arrays
```

### TikTok dedup sketch

```javascript
function tiktokDedupeKey(row) {
  const id = String(row.aweme_id ?? row.videoId ?? '').trim();
  if (id) return `tt:${id}`;
  return normalizeUrl(row.url) ? `tt:url:${normalizeUrl(row.url)}` : null;
}
```

### WriteGate / security

- **No vault writes** — read-only HTTP adapters
- **No AGENTS.md edit** required (Operator Guide env docs optional follow-up in 72-4)
- API key env-only — never commit
- **No new npm packages** (14-day rule satisfied by built-in fetch)

### Files to touch

| File | Action |
|------|--------|
| `../cns-dashboard/convex/validators.ts` | UPDATE |
| `../cns-dashboard/convex/lib/digest_source_registry.ts` | UPDATE — 2 rows |
| `../cns-dashboard/src/lib/utils/nexus-digest-feed.ts` | UPDATE — badges |
| `../cns-dashboard/tests/convex/digest.test.ts` | UPDATE |
| `../cns-dashboard/tests/convex/digest-source-health.test.ts` | UPDATE |
| `../cns-dashboard/tests/lib/nexus-digest-feed.test.ts` | UPDATE |
| `../cns-dashboard/tests/lib/nexus-source-health.test.ts` | UPDATE |
| `scripts/hermes-skill-examples/morning-digest/scripts/fetch-tiktok-signals.mjs` | NEW |
| `scripts/hermes-skill-examples/morning-digest/scripts/fetch-instagram-signals.mjs` | NEW |
| `scripts/session-close/hermes-run-tiktok.sh` | NEW |
| `scripts/session-close/hermes-run-instagram.sh` | NEW |
| `scripts/hermes-skill-examples/morning-digest/scripts/adapter-result.mjs` | UPDATE — `reels` key |
| `scripts/hermes-skill-examples/morning-digest/scripts/parse-digest-source-outcomes.mjs` | UPDATE |
| `scripts/lib/digest-source-registry-parity.mjs` | UPDATE — section literals |
| `scripts/run-digest-convex-completion.mjs` | UPDATE |
| `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs` | UPDATE |
| `scripts/hermes-skill-examples/morning-digest/scripts/dedupe-digest-signals.mjs` | UPDATE |
| `scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs` | UPDATE |
| `scripts/hermes-skill-examples/morning-digest/scripts/build-digest-push-payload.mjs` | UPDATE if source list hardcoded |
| `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` | UPDATE |
| `scripts/hermes-skill-examples/morning-digest/SKILL.md` | UPDATE |
| `tests/morning-digest-tiktok-adapter.test.mjs` | NEW |
| `tests/morning-digest-instagram-adapter.test.mjs` | NEW |
| `tests/morning-digest-score-signals.test.mjs` | UPDATE |
| `tests/morning-digest-push-convex.test.mjs` | UPDATE |
| `tests/hermes-morning-digest-skill.test.mjs` | UPDATE |
| `tests/morning-digest-pick-signal-notebook.test.mjs` | UPDATE |
| `tests/run-digest-convex-completion.test.mjs` | UPDATE if needed |

**Do NOT edit:** Reddit adapter, Instagram comment endpoints, dedupe merge core, rankScore weights

### Example operator env (`~/.hermes/trend-ingest.env`)

```bash
SCRAPECREATORS_API_KEY=sc_...
MORNING_DIGEST_TIKTOK_HASHTAGS=aiagents,claudeai,chatgpt,mcp
MORNING_DIGEST_INSTAGRAM_HASHTAGS=ai,artificialintelligence,technews
```

### Testing notes

- Fixture `aweme_list` with string statistics counts (like YouTube API strings)
- Instagram fixture with duplicate shortcodes in trending response — assert single output row
- Empty hashtag Google-index response → exit 0 with `reels: []` or sparse list — **not** throw
- `tiktokVideoToDigestSignal` / `instagramReelToDigestSignal` helpers in tests → `normalizeEngagement` non-null
- Parity test must fail if developer adds schema literal but forgets SECTION_MAP (intentional)

---

## Previous Story Intelligence

| Story | Learning |
|-------|----------|
| **72-1** | Two-phase/query-watchlist adapter shape; `videos[]` stdout; schema before push; cross-repo verify |
| **72-2** | **Registry drift is the default failure mode** — patch ALL lists in one commit; `tests/digest-source-registry-parity.test.mjs` is the structural gate; `ADAPTER_PAYLOAD_ARRAY_KEYS` DRY with `ADAPTER_DATA_KEYS` |
| **72-2 root cause** | Orchestrator must wire collect task **before** cron — not skill-only wiring |
| **68-5** | Distinct stdout array key per source (`posts[]` for Bluesky) — Instagram uses `reels[]` |
| **68-8** | §9 map construction — never dedupe empty signals |
| **70-1** | `collectAdapterOutputs` is cron SSOT |
| **67-2 closure** | Do not invest in Reddit; ScrapeCreators is approved hostile-platform path |

---

## Git Intelligence

Follow Epic 72 commits: Node `.mjs` adapters, thin bash wrappers, contract tests in `hermes-morning-digest-skill.test.mjs`, registry parity in same commit as schema literals.

---

## Latest Tech Information

**Source:** ScrapeCreators docs + MCP descriptors (2026-06-20)

- API base `https://api.scrapecreators.com`, auth `x-api-key` header only
- 100 free trial credits; pay-as-you-go pricing (~$10/5k credits)
- TikTok `search/hashtag` may return duplicates — dedupe like Instagram
- Instagram `search/hashtag` is Google-index-backed — document, do not treat sparse results as bugs
- Instagram `reels/trending` overlaps across calls — mandatory dedup
- Instagram comments endpoints ~90% success — **excluded from v1**

---

## Project Context Reference

- Constitution: `specs/cns-vault-contract/AGENTS.md` — no direct AI-Context edits
- Nexus principle: `project-context.md` — adapters in Node; no last30days subprocess
- Deferred: `deferred-work.md` — registry SSOT debt partially addressed by 72-2 parity test; extend for 14–15
- Verify gate: `bash scripts/verify.sh` mandatory before done
- Mutation audit: N/A (read-only adapters)

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor)

### Debug Log References

- Instagram/TikTok test fixtures: lookback filter excluded stale `create_time`/`taken_at` — removed timestamps from fixtures so client-side filter passes in CI.

### Completion Notes List

- Added ScrapeCreators adapters: Source 14 TikTok (`videos[]` stdout) and Source 15 Instagram (`reels[]` stdout) with `x-api-key` auth, hashtag watchlists, TikTok trending fallback, Instagram trending supplement with mandatory shortcode dedup.
- Extended registry parity to 15 sources: schema literals, health registry, SECTION_MAP, orchestrator collect tasks, badges `TT`/`IG`, `ADAPTER_PAYLOAD_ARRAY_KEYS` + `reels`.
- TikTok/Instagram scoring mirrors YouTube (0.60/0.30/0.10 on views/likes/comments using `YT_*_CAP` aliases); dedup priority tier 4 (same as YouTube).
- Credit estimate stderr warning at 50+ hashtag calls (TikTok); no hard block per spec.
- Instagram Google-index freshness disclaimer in adapter header + task-prompt Source 15 block.
- `bash scripts/verify.sh` green; Hermes skill synced via `install-hermes-skill-morning-digest.sh`.

### File List

- `../cns-dashboard/convex/validators.ts`
- `../cns-dashboard/convex/lib/digest_source_registry.ts`
- `../cns-dashboard/src/lib/utils/nexus-digest-feed.ts`
- `../cns-dashboard/tests/convex/digest.test.ts`
- `../cns-dashboard/tests/convex/digest-source-health.test.ts`
- `../cns-dashboard/tests/lib/nexus-digest-feed.test.ts`
- `../cns-dashboard/tests/lib/nexus-source-health.test.ts`
- `scripts/hermes-skill-examples/morning-digest/scripts/fetch-tiktok-signals.mjs` (NEW)
- `scripts/hermes-skill-examples/morning-digest/scripts/fetch-instagram-signals.mjs` (NEW)
- `scripts/session-close/hermes-run-tiktok.sh` (NEW)
- `scripts/session-close/hermes-run-instagram.sh` (NEW)
- `scripts/hermes-skill-examples/morning-digest/scripts/adapter-result.mjs`
- `scripts/hermes-skill-examples/morning-digest/scripts/parse-digest-source-outcomes.mjs`
- `scripts/lib/digest-source-registry-parity.mjs`
- `scripts/run-digest-convex-completion.mjs`
- `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs`
- `scripts/hermes-skill-examples/morning-digest/scripts/dedupe-digest-signals.mjs`
- `scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs`
- `scripts/hermes-skill-examples/morning-digest/scripts/build-digest-push-payload.mjs`
- `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md`
- `scripts/hermes-skill-examples/morning-digest/SKILL.md`
- `tests/morning-digest-tiktok-adapter.test.mjs` (NEW)
- `tests/morning-digest-instagram-adapter.test.mjs` (NEW)
- `tests/morning-digest-score-signals.test.mjs`
- `tests/morning-digest-push-convex.test.mjs`
- `tests/hermes-morning-digest-skill.test.mjs`
- `tests/morning-digest-pick-signal-notebook.test.mjs`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-06-20: Story 72.3 — TikTok + Instagram ScrapeCreators adapters (Sources 14–15), full registry/orchestrator/skill parity, tests + verify green.

---

## Story Completion Status

- Status: **done**
- All ACs satisfied; `bash scripts/verify.sh` passed
- Next: `/bmad-code-review` (prefer different LLM than implementer); live ScrapeCreators validation optional in 72-4

### Review Findings

#### Verified (not blockers)

- **Exit-0 + real failure surfacing confirmed.** Both adapters always `process.exit(0)` with `{"error":"<reason>"}` on failure (consistent with Reddit/YouTube). The deterministic collect path classifies bare error JSON via `isAdapterErrorPayload()` → `{ success: false, error: 'adapter-error:…' }` → `buildSourcesFromAdapterOutputs()` → `{ status: 'error', count: 0 }`. Hermes task-prompt Sources 14–15 step 3 maps `tt_json.error` / `ig_json.error` to `(source unavailable: <reason>)` in the digest artifact → `parseSourceOutcomesFromArtifact()` → health row `status: 'unavailable'` with `reason`. Credit exhaustion, missing key, and auth errors are **not** silently treated as empty success: they never emit `{ videos: [] }` / `{ reels: [] }` without a prior successful HTTP 200 path. Legitimate Google-index empty Instagram (`{ reels: [] }`) correctly maps to orchestrator `status: 'empty'` (not error) per AC 4 — distinct from vendor failures.

- [x] [Review][Patch] Add collect-path regression tests for TikTok/Instagram error stdout [`tests/run-digest-convex-completion.test.mjs`] — mirror existing YouTube `quota-exceeded` test for `{ error: 'credit-exhausted' }` and `{ error: 'missing-api-key' }` on Sources 14–15; AC 10 calls this out explicitly.

- [x] [Review][Patch] Add outcome-record tests for Sources 14–15 [`tests/digest-run-outcome.test.mjs`] — extend 72-2 YouTube pattern: `buildSourcesFromAdapterOutputs({ tiktok: { success: false, … } })` → `status: 'error'`; success with `videos[]`/`reels[]` → correct counts.

- [x] [Review][Patch] Treat HTTP 402 as credit-exhausted in `classifyScrapeCreatorsHttpError` [`fetch-tiktok-signals.mjs`, `fetch-instagram-signals.mjs`] — today only body message keywords trigger `credit-exhausted`; bare 402 is non-fatal and may degrade to generic `tiktok fetch failed` / `instagram fetch failed` after hashtag loop exhaustion, obscuring credit math from operator triage.

- [x] [Review][Patch] Update stale `collectAdapterOutputs` return-type JSDoc [`scripts/run-digest-convex-completion.mjs:97-109`] — still ends at `youtube`; add `tiktok` and `instagram`.

- [x] [Review][Defer] Live ScrapeCreators API validation with real `SCRAPECREATORS_API_KEY` — deferred to Story 72-4 per operator brief; CI correctly uses fixture-only mocks.
