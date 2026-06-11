---
story_id: 68-5
epic: 68
title: bluesky-adapter-source-12
status: done
baseline_date: 2026-06-11
baseline_commit: 6c18ea9
operator_brief: 2026-06-11
predecessors: 68-1, 68-4
parallel: 68-2
blocks: 68-8
repo: Omnipotent.md only
fr_ids: FR-8, FR-9, FR-10
priority: P1
---

# Story 68.5: Bluesky Adapter (Source 12) + Integration

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a **CNS operator receiving the morning digest in `#hermes`**,
I want **a native Bluesky AT Protocol adapter (Source 12) wired into the morning-digest pipeline with engagement-aware scoring and §9 push mapping**,
so that **curated AI-community posts appear in Discord and Convex with `sourceType: 'bluesky'`, engagement fields normalize into `rankScore`, and the digest catches narrative discourse hours before HN/NewsAPI without credentials or Python subprocesses**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 68 — Source Expansion: X/Twitter, Bluesky, Cross-Source Dedup |
| **Priority** | **P1** — free public AT Protocol; no credential blocker; ships after dedup + schema gate |
| **Repo** | **Omnipotent.md only** — adapter, shell wrapper, task-prompt, scoring branch, tests |
| **Predecessors** | **68-1** (done) — cross-source dedup already references `bluesky` in `SOURCE_PRIORITY`; **68-4** (ready-for-dev / schema landed in cns-dashboard) — Convex must accept `sourceType: 'bluesky'` + social `sourceMetadata` before live push succeeds |
| **Parallel** | **68-2** (people watchlist loader) — no hard dependency; `authorHandle` on mapped signals enables future 68-3 bonus |
| **Blocks** | **68-8** live validation (needs ≥1 `bluesky` signal with engagement metadata) |
| **Normative spec** | `prd-epic-68-2026-06-11/prd.md` §4.3 (FR-8..FR-10); `addendum.md` §A3, §A5; `docs/ADR-E67-001-last30days-codebook-only.md` |
| **Out of scope** | X/Twitter adapter (68-6/68-7); people scoring bonus (68-3); `cns-dashboard` validator changes (68-4); authenticated `searchPosts` path; vault WriteGate; Nexus inspector UI for social chips |

### Operator rationale (binding)

Epic 68 sequencing: `68-1` → `68-4` → **`68-5`** ∥ `68-2` → … Bluesky is **Source 12** (X is Source 11 in 68-6). v1 uses **public** `getAuthorFeed` — no `BSKY_HANDLE` / app password required. Study `last30days-skill-reference/skills/last30days/scripts/lib/bluesky.py` **read-only** for AT Protocol field shapes (`likeCount`, `repostCount`, URI→URL); **never** subprocess or import Python (ADR-E67-001).

### Problem (current state)

| Gap | Today |
|-----|--------|
| No Bluesky fetch script | Sources 1–10 wired; no `fetch-bluesky-signals.mjs` |
| No Source 12 in task-prompt | `task-prompt.md` ends at Source 10; §9 mapping table has no `bluesky` row |
| No engagement branch | `normalizeEngagement()` in `score-digest-signals.mjs` has no `case 'bluesky':` — social posts would score Path B only |
| No Hermes wrapper | No `hermes-run-bluesky.sh` |
| Schema gate | cns-dashboard `digestSourceTypeValue` / `digestSectionValue` include `bluesky` after **68-4** (verify sibling repo before claiming live push) |

Dedup engine (`dedupe-digest-signals.mjs`) already ranks `bluesky` in merge priority — no 68-1 changes needed when bluesky signals land.

### Target pipeline touchpoints

```text
… → hermes-run-bluesky.sh → fetch-bluesky-signals.mjs  ← NEW (68-5)
  → task-prompt Source 12 Discord + digest_sources.bluesky
  → §9 map (posts[] → digestSignal rows)
  → dedupe-digest-signals.mjs (68-1, unchanged)
  → score-digest-signals.mjs (normalizeEngagement bluesky branch) ← NEW
  → push-digest-convex.mjs
```

---

## Acceptance Criteria

### 1. Bluesky adapter stdout contract (AC: FR-8)

**Given** `MORNING_DIGEST_BSKY_ACTORS` lists one or more public handles (or defaults apply)
**When** `node scripts/hermes-skill-examples/morning-digest/scripts/fetch-bluesky-signals.mjs` runs
**Then** stdout is valid JSON:

```json
{
  "posts": [
    {
      "title": "Post text (first sentence or truncated)",
      "authorHandle": "simonwillison.net",
      "url": "https://bsky.app/profile/simonwillison.net/post/3l...",
      "publishedAt": "2026-06-11T07:30:00Z",
      "likes": 450,
      "reposts": 120,
      "replies": 34,
      "quotes": 8
    }
  ]
}
```

**And** process exits **0**
**And** implementation uses public AppView `https://api.bsky.app/xrpc/` (override via `MORNING_DIGEST_BSKY_APPVIEW_HOST` optional)
**And** per actor: `com.atproto.identity.resolveHandle` then `app.bsky.feed.getAuthorFeed`
**And** posts filtered to `MORNING_DIGEST_BSKY_LOOKBACK_HOURS` (default **24**)
**And** global cap `MORNING_DIGEST_BSKY_MAX_POSTS` (default **25**, hard max **50**)
**And** rate limit: **100ms delay** between actors `[ASSUMPTION per PRD]`
**And** `mergeTrendIngestEnv` + `resolveOperatorHome()` from `fetch-arxiv-rss.mjs` — never `os.homedir()` alone for config paths

### 2. Graceful failure shapes (AC: FR-8)

**Given** network failure, invalid handle, empty actor list, or AppView error
**When** the adapter runs
**Then** stdout is `{"error":"<short reason>"}` (≤120 chars)
**And** process exits **0** (never abort digest)
**And** `MORNING_DIGEST_BSKY_ENABLED=0|false` → `{"error":"bluesky disabled"}`

### 3. Shell wrapper + Hermes contract (AC: FR-8)

**Given** `scripts/session-close/hermes-run-bluesky.sh`
**When** invoked from Hermes `terminal(...)` with `workdir=resolved_repo_root`
**Then** HOME isolation remap matches `hermes-run-producthunt.sh` (lines 4–14)
**And** thin `exec node` on `fetch-bluesky-signals.mjs`
**And** stdout key is **`posts[]` only** — never `launches[]`, `repos[]`, `stories[]`, `entries[]`

### 4. Source 12 block in task-prompt.md (AC: FR-8, FR-10 integration)

**Given** `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md`
**When** Source 12 is added
**Then** block inserted **after Source 10**, **before Source 6**
**And** includes:
- `terminal(command="bash scripts/session-close/hermes-run-bluesky.sh", workdir=resolved_repo_root, timeout=45)`
- Imperative stdout threading: `bsky_stdout` → `JSON.parse` → `bsky_json.posts[]` only
- Anti-pattern line against other stdout keys
- Failure: **Bluesky** header + `- (source unavailable: <short reason>)` → **continue to Source 6**
- §9 mapping documented in this story (see Dev Notes)
**And** source-order table updated: add row **12 | Bluesky**
**And** **Steps 9–12 gate:** Sources 9, 10, and **12** terminals **MUST fire** before Source 6 (Source 11 X deferred to 68-6)
**And** `digest_sources` assembly JSON adds `"bluesky": [...]` field
**And** §9 signal mapping table adds `bluesky` row
**And** §9 strict-schema union lists `bluesky` in `section` and `sourceType`
**And** Discord template includes **Bluesky** section (mirror Product Hunt bullets: title + engagement counts)

### 5. pick-signal-notebook integration (AC: FR-10 routing cap)

**Given** `buildDigestSignals()` in `pick-signal-notebook.mjs`
**When** `digest_sources.bluesky` is present
**Then** `extractBlueskySignals()` adds up to **2** post titles ranked by engagement proxy (likes + reposts desc)
**And** insertion order: after Product Hunt, before title dedupe cap-10
**And** exports `extractBlueskySignals` for unit tests

### 6. normalizeEngagement bluesky branch (AC: FR-9)

**Given** `score-digest-signals.mjs`
**When** `normalizeEngagement({ sourceType: 'bluesky', sourceMetadata: { likes, reposts, replies, quotes } })` is called
**Then** weighted log-norm uses addendum A3 weights: **likes 0.40, reposts 0.30, replies 0.20, quotes 0.10**
**And** caps `[ASSUMPTION: BSKY_LIKES_CAP=20000, BSKY_REPOSTS_CAP=5000, BSKY_REPLIES_CAP=2000, BSKY_QUOTES_CAP=1000]` exported as named constants (anti-drift)
**And** requires at least one finite engagement field; all missing/zero → `null`
**And** `SOURCE_PRIOR.bluesky` and `TREND_PROXY_PRIOR.bluesky` added (suggest **7** / **38** — between `rss` and `reddit`; document in Completion Notes)
**And** `DigestSourceType` typedef includes `'bluesky'`

### 7. §9 digestSignal mapping (AC: FR-8, FR-10)

**Given** parsed `posts[]` from Source 12
**When** agent builds `digest_push_payload.signals[]`
**Then** each row has paired **`section: 'bluesky'`, `sourceType: 'bluesky'`**
**And** mapping per addendum A3:

| stdout field | digestSignal field |
|--------------|-------------------|
| `title` | `title` |
| first 200 chars of `title` | `summary` |
| `url` | `url` |
| `authorHandle` | `sourceMetadata.authorHandle` |
| `likes` / `reposts` / `replies` / `quotes` | same keys under `sourceMetadata` (numbers) |
| `publishedAt` | `sourceMetadata.publishedAt` when present |

**And** engagement fields live **only** under `sourceMetadata` — never at signal root (same rule as GitHub/Reddit/Product Hunt)

### 8. Tests + verify gate (AC: FR-8, FR-9)

**Given** implementation complete
**When** `npm test` runs in Omnipotent.md
**Then** new `tests/morning-digest-bluesky-adapter.test.mjs` passes:
- fixture AT Protocol feed JSON → `posts[]` stdout shape
- handle resolve + feed parse unit tests (mocked `fetch`, no live network in CI)
- §9 mapping round-trip → `normalizeEngagement` non-null for fixture with likes
- missing actors / disabled flag error shapes
**And** `tests/morning-digest-score-signals.test.mjs` extended — bluesky cap-saturation fixture
**And** `tests/hermes-morning-digest-skill.test.mjs` extended — Source 12 contract strings (`posts[]`, gate before Source 6)
**When** `bash scripts/verify.sh` runs
**Then** all tests green (cns-dashboard baseline unchanged — no validator edits in this story)

### 9. Env documentation (AC: operator ergonomics)

**Given** `scripts/trend-ingest.env.example`
**When** updated
**Then** documents optional keys: `MORNING_DIGEST_BSKY_ACTORS`, `MORNING_DIGEST_BSKY_MAX_POSTS`, `MORNING_DIGEST_BSKY_LOOKBACK_HOURS`, `MORNING_DIGEST_BSKY_ENABLED`, `MORNING_DIGEST_BSKY_APPVIEW_HOST`
**And** includes commented default actor list (8–12 AI/tech handles — e.g. `karpathy.bsky.social`, `simonwillison.net`, `dannypostma.bsky.social`, `swyx.io`, `sama.bsky.social`, `ylecun.bsky.social`, `emollick.bsky.social`, `GaryMarcus.bsky.social`)
**And** notes v1 is **public feeds only** — no `BSKY_APP_PASSWORD` in this story

---

## Tasks / Subtasks

- [x] **T1** Create `fetch-bluesky-signals.mjs` (AC: 1, 2)
  - [x] Export `runBlueskyFetch`, `loadBlueskyConfig`, `parseActors`, `resolveHandle`, `mapFeedPost`, `filterByLookback`, `sortAndCapPosts` for fixture tests
  - [x] AppView base default `api.bsky.app`; 15s fetch timeout per request
  - [x] Map AT Protocol fields: `record.text` → `title`; `author.handle` → `authorHandle`; `likeCount`/`repostCount`/`replyCount`/`quoteCount` → stdout engagement; URI → `https://bsky.app/profile/{handle}/post/{rkey}`
  - [x] Aggregate posts across actors; sort by engagement proxy (likes + 2×reposts); cap at max posts
  - [x] 100ms delay between actors; stderr diagnostics only (never pollute stdout)
- [x] **T2** Create `hermes-run-bluesky.sh` (AC: 3)
  - [x] Copy HOME remap from `hermes-run-producthunt.sh`
  - [x] `exec node` on fetch script
- [x] **T3** Update `task-prompt.md` + `SKILL.md` mirror (AC: 4)
  - [x] Source 12 imperative block; update gate text (Sources 9–10–12)
  - [x] `digest_sources` JSON, §9 table, strict-schema unions, Discord template
  - [x] Update §9 precondition text: Sources **1–5, 7–10, 12, and 6**
- [x] **T4** Extend `pick-signal-notebook.mjs` (AC: 5)
  - [x] `extractBlueskySignals(sources.bluesky)` — top 2 by engagement
- [x] **T5** Extend `score-digest-signals.mjs` (AC: 6)
  - [x] `case 'bluesky':` in `normalizeEngagement`
  - [x] Export BSKY_*_CAP constants; SOURCE_PRIOR / TREND_PROXY_PRIOR entries
- [x] **T6** Tests + env example (AC: 8, 9)
  - [x] `tests/morning-digest-bluesky-adapter.test.mjs`
  - [x] Extend score-signals + hermes-morning-digest-skill tests
  - [x] Update `scripts/trend-ingest.env.example`
- [x] **T7** Verify gate
  - [x] `npm test` in Omnipotent.md
  - [x] `bash scripts/verify.sh`
  - [x] Note: run `bash scripts/install-hermes-skill-morning-digest.sh` post-merge (operator step)

### Review Findings

- [x] [Review][Patch] SKILL.md "headings exactly" list omits **Bluesky** [scripts/hermes-skill-examples/morning-digest/SKILL.md:61] — Output template adds a Bluesky section but the enforcement line still lists only Trending Now through Vault context; agents under context pressure may skip the section.
- [x] [Review][Patch] Lookback filter bypasses undated/unparseable posts [fetch-bluesky-signals.mjs:205-211] — `filterByLookback` returns `true` when `publishedAt` is missing or `Date.parse` is non-finite, violating AC1 24h window intent; stale posts can leak through.
- [x] [Review][Patch] No URL deduplication across actors [fetch-bluesky-signals.mjs:372] — Same post from overlapping follows or repost visibility can appear multiple times before global cap.
- [x] [Review][Patch] Empty-actor error path is dead code [fetch-bluesky-signals.mjs:323-324] — `parseActors()` always falls back to `DEFAULT_BSKY_ACTORS`, so `{ error: 'no bluesky actors configured' }` is unreachable; AC2 empty-actor shape untested.
- [x] [Review][Patch] `fetchAuthorFeed` lacks mocked-fetch unit test [fetch-bluesky-signals.mjs:288] — AC8 requires resolve + feed parse tests; only `resolveHandle` and fixture-mode `runBlueskyFetch` are covered.
- [x] [Review][Patch] `SOURCE_PRIOR.bluesky = 7` not asserted in tests [score-digest-signals.mjs:30] — TREND_PROXY 38 is tested; urgency/source prior 7 has no anti-drift assertion (AC6/AC8).
- [x] [Review][Patch] Duplicate handles in `MORNING_DIGEST_BSKY_ACTORS` not deduped [fetch-bluesky-signals.mjs:46] — Repeated handles cause redundant API calls and duplicate posts.

- [x] [Review][Defer] Terminal timeout budget vs 8 default actors [task-prompt.md / hermes-run-bluesky.sh] — 45s Hermes timeout vs worst-case ~240s serial fetch; operator can trim `MORNING_DIGEST_BSKY_ACTORS`; same class as other multi-call sources.
- [x] [Review][Defer] Feed pagination capped at FEED_LIMIT=50 per author [fetch-bluesky-signals.mjs:17] — High-volume authors may omit older in-window posts beyond first page; acceptable v1 scope.
- [x] [Review][Defer] Reply/repost-only feed entries may map poorly [fetch-bluesky-signals.mjs:131] — `mapFeedPost` reads `record.text` only; repost-without-embed entries dropped; v1 getAuthorFeed scope.
- [x] [Review][Defer] Custom AppView host has no allowlist [fetch-bluesky-signals.mjs:58] — Operator-controlled env override; same trust model as other ingest endpoints.
- [x] [Review][Defer] Empty `posts[]` after successful HTTP without `error` key [fetch-bluesky-signals.mjs:379] — Task-prompt treats empty array as agent-layer failure; consistent with other adapters.
- [x] [Review][Defer] Duplicate bluesky cap tests in adapter + score-signals suites — Maintenance drift only; both pass.

---

## Dev Notes

### File paths (repo SSOT → Hermes mirror)

| Action | Repo path | Installed mirror |
|--------|-----------|------------------|
| **Create** | `scripts/hermes-skill-examples/morning-digest/scripts/fetch-bluesky-signals.mjs` | `~/.hermes/skills/cns/morning-digest/scripts/` |
| **Create** | `scripts/session-close/hermes-run-bluesky.sh` | _(session-close stays in repo)_ |
| **Update** | `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` | mirrored |
| **Update** | `scripts/hermes-skill-examples/morning-digest/SKILL.md` | mirrored |
| **Update** | `scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs` | mirrored |
| **Update** | `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs` | mirrored |
| **Update** | `scripts/trend-ingest.env.example` | operator copy at `~/.hermes/trend-ingest.env` |

### AT Protocol implementation (binding — port from last30days read-only)

**Endpoints (public v1 — no auth):**

```text
GET {appview}/xrpc/com.atproto.identity.resolveHandle?handle={handle}
  → { did: "did:plc:..." }

GET {appview}/xrpc/app.bsky.feed.getAuthorFeed?actor={did}&limit={n}
  → { feed: [{ post: { uri, record, author, likeCount, repostCount, replyCount, quoteCount, indexedAt } }] }
```

**Field mapping (feed item → stdout post):**

| AT Protocol | stdout |
|-------------|--------|
| `post.record.text` | `title` (trim; truncate to ~280 if needed) |
| `post.author.handle` | `authorHandle` |
| `post.uri` rkey suffix | build `url` |
| `post.likeCount` | `likes` |
| `post.repostCount` | `reposts` |
| `post.replyCount` | `replies` |
| `post.quoteCount` | `quotes` |
| `post.indexedAt` or `post.record.createdAt` | `publishedAt` ISO string |

Reference: `last30days-skill-reference/.../bluesky.py` `parse_bluesky_response()` lines 287–304 for URI→URL and engagement field names.

**Do not** implement `app.bsky.feed.searchPosts` or `createSession` — out of scope (addendum A3 optional future).

### Adapter skeleton (mirror `fetch-github-signals.mjs` + `fetch-reddit-signals.mjs`)

```javascript
// fetch-bluesky-signals.mjs — Bluesky AT Protocol for morning-digest Source 12
// stdout: {"posts":[...]} or {"error":"..."}; always exit 0

import { mergeTrendIngestEnv } from './fetch-arxiv-rss.mjs';

const APPVIEW_DEFAULT = 'https://api.bsky.app';
const FETCH_TIMEOUT_MS = 15_000;
const MAX_POSTS_DEFAULT = 25;
const MAX_POSTS_HARD = 50;
const LOOKBACK_HOURS_DEFAULT = 24;
const ACTOR_DELAY_MS = 100;

export const DEFAULT_BSKY_ACTORS = [
  'karpathy.bsky.social',
  'simonwillison.net',
  // … 6–10 more AI/tech handles
];
```

### normalizeEngagement branch (binding)

```javascript
export const BSKY_LIKES_CAP = 20000;
export const BSKY_REPOSTS_CAP = 5000;
export const BSKY_REPLIES_CAP = 2000;
export const BSKY_QUOTES_CAP = 1000;

// case 'bluesky':
return Math.round(
  0.40 * logNorm(meta.likes, BSKY_LIKES_CAP) +
  0.30 * logNorm(meta.reposts, BSKY_REPOSTS_CAP) +
  0.20 * logNorm(meta.replies, BSKY_REPLIES_CAP) +
  0.10 * logNorm(meta.quotes, BSKY_QUOTES_CAP),
);
```

Weights from `last30days-skill-reference/.../signals.py` line 96 — port formula only, not Python runtime.

### §9 mapping helper (test pattern — mirror Product Hunt)

```javascript
function blueskyPostToDigestSignal(post, rank) {
  const sourceMetadata = {
    authorHandle: post.authorHandle,
    likes: post.likes,
    reposts: post.reposts,
    replies: post.replies,
    quotes: post.quotes,
  };
  if (post.publishedAt) sourceMetadata.publishedAt = post.publishedAt;
  return {
    section: 'bluesky',
    sourceType: 'bluesky',
    title: post.title,
    summary: post.title.slice(0, 200),
    url: post.url,
    rank,
    sourceMetadata,
  };
}
```

### Source ordering vs Source 11 (X)

| Source | Story | Insert point |
|--------|-------|--------------|
| **12 Bluesky** | **68-5** (this story) | After Source 10, before Source 6 |
| **11 X/Twitter** | 68-6/68-7 | After Source 10, before Source 12 (when shipped) |

For 68-5 only: gate text = Sources **9, 10, 12** before Source 6. When 68-6 lands, expand gate to **9, 10, 11, 12**.

### Dependency on 68-4 (schema gate)

Live Convex push requires cns-dashboard validators from **68-4**:
- `digestSourceTypeValue` includes `bluesky`
- `digestSectionValue` includes `bluesky`
- `sourceMetadataValidator` accepts `authorHandle`, `likes`, `reposts`, `replies`, `quotes`

As of baseline commit, sibling `cns-dashboard/convex/validators.ts` already contains these literals — confirm `npm test` in cns-dashboard before first live push. Implement Omnipotent.md pipeline fully even if 68-4 story status is still `ready-for-dev`.

### What must be preserved

- **68-1 dedup** — runs after §9 map; bluesky rows participate in URL/title clustering unchanged
- **Existing sources 1–10** — no regressions to stdout keys or gates
- **ADR-E67-001** — Node-only adapters; read last30days as codebook only
- **Exit 0 failure pattern** — all morning-digest fetch scripts
- **HOME remap in shell wrappers** — Epic 59 Hermes profile isolation

### Anti-patterns (do not)

- Do not subprocess `bluesky.py` or any Python from last30days
- Do not use stdout key `tweets[]` or `entries[]` — **`posts[]` only**
- Do not put engagement fields at signal root in §9 push
- Do not require `BSKY_HANDLE` / app password in v1
- Do not edit `cns-dashboard/convex/validators.ts` (68-4 scope)
- Do not implement Source 11 X adapter (68-6 scope)
- Do not remove title dedupe in `pick-signal-notebook.mjs` — orthogonal to cross-source dedup

### Previous story intelligence

**68-1 (dedup):** `SOURCE_PRIORITY` already includes `bluesky: 5`. Merged clusters can list `sourceType: 'bluesky'` in `contributingSources[]`. Dedup runs **before** scoring — bluesky adapter output must include `url` and `publishedAt` for cluster keys.

**68-4 (schema):** Paired literals `section: 'bluesky'` + `sourceType: 'bluesky'`. Social metadata on primary `sourceMetadata`, not only on contributor child rows.

**67-5 (Product Hunt pattern):** Mirror adapter structure (`run*Fetch`, config loader, fixture tests, shell wrapper, task-prompt Source N block, `normalizeEngagement` branch, `buildDigestSignals` extract helper).

### Testing fixtures

Provide mocked `getAuthorFeed` JSON with at least:
- one post with full engagement counts
- one post missing optional fields (should still map with zeros)
- handle resolve fixture returning `did:plc:test`

CLI smoke (optional, not CI): `bash scripts/session-close/hermes-run-bluesky.sh` with default actors — expect JSON stdout exit 0.

### Git intelligence (recent patterns)

- `6c18ea9` — Epic 68-1 dedup engine + HN URL fix: follow same test file naming (`morning-digest-*-adapter.test.mjs`) and export testable pure functions from adapter
- Product Hunt (67-5): established Source 10 end-to-end pattern this story mirrors for Source 12

### Project Structure Notes

- Canonical task-prompt: `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` (not `scripts/session-close/`)
- Verify gate: `bash scripts/verify.sh` from Omnipotent.md root
- Deferred: Reddit OAuth (67-2) — unrelated; Bluesky v1 avoids credential friction intentionally

### References

- [Source: `_bmad-output/planning-artifacts/prds/prd-epic-68-2026-06-11/prd.md` §4.3, §6.2]
- [Source: `_bmad-output/planning-artifacts/prds/prd-epic-68-2026-06-11/addendum.md` §A3, §A5]
- [Source: `_bmad-output/implementation-artifacts/68-1-cross-source-dedup-engine.md`]
- [Source: `_bmad-output/implementation-artifacts/68-4-schema-literals-twitter-bluesky.md`]
- [Source: `_bmad-output/implementation-artifacts/67-5-producthunt-adapter-source-10.md` — integration pattern]
- [Source: `docs/ADR-E67-001-last30days-codebook-only.md`]
- [Source: `last30days-skill-reference/skills/last30days/scripts/lib/bluesky.py` — field shapes read-only]
- [Source: `last30days-skill-reference/skills/last30days/scripts/lib/signals.py` — bluesky engagement weights]
- [Source: `scripts/hermes-skill-examples/morning-digest/scripts/fetch-reddit-signals.mjs` — `posts[]` stdout pattern]
- [Source: `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs` — normalizeEngagement]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor)

### Debug Log References

### Completion Notes List

- Implemented Source 12 Bluesky adapter using public AT Protocol AppView (`resolveHandle` + `getAuthorFeed`); stdout contract `posts[]` with graceful `{"error":"..."}` exit-0 failures.
- Wired Source 12 into task-prompt/SKILL.md: terminal checklist row 12, Sources 9–12 gate before Source 6, §9 mapping (`section`/`sourceType: bluesky`), Discord template, and `digest_sources.bluesky`.
- Added `normalizeEngagement` bluesky branch with A3 weights (likes 0.40, reposts 0.30, replies 0.20, quotes 0.10); exported `BSKY_*_CAP` constants; `SOURCE_PRIOR.bluesky=7`, `TREND_PROXY_PRIOR.bluesky=38`.
- Added `extractBlueskySignals()` (top 2 by likes+reposts) in pick-signal-notebook after Product Hunt.
- Tests: `morning-digest-bluesky-adapter.test.mjs` + extensions to score-signals, hermes-skill, pick-signal-notebook tests. `bash scripts/verify.sh` green; Hermes skill mirrored via install script.

### File List

- `scripts/hermes-skill-examples/morning-digest/scripts/fetch-bluesky-signals.mjs` (new)
- `scripts/session-close/hermes-run-bluesky.sh` (new)
- `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md`
- `scripts/hermes-skill-examples/morning-digest/SKILL.md`
- `scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs`
- `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs`
- `scripts/trend-ingest.env.example`
- `tests/morning-digest-bluesky-adapter.test.mjs` (new)
- `tests/morning-digest-score-signals.test.mjs`
- `tests/hermes-morning-digest-skill.test.mjs`
- `tests/morning-digest-pick-signal-notebook.test.mjs`

### Change Log

- 2026-06-11: Story 68-5 — Bluesky Source 12 adapter, scoring branch, task-prompt/SKILL integration, tests (FR-8, FR-9, FR-10).
- 2026-06-11: Code review patches — strict lookback, URL/handle dedupe, empty-actor error path, fetchAuthorFeed test, SOURCE_PRIOR assertion, SKILL headings fix.

---

## Story Completion Status

- **Status:** done
- **Completion note:** Bluesky Source 12 adapter, scoring integration, task-prompt wiring, and code-review patches complete (FR-8, FR-9, FR-10). Verify gate passed.
