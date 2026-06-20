---
story_id: 72-7
epic: 72
title: threads-scrapecreators-adapter
status: review
baseline_commit: 34f00e8
operator_brief: 2026-06-20
predecessors: 72-3, 72-5, 72-6, 68-2, 68-3, 68-4, 70-1, 72-2
blocks: 72-4
repo: cross-repo (Omnipotent.md adapters + cns-dashboard schema)
fr_ids: FR-1, FR-2, FR-3, FR-4, FR-5
priority: P1
---

# Story 72.7: Threads ScrapeCreators Adapter (Source 18)

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a **CNS operator receiving the morning digest**,
I want **a Threads signal adapter via ScrapeCreators (API-key only) wired as Source 18 using a handle-watchlist primary pattern**,
so that **founder/operator/AI-vendor voices on Meta's text platform enter the digest with social engagement scoring, peopleMatch bonuses, full registry/orchestrator parity across all three list-classes, and Convex push validators that cannot repeat today's Polymarket health-panel / contributor-metadata drift failures**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 72 — Source Expansion (continues ScrapeCreators 72-3/72-5 + Polymarket 72-6) |
| **Priority** | **P1** — closes Meta short-form text gap; **no new credential** (reuses `SCRAPECREATORS_API_KEY`) |
| **Repo** | **Cross-repo** — schema: `cns-dashboard/convex/validators.ts`; adapters + pipeline: Omnipotent.md |
| **Predecessors** | **72-3** (ScrapeCreators HTTP + error class), **72-5/72-6** (registry parity + canonical fixture SSOT), **72-2** (parity test gate), **68-2/68-3** (people watchlist + `peopleMatch` bonus), **68-4** (schema literals), **70-1** (orchestrator) |
| **Vendor** | ScrapeCreators — `https://api.scrapecreators.com`, auth header `x-api-key`, env `SCRAPECREATORS_API_KEY` |
| **Source number** | **18** (after Polymarket 17, before Perplexity 3) |
| **Out of scope** | OAuth; npm ScrapeCreators SDK; `last30days` subprocess; vault writes; keyword-search-as-primary; `v1_threads_search_users` in v1 (discovery only — skip) |

### Operator brief (binding — 2026-06-20)

| Requirement | Value |
|-------------|-------|
| Auth | Single `x-api-key` header — **no OAuth**, same key as 72-3/72-5 |
| Env (primary) | `SCRAPECREATORS_API_KEY` (already set), **`MORNING_DIGEST_THREADS_HANDLES`** |
| Env example (binding) | **Backfill + Threads:** update `scripts/trend-ingest.env.example` in one pass — add commented blocks for **TikTok, Instagram, Pinterest, Polymarket** (shipped in 72-3/72-5/72-6 but missing from example file) **and** Threads (72-7). Mirror X/Bluesky style. Zero functional risk — reference file catch-up only. |
| Env (optional secondary) | **`MORNING_DIGEST_THREADS_KEYWORDS`** — only if T0 spike confirms search endpoint live |
| ScrapeCreators endpoints (5 total) | `GET /v1/threads/profile`, `GET /v1/threads/user/posts`, `GET /v1/threads/post`, `GET /v1/threads/search`, `GET /v1/threads/search/users` |
| **T0 spike (blocking)** | Live `curl` probe against `GET /v1/threads/search?query=ai&trim=true` **before** assuming keyword supplement works — operator reports "Endpoint not found" on ScrapeCreators docs site despite marketing/blog docs |
| **Default pattern** | **Handle-watchlist** — mirror X account loop (`MORNING_DIGEST_X_ACCOUNTS`) / YouTube query-watchlist shape, **not** keyword search |
| Handle-watchlist targets | Founders/operators/AI-tool vendor accounts, Anthropic/OpenAI/Meta-adjacent voices — align with `~/.hermes/nexus-people.yaml` / `nexus-goals.yaml` topical focus (peopleMatch bonus on `authorHandle`) |
| Keyword search role | **Secondary/optional supplement only** if T0 confirms `/v1/threads/search` live — keep narrow (few keywords), treat results as **low-trust/supplementary**, not primary recall |
| Platform limits | `user/posts` returns only **last 20–30 posts** per user (Threads platform limit, **not** adapter bug) — document in task-prompt |
| ScrapeCreators rate limit | **No query-frequency rate limit** on vendor side ("use as much as you want") — weakness is **~10 results per search call** (Meta constraint), not call frequency |
| Registry | Source **18** — extend **all three list-classes** (see AC 6) |
| Validator gate (critical) | Canonical fixture via **`buildDigestPushPayload()`** — same SSOT pattern as Polymarket/Pinterest (72-5/72-6 review patches) |
| Deploy gate (critical) | Before claiming live-verifiable: confirm **`npx convex deploy`** to production completed (`cns-dashboard` — no `--prod` flag) |

### Problem (current state)

| Gap | Today |
|-----|--------|
| No Threads adapter | Sources 1–17 wired; no `fetch-threads-signals.mjs` |
| Schema | `digestSourceTypeValue` / `digestSectionValue` lack `threads` |
| Orchestrator | `COLLECT_ADAPTER_TASK_KEYS` ends at `polymarket` |
| Registry parity | 17 rows in `DIGEST_SOURCE_SECTION_MAP` / `DIGEST_SOURCE_HEALTH_REGISTRY` |
| Health panel | **Separate list** from SECTION_MAP — Polymarket incident (2026-06-20): parity test passed but health output missing row until explicit registry update verified |
| Scoring/dedup | No `normalizeEngagement` or `SOURCE_PRIORITY` branch for `threads` |
| Collection order | Skill/task-prompt ends at Source 17 before Perplexity |
| Env example drift | `scripts/trend-ingest.env.example` stops at arXiv — **no** Epic 72 blocks (Sources 14–17 shipped; live values in `~/.hermes/trend-ingest.env` only) |

### Target pipeline touchpoints

```text
… → hermes-run-polymarket.sh (17)
  → hermes-run-threads.sh → fetch-threads-signals.mjs   ← NEW Source 18
  → hermes-run-perplexity.sh (Source 3)
  → pick-signal-notebook / §9 map / dedupe / score / push
```

**Collection order update:** `… → 16 → 17 → **18** → 3 → 6`

---

## Acceptance Criteria

### 0. T0 spike — live search endpoint probe (AC: blocking design)

**Given** `SCRAPECREATORS_API_KEY` is set in operator env
**When** dev runs T0 before implementing keyword supplement
**Then** execute live probe (document command + HTTP status + body snippet in Completion Notes):

```bash
curl -sS -o /tmp/threads-search.json -w '%{http_code}' \
  -H "x-api-key: ${SCRAPECREATORS_API_KEY}" \
  "https://api.scrapecreators.com/v1/threads/search?query=ai&trim=true"
```

**And** if response is 404 / `"Endpoint not found"` / empty error body:
- **Do not wire** `MORNING_DIGEST_THREADS_KEYWORDS` path in v1
- Document `search-endpoint-unavailable` in Completion Notes
- Handle-watchlist-only adapter still ships (primary pattern unaffected)

**And** if response is 200 with post array:
- Wire optional keyword supplement behind env flag (see AC 3)
- Cap keywords to **≤5** in docs; max **10 results per keyword** (platform limit)
- Mark keyword-derived signals as supplementary in task-prompt (low-trust copy)

**And** regardless of search outcome, probe **`GET /v1/threads/user/posts?handle={known_handle}&trim=true`** succeeds — this is the primary path

### 1. Schema literals (AC: FR-1)

**Given** cns-dashboard digest signal validators
**When** extended for Threads
**Then** `digestSourceTypeValue` adds `v.literal('threads')`
**And** `digestSectionValue` adds `v.literal('threads')`
**And** existing `sourceMetadataValidator` fields suffice for v1 push:
- `likes`, `commentCount`, `author`, `authorHandle`, `publishedAt` — mirror X/Bluesky
- **No new metadata keys** unless T0 response exposes fields with no existing slot (prefer reuse)
**And** push payloads with `sourceType`/`section` `threads` pass **`digest:addDigestSignal`** (real mutation)
**And** nested `contributingSources[]` accepts any engagement keys dedupe copies from `ENGAGEMENT_FIELDS`

**Apply in:** `cns-dashboard/convex/validators.ts` + `cns-dashboard/tests/convex/digest.test.ts`

**Validator wiring checklist (mandatory before done):**

1. Trace `digest:addDigestSignal` → confirm `digestSignalInputValidator`.
2. Implement §9 mapping in `build-digest-push-payload.mjs` first.
3. List every key written to `signal.sourceMetadata` for Threads.
4. Confirm each key on `sourceMetadataValidator` (+ nested contributor schema if in `ENGAGEMENT_FIELDS`).
5. Add `tests/fixtures/threads-digest-signal.fixture.mjs` exporting `buildCanonicalThreadsDigestSignal()` via **`buildDigestPushPayload()`** — **not** a hand-rolled test double.
6. Import fixture in `digest.test.ts` → call `t.mutation('digest:addDigestSignal', …)` → assert stored document.
7. Extend `tests/morning-digest-build-payload.test.mjs` with Threads builder path + metadata key guard.

Reference: `_bmad-output/implementation-artifacts/spec-morning-digest-convex-contributor-engagement-validator.md`

### 2. ScrapeCreators HTTP client contract (AC: FR-2)

**Given** `fetch-threads-signals.mjs`
**When** calling ScrapeCreators
**Then** base URL `https://api.scrapecreators.com`
**And** header `x-api-key: ${SCRAPECREATORS_API_KEY}` on every request
**And** **no new npm dependencies** — Node built-in `fetch` only
**And** credentials via `mergeTrendIngestEnv()` + `resolveOperatorHome()` — key in `~/.hermes/trend-ingest.env`
**And** never print API key to stdout/stderr/Discord
**And** HTTP timeout **15s** per request; **100ms** delay between handle/keyword iterations
**And** process **always exits 0** — failures return `{"error":"<short reason>"}` stdout (≤120 chars)
**And** reuse `classifyScrapeCreatorsHttpError` from 72-3 (402 → `credit-exhausted`, 401/403 fatal)

**Credit awareness:** Log stderr one-line warning when handle count × estimated credits exceeds soft threshold; do **not** hard-block cron.

**Endpoint map (v1 usage):**

| Endpoint | v1 role |
|----------|---------|
| `GET /v1/threads/user/posts?handle={h}&trim=true` | **Primary** — one call per watchlist handle |
| `GET /v1/threads/profile?handle={h}` | **Optional** — skip in v1 unless needed for validation; do not burn credits per handle |
| `GET /v1/threads/post?url={url}` | **Skip v1** — no URL-ingest path in digest |
| `GET /v1/threads/search?query={kw}&trim=true` | **Optional secondary** — only if T0 pass |
| `GET /v1/threads/search/users?query={q}` | **Skip v1** — discovery only |

### 3. Threads adapter stdout contract (AC: FR-2, FR-3)

**Given** `fetch-threads-signals.mjs`
**When** enabled and configured
**Then** stdout success shape:

```json
{
  "posts": [
    {
      "title": "Caption text trimmed",
      "url": "https://www.threads.com/@karpathy/post/DIU8naHS6q_",
      "authorHandle": "karpathy",
      "author": "karpathy",
      "publishedAt": "2026-06-19T14:30:00.000Z",
      "likes": 4200,
      "reposts": 180,
      "replies": 95,
      "postCode": "DIU8naHS6q_",
      "postId": "1234567890"
    }
  ]
}
```

**And** stdout key is **`posts[]` only** — collect key `threads` distinguishes from X/Bluesky `posts[]` in separate adapter processes (same pattern as twitter + bluesky both using `posts[]`)

**Primary flow — handle watchlist:**

- Parse `MORNING_DIGEST_THREADS_HANDLES` comma-separated (strip `@`, dedupe case-insensitively)
- Per handle: `GET /v1/threads/user/posts?handle={handle}&trim=true`
- Map API post objects → stdout rows:
  - `title` ← caption text (trimmed)
  - `url` ← `https://www.threads.com/@{handle}/post/{code}` when `code` present
  - `authorHandle` / `author` ← watchlist handle (enables **peopleMatch** bonus via 68-3)
  - `likes` ← `like_count`
  - `reposts` ← `reshare_count` + `repost_count` (sum if both present)
  - `replies` ← `direct_reply_count`
  - `publishedAt` ← `taken_at` (unix → ISO when numeric)
  - `postCode` / `postId` ← stable id for dedupe + `externalId`
- Dedupe by `postId` / `postCode` / canonical URL across handles
- Respect `MORNING_DIGEST_THREADS_MAX_POSTS` (default **15**, hard max **30**)
- Respect `MORNING_DIGEST_THREADS_PER_HANDLE` (default **5**)
- Client-side lookback filter when `publishedAt` present (`MORNING_DIGEST_THREADS_LOOKBACK_HOURS`, default **168**)

**Optional secondary — keyword supplement (T0 pass only):**

- Parse `MORNING_DIGEST_THREADS_KEYWORDS` (comma-separated, **max 5** keywords enforced in code)
- Per keyword: `GET /v1/threads/search?query={keyword}&trim=true`
- Merge into handle results with dedupe; tag supplementary rows only in stderr summary (not separate metadata key unless validator extended)
- Do **not** run keyword path when env unset or T0 failed

**Platform limit documentation (mandatory in adapter header + task-prompt):**

> `user/posts` returns only the **last 20–30 publicly visible posts** per handle. Sparse results are expected — not an adapter bug.

**Failure stdout examples:** `threads disabled`, `missing-api-key`, `missing-handles`, `http-401`, `http-403`, `credit-exhausted`, `search-endpoint-unavailable`

**Exports:** `runThreadsFetch(env, options)` with injectable `fetch` + fixtures (mirror `runTiktokFetch` / `runXFetch`)

| Variable | Purpose | Default |
|----------|---------|---------|
| `SCRAPECREATORS_API_KEY` | Shared with TikTok/Instagram/Pinterest | required when enabled |
| `MORNING_DIGEST_THREADS_HANDLES` | Comma-separated Threads usernames | **required** when enabled |
| `MORNING_DIGEST_THREADS_KEYWORDS` | Optional keyword supplement (T0 pass only) | unset = disabled |
| `MORNING_DIGEST_THREADS_ENABLED` | Falsy: `0`, `false`, `no`, `off` | enabled |
| `MORNING_DIGEST_THREADS_MAX_POSTS` | Global cap after dedupe | `15` |
| `MORNING_DIGEST_THREADS_PER_HANDLE` | Max posts per handle fetch | `5` |
| `MORNING_DIGEST_THREADS_PER_KEYWORD` | Max posts per keyword search (T0 pass) | `5` |
| `MORNING_DIGEST_THREADS_LOOKBACK_HOURS` | Client-side filter when `publishedAt` present | `168` |

### 4. Shell wrapper + Hermes contract (AC: FR-4)

**Given** `scripts/session-close/hermes-run-threads.sh`
**When** invoked from Hermes `terminal(...)` with `workdir=resolved_repo_root`
**Then** HOME isolation remap matches `hermes-run-polymarket.sh` / `hermes-run-tiktok.sh`
**And** thin `exec node` on `fetch-threads-signals.mjs`
**And** stdout reads **`posts[]` only**
**And** wrapper timeout **45s**

### 5. Source 18 in task-prompt.md + SKILL.md (AC: FR-4)

**Given** morning-digest task contract
**When** Source 18 is added
**Then** insert **after Source 17 (Polymarket), before Source 3 (Perplexity)**
**And** update strict collection order: `… → 17 → **18** → 3 → 6`
**And** REQUIRED SOURCES checklist adds row **18 | Threads**
**And** Steps 9–17 gate becomes **Steps 9–18 gate**
**And** Source 3 gate: Perplexity fires **after Source 18**

**Source 18 block includes:**

- `terminal(command="bash scripts/session-close/hermes-run-threads.sh", workdir=resolved_repo_root, timeout=45)`
- Imperative stdout: `th_stdout` → `JSON.parse` → `th_json.posts[]` only
- Failure: **Threads** header + `- (source unavailable: <short reason>)` → continue to Source 3
- Discord bullets: `- @<authorHandle>: <title> — <likes> likes, <reposts> reposts`
- **Platform limit callout** (one sentence): user/posts returns last 20–30 posts only

**§9 mapping table** adds:

| Section | sourceType | Source data | title | summary | url | externalId |
|---------|------------|-------------|-------|---------|-----|------------|
| `threads` | `threads` | Source 18 `posts[]` | `title` | first 200 chars of `title` | `url` | `postId` or `postCode` or `sha256(url).slice(0,16)` |

**§9 sourceMetadata (Convex push — validator-bound fields only):**

| stdout field | digestSignal field | Notes |
|--------------|-------------------|-------|
| `likes` | `sourceMetadata.likes` | primary engagement |
| `reposts` | `sourceMetadata.commentCount` | **X analog** — reposts mapped to commentCount slot for scoring reuse (document in Completion Notes) OR use existing pattern from X if different — **verify against `build-digest-push-payload.mjs` X mapping before deviating** |
| `replies` | omit or embed in summary | prefer not adding new validator keys |
| `authorHandle` | `sourceMetadata.authorHandle` | **required for peopleMatch** (68-3) |
| `author` | `sourceMetadata.author` | display fallback |
| `publishedAt` | `sourceMetadata.publishedAt` | when present |

**Do not push** raw API blobs, `postCode`, or media URLs unless added to validator first.

**digest_sources assembly** adds `"threads": [...]` with engagement for `buildDigestSignals`

**Strict-schema unions** extend `section` and `sourceType` with `threads`

### 6. Orchestrator + registry parity — three list-classes (AC: FR-4, FR-5)

**Given** `collectAdapterOutputs()` in `scripts/run-digest-convex-completion.mjs`
**When** deterministic digest runs
**Then** add task after `polymarket`:

```javascript
['threads', () => runWrapper('hermes-run-threads.sh', mergedEnv, 45_000)],
```

**And** extend `COLLECT_ADAPTER_TASK_KEYS` + `COLLECT_ADAPTER_WRAPPER_BY_KEY` in same commit

**CRITICAL — three separate list-classes (2026-06-20 incident lesson):**

All three must be updated in **one commit** and **explicitly verified** before done — passing `digest-source-registry-parity.test.mjs` alone is **insufficient** if health UI list drifts.

| # | List class | Location | Verify |
|---|------------|----------|--------|
| **1** | Parity test five-list gate | `tests/digest-source-registry-parity.test.mjs` + `scripts/lib/digest-source-registry-parity.mjs` | `bash scripts/verify.sh` — structural assert **18** collect keys, SECTION_MAP rows, payload keys |
| **2** | Convex mutation args validator | `cns-dashboard/convex/validators.ts` → `digestSignalInputValidator` → `sourceMetadataValidator` | `digest.test.ts` calls real `digest:addDigestSignal` with **`buildCanonicalThreadsDigestSignal()`** from production `buildDigestPushPayload()` |
| **3** | Source health reporting list | `cns-dashboard/convex/lib/digest_source_registry.ts` → **`DIGEST_SOURCE_HEALTH_REGISTRY`** | `digest-source-health.test.ts` asserts **18 rows**; **post-deploy** spot-check `getDigestSourceHealth` returns Threads row (not inferred-only gap like Polymarket incident) |

**Registry parity sweep (update ALL in one commit):**

| Location | Add |
|----------|-----|
| `DIGEST_SOURCE_SECTION_MAP` | `threads` row + label patterns (`/threads/i`) |
| `SECTION_LITERAL_TO_SOURCE_KEY` | `threads` |
| `cns-dashboard/convex/lib/digest_source_registry.ts` | **18th health row** `{ sourceKey: 'threads', label: 'Threads' }` |
| `cns-dashboard/convex/validators.ts` | `threads` literals |
| `cns-dashboard/src/lib/utils/nexus-digest-feed.ts` | badge **`TH`** |
| `ADAPTER_PAYLOAD_ARRAY_KEYS` | confirm `posts` already listed (twitter/bluesky/threads share key — no new entry needed unless parity test requires explicit comment) |
| `EMPTY_ADAPTER_SUCCESS_DATA` in parity test | `{ threads: { posts: [] } }` |
| `tests/digest-source-registry-parity.test.mjs` | must pass without weakening assertions |

**Verify:** `bash scripts/verify.sh` fails if any list drifts.

**Post-deploy verification (mandatory before "live-verifiable" claim):**

```bash
cd ../cns-dashboard && npx convex deploy   # production — no --prod flag
# Confirm deploy succeeded; then spot-check dashboard source health shows Threads row on next digest run
```

### 7. Scoring + dedup branches (AC: FR-5)

**Given** `score-digest-signals.mjs`
**When** `normalizeEngagement` for `threads`
**Then** mirror **X/Bluesky** social weights on `likes` + repost analog:
- **0.60** × logNorm(likes, cap) + **0.30** × logNorm(reposts→commentCount, cap) + **0.10** × optional reply weight if mapped
- Or mirror exact X weights if `build-digest-push-payload` maps reposts consistently with twitter — **read existing X §9 mapping first**
**And** all missing/zero engagement → `null` (Path B momentum)
**And** `SOURCE_PRIOR.threads = 9` (high-signal social tier — align with twitter/bluesky)
**And** `TREND_PROXY_PRIOR.threads = 44` (between bluesky 43 and polymarket 45 — adjust to match twitter if already defined)
**And** extend `DigestSourceType` typedef

**Given** `dedupe-digest-signals.mjs`
**When** merge priority resolves clusters
**Then** add `threads: 4` to `SOURCE_PRIORITY` (same tier as `twitter: 4`, `youtube: 4`)
**And** `likes` already in `ENGAGEMENT_FIELDS` — confirm repost-mapped field included if copied to contributors

**peopleMatch integration (68-3 — no new work, but verify):**

- When `authorHandle` matches `~/.hermes/nexus-people.yaml`, scoring emits `sourceMetadata.peopleMatch`
- Fixture test: known people.yaml handle → `peopleMatch.bonusPoints === 20`

**Do not** modify merge algorithm core, rankScore weights, or disposition thresholds.

### 8. buildDigestSignals integration (AC: FR-4)

**Given** `pick-signal-notebook.mjs`
**When** `digest_sources.threads` present
**Then** export `extractThreadsSignals()` — top **2** posts by engagement score desc (likes + 2×reposts, mirror X `sortAndCapPosts` ranking)
**And** insert after Polymarket, before title dedupe cap-10
**And** extend `signalsFromParsedInput()` guard keys

### 9. Tests + verify gate (AC: FR-5)

**Given** implementation complete
**When** `bash scripts/verify.sh` runs
**Then** all tests pass including:

- `tests/fixtures/threads-digest-signal.fixture.mjs` — **NEW** — `buildCanonicalThreadsDigestSignal()` via production `buildDigestPushPayload()`
- `cns-dashboard/tests/convex/digest.test.ts` — imports fixture; **`addDigestSignal accepts threads signal with social metadata + authorHandle`**
- `tests/morning-digest-build-payload.test.mjs` — Threads builder + metadata key guard
- `cns-dashboard/tests/lib/nexus-digest-feed.test.ts` — `formatDigestSourceBadge('threads')` → `'TH'`
- `cns-dashboard/tests/convex/digest-source-health.test.ts` — **18** registry rows (list-class #3)
- `cns-dashboard/tests/lib/nexus-source-health.test.ts` — **18** rows if applicable
- `tests/morning-digest-threads-adapter.test.mjs` (new) — config, handle parse, post mapping, dedupe across handles, disabled/missing-key, 401/402 credit paths, T0-off keyword path skipped, `buildCanonicalThreadsDigestSignal` shape
- `tests/morning-digest-score-signals.test.mjs` (extend) — threads `normalizeEngagement`; peopleMatch bonus with handle fixture
- `tests/morning-digest-push-convex.test.mjs` (extend) — sourceType passthrough
- `tests/hermes-morning-digest-skill.test.mjs` (extend) — Source 18 block, `posts[]` threading, §9 rows, collection order, platform limit disclaimer
- `tests/morning-digest-pick-signal-notebook.test.mjs` (extend) — extract helper
- `tests/digest-source-registry-parity.test.mjs` — green (list-class #1)
- `tests/run-digest-convex-completion.test.mjs` (extend) — threads success/error outcome counts; `{ error: 'credit-exhausted' }` / `{ error: 'missing-handles' }`
- `tests/digest-run-outcome.test.mjs` (extend) — threads success/error outcome counts

**And** `bash scripts/install-hermes-skill-morning-digest.sh` after script/wrapper changes
**And** **no live ScrapeCreators calls in CI** — mock `fetch` with fixtures from MCP tool response shapes

**Mandatory pre-done validator audit:**

```bash
# cns-dashboard
npm test -- tests/convex/digest.test.ts
npm test -- tests/convex/digest-source-health.test.ts
# Omnipotent.md
bash scripts/verify.sh
```

### 10. Anti-drift boundaries (AC: scope)

**Given** this story's scope
**When** implementation completes
**Then** there is **no** keyword-search-primary mode (handles are primary regardless of T0)
**And** **no** OAuth or Threads official API
**And** **no** new ScrapeCreators credential beyond existing `SCRAPECREATORS_API_KEY`
**And** **no** `last30days` import/subprocess
**And** **no** `search/users` or `profile` per-handle credit burn in v1
**And** TikTok/Instagram/Pinterest/Polymarket adapters unchanged except shared env merge if needed

### 11. Operator env example file — Epic 72 backfill + Threads (AC: FR-4)

**Given** `scripts/trend-ingest.env.example` (currently stops at arXiv — **missing** TikTok/Instagram/Pinterest/Polymarket blocks despite Sources 14–17 shipped)
**When** Story 72-7 completes
**Then** add commented **Epic 72 morning-digest source tuning** sections in one pass — mirror X/Bluesky block style (Story reference, tuning vars, copy-to-`~/.hermes/trend-ingest.env` note)
**And** place after arXiv block, before analytics soak section
**And** **zero functional risk** — documentation-only catch-up to values already established in 72-3/72-5/72-6 stories and live in operator `~/.hermes/trend-ingest.env`; no adapter code changes

**Shared ScrapeCreators credential (Sources 14–16, 18):**

```bash
# SCRAPECREATORS_API_KEY=""   # https://scrapecreators.com — shared by TikTok, Instagram, Pinterest, Threads (72-3/72-5/72-7)
```

**TikTok — Source 14 (Story 72-3):**

```bash
# MORNING_DIGEST_TIKTOK_HASHTAGS=aiagents,claudeai,chatgpt,mcp
# MORNING_DIGEST_TIKTOK_ENABLED=1
# MORNING_DIGEST_TIKTOK_REGION=US
# MORNING_DIGEST_TIKTOK_MAX_VIDEOS=20
# MORNING_DIGEST_TIKTOK_PER_HASHTAG=5
# MORNING_DIGEST_TIKTOK_LOOKBACK_HOURS=24
```

**Instagram — Source 15 (Story 72-3):**

```bash
# MORNING_DIGEST_INSTAGRAM_HASHTAGS=ai,artificialintelligence,technews
# MORNING_DIGEST_INSTAGRAM_ENABLED=1
# MORNING_DIGEST_INSTAGRAM_MAX_REELS=15
# MORNING_DIGEST_INSTAGRAM_PER_HASHTAG=5
# MORNING_DIGEST_INSTAGRAM_INCLUDE_TRENDING=1
# MORNING_DIGEST_INSTAGRAM_LOOKBACK_HOURS=168
# Note: hashtag search is Google-index-backed — sparse results expected (see task-prompt Source 15)
```

**Pinterest — Source 16 (Story 72-5):**

```bash
# MORNING_DIGEST_PINTEREST_KEYWORDS=ai agents,claude ai,mcp servers
# MORNING_DIGEST_PINTEREST_ENABLED=1
# MORNING_DIGEST_PINTEREST_MAX_PINS=15
# MORNING_DIGEST_PINTEREST_PER_KEYWORD=5
# MORNING_DIGEST_PINTEREST_LOOKBACK_HOURS=168
```

**Polymarket — Source 17 (Story 72-6) — no API key:**

```bash
# MORNING_DIGEST_POLYMARKET_KEYWORDS=AI model,Claude,Bitcoin ETF,Fed rate cut
# MORNING_DIGEST_POLYMARKET_TAG_SLUGS=crypto,politics
# MORNING_DIGEST_POLYMARKET_ENABLED=1
# MORNING_DIGEST_POLYMARKET_MAX_MARKETS=15
# MORNING_DIGEST_POLYMARKET_MIN_VOLUME24HR=1000
```

**Threads — Source 18 (Story 72-7):**

```bash
# MORNING_DIGEST_THREADS_HANDLES=sama,karpathy,AnthropicAI,simonw,emollick
# MORNING_DIGEST_THREADS_ENABLED=1
# MORNING_DIGEST_THREADS_MAX_POSTS=15
# MORNING_DIGEST_THREADS_PER_HANDLE=5
# MORNING_DIGEST_THREADS_LOOKBACK_HOURS=168
# Optional — only if T0 spike confirms /v1/threads/search live:
# MORNING_DIGEST_THREADS_KEYWORDS=claude ai,mcp servers
# Note: user/posts returns last 20–30 posts per handle; handles align with nexus-people.yaml / peopleMatch (68-3)
```

**And** operator may swap any watchlist values — consistency of **having** example blocks matters more than specific handles/keywords
**And** **not** operator-only documentation — committed example file is SSOT for the copy workflow at top of file

---

## Tasks / Subtasks

- [x] **T0** Live spike — `curl` probe `/v1/threads/search` + confirm `/v1/threads/user/posts` works; document pass/fail in Completion Notes (AC: 0)
- [x] **T1** `cns-dashboard/convex/validators.ts` — `threads` literals (AC: 1)
- [x] **T2** `tests/fixtures/threads-digest-signal.fixture.mjs` + `digest.test.ts` + `morning-digest-build-payload.test.mjs` — **full mutation fixture via production builder** (AC: 1, 9 — list-class #2)
- [x] **T3** `fetch-threads-signals.mjs` + `hermes-run-threads.sh` — handle-watchlist primary; optional keyword supplement if T0 pass (AC: 2, 3, 4)
- [x] **T4** Registry parity sweep — SECTION_MAP, **HEALTH_REGISTRY (list-class #3)**, SECTION_LITERAL_TO_SOURCE_KEY, badges, parity test empty fixture (AC: 6)
- [x] **T5** `run-digest-convex-completion.mjs` — collect task + JSDoc (AC: 6)
- [x] **T6** `score-digest-signals.mjs` + `dedupe-digest-signals.mjs` — include peopleMatch verification (AC: 7)
- [x] **T7** `pick-signal-notebook.mjs` + `build-digest-push-payload.mjs` — extract helper + §9 mapping (AC: 8)
- [x] **T8** `task-prompt.md` + `SKILL.md` + **`scripts/trend-ingest.env.example`** — Source 18 skill contract; **backfill Epic 72 env example blocks** for TikTok, Instagram, Pinterest, Polymarket (72-3/72-5/72-6 drift fix) + Threads defaults `sama,karpathy,AnthropicAI,simonw,emollick` (AC: 5, 11)
- [x] **T9** Omnipotent.md + dashboard tests (AC: 9)
- [x] **T10** **Three-list-class audit** — document explicit verification of parity test, mutation fixture, and health registry row count; trace every emitted metadata field (AC: 1, 6, 9)
- [x] **T11** Verify + Hermes sync + **Convex prod deploy** (AC: 9, 6)
  - [x] `bash scripts/verify.sh` green
  - [x] `bash scripts/install-hermes-skill-morning-digest.sh`
  - [x] `cd ../cns-dashboard && CONVEX_DEPLOYMENT=amiable-ox-862 npx convex deploy` — prod push succeeded

### Review Findings

**Live prod verification (2026-06-20):** `CONVEX_DEPLOYMENT=amiable-ox-862 npx convex run digest:getDigestSourceHealth` on run `md75x9s3q74agy3ygq0cvve6bx890f4e` returned **18 rows** including `{ sourceKey: 'threads', label: 'Threads' }`. List-class #3 is deployed — not a Pinterest/Polymarket-style drift gap.

- [x] [Review][Patch] SKILL.md terminal-fire gate still says Sources 9–17 and Perplexity after Source 17 — fixed: Sources 9–18 gate + `hermes-run-threads.sh`; Perplexity after Source 18
- [x] [Review][Patch] `run-digest-convex-completion.test.mjs` not extended for threads success/error paths — fixed: missing-handles, credit-exhausted, success stdout tests
- [x] [Review][Patch] `morning-digest-push-convex.test.mjs` not extended for threads sourceType passthrough — fixed
- [x] [Review][Patch] Keyword fatal error discards handle-sourced posts — fixed: keyword fatal uses `break` not early return
- [x] [Review][Patch] `hermes-run-threads.sh` missing executable-bit test — fixed: `0o111` assertion added
- [x] [Review][Patch] http-401/http-403 fatal path untested in adapter test — fixed: handle 401 test + keyword 401 preserves handle posts
- [x] [Review][Defer] `DEFAULT_THREADS_HANDLES` exported but unused — AC3 requires `missing-handles` when env unset; intentional, not a bug
- [x] [Review][Defer] Threads scoring reuses X engagement caps — AC7 allows mirroring X weights; calibration deferred
- [x] [Review][Defer] Cross-endpoint dedupe ID shape mismatch (handle vs search) — edge case; defer unless duplicate signals observed in prod

---

## Dev Notes

### Cross-repo workflow (critical)

1. Schema + registry in `../cns-dashboard/`
2. Adapters + tests in Omnipotent.md
3. Verify: `bash scripts/verify.sh` from Omnipotent.md (`CNS_DASHBOARD_ROOT` to override)
4. **Deploy:** `npx convex deploy` in cns-dashboard before live verification claims

### Canonical adapter pattern (mirror — do not reinvent)

| Concern | Copy from |
|---------|-----------|
| Handle-watchlist loop | `fetch-x-signals.mjs` — `MORNING_DIGEST_X_ACCOUNTS`, per-account fetch, dedupe |
| ScrapeCreators HTTP + error class | `fetch-tiktok-signals.mjs` — `classifyScrapeCreatorsHttpError`, `x-api-key`, 402 handling |
| Env merge / operator home | `fetch-arxiv-rss.mjs` — `mergeTrendIngestEnv`, `resolveOperatorHome` |
| Shell wrapper | `hermes-run-polymarket.sh` |
| §9 + mutation fixture SSOT | `tests/fixtures/polymarket-digest-signal.fixture.mjs` + `build-digest-push-payload.mjs` |
| Registry parity (three lists) | `72-6` — extend ALL lists in **one commit**; verify health registry explicitly |
| Social post stdout | `fetch-bluesky-signals.mjs` / `fetch-x-signals.mjs` — `posts[]` shape |
| peopleMatch | `68-3` — emit `authorHandle`; scoring adds bonus automatically |

### ScrapeCreators Threads API reference

**Base:** `https://api.scrapecreators.com`

**Auth:** `x-api-key: SCRAPECREATORS_API_KEY`

**User posts (primary):**

```http
GET /v1/threads/user/posts?handle=karpathy&trim=true
x-api-key: ...
```

Response fields (MCP descriptor): `id`, caption text, `code`, `like_count`, `reshare_count`, `direct_reply_count`, `repost_count`, `taken_at`. Only last **20–30** posts visible.

**Keyword search (optional — T0 gate):**

```http
GET /v1/threads/search?query=ai&trim=true
x-api-key: ...
```

Returns **≤10 results** per call (Meta public API limit). Operator reports endpoint may return 404 on docs site — **must live-probe before wiring**.

**Post by URL (skip v1):**

```http
GET /v1/threads/post?url=https://www.threads.com/@handle/post/CODE&trim=true
```

**Profile (skip v1):**

```http
GET /v1/threads/profile?handle=karpathy
```

**Search users (skip v1):**

```http
GET /v1/threads/search/users?query=shams
```

**MCP tool names (manual validation):** `v1_threads_user_posts`, `v1_threads_search`, `v1_threads_profile`, `v1_threads_post`, `v1_threads_search_users`

**Docs:** https://docs.scrapecreators.com/openapi.json

### Dedup implementation sketch

```javascript
function threadsDedupeKey(row) {
  const postId = String(row.postId ?? row.id ?? '').trim();
  if (postId) return `th:${postId}`;
  const code = String(row.postCode ?? row.code ?? '').trim();
  if (code) return `th:code:${code}`;
  const url = normalizeUrl(row.url);
  if (url) return `th:url:${url}`;
  return null;
}
```

### Three list-classes — Polymarket incident (mandatory reading)

2026-06-20: **`digest-source-registry-parity.test.mjs` passed** after Polymarket (72-6) landed, but **source health panel did not show Polymarket** until `DIGEST_SOURCE_HEALTH_REGISTRY` was confirmed deployed to Convex prod.

**Root cause class:** List-class #1 (parity test) and list-class #3 (`DIGEST_SOURCE_HEALTH_REGISTRY`) are **related but not identical** — parity test cross-checks them when `cns-dashboard` sibling exists, but **Convex prod deploy** is a separate step. Health query reads deployed schema/registry, not local files.

**For Threads, before done:**

1. Update all three list-classes in one commit.
2. Run `bash scripts/verify.sh` (covers #1 + #2 via tests).
3. Run `npx convex deploy` in cns-dashboard (activates #3 in prod).
4. Spot-check `getDigestSourceHealth` on next digest run includes `threads` row.

Reference: commit `34f00e8` — `fix(digest): emit fired status for successful-empty adapter runs, close parity gap`

### Validator wiring lesson (2026-06-20 — mandatory)

Production failure class: adapter emits fields validators do not declare → **`digest:addDigestSignal` rejects entire push**. Fix is validator alignment + regression test calling the **real mutation** via **`buildDigestPushPayload()`** fixture — not hand-rolled payloads.

Reference: `_bmad-output/implementation-artifacts/spec-morning-digest-convex-contributor-engagement-validator.md`

### WriteGate / security

- **No vault writes** — read-only HTTP adapters
- **No AGENTS.md edit** required (Operator Guide env docs optional in 72-4)
- API key env-only — never commit
- **No new npm packages**

### Files to touch

| File | Action |
|------|--------|
| `../cns-dashboard/convex/validators.ts` | UPDATE |
| `../cns-dashboard/convex/lib/digest_source_registry.ts` | UPDATE — 18th health row |
| `../cns-dashboard/src/lib/utils/nexus-digest-feed.ts` | UPDATE — badge `TH` |
| `../cns-dashboard/tests/convex/digest.test.ts` | UPDATE — threads mutation via fixture |
| `../cns-dashboard/tests/convex/digest-source-health.test.ts` | UPDATE — 18 rows |
| `../cns-dashboard/tests/lib/nexus-digest-feed.test.ts` | UPDATE |
| `../cns-dashboard/tests/lib/nexus-source-health.test.ts` | UPDATE |
| `tests/fixtures/threads-digest-signal.fixture.mjs` | NEW |
| `scripts/hermes-skill-examples/morning-digest/scripts/fetch-threads-signals.mjs` | NEW |
| `scripts/session-close/hermes-run-threads.sh` | NEW |
| `scripts/hermes-skill-examples/morning-digest/scripts/adapter-result.mjs` | UPDATE if needed |
| `scripts/hermes-skill-examples/morning-digest/scripts/parse-digest-source-outcomes.mjs` | UPDATE — SECTION_MAP row |
| `scripts/lib/digest-source-registry-parity.mjs` | UPDATE — section literal |
| `scripts/run-digest-convex-completion.mjs` | UPDATE |
| `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs` | UPDATE |
| `scripts/hermes-skill-examples/morning-digest/scripts/dedupe-digest-signals.mjs` | UPDATE |
| `scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs` | UPDATE |
| `scripts/hermes-skill-examples/morning-digest/scripts/build-digest-push-payload.mjs` | UPDATE |
| `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` | UPDATE |
| `scripts/hermes-skill-examples/morning-digest/SKILL.md` | UPDATE |
| `scripts/trend-ingest.env.example` | UPDATE — **Epic 72 backfill:** TikTok, Instagram, Pinterest, Polymarket + Threads blocks (AC: 11) |
| `tests/morning-digest-threads-adapter.test.mjs` | NEW |
| `tests/morning-digest-build-payload.test.mjs` | UPDATE |
| `tests/morning-digest-score-signals.test.mjs` | UPDATE |
| `tests/morning-digest-push-convex.test.mjs` | UPDATE |
| `tests/hermes-morning-digest-skill.test.mjs` | UPDATE |
| `tests/morning-digest-pick-signal-notebook.test.mjs` | UPDATE |
| `tests/run-digest-convex-completion.test.mjs` | UPDATE |
| `tests/digest-run-outcome.test.mjs` | UPDATE |
| `tests/digest-source-registry-parity.test.mjs` | UPDATE — empty fixture for `threads` |

**Do NOT edit:** TikTok/Instagram/Pinterest/Polymarket adapters (except shared constants), dedupe merge core, rankScore weights

### Example operator env (`~/.hermes/trend-ingest.env`)

Copy from `scripts/trend-ingest.env.example` (committed SSOT). After T8, the example file includes **all Epic 72 sources** (14–18). Threads slice:

```bash
SCRAPECREATORS_API_KEY=sc_...   # shared — already set from 72-3
MORNING_DIGEST_THREADS_HANDLES=sama,karpathy,AnthropicAI,simonw,emollick
MORNING_DIGEST_THREADS_MAX_POSTS=15
MORNING_DIGEST_THREADS_PER_HANDLE=5
# Optional — only if T0 spike confirms search endpoint live:
# MORNING_DIGEST_THREADS_KEYWORDS=claude ai,mcp servers
```

Default handles overlap X account watchlist (`karpathy`, `sama`, `emollick`, `simonw`) for peopleMatch alignment with `~/.hermes/nexus-people.yaml`.

### Testing notes

- Fixture with numeric `taken_at` unix timestamps → assert ISO `publishedAt`
- Duplicate `postCode` across two handles (reshared content) — assert single output row
- Empty handle fetch → exit 0 with `posts: []` for that handle — **not** throw; aggregate continues
- `buildCanonicalThreadsDigestSignal()` → metadata keys ⊆ `sourceMetadataValidator`
- Keyword path: test skipped when `MORNING_DIGEST_THREADS_KEYWORDS` unset; test wired when T0 documents pass
- Parity test must fail if developer adds schema literal but forgets HEALTH_REGISTRY row

---

## Previous Story Intelligence

| Story | Learning |
|-------|----------|
| **72-6** | Canonical fixture via `buildDigestPushPayload()`; keyword-primary for Polymarket; **`npx convex deploy`** before live claims; example env in story but **not** backfilled to `trend-ingest.env.example` — fix in 72-7 T8 |
| **72-5** | ScrapeCreators `x-api-key`, map engagement to existing validator fields; registry parity in one commit |
| **72-3** | `classifyScrapeCreatorsHttpError`, 402 → `credit-exhausted`, platform freshness limits; example env values in story (`aiagents,claudeai,chatgpt,mcp` etc.) — **backfill to trend-ingest.env.example in 72-7 T8** |
| **72-2** | **Registry drift is the default failure mode** — three list-classes must all be updated; parity test is structural gate (#1) only |
| **72-1** | Query/handle-watchlist adapter shape; cross-repo verify |
| **68-6/68-5** | Social adapters use `posts[]` stdout + `authorHandle` for peopleMatch |
| **68-3** | `peopleMatch` bonus requires `authorHandle` in pushed metadata — Threads must emit it |
| **70-1** | `collectAdapterOutputs` is cron SSOT — wire orchestrator in same commit as skill |
| **34f00e8** | Empty adapter success → `fired` not silent drop; extend outcome tests for new source |

---

## Git Intelligence

Follow Epic 72 commits: Node `.mjs` adapters, thin bash wrappers, contract tests in `hermes-morning-digest-skill.test.mjs`, registry parity in same commit as schema literals. 72-6 pattern: adapter + orchestrator + three-list audit + fixture SSOT + `npx convex deploy` note.

Recent commits:
- `34f00e8` — fired status for empty adapter runs; parity gap fix
- `1c899a2` — Polymarket Source 17 (72-6)
- `1b46965` — Pinterest Source 16 (72-5)
- `296b286` — TikTok/Instagram Sources 14–15 (72-3)

---

## Latest Tech Information

**Source:** ScrapeCreators MCP descriptors + operator brief (2026-06-20)

- API base `https://api.scrapecreators.com`, auth `x-api-key` header only
- Threads `user/posts`: returns `like_count`, `reshare_count`, `direct_reply_count`, `repost_count`, caption, `code`, `taken_at` — **20–30 post window per user**
- Threads `search`: documented as **≤10 results per request**; operator live test returned **"Endpoint not found"** on docs site — **T0 mandatory**
- ScrapeCreators: **no rate limit** on query frequency — structural weakness is result volume per call, not throttling
- Reuses existing `SCRAPECREATORS_API_KEY` and credit budget from 72-3
- URL pattern: `https://www.threads.com/@{handle}/post/{code}`

---

## Project Context Reference

- Constitution: `specs/cns-vault-contract/AGENTS.md` — no direct AI-Context edits
- Nexus principle: `project-context.md` — adapters in Node; no last30days subprocess
- Validator bugfix spec: `_bmad-output/implementation-artifacts/spec-morning-digest-convex-contributor-engagement-validator.md`
- Epic 72 handoff: `docs/HANDOFF-2026-06-20-post-epic72-3-session.md`
- peopleMatch: `68-3-personal-relevance-v3-people-bonus.md`, `~/.hermes/nexus-people.yaml`
- Verify gate: `bash scripts/verify.sh` mandatory before done
- Deferred SSOT: `deferred-work.md` — cross-repo registry SSOT still deferred; parity test guards drift
- Mutation audit: N/A (read-only adapters)

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor)

### Debug Log References

- T0 probe command + results (2026-06-20 session)

### Completion Notes List

**T0 spike (binding — reported before implementation):**

```bash
curl -sS -o /tmp/threads-search.json -w '%{http_code}' \
  -H "x-api-key: ${SCRAPECREATORS_API_KEY}" \
  "https://api.scrapecreators.com/v1/threads/search?query=ai&trim=true"
# HTTP status: 200
# Body snippet: {"success":true,"credits_remaining":58,"posts":[{"id":"3869303810309417924_71115666349",...}]}

curl -sS -o /tmp/threads-user-posts.json -w '%{http_code}' \
  -H "x-api-key: ${SCRAPECREATORS_API_KEY}" \
  "https://api.scrapecreators.com/v1/threads/user/posts?handle=karpathy&trim=true"
# HTTP status: 200
# Body snippet: {"success":true,"credits_remaining":57,"posts":[{"id":"3851718899906387951_63491345281","caption":{"text":"What does it mean...
```

**T0 decision:** Search endpoint is **live** (contrary to operator docs-site "Endpoint not found" report). Keyword supplement **wired** as optional secondary behind `MORNING_DIGEST_THREADS_KEYWORDS` + `THREADS_SEARCH_ENDPOINT_AVAILABLE=true`. Handle-watchlist remains **primary** — not demoted.

**Three-list-class audit (T10):**
1. Parity test — 18 collect keys, SECTION_MAP rows, empty fixture `{ threads: { posts: [] } }` — `digest-source-registry-parity.test.mjs` green
2. Mutation fixture — `buildCanonicalThreadsDigestSignal()` via production `buildDigestPushPayload()` — `digest.test.ts` calls real `digest:addDigestSignal`
3. Health registry — 18th row `{ sourceKey: 'threads', label: 'Threads' }` — `digest-source-health.test.ts` expects 18 rows; Convex prod deploy completed to `amiable-ox-862`

**Metadata fields emitted (validator-bound only):** `likes`, `reposts`, `replies`, `authorHandle`, `author`, `publishedAt` — mirrors X/Bluesky (not `commentCount` slot; reposts stay in `reposts` field per existing validator).

**Verify:** `bash scripts/verify.sh` PASSED (1203 tests). Hermes skill synced. Convex prod deploy: `CONVEX_DEPLOYMENT=amiable-ox-862 npx convex deploy` → success.

### File List

- `scripts/hermes-skill-examples/morning-digest/scripts/fetch-threads-signals.mjs` (NEW)
- `scripts/session-close/hermes-run-threads.sh` (NEW)
- `tests/fixtures/threads-digest-signal.fixture.mjs` (NEW)
- `tests/morning-digest-threads-adapter.test.mjs` (NEW)
- `scripts/hermes-skill-examples/morning-digest/scripts/build-digest-push-payload.mjs`
- `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs`
- `scripts/hermes-skill-examples/morning-digest/scripts/dedupe-digest-signals.mjs`
- `scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs`
- `scripts/hermes-skill-examples/morning-digest/scripts/parse-digest-source-outcomes.mjs`
- `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md`
- `scripts/hermes-skill-examples/morning-digest/SKILL.md`
- `scripts/run-digest-convex-completion.mjs`
- `scripts/lib/digest-source-registry-parity.mjs`
- `scripts/trend-ingest.env.example`
- `tests/digest-source-registry-parity.test.mjs`
- `tests/morning-digest-build-payload.test.mjs`
- `tests/morning-digest-score-signals.test.mjs`
- `tests/morning-digest-pick-signal-notebook.test.mjs`
- `tests/hermes-morning-digest-skill.test.mjs`
- `tests/digest-run-outcome.test.mjs`
- `../cns-dashboard/convex/validators.ts`
- `../cns-dashboard/convex/lib/digest_source_registry.ts`
- `../cns-dashboard/src/lib/utils/nexus-digest-feed.ts`
- `../cns-dashboard/tests/convex/digest.test.ts`
- `../cns-dashboard/tests/convex/digest-source-health.test.ts`
- `../cns-dashboard/tests/lib/nexus-digest-feed.test.ts`
- `../cns-dashboard/tests/lib/nexus-source-health.test.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-06-20: Code review patches — SKILL.md 9–18 gate, keyword fatal break, orchestrator/push/401 tests, wrapper executable assertion
- 2026-06-20: Story 72-7 — Source 18 Threads adapter (ScrapeCreators handle-watchlist primary, optional keyword supplement after T0 pass); registry/schema/skill parity; Epic 72 env example backfill; Convex prod deploy

---

## Story Completion Status

- Status: **done**
- T0: search endpoint **live** (HTTP 200) — keyword path enabled as optional supplement; handles remain primary
- Verify + Hermes sync + Convex prod deploy complete
