---
story_id: 68-6
epic: 68
title: x-twitter-adapter-source-11
status: done
baseline_date: 2026-06-11
baseline_commit: 316e36c
operator_brief: 2026-06-11
predecessors: 68-1, 68-4, 68-5
blocks: 68-7, 68-8
repo: Omnipotent.md only
fr_ids: FR-11, FR-12, FR-13, FR-14
priority: P3
operator_override: cookie-graphql-via-bird-search
---

# Story 68.6: X/Twitter Adapter (Source 11) — Cookie GraphQL via bird-search

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a **CNS operator receiving the morning digest in `#hermes`**,
I want **a native X/Twitter adapter (Source 11) wired into the morning-digest pipeline using browser session cookies and the vendored bird-search GraphQL client**,
so that **curated AI-community posts appear in Discord and Convex with `sourceType: 'twitter'`, engagement fields normalize into `rankScore`, and the digest degrades gracefully when `X_AUTH_TOKEN` / `X_CT0` are absent — without official X API v2, Python subprocesses, or WSL-incompatible browser cookie extraction**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 68 — Source Expansion: X/Twitter, Bluesky, Cross-Source Dedup |
| **Priority** | **P3** — highest narrative signal; **operator-gated** on session cookies |
| **Repo** | **Omnipotent.md only** — adapter, vendored bird-search, shell wrapper, task-prompt, scoring branch, tests |
| **Predecessors** | **68-1** (done) — dedup already ranks `twitter: 6` in `SOURCE_PRIORITY`; **68-4** (ready-for-dev) — Convex must accept `sourceType: 'twitter'` before live push; **68-5** (done) — mirror adapter/integration pattern for Source 12 |
| **Blocks** | **68-7** (extended env docs, credential health check, integration polish); **68-8** (live validation may document X NO-GO when cookies missing) |
| **Normative spec** | `prd-epic-68-2026-06-11/prd.md` §4.4 (FR-11..FR-14); `addendum.md` §A1; `docs/ADR-E67-001-last30days-codebook-only.md` |
| **Out of scope** | Official X API v2 / `X_BEARER_TOKEN` path (operator override — see below); `@steipete/sweet-cookie` / Safari-Chrome cookie reads (WSL incompatible); Python subprocess of last30days; `cns-dashboard` validator edits (68-4); monthly API budget guard (68-7 — N/A for cookie GraphQL); vault WriteGate; Nexus inspector UI |

### Operator binding override (supersedes PRD §4.4 bearer-token wording)

The PRD originally described `X_BEARER_TOKEN` and X API v2 Basic tier. **Operator direction for this repo is binding:**

| Decision | Implementation |
|----------|----------------|
| **Auth mechanism** | Vendored **bird-search** Node library (subset of `@steipete/bird` v0.8.0, MIT) — X internal **GraphQL SearchTimeline** via browser session cookies |
| **Cookie source** | `X_AUTH_TOKEN` + `X_CT0` in `~/.hermes/trend-ingest.env` (loaded via `mergeTrendIngestEnv` + `resolveOperatorHome()`) |
| **No sweet-cookie** | **Never** import `@steipete/sweet-cookie` or read browser cookie stores — WSL incompatible. Always set `BIRD_DISABLE_BROWSER_COOKIES=1` before credential resolution |
| **Graceful degrade** | Missing either cookie → stdout `{"error":"X credentials not configured"}` (or shorter variant ≤120 chars); exit **0**; task-prompt shows `(source unavailable: …)` for X section only |
| **No official API** | Do not call `api.twitter.com/2/*`; do not add `X_BEARER_TOKEN` requirement |
| **ADR-E67-001** | Study `last30days-skill-reference/.../bird_x.py` and `vendor/bird-search/` **read-only** for field mapping and query patterns; **never** subprocess last30days Python |

**Credential mapping:** bird-search's `cookies.js` reads `AUTH_TOKEN` / `CT0` / `TWITTER_*` aliases. The CNS adapter **must** map operator keys before search:

```javascript
// In loadXConfig / before SearchClient construction:
process.env.AUTH_TOKEN = env.X_AUTH_TOKEN ?? env.AUTH_TOKEN ?? '';
process.env.CT0 = env.X_CT0 ?? env.CT0 ?? '';
process.env.BIRD_DISABLE_BROWSER_COOKIES = '1';
```

Document `X_AUTH_TOKEN` / `X_CT0` as the **canonical** operator-facing names in `trend-ingest.env.example`. Accept legacy `AUTH_TOKEN`/`CT0` as aliases when `X_*` unset.

### Problem (current state)

| Gap | Today |
|-----|--------|
| No X fetch script | Sources 1–10 + 12 wired; no `fetch-x-signals.mjs` |
| No Source 11 in task-prompt | Gate is Sources 9–10–12 before Source 6; X slot missing |
| No engagement branch | `normalizeEngagement()` has no `case 'twitter':` |
| No Hermes wrapper | No `hermes-run-x.sh` |
| No bird-search vendor | GraphQL client not vendored into Omnipotent.md |

Dedup engine already includes `twitter` in merge priority — no 68-1 changes needed when twitter signals land.

### Target pipeline touchpoints

```text
… → hermes-run-x.sh → fetch-x-signals.mjs  ← NEW (68-6)
  → task-prompt Source 11 Discord + digest_sources.twitter
  → §9 map (posts[] → digestSignal rows)
  → dedupe-digest-signals.mjs (68-1, unchanged)
  → score-digest-signals.mjs (normalizeEngagement twitter branch) ← NEW
  → push-digest-convex.mjs
```

**Source order (binding):** Source **11** inserts **after Source 10 (Product Hunt), before Source 12 (Bluesky)**. Expand Steps 9–12 gate to **Sources 9, 10, 11, and 12** before Source 6.

---

## Acceptance Criteria

### 1. Vendored bird-search (env-only auth) (AC: FR-12, operator override)

**Given** `scripts/hermes-skill-examples/morning-digest/scripts/vendor/bird-search/` is added
**When** the vendor tree is inspected
**Then** it contains the bird-search subset from `last30days-skill-reference/.../vendor/bird-search/` (MIT license preserved in vendor README or package.json)
**And** `lib/cookies.js` is patched so credential resolution:
- Reads `X_AUTH_TOKEN`, `X_CT0`, `AUTH_TOKEN`, `CT0`, `TWITTER_AUTH_TOKEN`, `TWITTER_CT0` from env
- **Never** dynamic-imports `@steipete/sweet-cookie` (remove or stub browser path; env-only when `BIRD_DISABLE_BROWSER_COOKIES=1`)
**And** adapter imports `SearchClient` via `withSearch(TwitterClientBase)` **directly in Node** — no Python subprocess, no `exec node bird-search.mjs` CLI wrapper from fetch script
**And** no new npm dependency on `@steipete/sweet-cookie`

### 2. X adapter stdout contract (AC: FR-12)

**Given** valid `X_AUTH_TOKEN` + `X_CT0` and configured accounts/queries
**When** `node scripts/hermes-skill-examples/morning-digest/scripts/fetch-x-signals.mjs` runs
**Then** stdout is valid JSON:

```json
{
  "posts": [
    {
      "title": "Tweet text truncated to 280 chars or first sentence",
      "authorHandle": "karpathy",
      "url": "https://x.com/karpathy/status/1234567890",
      "publishedAt": "2026-06-11T08:00:00Z",
      "likes": 1200,
      "reposts": 340,
      "replies": 89,
      "quotes": 12
    }
  ]
}
```

**And** process exits **0**
**And** searches use GraphQL `SearchTimeline` via vendored client (not X API v2)
**And** config keys (with defaults):

| Key | Default / cap |
|-----|----------------|
| `MORNING_DIGEST_X_ACCOUNTS` | Comma-separated handles (no `@`); default curated AI/tech list (8–12 handles — mirror addendum / last30days curated set) |
| `MORNING_DIGEST_X_SEARCH_QUERIES` | Optional comma-separated queries; max **3** per run |
| `MORNING_DIGEST_X_MAX_TWEETS` | Default **20**; hard cap **50** |
| `MORNING_DIGEST_X_LOOKBACK_HOURS` | Default **24** → `since:YYYY-MM-DD` filter on queries |
| `MORNING_DIGEST_X_ENABLED` | Default enabled; `0|false` → `{"error":"x disabled"}` |

**And** per-account queries use `from:{handle} since:{date}` syntax (port `bird_x.search_handles` pattern)
**And** optional global queries run when `MORNING_DIGEST_X_SEARCH_QUERIES` set
**And** aggregate, dedupe by tweet URL/id, sort by engagement proxy (likes + 2×reposts), cap at max tweets
**And** **100ms delay** between distinct search calls `[ASSUMPTION per Bluesky adapter]`
**And** `mergeTrendIngestEnv` + `resolveOperatorHome()` mandatory — never `os.homedir()` alone

### 3. Graceful failure shapes (AC: FR-14)

**Given** missing `X_AUTH_TOKEN` or `X_CT0`, invalid session (401/403 from GraphQL), network error, or disabled flag
**When** the adapter runs
**Then** stdout is `{"error":"<short reason>"}` (≤120 chars), e.g. `X credentials not configured`
**And** process exits **0** (never abort digest)
**And** stderr carries diagnostics only (never pollute stdout JSON)

### 4. Shell wrapper + Hermes contract (AC: FR-12)

**Given** `scripts/session-close/hermes-run-x.sh`
**When** invoked from Hermes `terminal(...)` with `workdir=resolved_repo_root`
**Then** HOME isolation remap matches `hermes-run-bluesky.sh`
**And** thin `exec node` on `fetch-x-signals.mjs`
**And** stdout key is **`posts[]` only** — same contract as Bluesky/Reddit

### 5. Source 11 block in task-prompt.md (AC: FR-12 integration)

**Given** `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md`
**When** Source 11 is added
**Then** block inserted **after Source 10**, **before Source 12**
**And** includes:
- `terminal(command="bash scripts/session-close/hermes-run-x.sh", workdir=resolved_repo_root, timeout=60)`
- Imperative stdout threading: `x_stdout` → `JSON.parse` → `x_json.posts[]` only
- Failure: **X / Twitter** header + `- (source unavailable: <short reason>)` → **continue to Source 12**
- Pre-flight gate: Source 10 must have fired before Source 11; Source 11 before Source 12
**And** source-order table adds row **11 | X / Twitter**
**And** **Steps 9–12 gate** updated: Sources **9, 10, 11, and 12** terminals **MUST fire** before Source 6
**And** `digest_sources` assembly adds `"twitter": [...]` field
**And** §9 mapping table adds `twitter` row (`section` + `sourceType`: `twitter`)
**And** §9 strict-schema unions include `twitter`
**And** Discord template adds **X / Twitter** section (mirror Bluesky bullets: title + engagement counts)
**And** `SKILL.md` output template headings list includes **X / Twitter** (mirror 68-5 Bluesky review fix)
**And** §9 precondition text: Sources **1–5, 7–11, 12, and 6**

### 6. pick-signal-notebook integration (AC: routing cap)

**Given** `buildDigestSignals()` in `pick-signal-notebook.mjs`
**When** `digest_sources.twitter` is present
**Then** `extractTwitterSignals()` adds up to **2** post titles ranked by engagement proxy (likes + reposts desc)
**And** insertion order: after Product Hunt, before Bluesky
**And** exported for unit tests

### 7. normalizeEngagement twitter branch (AC: FR-13)

**Given** `score-digest-signals.mjs`
**When** `normalizeEngagement({ sourceType: 'twitter', sourceMetadata: { likes, reposts, replies, quotes } })` is called
**Then** weighted log-norm uses addendum A1 / last30days X weights: **likes 0.55, reposts 0.25, replies 0.15, quotes 0.05**
**And** caps exported as named constants: `X_LIKES_CAP=50000`, `X_REPOSTS_CAP=10000`, `X_REPLIES_CAP=5000`, `X_QUOTES_CAP=2000`
**And** requires at least one finite engagement field; all missing/zero → `null`
**And** `SOURCE_PRIOR.twitter` and `TREND_PROXY_PRIOR.twitter` added (suggest **9** / **40** — above `bluesky` 7/38; document in Completion Notes)
**And** `DigestSourceType` typedef includes `'twitter'`

### 8. §9 digestSignal mapping (AC: FR-11, FR-12)

**Given** parsed `posts[]` from Source 11
**When** agent builds `digest_push_payload.signals[]`
**Then** each row has paired **`section: 'twitter'`, `sourceType: 'twitter'`** (literal name is `twitter`, not `x` — matches 68-4 schema)
**And** mapping per addendum A1:

| stdout field | digestSignal field |
|--------------|-------------------|
| `title` | `title` |
| first 200 chars of `title` | `summary` |
| `url` | `url` |
| `authorHandle` | `sourceMetadata.authorHandle` |
| `likes` / `reposts` / `replies` / `quotes` | same keys under `sourceMetadata` (numbers) |
| `publishedAt` | `sourceMetadata.publishedAt` when present |

**And** engagement fields live **only** under `sourceMetadata`

### 9. Bird tweet → stdout mapping (AC: FR-12)

**Given** raw tweet objects from bird-search GraphQL client
**When** `mapBirdTweet(tweet)` runs
**Then** field mapping ports `bird_x.parse_bird_response()` / addendum A1:

| bird-search field | stdout |
|-------------------|--------|
| `text` / `full_text` | `title` (trim; max 280) |
| `author.username` / `user.screen_name` | `authorHandle` (strip `@`) |
| `permanent_url` or constructed `https://x.com/{handle}/status/{id}` | `url` |
| `likeCount` / `like_count` / `favorite_count` | `likes` |
| `retweetCount` / `retweet_count` | `reposts` |
| `replyCount` / `reply_count` | `replies` |
| `quoteCount` / `quote_count` | `quotes` |
| `createdAt` / `created_at` | `publishedAt` ISO-8601 when parseable |

**And** tweets without resolvable URL are dropped

### 10. Tests + verify gate (AC: FR-12, FR-13)

**Given** implementation complete
**When** `npm test` runs in Omnipotent.md
**Then** new `tests/morning-digest-x-adapter.test.mjs` passes:
- fixture bird-search tweet JSON → `posts[]` stdout shape
- `mapBirdTweet`, `loadXConfig`, credential-missing error shape
- §9 mapping round-trip → `normalizeEngagement` non-null for fixture with likes
- mocked `SearchClient.search` — **no live X network in CI**
**And** `tests/morning-digest-score-signals.test.mjs` extended — twitter cap-saturation + SOURCE_PRIOR assertion
**And** `tests/hermes-morning-digest-skill.test.mjs` extended — Source 11 contract strings, gate order 9–10–11–12
**And** `tests/morning-digest-pick-signal-notebook.test.mjs` extended — `extractTwitterSignals`
**When** `bash scripts/verify.sh` runs
**Then** all tests green (no cns-dashboard edits in this story)

### 11. Env documentation (minimal — AC: operator ergonomics)

**Given** `scripts/trend-ingest.env.example`
**When** updated in this story
**Then** documents **required-for-X** keys:

```bash
# X/Twitter session cookies (Story 68-6) — from logged-in x.com browser session; NOT official API keys
# X_AUTH_TOKEN=""   # auth_token cookie value
# X_CT0=""            # ct0 cookie value
```

**And** documents optional tuning keys: `MORNING_DIGEST_X_ACCOUNTS`, `MORNING_DIGEST_X_SEARCH_QUERIES`, `MORNING_DIGEST_X_MAX_TWEETS`, `MORNING_DIGEST_X_LOOKBACK_HOURS`, `MORNING_DIGEST_X_ENABLED`
**And** notes: **no `@steipete/sweet-cookie`** — env vars only; WSL operators paste cookies manually
**And** extended credential rotation docs / health-check script deferred to **68-7**

---

## Tasks / Subtasks

- [x] **T1** Vendor bird-search (env-only) (AC: 1)
  - [x] Copy `last30days-skill-reference/.../vendor/bird-search/` → `scripts/.../vendor/bird-search/`
  - [x] Patch `lib/cookies.js`: add `X_AUTH_TOKEN`/`X_CT0` env reads; remove sweet-cookie browser path (env-only stub)
  - [x] Add vendor README citing MIT / @steipete/bird v0.8.0 provenance
- [x] **T2** Create `fetch-x-signals.mjs` (AC: 2, 3, 9)
  - [x] Export testable pure functions: `loadXConfig`, `parseAccounts`, `parseSearchQueries`, `buildSinceDate`, `mapBirdTweet`, `dedupePostsByUrl`, `sortAndCapPosts`, `runXFetch`
  - [x] Import vendored `SearchClient` directly; set `BIRD_DISABLE_BROWSER_COOKIES=1`
  - [x] Implement account timeline searches (`from:handle since:date`) + optional query list (max 3)
  - [x] Retry once on JSON/HTML interstitial class errors `[ASSUMPTION: 1 retry, 5s delay — lighter than last30days MAX=2]`
  - [x] 15–30s fetch timeout per search call; 100ms inter-search delay
- [x] **T3** Create `hermes-run-x.sh` (AC: 4)
  - [x] Copy HOME remap from `hermes-run-bluesky.sh`; `exec node` on fetch script
- [x] **T4** Update `task-prompt.md` + `SKILL.md` (AC: 5)
  - [x] Source 11 block between 10 and 12; gate 9–10–11–12
  - [x] `digest_sources`, §9 table, Discord template, strict-schema unions
- [x] **T5** Extend `pick-signal-notebook.mjs` (AC: 6)
  - [x] `extractTwitterSignals(sources.twitter)` — top 2 by likes+reposts
- [x] **T6** Extend `score-digest-signals.mjs` (AC: 7)
  - [x] `case 'twitter':` in `normalizeEngagement`; export `X_*_CAP` constants; SOURCE_PRIOR / TREND_PROXY_PRIOR
- [x] **T7** Tests + env example (AC: 10, 11)
  - [x] `tests/morning-digest-x-adapter.test.mjs` + extend score-signals, hermes-skill, pick-signal-notebook tests
  - [x] Update `scripts/trend-ingest.env.example`
- [x] **T8** Verify gate
  - [x] `npm test` + `bash scripts/verify.sh`
  - [x] Note: run `bash scripts/install-hermes-skill-morning-digest.sh` post-merge (operator step)

### Review Findings

- [x] [Review][Decision] Hermes `timeout=60` vs sequential search budget — **Resolved 1D:** `DEFAULT_X_ACCOUNTS` reduced to 5 handles; `FETCH_TIMEOUT_MS` lowered to 15s (Bluesky mirror). Worst-case ~8 queries × 20s ≈ 160s theoretical; typical run fits 60s budget.

- [x] [Review][Decision] Mid-run auth failure discards partial posts — **Resolved 2B:** `runXFetch` returns partial `posts[]` when `sawSuccess || aggregated.length > 0`; only fails closed with `{ error: 'X session invalid' }` when no data collected.

- [x] [Review][Patch] `signalsFromParsedInput` guard omits `twitter` / `bluesky` / `producthunt` [pick-signal-notebook.mjs:530] — Added keys to digest-object guard; CLI test for twitter-only `DIGEST_SOURCES_JSON`.

- [x] [Review][Patch] HTML/login interstitial not classified as session invalid [fetch-x-signals.mjs] — Added `isSessionInvalidError()`; HTML/login/invalid-json shapes map to session invalid when no partial data.

- [x] [Review][Patch] `applyXCredentialEnv` omits `TWITTER_*` alias propagation [fetch-x-signals.mjs:295] — `TWITTER_AUTH_TOKEN`/`TWITTER_CT0` included in env mapping.

- [x] [Review][Patch] Missing failure-path tests [tests/morning-digest-x-adapter.test.mjs] — Added tests for partial 403, total auth fail, x fetch failed, HTML interstitial.

- [x] [Review][Patch] Double `since:` when operator query already contains `since:` [fetch-x-signals.mjs] — Added `appendSinceToQuery()` with existing-`since:` detection.

- [x] [Review][Patch] URL dedupe misses `x.com` vs `twitter.com` and id-only duplicates [fetch-x-signals.mjs:240] — Added `normalizeTweetUrl()` + `tweetDedupeKey()` status-id dedupe.

- [x] [Review][Defer] `quoteCount` always 0 on live bird-search path [vendor/bird-search/lib/twitter-client-utils.js] — deferred, vendor `mapTweetResult` does not populate quotes; 5% scoring weight inert until vendor patch.

- [x] [Review][Defer] Day-granular `since:YYYY-MM-DD` without post-fetch hour filter [fetch-x-signals.mjs:93] — deferred, AC 2 explicitly binds `since:YYYY-MM-DD`; Bluesky-style `filterByLookback` is out of spec for this story.

---

## Dev Notes

### File paths (repo SSOT → Hermes mirror)

| Action | Repo path | Installed mirror |
|--------|-----------|------------------|
| **Create (vendor)** | `scripts/hermes-skill-examples/morning-digest/scripts/vendor/bird-search/**` | mirrored |
| **Create** | `scripts/hermes-skill-examples/morning-digest/scripts/fetch-x-signals.mjs` | `~/.hermes/skills/cns/morning-digest/scripts/` |
| **Create** | `scripts/session-close/hermes-run-x.sh` | _(session-close stays in repo)_ |
| **Update** | `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` | mirrored |
| **Update** | `scripts/hermes-skill-examples/morning-digest/SKILL.md` | mirrored |
| **Update** | `scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs` | mirrored |
| **Update** | `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs` | mirrored |
| **Update** | `scripts/trend-ingest.env.example` | operator copy at `~/.hermes/trend-ingest.env` |

### bird-search integration (binding)

**Do:**
- Import modules from `./vendor/bird-search/lib/` inside `fetch-x-signals.mjs`
- Construct client with explicit cookies object `{ authToken, ct0, cookieHeader }` from env
- Use `client.search(query, count)` for each query string

**Do not:**
- Subprocess `bird-search.mjs` CLI from Python or shell inside fetch script (direct import only)
- Subprocess last30days Python (`bird_x.py`)
- Install or import `@steipete/sweet-cookie`
- Read Safari/Chrome/Firefox cookies on any platform

**Reference files (read-only codebook):**

| File | Use |
|------|-----|
| `last30days-skill-reference/.../bird_x.py` | `parse_bird_response`, `search_handles`, query `from:{handle} since:{date}` |
| `last30days-skill-reference/.../vendor/bird-search/bird-search.mjs` | CLI arg parsing reference only — CNS uses library import |
| `last30days-skill-reference/.../vendor/bird-search/lib/twitter-client-search.js` | GraphQL SearchTimeline behavior |
| `last30days-skill-reference/.../signals.py` line 93 | X engagement weights |
| `addendum.md` §A1 | stdout contract + normalizeEngagement caps |

### Default curated accounts (suggested starting set)

```javascript
export const DEFAULT_X_ACCOUNTS = [
  'karpathy',
  'sama',
  'ylecun',
  'GaryMarcus',
  'emollick',
  'simonw',
  'swyx',
  'dannypostma',
  'DrJimFan',
  'goodfellow_ian',
];
```

Operator may override via `MORNING_DIGEST_X_ACCOUNTS`. Dedupe handles case-insensitively.

### normalizeEngagement branch (binding)

```javascript
export const X_LIKES_CAP = 50000;
export const X_REPOSTS_CAP = 10000;
export const X_REPLIES_CAP = 5000;
export const X_QUOTES_CAP = 2000;

// case 'twitter':
return Math.round(
  0.55 * logNorm(meta.likes, X_LIKES_CAP) +
  0.25 * logNorm(meta.reposts, X_REPOSTS_CAP) +
  0.15 * logNorm(meta.replies, X_REPLIES_CAP) +
  0.05 * logNorm(meta.quotes, X_QUOTES_CAP),
);
```

### §9 mapping helper (test pattern)

```javascript
function twitterPostToDigestSignal(post, rank) {
  const sourceMetadata = {
    authorHandle: post.authorHandle,
    likes: post.likes,
    reposts: post.reposts,
    replies: post.replies,
    quotes: post.quotes,
  };
  if (post.publishedAt) sourceMetadata.publishedAt = post.publishedAt;
  return {
    section: 'twitter',
    sourceType: 'twitter',
    title: post.title,
    summary: post.title.slice(0, 200),
    url: post.url,
    rank,
    sourceMetadata,
  };
}
```

### Source ordering (update from 68-5)

| Source | Story | Insert point |
|--------|-------|--------------|
| **11 X/Twitter** | **68-6** (this story) | After Source 10, before Source 12 |
| **12 Bluesky** | 68-5 (done) | After Source 11 (when 68-6 lands), before Source 6 |

Gate text becomes: Sources **9, 10, 11, 12** before Source 6.

### Dependency on 68-4 (schema gate)

Live Convex push requires cns-dashboard validators from **68-4**:
- `digestSourceTypeValue` includes `twitter`
- `digestSectionValue` includes `twitter`
- `sourceMetadataValidator` accepts social engagement fields

Implement Omnipotent.md pipeline fully even if 68-4 is still `ready-for-dev` in sprint tracker.

### What must be preserved

- **68-1 dedup** — twitter rows need `url` + `publishedAt` for cluster keys
- **68-5 Bluesky** — do not regress Source 12 block or gate; insert X **before** Bluesky
- **ADR-E67-001** — Node-only; last30days read-only
- **Exit 0 failure pattern** — all morning-digest fetch scripts
- **HOME remap in shell wrappers** — Epic 59 Hermes profile isolation

### Anti-patterns (do not)

- Do not implement `X_BEARER_TOKEN` or X API v2 REST endpoints
- Do not add `@steipete/sweet-cookie` to package.json
- Do not subprocess last30days Python
- Do not use stdout key `tweets[]` — **`posts[]` only** (CNS convention matches Bluesky/addendum A1)
- Do not put engagement at signal root in §9 push
- Do not edit `cns-dashboard/convex/validators.ts` (68-4 scope)
- Do not implement monthly API budget guard (68-7; N/A for cookie auth — session expiry is operational concern)

### Previous story intelligence

**68-5 (Bluesky — primary mirror):** Full adapter pattern: `run*Fetch`, config loader, exported pure functions, shell wrapper, task-prompt Source N, `normalizeEngagement` branch, `extract*Signals`, fixture tests with mocked fetch, env example. Code review patches: strict lookback, URL dedupe, SKILL headings, SOURCE_PRIOR test assertion.

**68-1 (dedup):** `SOURCE_PRIORITY.twitter = 6` (wins over bluesky 5). Merged clusters can list `sourceType: 'twitter'` in `contributingSources[]`.

**68-4 (schema):** Paired literals `section: 'twitter'` + `sourceType: 'twitter'`.

**67-5 (Product Hunt):** Established Source 10 end-to-end pattern; X is Source 11.

### Testing fixtures

Provide mocked bird-search tweet objects with:
- full engagement counts (camelCase `likeCount`, etc.)
- legacy snake_case fields
- missing optional fields (zeros OK)
- credential-missing config → `{"error":"X credentials not configured"}`

Mock `SearchClient.prototype.search` or inject a test double — **no live GraphQL in CI**.

CLI smoke (optional, operator-only, not CI): requires real cookies in `~/.hermes/trend-ingest.env`.

### Git intelligence (recent patterns)

- `316e36c` — Epic 68-5 Bluesky: mirror file naming (`morning-digest-x-adapter.test.mjs`), export testable pure functions, Source gate expansion pattern
- `6c18ea9` — Epic 68-1 dedup: twitter already in SOURCE_PRIORITY

### 68-7 handoff (out of scope here)

Story **68-7** should cover: credential health-check script (`--check` equivalent), operator guide for rotating `X_AUTH_TOKEN`/`X_CT0`, session-expiry stderr warnings, any remaining SKILL/task-prompt polish not caught in 68-6. **Do not** implement X API v2 monthly budget guard — obsolete under cookie GraphQL path.

### Project Structure Notes

- Canonical task-prompt: `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md`
- Verify gate: `bash scripts/verify.sh` from Omnipotent.md root
- Vendor code lives under morning-digest scripts tree (not npm package) to keep Hermes mirror self-contained

### References

- [Source: `_bmad-output/planning-artifacts/prds/prd-epic-68-2026-06-11/prd.md` §4.4, §6.2 — FR IDs; bearer-token wording superseded by operator override above]
- [Source: `_bmad-output/planning-artifacts/prds/prd-epic-68-2026-06-11/addendum.md` §A1]
- [Source: `_bmad-output/implementation-artifacts/68-5-bluesky-adapter-source-12.md` — primary integration mirror]
- [Source: `_bmad-output/implementation-artifacts/68-4-schema-literals-twitter-bluesky.md`]
- [Source: `_bmad-output/implementation-artifacts/68-1-cross-source-dedup-engine.md`]
- [Source: `docs/ADR-E67-001-last30days-codebook-only.md`]
- [Source: `last30days-skill-reference/skills/last30days/scripts/lib/bird_x.py`]
- [Source: `last30days-skill-reference/skills/last30days/scripts/lib/vendor/bird-search/`]
- [Source: `last30days-skill-reference/skills/last30days/scripts/lib/signals.py` — X engagement weights]
- [Source: `scripts/hermes-skill-examples/morning-digest/scripts/fetch-bluesky-signals.mjs` — adapter skeleton]
- [Source: `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs`]

## Dev Agent Record

### Agent Model Used

claude-4.6-sonnet-medium-thinking (Cursor)

### Debug Log References

### Completion Notes List

- Vendored bird-search from last30days-skill-reference with env-only `cookies.js` (X_AUTH_TOKEN/X_CT0 + aliases; no sweet-cookie).
- Added `fetch-x-signals.mjs` + `hermes-run-x.sh` — GraphQL SearchTimeline via session cookies; stdout `posts[]`; exit 0 on failure.
- Wired Source 11 into task-prompt/SKILL.md between Product Hunt and Bluesky; expanded Steps 9–12 gate to include X.
- Added `extractTwitterSignals` (top 2 by likes+reposts) and `normalizeEngagement` twitter branch (weights 0.55/0.25/0.15/0.05; SOURCE_PRIOR 9, TREND_PROXY_PRIOR 40).
- Tests: `morning-digest-x-adapter.test.mjs` + extensions to score-signals, hermes-skill, pick-signal-notebook. `bash scripts/verify.sh` green.
- Operator post-merge: `bash scripts/install-hermes-skill-morning-digest.sh` to sync ~/.hermes mirror.

### File List

- scripts/hermes-skill-examples/morning-digest/scripts/vendor/bird-search/** (vendored)
- scripts/hermes-skill-examples/morning-digest/scripts/fetch-x-signals.mjs
- scripts/session-close/hermes-run-x.sh
- scripts/hermes-skill-examples/morning-digest/references/task-prompt.md
- scripts/hermes-skill-examples/morning-digest/SKILL.md
- scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs
- scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs
- scripts/trend-ingest.env.example
- tests/morning-digest-x-adapter.test.mjs
- tests/morning-digest-score-signals.test.mjs
- tests/morning-digest-pick-signal-notebook.test.mjs
- tests/hermes-morning-digest-skill.test.mjs
- eslint.config.js

### Change Log

- 2026-06-11: Story 68-6 — X/Twitter Source 11 adapter (cookie GraphQL via vendored bird-search)
- 2026-06-11: Code review — 1D/2B decisions + 6 patches applied

---

## Story Completion Status

- **Status:** done
- **Completion note:** X/Twitter Source 11 adapter implemented — code review patches applied (5 default accounts, 15s timeout, partial-post degrade, dedupe/guard/test hardening).
