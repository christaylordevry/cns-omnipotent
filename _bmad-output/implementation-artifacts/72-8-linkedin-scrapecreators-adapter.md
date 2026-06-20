---
story_id: 72-8
epic: 72
title: linkedin-scrapecreators-adapter
status: done
baseline_commit: 73301ea
operator_brief: 2026-06-20
predecessors: 72-3, 72-5, 72-6, 72-7, 68-2, 68-3, 68-4, 70-1, 72-2
blocks: 72-4
repo: cross-repo (Omnipotent.md adapters + cns-dashboard schema)
fr_ids: FR-1, FR-2, FR-3, FR-4, FR-5
priority: P1
---

# Story 72.8: LinkedIn ScrapeCreators Adapter (Source 19)

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a **CNS operator receiving the morning digest**,
I want **a LinkedIn signal adapter via ScrapeCreators (API-key only) wired as Source 19 using dual primary watchlists — `MORNING_DIGEST_LINKEDIN_COMPANIES` and `MORNING_DIGEST_LINKEDIN_PROFILES`**,
so that **professional intelligence — company positioning, hiring signals, B2B/founder discourse — enters the digest with engagement scoring, registry/orchestrator parity across all three list-classes, and Convex push validators that cannot repeat the Polymarket/Threads health-panel drift failures**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 72 — Source Expansion (continues ScrapeCreators 72-3/72-5/72-7 + Polymarket 72-6) |
| **Priority** | **P1** — professional intelligence layer; **no new credential** (reuses `SCRAPECREATORS_API_KEY`) |
| **Repo** | **Cross-repo** — schema: `cns-dashboard/convex/validators.ts`; adapters + pipeline: Omnipotent.md |
| **Predecessors** | **72-3** (ScrapeCreators HTTP + error class + Google-index caveat pattern), **72-7** (handle/company watchlist + three-list-class gate + env example discipline), **72-5/72-6** (registry parity + canonical fixture SSOT), **72-2** (parity test gate), **68-2/68-3** (people watchlist + `peopleMatch` bonus), **68-4** (schema literals), **70-1** (orchestrator) |
| **Vendor** | ScrapeCreators — `https://api.scrapecreators.com`, auth header `x-api-key`, env `SCRAPECREATORS_API_KEY` |
| **Source number** | **19** (after Threads 18, before Perplexity 3) |
| **Strategic framing** | **Professional intelligence layer** — company/hiring/B2B narrative — **not** a generic social trend source. Low keyword-search volume is a **source characteristic**, not a malfunction. |
| **Out of scope** | OAuth; LinkedIn official API; npm ScrapeCreators SDK; `last30days` subprocess; vault writes; keyword-search-as-primary; ad-library endpoints in v1; scoring on work history / job title fields |

### Operator brief (binding — 2026-06-20)

| Requirement | Value |
|-------------|-------|
| Auth | Single `x-api-key` header — **no OAuth**, same key as 72-3/72-5/72-7 |
| Env (primary — companies) | `SCRAPECREATORS_API_KEY` (already set), **`MORNING_DIGEST_LINKEDIN_COMPANIES`** — company page URLs/slugs only |
| Env (primary — founders) | **`MORNING_DIGEST_LINKEDIN_PROFILES`** — founder/operator profile URLs/vanity slugs only |
| Env (optional secondary) | **`MORNING_DIGEST_LINKEDIN_KEYWORDS`** — opportunistic supplement only |
| Watchlist routing | **No URL-shape inference** — list membership determines endpoint (`COMPANIES` → `company/posts`, `PROFILES` → `profile` recent posts) |
| ScrapeCreators endpoints (6 total) | `GET /v1/linkedin/profile`, `GET /v1/linkedin/company`, `GET /v1/linkedin/company/posts`, `GET /v1/linkedin/search/posts`, `GET /v1/linkedin/post`, `GET /v1/linkedin/ad` (+ `ads/search`, `post/transcript` exist — **skip v1**) |
| **Confirmed search endpoint** | `GET /v1/linkedin/search/posts` — **Google-index-backed, NOT real-time** (same caveat class as Instagram 72-3). ScrapeCreators: uses Google Search to find indexed posts, then scrapes public LinkedIn pages. |
| **T0 spike (required, non-blocking for ship)** | Live `curl` probe `GET /v1/linkedin/search/posts?query=ai+agents&date_posted=last-week` — confirm returns usable volume; **weak/thin keyword results are NOT a reason to deprioritize or block this story** because company-watchlist is the primary value driver |
| **Default pattern** | **Dual primary watchlists** — `MORNING_DIGEST_LINKEDIN_COMPANIES` + `MORNING_DIGEST_LINKEDIN_PROFILES` (mirror Threads handles + GitHub query lists as separate env vars) — **NOT** keyword search |
| Watchlist targets | AI agencies/consultancies, founder/operator voices in AI automation/RevOps/GTM, company pages for AI infra + hiring posts — adjacent to Threads handle list but professionally framed |
| Keyword search role | **Secondary/opportunistic supplement only** — narrow keyword list; document loudly that results lag actual posting activity |
| Profile endpoint limitation | Person `profile` does **NOT** return work history or job title (LinkedIn platform restriction on public data — **not** adapter bug). Do **not** design scoring around those fields. |
| Company posts pagination | `company/posts` supports page-based pagination — **max 7 pages** (LinkedIn platform limitation per ScrapeCreators). v1: fetch **page 1 only** per company unless operator env explicitly requests deeper pagination (cap at 7). |
| Registry | Source **19** — extend **all three list-classes** (see AC 6) |
| Validator gate (critical) | Canonical fixture via **`buildDigestPushPayload()`** — same SSOT pattern as Threads/Polymarket (72-7/72-6) |
| Deploy gate (critical) | Before claiming live-verifiable: confirm **`npx convex deploy`** to production completed (`cns-dashboard` — no `--prod` flag); spot-check `npx convex run digest:getDigestSourceHealth` |

### Problem (current state)

| Gap | Today |
|-----|--------|
| No LinkedIn adapter | Sources 1–18 wired; no `fetch-linkedin-signals.mjs` |
| Schema | `digestSourceTypeValue` / `digestSectionValue` lack `linkedin` |
| Orchestrator | `COLLECT_ADAPTER_TASK_KEYS` ends at `threads` |
| Registry parity | 18 rows in `DIGEST_SOURCE_SECTION_MAP` / `DIGEST_SOURCE_HEALTH_REGISTRY` |
| Health panel | Separate list from SECTION_MAP — three-list-class incident class (72-6/72-7) |
| Scoring/dedup | No `normalizeEngagement` or `SOURCE_PRIORITY` branch for `linkedin` |
| Collection order | Skill/task-prompt ends at Source 18 before Perplexity |
| Env example | `scripts/trend-ingest.env.example` has Epic 72 blocks through Threads — **missing LinkedIn** |
| Strategic UX | No task-prompt framing that LinkedIn is professional intelligence, not trend chatter |

### Target pipeline touchpoints

```text
… → hermes-run-threads.sh (18)
  → hermes-run-linkedin.sh → fetch-linkedin-signals.mjs   ← NEW Source 19
  → hermes-run-perplexity.sh (Source 3)
  → pick-signal-notebook / §9 map / dedupe / score / push
```

**Collection order update:** `… → 17 → 18 → **19** → 3 → 6`

---

## Acceptance Criteria

### 0. T0 spike — live search/posts probe (AC: required design input, non-blocking for ship)

**Given** `SCRAPECREATORS_API_KEY` is set in operator env
**When** dev runs T0 before implementing keyword supplement
**Then** execute live probe (document command + HTTP status + body snippet in Completion Notes):

```bash
curl -sS -o /tmp/linkedin-search-posts.json -w '%{http_code}' \
  -H "x-api-key: ${SCRAPECREATORS_API_KEY}" \
  "https://api.scrapecreators.com/v1/linkedin/search/posts?query=ai+agents&date_posted=last-week"
```

**And** record result volume (post count) and sample field shapes in Completion Notes
**And** if response is thin/sparse/empty:
- **Still ship** company-watchlist primary adapter (primary pattern unaffected)
- Wire keyword path only as optional supplement; document `search-thin-results` in Completion Notes
- **Do not** file regressions or deprioritize story — Google-index lag is expected (same class as Instagram Source 15)

**And** regardless of search outcome, probe **`GET /v1/linkedin/company/posts?url=https://www.linkedin.com/company/anthropic&page=1`** succeeds — this is the primary path

**And** probe **`GET /v1/linkedin/profile?url=https://www.linkedin.com/in/{known-founder}`** succeeds for founder entries in watchlist — document which public fields are present; confirm **work history / job title absent** on public profile response

### 1. Schema literals (AC: FR-1)

**Given** cns-dashboard digest signal validators
**When** extended for LinkedIn
**Then** `digestSourceTypeValue` adds `v.literal('linkedin')`
**And** `digestSectionValue` adds `v.literal('linkedin')`
**And** existing `sourceMetadataValidator` fields suffice for v1 push:
- `likes`, `commentCount`, `author`, `authorHandle`, `publishedAt` — mirror Threads/X/Bluesky social slots
- **No new metadata keys** unless T0 response exposes engagement with no existing slot (prefer reuse)
- **Do not** add `jobTitle`, `workHistory`, `headcount`, or other profile-only fields to validator for v1
**And** push payloads with `sourceType`/`section` `linkedin` pass **`digest:addDigestSignal`** (real mutation)
**And** nested `contributingSources[]` accepts engagement keys dedupe copies from `ENGAGEMENT_FIELDS`

**Apply in:** `cns-dashboard/convex/validators.ts` + `cns-dashboard/tests/convex/digest.test.ts`

**Validator wiring checklist (mandatory before done):**

1. Trace `digest:addDigestSignal` → confirm `digestSignalInputValidator`.
2. Implement §9 mapping in `build-digest-push-payload.mjs` first.
3. List every key written to `signal.sourceMetadata` for LinkedIn.
4. Confirm each key on `sourceMetadataValidator` (+ nested contributor schema if in `ENGAGEMENT_FIELDS`).
5. Add `tests/fixtures/linkedin-digest-signal.fixture.mjs` exporting `buildCanonicalLinkedinDigestSignal()` via **`buildDigestPushPayload()`** — **not** a hand-rolled test double.
6. Import fixture in `digest.test.ts` → call `t.mutation('digest:addDigestSignal', …)` → assert stored document.
7. Extend `tests/morning-digest-build-payload.test.mjs` with LinkedIn builder path + metadata key guard.

Reference: `_bmad-output/implementation-artifacts/spec-morning-digest-convex-contributor-engagement-validator.md`

### 2. ScrapeCreators HTTP client contract (AC: FR-2)

**Given** `fetch-linkedin-signals.mjs`
**When** calling ScrapeCreators
**Then** base URL `https://api.scrapecreators.com`
**And** header `x-api-key: ${SCRAPECREATORS_API_KEY}` on every request
**And** **no new npm dependencies** — Node built-in `fetch` only
**And** credentials via `mergeTrendIngestEnv()` + `resolveOperatorHome()` — key in `~/.hermes/trend-ingest.env`
**And** never print API key to stdout/stderr/Discord
**And** HTTP timeout **15s** per request; **100ms** delay between watchlist/keyword iterations
**And** process **always exits 0** — failures return `{"error":"<short reason>"}` stdout (≤120 chars)
**And** reuse `classifyScrapeCreatorsHttpError` from 72-3 (402 → `credit-exhausted`, 401/403 fatal)

**Credit awareness:** Log stderr one-line warning when watchlist entry count × estimated credits exceeds soft threshold; do **not** hard-block cron.

**Endpoint map (v1 usage):**

| Endpoint | v1 role |
|----------|---------|
| `GET /v1/linkedin/company/posts?url={companyUrl}&page={n}` | **Primary** — one call per `MORNING_DIGEST_LINKEDIN_COMPANIES` entry (page 1 default; max page 7) |
| `GET /v1/linkedin/profile?url={profileUrl}` | **Primary** — one call per `MORNING_DIGEST_LINKEDIN_PROFILES` entry; extract **recent posts** only |
| `GET /v1/linkedin/search/posts?query={kw}&date_posted=last-week` | **Optional secondary** — only when env keywords set + T0 documented |
| `GET /v1/linkedin/company?url={companyUrl}` | **Skip v1** — metadata-only; do not burn credits per company unless needed for validation |
| `GET /v1/linkedin/post?url={postUrl}` | **Skip v1** — no URL-ingest path in digest |
| `GET /v1/linkedin/ad`, `ads/search`, `post/transcript` | **Skip v1** — ad library / transcript out of scope |

### 3. LinkedIn adapter stdout contract (AC: FR-2, FR-3)

**Given** `fetch-linkedin-signals.mjs`
**When** enabled and configured
**Then** stdout success shape:

```json
{
  "posts": [
    {
      "title": "Post text trimmed",
      "url": "https://www.linkedin.com/posts/...",
      "author": "Anthropic",
      "authorHandle": "anthropic",
      "publishedAt": "2026-06-19T14:30:00.000Z",
      "likes": 420,
      "commentCount": 38,
      "postId": "7123456789012345678",
      "sourceKind": "company"
    }
  ]
}
```

**And** stdout key is **`posts[]` only** — collect key `linkedin` distinguishes from Threads `posts[]` in separate adapter processes (same pattern as twitter + bluesky + threads)

**Primary flow — two explicit watchlists (no URL-shape inference):**

- Parse **`MORNING_DIGEST_LINKEDIN_COMPANIES`** comma-separated — **company entries only**:
  - Full URLs: `https://www.linkedin.com/company/{slug}`
  - Bare slugs: `anthropic` → normalize to `https://www.linkedin.com/company/anthropic`
  - Per entry: `GET /v1/linkedin/company/posts?url={normalizedCompanyUrl}&page=1` (optional pages 2–7 when `MORNING_DIGEST_LINKEDIN_MAX_PAGES` > 1, hard cap **7**)
- Parse **`MORNING_DIGEST_LINKEDIN_PROFILES`** comma-separated — **founder/operator profile entries only**:
  - Full URLs: `https://www.linkedin.com/in/{vanity}`
  - Bare vanity slugs: `karpathy` → normalize to `https://www.linkedin.com/in/karpathy`
  - Per entry: `GET /v1/linkedin/profile?url={normalizedProfileUrl}` → map **recent posts** from profile payload (ignore work history / job title fields even if nested in response)
- **At least one** of `COMPANIES` or `PROFILES` must be set when enabled — return `missing-watchlist` when both empty (keywords alone do **not** satisfy primary watchlist)
- Map API post objects → stdout rows:
  - `title` ← post description/text (trimmed)
  - `url` ← canonical post URL when present
  - `author` / `authorHandle` ← company name or profile vanity slug (enables **peopleMatch** where vanity overlaps `nexus-people.yaml`)
  - `likes` ← reaction/like count when exposed
  - `commentCount` ← comment count when exposed
  - `publishedAt` ← ISO when date present
  - `postId` ← stable id for dedupe + `externalId`
  - `sourceKind` ← `company` \| `profile` (stderr/summary only — **omit from Convex push** unless added to validator first)
- Dedupe by `postId` / canonical URL across all watchlist entries
- Respect `MORNING_DIGEST_LINKEDIN_MAX_POSTS` (default **15**, hard max **30**)
- Respect `MORNING_DIGEST_LINKEDIN_PER_TARGET` (default **5** posts per company/profile fetch)
- Client-side lookback filter when `publishedAt` present (`MORNING_DIGEST_LINKEDIN_LOOKBACK_HOURS`, default **168**)

**Optional secondary — keyword supplement (T0 documented):**

- Parse `MORNING_DIGEST_LINKEDIN_KEYWORDS` (comma-separated, **max 5** keywords enforced in code)
- Per keyword: `GET /v1/linkedin/search/posts?query={keyword}&date_posted=last-week` (+ cursor pagination only if T0 shows value — cap **1 page** per keyword in v1)
- Merge into watchlist results with dedupe
- Do **not** run keyword path when env unset

**Mandatory documentation (adapter header + task-prompt — LOUD):**

> **Professional intelligence layer:** LinkedIn signals reflect company positioning, hiring narratives, and B2B/founder discourse — not real-time trend chatter.
>
> **Keyword search (`/v1/linkedin/search/posts`) is Google-index-backed.** Results reflect what Google has indexed, **not** a live LinkedIn-native feed. Sparse or stale keyword results **may lag actual posting activity** — this is a **source characteristic**, not a bug to fix later.
>
> **Public profile endpoint** does not return work history or job title on current LinkedIn public pages — do not design scoring or digest copy around those fields.

**Failure stdout examples:** `linkedin disabled`, `missing-api-key`, `missing-watchlist`, `http-401`, `http-403`, `credit-exhausted`, `search-thin-results`

**Exports:** `runLinkedinFetch(env, options)` with injectable `fetch` + fixtures (mirror `runThreadsFetch` / `runTiktokFetch`)

| Variable | Purpose | Default |
|----------|---------|---------|
| `SCRAPECREATORS_API_KEY` | Shared with TikTok/Instagram/Pinterest/Threads | required when enabled |
| `MORNING_DIGEST_LINKEDIN_COMPANIES` | Comma-separated company page URLs/slugs — **company list only** | at least one of `COMPANIES` or `PROFILES` required when enabled |
| `MORNING_DIGEST_LINKEDIN_PROFILES` | Comma-separated founder/operator profile URLs/vanity slugs — **profile list only** | at least one of `COMPANIES` or `PROFILES` required when enabled |
| `MORNING_DIGEST_LINKEDIN_KEYWORDS` | Optional keyword supplement (T0 documented) | unset = disabled |
| `MORNING_DIGEST_LINKEDIN_ENABLED` | Falsy: `0`, `false`, `no`, `off` | enabled |
| `MORNING_DIGEST_LINKEDIN_MAX_POSTS` | Global cap after dedupe | `15` |
| `MORNING_DIGEST_LINKEDIN_PER_TARGET` | Max posts per company/profile fetch | `5` |
| `MORNING_DIGEST_LINKEDIN_PER_KEYWORD` | Max posts per keyword search | `5` |
| `MORNING_DIGEST_LINKEDIN_MAX_PAGES` | Company posts pagination depth (hard max **7**) | `1` |
| `MORNING_DIGEST_LINKEDIN_LOOKBACK_HOURS` | Client-side filter when `publishedAt` present | `168` |

### 4. Shell wrapper + Hermes contract (AC: FR-4)

**Given** `scripts/session-close/hermes-run-linkedin.sh`
**When** invoked from Hermes `terminal(...)` with `workdir=resolved_repo_root`
**Then** HOME isolation remap matches `hermes-run-threads.sh` / `hermes-run-polymarket.sh`
**And** thin `exec node` on `fetch-linkedin-signals.mjs`
**And** stdout reads **`posts[]` only**
**And** wrapper timeout **60s** (company pagination may need slightly longer than Threads 45s)

### 5. Source 19 in task-prompt.md + SKILL.md (AC: FR-4)

**Given** morning-digest task contract
**When** Source 19 is added
**Then** insert **after Source 18 (Threads), before Source 3 (Perplexity)**
**And** update strict collection order: `… → 18 → **19** → 3 → 6`
**And** REQUIRED SOURCES checklist adds row **19 | LinkedIn**
**And** Steps 9–18 gate becomes **Steps 9–19 gate**
**And** Source 3 gate: Perplexity fires **after Source 19**

**Source 19 block includes:**

- `terminal(command="bash scripts/session-close/hermes-run-linkedin.sh", workdir=resolved_repo_root, timeout=60)`
- Imperative stdout: `li_stdout` → `JSON.parse` → `li_json.posts[]` only
- Failure: **LinkedIn** header + `- (source unavailable: <short reason>)` → continue to Source 3
- Discord bullets: `- <author>: <title> — <likes> likes, <commentCount> comments`
- **Professional intelligence framing** (2–3 sentences): company/hiring/B2B narrative layer — not generic social trends
- **Google-index keyword caveat** (one sentence, mandatory): keyword results are indexed/search-derived and may lag actual posting activity
- **Profile limitation callout**: public profiles do not expose work history/job title — do not expect those fields in signals
- **Dual watchlist callout**: `MORNING_DIGEST_LINKEDIN_COMPANIES` (company pages) + `MORNING_DIGEST_LINKEDIN_PROFILES` (founder voices) are **both primary**; do not mix entry types across lists

**§9 mapping table** adds:

| Section | sourceType | Source data | title | summary | url | externalId |
|---------|------------|-------------|-------|---------|-----|------------|
| `linkedin` | `linkedin` | Source 19 `posts[]` | `title` | first 200 chars of `title` | `url` | `postId` or `sha256(url).slice(0,16)` |

**§9 sourceMetadata (Convex push — validator-bound fields only):**

| stdout field | digestSignal field | Notes |
|--------------|-------------------|-------|
| `likes` | `sourceMetadata.likes` | primary engagement |
| `commentCount` | `sourceMetadata.commentCount` | primary engagement |
| `authorHandle` | `sourceMetadata.authorHandle` | company slug or profile vanity — **peopleMatch** when overlaps nexus-people (68-3) |
| `author` | `sourceMetadata.author` | display name |
| `publishedAt` | `sourceMetadata.publishedAt` | when present |

**Do not push** raw API blobs, `sourceKind`, work history, job title, headcount, or ad metadata unless added to validator first.

**digest_sources assembly** adds `"linkedin": [...]` with engagement for `buildDigestSignals`

**Strict-schema unions** extend `section` and `sourceType` with `linkedin`

### 6. Orchestrator + registry parity — three list-classes (AC: FR-4, FR-5)

**Given** `collectAdapterOutputs()` in `scripts/run-digest-convex-completion.mjs`
**When** deterministic digest runs
**Then** add task after `threads`:

```javascript
['linkedin', () => runWrapper('hermes-run-linkedin.sh', mergedEnv, 60_000)],
```

**And** extend `COLLECT_ADAPTER_TASK_KEYS` + `COLLECT_ADAPTER_WRAPPER_BY_KEY` in same commit

**CRITICAL — three separate list-classes (2026-06-20 incident lesson):**

All three must be updated in **one commit** and **explicitly verified** before done — passing `digest-source-registry-parity.test.mjs` alone is **insufficient** if health UI list drifts.

| # | List class | Location | Verify |
|---|------------|----------|--------|
| **1** | Parity test five-list gate | `tests/digest-source-registry-parity.test.mjs` + `scripts/lib/digest-source-registry-parity.mjs` | `bash scripts/verify.sh` — structural assert **19** collect keys, SECTION_MAP rows, payload keys |
| **2** | Convex mutation args validator | `cns-dashboard/convex/validators.ts` → `digestSignalInputValidator` → `sourceMetadataValidator` | `digest.test.ts` calls real `digest:addDigestSignal` with **`buildCanonicalLinkedinDigestSignal()`** from production `buildDigestPushPayload()` |
| **3** | Source health reporting list | `cns-dashboard/convex/lib/digest_source_registry.ts` → **`DIGEST_SOURCE_HEALTH_REGISTRY`** | `digest-source-health.test.ts` asserts **19 rows**; **post-deploy** `npx convex run digest:getDigestSourceHealth` returns LinkedIn row |

**Registry parity sweep (update ALL in one commit):**

| Location | Add |
|----------|-----|
| `DIGEST_SOURCE_SECTION_MAP` | `linkedin` row + label patterns (`/linkedin/i`, `/hiring/i` optional) |
| `SECTION_LITERAL_TO_SOURCE_KEY` | `linkedin` |
| `cns-dashboard/convex/lib/digest_source_registry.ts` | **19th health row** `{ sourceKey: 'linkedin', label: 'LinkedIn' }` |
| `cns-dashboard/convex/validators.ts` | `linkedin` literals |
| `cns-dashboard/src/lib/utils/nexus-digest-feed.ts` | badge **`LI`** |
| `ADAPTER_PAYLOAD_ARRAY_KEYS` | confirm `posts` already listed (shared key — no new entry unless parity test requires comment) |
| `EMPTY_ADAPTER_SUCCESS_DATA` in parity test | `{ linkedin: { posts: [] } }` |
| `tests/digest-source-registry-parity.test.mjs` | must pass without weakening assertions |

**Post-deploy verification (mandatory before "live-verifiable" claim):**

```bash
cd ../cns-dashboard && npx convex deploy   # production — no --prod flag
CONVEX_DEPLOYMENT=amiable-ox-862 npx convex run digest:getDigestSourceHealth
# Confirm 19 rows including { sourceKey: 'linkedin', label: 'LinkedIn' }
```

### 7. Scoring + dedup branches (AC: FR-5)

**Given** `score-digest-signals.mjs`
**When** `normalizeEngagement` for `linkedin`
**Then** mirror **Threads/X** social weights on `likes` + `commentCount`:
- **0.60** × logNorm(likes, cap) + **0.40** × logNorm(commentCount, cap) — professional discourse weights comments slightly higher than repost-heavy social
- Or mirror exact Threads weights if simpler — **read existing Threads branch first**
**And** all missing/zero engagement → `null` (Path B momentum)
**And** **do not** incorporate job title, headcount, or work-history fields (they are absent/unreliable)
**And** `SOURCE_PRIOR.linkedin = 9` (high-signal professional tier — align with threads/twitter)
**And** `TREND_PROXY_PRIOR.linkedin = 45` (after threads 44 — adjust to maintain monotonic ordering)
**And** extend `DigestSourceType` typedef

**Given** `dedupe-digest-signals.mjs`
**When** merge priority resolves clusters
**Then** add `linkedin: 4` to `SOURCE_PRIORITY` (same tier as `twitter: 4`, `threads: 4`, `youtube: 4`)
**And** `likes`, `commentCount` already in `ENGAGEMENT_FIELDS`

**peopleMatch integration (68-3 — verify, do not rebuild):**

- When `authorHandle` (profile vanity or known founder slug) matches `~/.hermes/nexus-people.yaml`, scoring emits `sourceMetadata.peopleMatch`
- Company-page posts may not peopleMatch — expected; do not force-match company slugs to people entries

**Do not** modify merge algorithm core, rankScore weights, or disposition thresholds.

### 8. buildDigestSignals integration (AC: FR-4)

**Given** `pick-signal-notebook.mjs`
**When** `digest_sources.linkedin` present
**Then** export `extractLinkedinSignals()` — top **2** posts by engagement score desc (likes + 2×commentCount)
**And** insert after Threads, before title dedupe cap-10
**And** extend `signalsFromParsedInput()` guard keys

### 9. Tests + verify gate (AC: FR-5)

**Given** implementation complete
**When** `bash scripts/verify.sh` runs
**Then** all tests pass including:

- `tests/fixtures/linkedin-digest-signal.fixture.mjs` — **NEW** — `buildCanonicalLinkedinDigestSignal()` via production `buildDigestPushPayload()`
- `cns-dashboard/tests/convex/digest.test.ts` — imports fixture; **`addDigestSignal accepts linkedin signal with social metadata + authorHandle`**
- `tests/morning-digest-build-payload.test.mjs` — LinkedIn builder + metadata key guard
- `cns-dashboard/tests/lib/nexus-digest-feed.test.ts` — `formatDigestSourceBadge('linkedin')` → `'LI'`
- `cns-dashboard/tests/convex/digest-source-health.test.ts` — **19** registry rows (list-class #3)
- `cns-dashboard/tests/lib/nexus-source-health.test.ts` — **19** rows if applicable
- `tests/morning-digest-linkedin-adapter.test.mjs` (new) — config, separate `COMPANIES` vs `PROFILES` list parsing (no cross-list URL inference), post mapping, dedupe across both lists, `missing-watchlist` when both empty, disabled/missing-key, 401/402, keyword path skipped when unset, profile response ignores work-history fields, `buildCanonicalLinkedinDigestSignal` shape
- `tests/morning-digest-score-signals.test.mjs` (extend) — linkedin `normalizeEngagement`; no scoring on absent job-title fields
- `tests/morning-digest-push-convex.test.mjs` (extend) — sourceType passthrough
- `tests/hermes-morning-digest-skill.test.mjs` (extend) — Source 19 block, `posts[]` threading, §9 rows, collection order, professional-intelligence + Google-index disclaimers
- `tests/morning-digest-pick-signal-notebook.test.mjs` (extend) — extract helper
- `tests/digest-source-registry-parity.test.mjs` — green (list-class #1)
- `tests/run-digest-convex-completion.test.mjs` (extend) — linkedin success/error outcome counts
- `tests/digest-run-outcome.test.mjs` (extend) — linkedin success/error outcome counts

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
**Then** there is **no** keyword-search-primary mode (dual company/profile watchlists are primary regardless of T0)
**And** **no** URL-shape inference routing profiles through `COMPANIES` or companies through `PROFILES`
**And** **no** OAuth or LinkedIn official API
**And** **no** new ScrapeCreators credential beyond existing `SCRAPECREATORS_API_KEY`
**And** **no** `last30days` import/subprocess
**And** **no** ad-library / single-post URL / company-metadata-only credit burn in v1
**And** **no** scoring on work history, job title, or headcount
**And** other ScrapeCreators adapters unchanged except shared env merge if needed

### 11. Operator env example file — LinkedIn block (AC: FR-4)

**Given** `scripts/trend-ingest.env.example` (Epic 72 blocks through Threads from 72-7)
**When** Story 72-8 completes
**Then** add commented **LinkedIn — Source 19 (Story 72-8)** section in **same PR** — mirror Threads block style
**And** place after Threads block, before analytics soak section
**And** include professional-intelligence + Google-index keyword caveat in comment lines

**LinkedIn — Source 19 (Story 72-8):**

```bash
# MORNING_DIGEST_LINKEDIN_COMPANIES=anthropic,openai,cursor,n8n-io
# MORNING_DIGEST_LINKEDIN_PROFILES=simonw,karpathy,sama,emollick
# MORNING_DIGEST_LINKEDIN_ENABLED=1
# MORNING_DIGEST_LINKEDIN_MAX_POSTS=15
# MORNING_DIGEST_LINKEDIN_PER_TARGET=5
# MORNING_DIGEST_LINKEDIN_MAX_PAGES=1
# MORNING_DIGEST_LINKEDIN_LOOKBACK_HOURS=168
# Optional — opportunistic keyword supplement (Google-index-backed; may lag posting activity):
# MORNING_DIGEST_LINKEDIN_KEYWORDS=ai agents,mcp servers,revops automation
# Note: COMPANIES + PROFILES are dual primary watchlists (do not mix entry types). Keyword search is secondary. Profile endpoint does not return work history/job title.
```

**And** operator may swap watchlist values — consistency of **having** the example block matters more than specific slugs

---

## Tasks / Subtasks

- [x] **T0** Live spike — `curl` probe `/v1/linkedin/search/posts` + confirm `/v1/linkedin/company/posts` + `/v1/linkedin/profile`; document pass/fail/thin volume + absent profile fields in Completion Notes (AC: 0)
- [x] **T1** `cns-dashboard/convex/validators.ts` — `linkedin` literals (AC: 1)
- [x] **T2** `tests/fixtures/linkedin-digest-signal.fixture.mjs` + `digest.test.ts` + `morning-digest-build-payload.test.mjs` — **full mutation fixture via production builder** (AC: 1, 9 — list-class #2)
- [x] **T3** `fetch-linkedin-signals.mjs` + `hermes-run-linkedin.sh` — dual primary watchlists (`COMPANIES` + `PROFILES`, no URL-shape inference); optional keyword supplement (AC: 2, 3, 4)
- [x] **T4** Registry parity sweep — SECTION_MAP, **HEALTH_REGISTRY (list-class #3)**, SECTION_LITERAL_TO_SOURCE_KEY, badges, parity test empty fixture (AC: 6)
- [x] **T5** `run-digest-convex-completion.mjs` — collect task + JSDoc (AC: 6)
- [x] **T6** `score-digest-signals.mjs` + `dedupe-digest-signals.mjs` — no job-title/work-history scoring (AC: 7)
- [x] **T7** `pick-signal-notebook.mjs` + `build-digest-push-payload.mjs` — extract helper + §9 mapping (AC: 8)
- [x] **T8** `task-prompt.md` + `SKILL.md` + **`scripts/trend-ingest.env.example`** — Source 19 skill contract with professional-intelligence framing + LinkedIn env block (AC: 5, 11)
- [x] **T9** Omnipotent.md + dashboard tests (AC: 9)
- [x] **T10** **Three-list-class audit** — document explicit verification of parity test, mutation fixture, and health registry row count; trace every emitted metadata field (AC: 1, 6, 9)
- [x] **T11** Verify + Hermes sync + **Convex prod deploy** (AC: 9, 6)
  - [x] `bash scripts/verify.sh` green
  - [x] `bash scripts/install-hermes-skill-morning-digest.sh`
  - [x] `cd ../cns-dashboard && CONVEX_DEPLOYMENT=amiable-ox-862 npx convex deploy` — prod push succeeded
  - [x] Health registry **19 rows** including `linkedin` — verified via `digest-source-health.test.ts` + prod deploy (live `getDigestSourceHealth` requires `digestRunId` arg)

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
| Dual primary watchlist loop | `fetch-threads-signals.mjs` — per-target fetch + dedupe; **two env lists** like X accounts + people.yaml overlap pattern |
| ScrapeCreators HTTP + error class | `fetch-tiktok-signals.mjs` — `classifyScrapeCreatorsHttpError`, `x-api-key`, 402 handling |
| Google-index freshness caveat | `fetch-instagram-signals.mjs` — loud task-prompt disclaimer for non-real-time search |
| Env merge / operator home | `fetch-arxiv-rss.mjs` — `mergeTrendIngestEnv`, `resolveOperatorHome` |
| Shell wrapper | `hermes-run-threads.sh` |
| §9 + mutation fixture SSOT | `tests/fixtures/threads-digest-signal.fixture.mjs` + `build-digest-push-payload.mjs` |
| Registry parity (three lists) | `72-7` — extend ALL lists in **one commit**; verify health registry + live `getDigestSourceHealth` |
| GitHub query-watchlist shape | `fetch-github-signals.mjs` — comma-separated watchlist env parsing |
| peopleMatch | `68-3` — emit `authorHandle` from profile vanity when available |

### ScrapeCreators LinkedIn API reference

**Base:** `https://api.scrapecreators.com`

**Auth:** `x-api-key: SCRAPECREATORS_API_KEY`

**Company posts (primary):**

```http
GET /v1/linkedin/company/posts?url=https://www.linkedin.com/company/anthropic&page=1
x-api-key: ...
```

Returns post URL, ID, publication date, full text. Pagination **max 7 pages** (LinkedIn platform limit).

**Profile (primary for founder entries):**

```http
GET /v1/linkedin/profile?url=https://www.linkedin.com/in/karpathy
x-api-key: ...
```

Returns name, photo, about, **recent posts**, follower count. **Work history and job title are NOT reliably available** on public profiles — do not map or score them.

**Keyword search (optional secondary — Google-index-backed):**

```http
GET /v1/linkedin/search/posts?query=ai+agents&date_posted=last-week
x-api-key: ...
```

Best-effort indexed results; may lag actual posting activity. Pass `cursor` for next page when needed.

**Single post (skip v1):**

```http
GET /v1/linkedin/post?url=https://www.linkedin.com/posts/...
```

**MCP tool names (manual validation):** `v1_linkedin_company_posts`, `v1_linkedin_profile`, `v1_linkedin_search_posts`, `v1_linkedin_company`, `v1_linkedin_post`, `v1_linkedin_ad`

**Docs:** https://docs.scrapecreators.com/openapi.json

### Watchlist normalization sketch (two lists — no cross-list inference)

```javascript
function normalizeLinkedinCompanyEntry(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const slug = trimmed.replace(/^company\//i, '');
  return `https://www.linkedin.com/company/${slug}`;
}

function normalizeLinkedinProfileEntry(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const vanity = trimmed.replace(/^in\//i, '');
  return `https://www.linkedin.com/in/${vanity}`;
}

// loadLinkedinConfig: companies[] from MORNING_DIGEST_LINKEDIN_COMPANIES only
// profiles[] from MORNING_DIGEST_LINKEDIN_PROFILES only
// missing-watchlist when both arrays empty
```

### Three list-classes — mandatory reading

2026-06-20: **`digest-source-registry-parity.test.mjs` passed** after Polymarket (72-6) landed, but **source health panel did not show Polymarket** until `DIGEST_SOURCE_HEALTH_REGISTRY` was confirmed deployed to Convex prod.

**For LinkedIn, before done:**

1. Update all three list-classes in one commit.
2. Run `bash scripts/verify.sh` (covers #1 + #2 via tests).
3. Run `npx convex deploy` in cns-dashboard (activates #3 in prod).
4. Run `npx convex run digest:getDigestSourceHealth` — confirm **19 rows** with `linkedin`.

Reference: Story 72-7 Completion Notes — live prod verification pattern.

### Validator wiring lesson (mandatory)

Production failure class: adapter emits fields validators do not declare → **`digest:addDigestSignal` rejects entire push**. Fix is validator alignment + regression test calling the **real mutation** via **`buildDigestPushPayload()`** fixture.

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
| `../cns-dashboard/convex/lib/digest_source_registry.ts` | UPDATE — 19th health row |
| `../cns-dashboard/src/lib/utils/nexus-digest-feed.ts` | UPDATE — badge `LI` |
| `../cns-dashboard/tests/convex/digest.test.ts` | UPDATE — linkedin mutation via fixture |
| `../cns-dashboard/tests/convex/digest-source-health.test.ts` | UPDATE — 19 rows |
| `../cns-dashboard/tests/lib/nexus-digest-feed.test.ts` | UPDATE |
| `../cns-dashboard/tests/lib/nexus-source-health.test.ts` | UPDATE |
| `tests/fixtures/linkedin-digest-signal.fixture.mjs` | NEW |
| `scripts/hermes-skill-examples/morning-digest/scripts/fetch-linkedin-signals.mjs` | NEW |
| `scripts/session-close/hermes-run-linkedin.sh` | NEW |
| `scripts/hermes-skill-examples/morning-digest/scripts/parse-digest-source-outcomes.mjs` | UPDATE — SECTION_MAP row |
| `scripts/lib/digest-source-registry-parity.mjs` | UPDATE — section literal |
| `scripts/run-digest-convex-completion.mjs` | UPDATE |
| `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs` | UPDATE |
| `scripts/hermes-skill-examples/morning-digest/scripts/dedupe-digest-signals.mjs` | UPDATE |
| `scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs` | UPDATE |
| `scripts/hermes-skill-examples/morning-digest/scripts/build-digest-push-payload.mjs` | UPDATE |
| `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` | UPDATE |
| `scripts/hermes-skill-examples/morning-digest/SKILL.md` | UPDATE |
| `scripts/trend-ingest.env.example` | UPDATE — LinkedIn Source 19 block (AC: 11) |
| `tests/morning-digest-linkedin-adapter.test.mjs` | NEW |
| `tests/morning-digest-build-payload.test.mjs` | UPDATE |
| `tests/morning-digest-score-signals.test.mjs` | UPDATE |
| `tests/morning-digest-push-convex.test.mjs` | UPDATE |
| `tests/hermes-morning-digest-skill.test.mjs` | UPDATE |
| `tests/morning-digest-pick-signal-notebook.test.mjs` | UPDATE |
| `tests/run-digest-convex-completion.test.mjs` | UPDATE |
| `tests/digest-run-outcome.test.mjs` | UPDATE |
| `tests/digest-source-registry-parity.test.mjs` | UPDATE — empty fixture for `linkedin` |

**Do NOT edit:** TikTok/Instagram/Pinterest/Polymarket/Threads adapters (except shared constants), dedupe merge core, rankScore weights

### Example operator env (`~/.hermes/trend-ingest.env`)

```bash
SCRAPECREATORS_API_KEY=sc_...   # shared — already set from 72-3
MORNING_DIGEST_LINKEDIN_COMPANIES=anthropic,openai,cursor,n8n-io
MORNING_DIGEST_LINKEDIN_PROFILES=simonw,karpathy,sama,emollick
MORNING_DIGEST_LINKEDIN_MAX_POSTS=15
MORNING_DIGEST_LINKEDIN_PER_TARGET=5
# Optional — Google-index-backed; sparse results expected:
# MORNING_DIGEST_LINKEDIN_KEYWORDS=ai agents,revops automation
```

---

## Previous Story Intelligence

| Story | Learning |
|-------|----------|
| **72-7** | Three-list-class gate + live `getDigestSourceHealth` after deploy; handle-watchlist primary; T0 search non-blocking; env example backfill discipline; `buildCanonical*DigestSignal()` SSOT |
| **72-6** | Canonical fixture via `buildDigestPushPayload()`; **`npx convex deploy`** before live claims |
| **72-5** | ScrapeCreators `x-api-key`, map engagement to existing validator fields |
| **72-3** | `classifyScrapeCreatorsHttpError`, Google-index Instagram caveat — **same pattern for LinkedIn search/posts** |
| **72-2** | **Registry drift is the default failure mode** — three list-classes must all be updated |
| **72-1** | Query/handle-watchlist adapter shape; cross-repo verify |
| **68-3** | `peopleMatch` bonus requires `authorHandle` — map profile vanity slugs |
| **70-1** | `collectAdapterOutputs` is cron SSOT — wire orchestrator in same commit as skill |
| **73301ea** | Threads Source 18 landed — extend to 19, do not re-backfill Epic 72 env blocks except LinkedIn slice |

---

## Git Intelligence

Follow Epic 72 commits: Node `.mjs` adapters, thin bash wrappers, contract tests in `hermes-morning-digest-skill.test.mjs`, registry parity in same commit as schema literals. 72-7 pattern: adapter + orchestrator + three-list audit + fixture SSOT + `npx convex deploy` + live health query.

Recent commits:
- `73301ea` — Threads Source 18 (72-7), env example backfill
- `34f00e8` — fired status for empty adapter runs; parity gap fix
- `1c899a2` — Polymarket Source 17 (72-6)
- `1b46965` — Pinterest Source 16 (72-5)
- `296b286` — TikTok/Instagram Sources 14–15 (72-3)

---

## Latest Tech Information

**Source:** ScrapeCreators MCP descriptors + operator brief (2026-06-20)

- API base `https://api.scrapecreators.com`, auth `x-api-key` header only
- LinkedIn `company/posts`: post URL, ID, date, text; pagination **max 7 pages**
- LinkedIn `profile`: name, about, recent posts, followers — **work history/job title not reliably on public pages**
- LinkedIn `search/posts`: **Google-index-backed** — description explicitly states Google Search → scrape public pages; use `date_posted` filter; cursor pagination
- Reuses existing `SCRAPECREATORS_API_KEY` and credit budget from 72-3
- Strategic value: professional intent, company positioning, hiring signals, B2B/founder discourse — not real-time trend volume

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

- T0 probe via ScrapeCreators MCP (2026-06-20 session) — binding gate before implementation

### Completion Notes List

**T0 spike (binding — reported before implementation):**

| Probe | Result |
|-------|--------|
| `GET /v1/linkedin/search/posts?query=ai+agents&date_posted=last-week` | HTTP 200, **10 posts** — fields: `url`, `datePublished`, `description`, `author{name,url}`, `likeCount`, `commentCount`. Keyword path **viable** as optional supplement (`LINKEDIN_SEARCH_ENDPOINT_AVAILABLE=true`). |
| `GET /v1/linkedin/company/posts?url=.../anthropic&page=1` | HTTP 200, `posts:[]` (empty — company page sparse at probe time) |
| `GET /v1/linkedin/company/posts?url=.../openai&page=1` | HTTP 200, **5 posts** — fields: `url`, `id`, `datePublished`, `text` (no engagement on company payload) |
| `GET /v1/linkedin/profile?url=.../karpathy` | 404 private/not publicly available |
| `GET /v1/linkedin/profile?url=.../emollick` | HTTP 200 — `name`, `followers`, `recentPosts[]` with `link`, `id`, `title`, `datePublished`; `experience:[]`, `education:[]` — **no job title / work history on public profile** |

**Decision:** Ship dual primary watchlists (`COMPANIES` + `PROFILES`); wire keyword supplement as optional secondary only.

**Three-list-class audit (T10):**

1. **Parity test (#1):** `digest-source-registry-parity.test.mjs` — 19 collect keys, SECTION_MAP, payload keys; `linkedin: { posts: [] }` empty fixture.
2. **Mutation fixture (#2):** `buildCanonicalLinkedinDigestSignal()` via production `buildDigestPushPayload()`; `digest.test.ts` calls real `digest:addDigestSignal`.
3. **Health registry (#3):** `DIGEST_SOURCE_HEALTH_REGISTRY` 19th row `{ sourceKey: 'linkedin', label: 'LinkedIn' }`; `digest-source-health.test.ts` expects 19 rows; prod deploy succeeded.

**Metadata fields pushed (validator-bound only):** `likes`, `commentCount`, `authorHandle`, `author`, `publishedAt` — no `postId`, `sourceKind`, job title, or work history.

**Verify:** `bash scripts/verify.sh` green; Hermes skill synced to `~/.hermes/skills/cns/morning-digest`.

### File List

- `../cns-dashboard/convex/validators.ts`
- `../cns-dashboard/convex/lib/digest_source_registry.ts`
- `../cns-dashboard/src/lib/utils/nexus-digest-feed.ts`
- `../cns-dashboard/tests/convex/digest.test.ts`
- `../cns-dashboard/tests/convex/digest-source-health.test.ts`
- `../cns-dashboard/tests/lib/nexus-digest-feed.test.ts`
- `../cns-dashboard/tests/lib/nexus-source-health.test.ts`
- `scripts/hermes-skill-examples/morning-digest/scripts/fetch-linkedin-signals.mjs`
- `scripts/session-close/hermes-run-linkedin.sh`
- `scripts/hermes-skill-examples/morning-digest/scripts/build-digest-push-payload.mjs`
- `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs`
- `scripts/hermes-skill-examples/morning-digest/scripts/dedupe-digest-signals.mjs`
- `scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs`
- `scripts/hermes-skill-examples/morning-digest/scripts/parse-digest-source-outcomes.mjs`
- `scripts/run-digest-convex-completion.mjs`
- `scripts/lib/digest-source-registry-parity.mjs`
- `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md`
- `scripts/hermes-skill-examples/morning-digest/SKILL.md`
- `scripts/trend-ingest.env.example`
- `tests/fixtures/linkedin-digest-signal.fixture.mjs`
- `tests/morning-digest-linkedin-adapter.test.mjs`
- `tests/morning-digest-build-payload.test.mjs`
- `tests/morning-digest-score-signals.test.mjs`
- `tests/morning-digest-push-convex.test.mjs`
- `tests/morning-digest-pick-signal-notebook.test.mjs`
- `tests/hermes-morning-digest-skill.test.mjs`
- `tests/digest-source-registry-parity.test.mjs`
- `tests/digest-run-outcome.test.mjs`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-06-20: Story 72-8 — LinkedIn Source 19 adapter, three-list-class registry parity, T0 spike documented, Convex prod deploy
- 2026-06-20: Code review — karpathy-404 partial-failure regression tests + orchestrator parity tests added

### Review Findings

- [x] [Review][Patch] Missing karpathy-404 / private-profile partial-failure test [`tests/morning-digest-linkedin-adapter.test.mjs`] — **applied**: two tests (HTTP 200 `success:false` + `errorStatus:404`, and HTTP 404) mixed with successful `company/posts`; assert `posts[]` not top-level `{ error }`
- [x] [Review][Patch] `run-digest-convex-completion.test.mjs` missing LinkedIn adapter-error/success parity [`tests/run-digest-convex-completion.test.mjs`] — **applied**: `missing-watchlist` + success stdout cases mirroring Threads/Polymarket
- [x] [Review][Patch] No unit test for 7-page hard cap on `MORNING_DIGEST_LINKEDIN_MAX_PAGES` [`tests/morning-digest-linkedin-adapter.test.mjs`] — **applied**: `loadLinkedinConfig` asserts `maxPages === 7` when env is `99`

**Dismissed (operator-bound / not defects):**
- List-class #3 health registry live on `amiable-ox-862` — settled per operator prod query (19 rows, `linkedin` present)
- `status: unknown` / `inferenceMode: inferred` on predates-LinkedIn digest run — expected until next full collect with env vars

---

## Story Completion Status

- Status: **done**
- T0: complete — search/posts returned 10 indexed posts; company/posts primary path confirmed on openai; profile lacks work history/job title on public pages
- Three-list-class gate verified; Convex prod deploy complete
