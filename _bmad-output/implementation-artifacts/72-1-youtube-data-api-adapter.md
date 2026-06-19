---
story_id: 72-1
epic: 72
title: youtube-data-api-adapter
status: done
baseline_commit: b8deec110b70e7168efd2d841c3258e6a8f6b5a0
operator_brief: 2026-06-19
predecessors: 68-1, 68-4, 70-1, 71-3
blocks: 72-2
repo: cross-repo (Omnipotent.md adapter + cns-dashboard schema)
fr_ids: FR-1, FR-2, FR-3, FR-4, FR-5
priority: P1
---

# Story 72.1: YouTube Data API v3 Adapter (Source 13)

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a **CNS operator receiving the morning digest**,
I want **a YouTube Data API v3 query-watchlist adapter that surfaces recent AI-relevant videos with engagement metadata**,
so that **the digest regains a high-signal social/video source after Reddit platform closure, using a self-service API key with predictable daily quota and no OAuth approval queue**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 72 — Source Expansion: YouTube (first source-expansion epic since Reddit platform closure 2026-06-19) |
| **Priority** | **P1** — Reddit Source 8 is closed (`deferred-work.md` §Story 67-2); YouTube replaces lost social signal with API-key-only onboarding |
| **Repo** | **Cross-repo** — schema: `cns-dashboard/convex/validators.ts`; adapter + pipeline: Omnipotent.md |
| **Predecessors** | **68-1** (dedup engine — add `youtube` to `SOURCE_PRIORITY` only); **68-4** (schema literal pattern for new source types); **70-1** (`collectAdapterOutputs` orchestrator); **71-3** (structured run outcomes / source health) |
| **Blocks** | **72-2** (live digest validation + Operator Guide env docs — expected follow-on) |
| **Normative pattern** | Mirror **GitHub query-watchlist** (`fetch-github-signals.mjs` + `hermes-run-github.sh`) and **NewsAPI** env/config loading — not Reddit OAuth or Python subprocess |
| **Out of scope** | Removing Reddit adapter (keep graceful `(source unavailable)` — platform closure is final); YouTube OAuth; channel-subscription feeds; live chat; transcript ingestion; dashboard UI chips; `trend-ingest.py` unification; npm packages; changes to dedupe/scoring **formulas** beyond new `youtube` branches |

### Operator brief (binding — 2026-06-19)

| Requirement | Value |
|-------------|-------|
| API | YouTube Data API v3, **API key only** (Google Cloud Console → enable YouTube Data API v3 → create API key) |
| Auth | No OAuth, no Google approval queue (unlike Reddit app registration) |
| Quota | 10,000 free units/day default project quota |
| `search.list` cost | **100 units** per call |
| `videos.list` cost | **1 unit** per video (batch up to 50 IDs per request) |
| Daily budget @ 10 queries | ~**1,025 units** (10×100 search + ~25 enrich) — **~10× headroom** under 10k |
| Env vars | `MORNING_DIGEST_YOUTUBE_API_KEY`, `MORNING_DIGEST_YOUTUBE_QUERIES` |
| Search params | `publishedAfter` = 24h ago (RFC 3339), `type=video`, `order=date` |
| Enrichment | `videos.list` with `part=snippet,statistics` for `viewCount`, `likeCount`, `commentCount` |
| Pipeline | Output into existing `DigestSignal` shape → **unchanged** Epic 68 dedup → score → Convex push |

### Problem (current state)

| Gap | Today |
|-----|--------|
| No YouTube adapter | Sources 1–12 wired; no `fetch-youtube-signals.mjs` |
| Reddit closed | Source 8 returns platform errors; no engineering fix (`deferred-work.md` §67-2 closure) |
| Schema | `digestSourceTypeValue` / `digestSectionValue` lack `youtube`; `sourceMetadataValidator` lacks `viewCount` |
| Orchestrator | `collectAdapterOutputs()` in `run-digest-convex-completion.mjs` has no `youtube` task |
| Scoring | No `normalizeEngagement` branch for `youtube`; no `SOURCE_PRIOR` / `TREND_PROXY_PRIOR` entry |
| Dedup | `SOURCE_PRIORITY` in `dedupe-digest-signals.mjs` has no `youtube` key |
| Task-prompt | No Source 13 block; §9 mapping table has no `youtube` row |

### Target pipeline touchpoints

```text
… → hermes-run-youtube.sh → fetch-youtube-signals.mjs  ← NEW (72-1)
  → task-prompt Source 13 Discord + digest_sources.youtube
  → §9 map (videos[] → digestSignal rows)
  → dedupe-digest-signals.mjs (68-1, add SOURCE_PRIORITY.youtube only)
  → score-digest-signals.mjs (normalizeEngagement youtube branch) ← NEW
  → push-digest-convex.mjs
```

---

## Acceptance Criteria

### 1. Schema literals + sourceMetadata (AC: FR-1)

**Given** the cns-dashboard digest signal validators
**When** extended for YouTube
**Then** `digestSourceTypeValue` adds `v.literal('youtube')`
**And** `digestSectionValue` adds `v.literal('youtube')`
**And** `sourceMetadataValidator` adds optional `viewCount: v.optional(v.number())` (reuse existing `likes`, `commentCount`, `author`, `publishedAt` for other fields)
**And** push payload with `sourceType: 'youtube'`, `section: 'youtube'`, `sourceMetadata: { viewCount: 1000, likes: 50 }` passes `addDigestSignal`
**And** unknown literal still rejected
**And** `keywordSourceTypeValue` unchanged

**Apply in:** `cns-dashboard/convex/validators.ts` + `cns-dashboard/tests/convex/digest.test.ts`

### 2. YouTube fetch module stdout contract (AC: FR-2, FR-3)

**Given** `fetch-youtube-signals.mjs` under morning-digest scripts
**When** enabled and configured
**Then** stdout success shape:

```json
{
  "videos": [
    {
      "title": "Building AI agents with MCP — live demo",
      "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "channelTitle": "Example Channel",
      "publishedAt": "2026-06-18T14:30:00.000Z",
      "viewCount": 12500,
      "likeCount": 890,
      "commentCount": 142
    }
  ]
}
```

**And** process exits **0** always (never abort digest)
**And** credentials via `mergeTrendIngestEnv()` + `resolveOperatorHome()` — **never** `os.homedir()` alone
**And** requires `MORNING_DIGEST_YOUTUBE_API_KEY` when enabled
**And** requires `MORNING_DIGEST_YOUTUBE_QUERIES` (comma-separated search strings) when enabled
**And** **no new npm dependencies** — Node built-in `fetch` only

**Two-phase API flow (per query in watchlist):**

1. **`search.list`** — `GET https://www.googleapis.com/youtube/v3/search`
   - `part=snippet`
   - `q={encodeURIComponent(query)}`
   - `type=video`
   - `order=date`
   - `publishedAfter={RFC3339 UTC, now - lookbackHours}` (default **24**)
   - `maxResults={perQuery}` (default **3**)
   - `key={MORNING_DIGEST_YOUTUBE_API_KEY}`
   - Extract `items[].id.videoId` + snippet fields

2. **`videos.list`** — batch enrich (dedupe video IDs globally first)
   - `GET https://www.googleapis.com/youtube/v3/videos`
   - `part=snippet,statistics`
   - `id={comma-separated, max 50 per request}`
   - Map `statistics.viewCount`, `statistics.likeCount`, `statistics.commentCount` (API returns strings — parse to numbers)
   - URL: `https://www.youtube.com/watch?v={videoId}`

**Dedup:** by video ID / canonical URL across queries; respect `MORNING_DIGEST_YOUTUBE_MAX_VIDEOS` (default **25**, hard max **50**)

**Failure stdout:** `{"error":"<short reason>"}` (≤120 chars) — e.g. `youtube disabled`, `missing-api-key`, `missing-queries`, `http-403`, `quota-exceeded`

**Exports:** `runYoutubeFetch(env, options)` with injectable `fetch` + fixture JSON (mirror `runGithubFetch`)

**HTTP:** 15s timeout per request; optional 100ms delay between `search.list` calls (quota smoothing)

### 3. Configuration env contract (AC: FR-3)

| Variable | Purpose | Default |
|----------|---------|---------|
| `MORNING_DIGEST_YOUTUBE_API_KEY` | YouTube Data API v3 key | required when enabled |
| `MORNING_DIGEST_YOUTUBE_QUERIES` | Comma-separated search queries | required when enabled |
| `MORNING_DIGEST_YOUTUBE_ENABLED` | Falsy: `0`, `false`, `no`, `off` | enabled |
| `MORNING_DIGEST_YOUTUBE_LOOKBACK_HOURS` | Rolling window for `publishedAfter` | `24` |
| `MORNING_DIGEST_YOUTUBE_MAX_VIDEOS` | Global cap after dedupe | `25` |
| `MORNING_DIGEST_YOUTUBE_PER_QUERY` | `maxResults` per search.list | `3` |

**Quota guard (soft):** Log stderr warning when query count × 100 + maxVideos > 2000; do **not** hard-block (operator may run manual digest + cron once/day).

Store key in `~/.hermes/trend-ingest.env` (same file as `NEWSAPI_API_KEY`, `GITHUB_TOKEN`). **Never** print API key to stdout/stderr/Discord.

### 4. Shell wrapper + Hermes contract (AC: FR-2)

**Given** `scripts/session-close/hermes-run-youtube.sh`
**When** invoked from Hermes `terminal(...)` with `workdir=resolved_repo_root`
**Then** HOME isolation remap matches `hermes-run-github.sh` / `hermes-run-bluesky.sh`
**And** thin `exec node` on `fetch-youtube-signals.mjs`
**And** stdout key is **`videos[]` only** — never `repos[]`, `posts[]`, `headlines[]`, etc.

### 5. Source 13 in task-prompt.md + SKILL.md (AC: FR-4)

**Given** morning-digest task contract
**When** Source 13 is added
**Then** insert **after Source 12 (Bluesky), before Source 3 (Perplexity)**
**And** update strict collection order: `… → 11 → 12 → **13** → 3 → 6 → …`
**And** REQUIRED SOURCES checklist adds row **13 | YouTube | `hermes-run-youtube.sh`**
**And** Steps 9–12 gate becomes **Steps 9–13 gate** (Sources 9–13 must fire before Source 3 / Source 6)
**And** includes:
- `terminal(command="bash scripts/session-close/hermes-run-youtube.sh", workdir=resolved_repo_root, timeout=45)`
- Imperative stdout threading: `yt_stdout` → `JSON.parse` → `yt_json.videos[]` only
- Failure: **YouTube** header + `- (source unavailable: <short reason>)` → continue
- Discord bullets: `- <title> — <viewCount> views, <likeCount> likes` (use `title` text; `url` for §9 only — no bare URL link previews)
- Output contract template adds **YouTube** section after **Bluesky**
- `digest_sources` assembly adds `"youtube": [...]` with titles + engagement for `buildDigestSignals`

**§9 signal mapping table** adds row:

| Section | sourceType | Source data | title | summary | url | score | externalId |
|---------|------------|-------------|-------|---------|-----|-------|------------|
| `youtube` | `youtube` | Source 13 `videos[]` | `title` | first 200 chars of title | `url` | — | `sha256(url).slice(0,16)` |

**§9 sourceMetadata for YouTube:**

| stdout field | digestSignal field |
|--------------|-------------------|
| `viewCount` | `sourceMetadata.viewCount` |
| `likeCount` | `sourceMetadata.likes` |
| `commentCount` | `sourceMetadata.commentCount` |
| `channelTitle` | `sourceMetadata.author` |
| `publishedAt` | `sourceMetadata.publishedAt` |

**Strict-schema unions** extend `section` and `sourceType` with `youtube`.

**§9 assembly step 2** thread list adds `videos[]`.

### 6. Orchestrator integration (AC: FR-4)

**Given** `collectAdapterOutputs()` in `scripts/run-digest-convex-completion.mjs`
**When** deterministic digest runs (Epic 70 cron path)
**Then** add task `['youtube', () => runWrapper('hermes-run-youtube.sh', mergedEnv, 45_000)]` after `bluesky`, before Perplexity/deep-signal collection if applicable
**And** JSDoc on results object includes `youtube?: unknown`

### 7. Scoring + dedup branches (AC: FR-5)

**Given** `score-digest-signals.mjs`
**When** `normalizeEngagement({ sourceType: 'youtube', sourceMetadata: { viewCount, likes, commentCount } })`
**Then** weighted log-norm: **views 0.60, likes 0.30, comments 0.10**
**And** named caps (anti-drift): `YT_VIEWS_CAP = 1_000_000`, `YT_LIKES_CAP = 50_000`, `YT_COMMENTS_CAP = 10_000`
**And** requires at least one finite engagement field; all missing/zero → `null` (Path B momentum via prior)
**And** `SOURCE_PRIOR.youtube = 8` (between `reddit` 8 and `producthunt` 8 — tie ok; video signal high value)
**And** `TREND_PROXY_PRIOR.youtube = 40`
**And** `DigestSourceType` typedef includes `'youtube'`

**Given** `dedupe-digest-signals.mjs`
**When** merge priority resolves cross-source clusters
**Then** add `youtube: 4` to `SOURCE_PRIORITY` (between `rss: 4` and `reddit: 3` — video beats repo/social-low tiers; document in Completion Notes)
**And** add `viewCount` to `ENGAGEMENT_FIELDS` array for raw proxy

**Dedup/scoring pipeline logic unchanged** — only new type branches; do not modify merge algorithm, rankScore weights, or disposition thresholds.

### 8. buildDigestSignals integration (AC: FR-4)

**Given** `pick-signal-notebook.mjs`
**When** `digest_sources.youtube` present
**Then** export `extractYoutubeSignals()` — top **2** titles ranked by `viewCount` desc (fallback: `likeCount`)
**And** insert after Bluesky, before title dedupe cap-10
**And** extend `signalsFromParsedInput()` guard to include `youtube` key

### 9. Tests + verify gate (AC: FR-5)

**Given** implementation complete
**When** `bash scripts/verify.sh` runs from Omnipotent.md with sibling `cns-dashboard`
**Then** all tests pass including:
- `cns-dashboard/tests/convex/digest.test.ts` — accept youtube signal with `viewCount` + `likes`; reject invalid sourceType
- `tests/morning-digest-youtube-adapter.test.mjs` (new) — config, search+enrich parse, dedupe, quota error paths, disabled/missing-key
- `tests/morning-digest-score-signals.test.mjs` (extend) — youtube prior + normalizeEngagement fixture
- `tests/morning-digest-push-convex.test.mjs` (extend) — youtube `sourceType` passthrough
- `tests/hermes-morning-digest-skill.test.mjs` (extend) — Source 13 in task-prompt, `videos[]` threading, §9 mapping row
- `tests/morning-digest-pick-signal-notebook.test.mjs` (extend) — `extractYoutubeSignals` cap/sort

**And** run `bash scripts/install-hermes-skill-morning-digest.sh` after script/wrapper changes
**And** existing adapter tests remain green

### 10. Anti-drift boundaries (AC: scope)

**Given** this story's scope
**When** implementation completes
**Then** there is **no** OAuth flow, no Google client secret, no refresh tokens
**And** no removal of Reddit Source 8 (remains graceful-unavailable)
**And** no changes to `dedupeDigestSignals` merge algorithm beyond priority map + engagement field list
**And** no changes to rankScore weight constants
**And** no npm packages added
**And** no `last30days` import/subprocess (ADR-E67-001)

---

## Tasks / Subtasks

- [x] **T1** `cns-dashboard/convex/validators.ts` — `youtube` literals + `viewCount` in sourceMetadata (AC: 1)
- [x] **T2** `cns-dashboard/tests/convex/digest.test.ts` — validator coverage (AC: 1, 9)
- [x] **T3** `fetch-youtube-signals.mjs` + `hermes-run-youtube.sh` (AC: 2, 3, 4)
  - [x] `loadYoutubeConfig`, `searchVideosForQuery`, `enrichVideoStatistics`, `runYoutubeFetch`
  - [x] Two-phase search.list → videos.list with batching
  - [x] Dedupe by video ID; global cap
- [x] **T4** `score-digest-signals.mjs` — normalizeEngagement + priors (AC: 7)
- [x] **T5** `dedupe-digest-signals.mjs` — SOURCE_PRIORITY + ENGAGEMENT_FIELDS (AC: 7)
- [x] **T6** `run-digest-convex-completion.mjs` — collectAdapterOutputs youtube task (AC: 6)
- [x] **T7** `pick-signal-notebook.mjs` — extractYoutubeSignals + buildDigestSignals order (AC: 8)
- [x] **T8** `task-prompt.md` + `SKILL.md` — Source 13 block, §9 mapping, output contract (AC: 5)
- [x] **T9** Omnipotent.md tests (AC: 9)
- [x] **T10** Verify + Hermes sync (AC: 9)
  - [x] `bash scripts/verify.sh` green
  - [x] `bash scripts/install-hermes-skill-morning-digest.sh`

### Review Findings

- [x] [Review][Patch] Missing >50-ID `videos.list` batch boundary test — added `enrichVideoStatistics` test with 51 IDs forcing two `videos.list` calls. [`tests/morning-digest-youtube-adapter.test.mjs`]
- [x] [Review][Patch] **`videos` added to `ADAPTER_DATA_KEYS` (Epic 70/71 error-classification class)** — same bug class as Epic 70/71: adapters exit 0 with JSON stdout, so `collectAdapterOutputs` must not treat `{ error: "…" }` as success when a success data key is also present. Adding `videos` alongside `posts`, `events`, etc. prevents `{ error, videos: [] }` from being misread as a bare error payload and documents why the key must stay in the set (do not remove during cleanup). [`adapter-result.mjs`]
- [x] [Review][Patch] Orchestrator test for YouTube exit-0 error JSON — `parseAdapterStdout` + `isAdapterErrorPayload` + `buildErrorsBySource` lock `adapter-error:quota-exceeded` for YouTube. [`tests/run-digest-convex-completion.test.mjs`]
- [x] [Review][Patch] Enrich-phase quota-exceeded test — `runYoutubeFetch` with search ok + fatal `videos.list` 403. [`tests/morning-digest-youtube-adapter.test.mjs`]
- [x] [Review][Patch] Mid-loop search quota test — query 2 fatal abort proves query 3 never fetched. [`tests/morning-digest-youtube-adapter.test.mjs`]
- [x] [Review][Defer] Second `videos.list` batch unreachable at current caps — `MAX_VIDEOS_HARD` (50) equals `VIDEOS_LIST_BATCH_SIZE` (50), so production `runYoutubeFetch` never exercises multi-batch enrich; batching is defensive only until cap rises. [`fetch-youtube-signals.mjs:14-18`] — deferred, pre-existing design bound

---

## Dev Notes

### Cross-repo workflow (critical)

1. Schema changes in `../cns-dashboard/convex/validators.ts`
2. Adapter + tests in Omnipotent.md
3. Verify from Omnipotent.md: `bash scripts/verify.sh` (runs cns-dashboard tests when sibling exists; override `CNS_DASHBOARD_ROOT`)

### Canonical adapter pattern (mirror — do not reinvent)

| Concern | Copy from |
|---------|-----------|
| Query-watchlist loop | `fetch-github-signals.mjs` — `parseGithubQueries`, per-query fetch, dedupe, `runGithubFetch` export |
| Env merge / operator home | `fetch-arxiv-rss.mjs` — `mergeTrendIngestEnv`, `resolveOperatorHome` |
| Shell wrapper | `hermes-run-github.sh` — thin exec node |
| §9 test helper | `tests/morning-digest-github-adapter.test.mjs` — `githubRepoToDigestSignal` → `youtubeVideoToDigestSignal` |
| Schema literal gate | `68-4-schema-literals-twitter-bluesky.md` / `65-1` — extend unions before live push |
| Source N task-prompt block | `68-5-bluesky-adapter-source-12.md` — Source 12 insertion pattern |

### YouTube Data API v3 (Context7 — `/websites/developers_google_youtube_v3`)

**Authentication:** API key via `key` query parameter only — no Bearer token for this story.

**search.list** (quota **100 units**/call):
- Required: `part=snippet`, `q`
- Use: `type=video`, `order=date`, `publishedAfter` (RFC 3339 datetime)
- `maxResults`: 0–50 (use `MORNING_DIGEST_YOUTUBE_PER_QUERY`, default 3)
- Response: `items[].id.videoId`, `items[].snippet.title`, `publishedAt`, `channelTitle`

**videos.list** (quota **1 unit**/call):
- Required: `part` includes `statistics` for engagement
- Batch: up to **50** video IDs comma-separated in `id` param
- `statistics.viewCount`, `likeCount`, `commentCount` are **strings** in JSON — `parseInt` with finite guard

**Error handling:**
- HTTP 403 with `quotaExceeded` → `{"error":"quota-exceeded"}`
- HTTP 403 invalid key → `{"error":"http-403"}`
- Missing `items` → treat as empty for that query; continue other queries unless all fail

### Quota budget (operator reference)

| Operation | Count (default) | Units |
|-----------|-----------------|-------|
| search.list | 10 queries | 1,000 |
| videos.list | ~25 videos (deduped cap) | ~25 |
| **Daily total** | | **~1,025** |
| Free tier | | 10,000/day |

One cron run/day → safe. Manual re-runs same day: monitor quota via error shape.

### Reddit closure context (do not reopen)

Per `deferred-work.md` §Story 67-2 (2026-06-19): Reddit public JSON is platform-blocked. Source 8 stays wired for observability (`sources.reddit.status: error`) but **must not** receive engineering time in this story. YouTube is the replacement expansion vector.

### WriteGate / security

- **No vault writes** — adapter is read-only HTTP
- **No AGENTS.md edit** required for this story
- API key in env only — never commit to repo
- Package age rule: no new npm deps (built-in fetch satisfies)

### sourceMetadata field mapping rationale

Reuse existing Convex fields where possible:
- `likeCount` → `sourceMetadata.likes` (validator already has `likes`)
- `commentCount` → `sourceMetadata.commentCount`
- `channelTitle` → `sourceMetadata.author`
- `viewCount` → **new** optional field (no suitable existing field)

### Suggested normalizeEngagement sketch

```javascript
case 'youtube': {
  const views = meta.viewCount;
  const likes = meta.likes;
  const comments = meta.commentCount;
  const hasEngagement = [views, likes, comments].some(
    (v) => Number.isFinite(v) && Number(v) > 0,
  );
  if (!hasEngagement) return null;
  return Math.round(
    0.6 * logNorm(views, YT_VIEWS_CAP) +
    0.3 * logNorm(likes, YT_LIKES_CAP) +
    0.1 * logNorm(comments, YT_COMMENTS_CAP),
  );
}
```

### Files to touch

| File | Action |
|------|--------|
| `../cns-dashboard/convex/validators.ts` | UPDATE — youtube literals + viewCount |
| `../cns-dashboard/tests/convex/digest.test.ts` | UPDATE |
| `scripts/hermes-skill-examples/morning-digest/scripts/fetch-youtube-signals.mjs` | NEW |
| `scripts/session-close/hermes-run-youtube.sh` | NEW |
| `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs` | UPDATE |
| `scripts/hermes-skill-examples/morning-digest/scripts/dedupe-digest-signals.mjs` | UPDATE |
| `scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs` | UPDATE |
| `scripts/run-digest-convex-completion.mjs` | UPDATE |
| `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` | UPDATE |
| `scripts/hermes-skill-examples/morning-digest/SKILL.md` | UPDATE |
| `tests/morning-digest-youtube-adapter.test.mjs` | NEW |
| `tests/morning-digest-score-signals.test.mjs` | UPDATE |
| `tests/morning-digest-push-convex.test.mjs` | UPDATE |
| `tests/hermes-morning-digest-skill.test.mjs` | UPDATE |
| `tests/morning-digest-pick-signal-notebook.test.mjs` | UPDATE |

**Do NOT edit:** Reddit fetch script, dedupe merge algorithm core, rankScore weights, vault paths, AGENTS.md (72-2 may add Operator Guide §)

### Example operator env (`~/.hermes/trend-ingest.env`)

```bash
MORNING_DIGEST_YOUTUBE_API_KEY=AIza...
MORNING_DIGEST_YOUTUBE_QUERIES=AI agents MCP,Claude Code tutorial,LLM knowledge management,agentic workflow 2026
```

### Testing notes

- **No live network in CI** — mock `fetch` with fixture search.list + videos.list JSON
- Test quota-exceeded 403 body parsing
- Test string statistics → number mapping
- Test dedupe across overlapping queries returning same videoId
- Test `youtubeVideoToDigestSignal` → `normalizeEngagement` non-null for fixture with views

---

## Previous Story Intelligence

No prior story in Epic 72. Relevant cross-epic learnings:

| Story | Learning |
|-------|----------|
| **65-1** | Schema literals must land **before** Convex push; cross-repo verify gate |
| **68-5** | Source N insertion after prior source; `posts[]` key discipline → use `videos[]` |
| **68-8** | §9 map construction gate — never dedupe empty signals |
| **70-1** | Orchestrator `collectAdapterOutputs` is SSOT for deterministic cron |
| **71-3** | `sourceOutcomes` observability — youtube success/error surfaces in run record |
| **67-2 closure** | Do not invest in Reddit; YouTube is the intended replacement path |

---

## Git Intelligence

Recent commits show epic closure hygiene and Reddit→public-JSON pivot (now closed). Follow established patterns:
- Node `.mjs` adapters with fixture-injectable `run*Fetch`
- Thin bash wrappers in `scripts/session-close/`
- Contract tests in `tests/hermes-morning-digest-skill.test.mjs` for task-prompt presence

---

## Latest Tech Information

**Source:** Context7 `/websites/developers_google_youtube_v3` (queried 2026-06-19)

- `search.list`: `publishedAfter` accepts RFC 3339 datetime; `order=date` sorts by date; `type=video` restricts to videos; maxResults 0–50
- `videos.list`: 1 quota unit; use `part=snippet,statistics`; statistics counts are strings
- API key passed as `key=` query param on all requests
- Default quota 10,000 units/day per Google Cloud project (confirm in Cloud Console → APIs → YouTube Data API v3 → Quotas)

---

## Project Context Reference

- Constitution: `specs/cns-vault-contract/AGENTS.md` v2.1.5 — no direct vault AI-Context edits
- Nexus principle: `project-context.md` — adapters owned in Node; no last30days subprocess
- Deferred: `_bmad-output/implementation-artifacts/deferred-work.md` — Reddit closed; YouTube is new expansion
- Verify gate: `bash scripts/verify.sh` mandatory before done
- Mutation audit: N/A (read-only adapter)

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor)

### Debug Log References

- Two-phase adapter: per-query `search.list` collects video IDs + snippet; global dedupe; batched `videos.list` (≤50 IDs) merges string statistics into stdout `videos[]`.
- Fatal errors (`quota-exceeded`, `http-403`) return immediately; per-query non-fatal search failures log stderr and continue (sanctioned API — not Reddit-style graceful degradation).
- `SOURCE_PRIORITY.youtube = 4` (between `bluesky: 5` and `rss: 4` tie at video tier).

### Completion Notes List

- Added Source 13 YouTube adapter (`fetch-youtube-signals.mjs` + `hermes-run-youtube.sh`) with API-key auth, two-phase search→enrich, dedupe, quota soft-warning.
- Extended cns-dashboard validators (`youtube` literals + `sourceMetadata.viewCount`).
- Wired orchestrator, build-digest-push-payload, scoring (`normalizeEngagement` 0.60/0.30/0.10), dedup priority + `viewCount` engagement field, pick-signal `extractYoutubeSignals`.
- Updated task-prompt Source 13 block, §9 mapping, SKILL.md collection order (12 → 13 → 3 → 6).
- No changes to Reddit/X/Bluesky adapter scripts.
- `bash scripts/verify.sh` PASS; Hermes skill installed.

### File List

- `../cns-dashboard/convex/validators.ts`
- `../cns-dashboard/tests/convex/digest.test.ts`
- `scripts/hermes-skill-examples/morning-digest/scripts/fetch-youtube-signals.mjs`
- `scripts/session-close/hermes-run-youtube.sh`
- `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs`
- `scripts/hermes-skill-examples/morning-digest/scripts/dedupe-digest-signals.mjs`
- `scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs`
- `scripts/hermes-skill-examples/morning-digest/scripts/build-digest-push-payload.mjs`
- `scripts/run-digest-convex-completion.mjs`
- `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md`
- `scripts/hermes-skill-examples/morning-digest/SKILL.md`
- `tests/morning-digest-youtube-adapter.test.mjs`
- `tests/morning-digest-score-signals.test.mjs`
- `tests/morning-digest-push-convex.test.mjs`
- `tests/hermes-morning-digest-skill.test.mjs`
- `tests/morning-digest-pick-signal-notebook.test.mjs`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-06-19: Story 72-1 — YouTube Data API v3 adapter (Source 13), schema literals, pipeline wiring, tests, Hermes sync.

---

## Story Completion Status

- Status: **review**
- Ultimate context engine analysis completed — comprehensive developer guide created
- Next: `/bmad-dev-story` in fresh chat; then `bash scripts/verify.sh`; Operator Guide env docs deferred to **72-2**
