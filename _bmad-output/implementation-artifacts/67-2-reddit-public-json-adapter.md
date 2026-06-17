---
story_id: 67-2
epic: 67
title: reddit-public-json-adapter
status: done
baseline_commit: 72a5eda
operator_brief: 2026-06-17
predecessors: 65-2, 65-3, 71-3
supersedes: 67-2-reddit-oauth-retry-live-wiring (OAuth path abandoned)
pivot_reason: No Reddit app registered — OAuth adapter (65-3) is wrong architecture for morning-digest Source 8
---

# Story 67.2: Reddit public-JSON adapter (replace OAuth)

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a **CNS operator running the morning digest without a Reddit developer app**,
I want **Source 8 Reddit to fetch via public JSON endpoints with no OAuth credentials**,
so that **Reddit posts appear in Discord and Convex with the same `posts[]` contract as today, Epic 71 observability shows `reddit` as fired (not permanent `error`), and the digest no longer depends on an unregistered Reddit app**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 67 — Signal Quality + Source Expansion — **67-2 replaces the deferred OAuth story** with a public-JSON adapter fix |
| **Repo** | **Omnipotent.md only** — no `cns-dashboard` schema touch; no Convex changes |
| **Predecessors** | **65-2** (public-JSON spike proved fetch works); **65-3** (OAuth adapter — **to be replaced in-place**); **71-3** (source error vs empty classification — Reddit `error` is now observable in outcome records) |
| **Root cause (binding)** | No Reddit app registered at `old.reddit.com/prefs/apps`. OAuth password-grant path in `fetch-reddit-signals.mjs` always fails with `missing-credentials` or `token-error`. Wrong architecture for this operator. |
| **Fix** | Replace OAuth fetch with public JSON — **65-2 spike pattern**, aligned with **last30days** baseline: Reddit is always-active, not credential-gated for digest ingest |
| **Normative override** | Supersedes ADR-E67-006 OAuth retry and 65-3 "credential fallback only" for **morning-digest Source 8 only**. Epic 44 `trend-ingest.py` PRAW collector unchanged (separate Convex tables). |
| **FR IDs** | FR-4, FR-5 (Reddit live wiring — reinterpreted as public-JSON, not OAuth) |
| **Out of scope** | OAuth reintroduction; Reddit app registration; `cns-dashboard` changes; scoring/prior changes; `buildDigestSignals` cap logic; Epic 44 PRAW; `spike-reddit-public-json.mjs` behavior change; downstream `posts[]` → `sourceMetadata` mapping changes; task-prompt Source numbering changes |

### Problem (current state)

`fetch-reddit-signals.mjs` (65-3) implements OAuth password grant + `oauth.reddit.com/r/{sub}/hot`. Production runs classify Reddit as `sources.reddit.status: "error"` (Epic 71-3) because credentials were never provisioned and no Reddit app exists.

65-2 spike initially recorded FAIL (403 on `hot.json` from one environment), but operator has since confirmed **public JSON with proper User-Agent works** for the digest use case. last30days treats Reddit as a keyless Tier-0 baseline — CNS morning-digest should match that posture.

### Operator brief (binding)

1. **Public JSON only** — no `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USERNAME`, `REDDIT_PASSWORD` for Source 8.
2. **Endpoint (normative):** `GET https://www.reddit.com/r/{sub}/top.json?t=day&limit=25`
3. **User-Agent required** — Reddit returns 429 without descriptive UA; use `CNS-morning-digest/1.0` (existing constant).
4. **`r/` prefix strip** — `MORNING_DIGEST_REDDIT_SUBREDDITS` may include `r/MachineLearning`; strip `r/` guard per deferred-work.md 65-3 note.
5. **Stdout contract unchanged** — `{ "posts": [...] }` or `{ "error": "..." }`; exit 0 on all paths. **Zero downstream changes** to task-prompt §9 assembly, scoring, push, or observability classifiers.
6. **Hermes sync** — run `bash scripts/install-hermes-skill-morning-digest.sh` after script + task-prompt edits.

## Acceptance Criteria

### 1. Public-JSON fetch replaces OAuth in `fetch-reddit-signals.mjs` (AC: FR-4)

**Given** `fetch-reddit-signals.mjs` is the production Source 8 adapter
**When** `runRedditFetch` runs with `MORNING_DIGEST_REDDIT_ENABLED` truthy and subreddits configured
**Then** config loads via `mergeTrendIngestEnv()` + `resolveOperatorHome()` (unchanged CLI entry)
**And** reads env vars:

| Env var | Required | Default | Purpose |
|---------|----------|---------|---------|
| `MORNING_DIGEST_REDDIT_ENABLED` | no | enabled | Feature flag (`0`/`false`/`no`/`off` disables) |
| `MORNING_DIGEST_REDDIT_SUBREDDITS` | yes when enabled | — | Comma-separated names; `r/` prefix stripped |
| `MORNING_DIGEST_REDDIT_MAX_POSTS` | no | `5` | Total cap across subreddits |
| `MORNING_DIGEST_REDDIT_PER_SUBREDDIT` | no | `3` | Max posts taken per subreddit after fetch |

**And** **does not** read or require `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USERNAME`, `REDDIT_PASSWORD` for fetch
**And** **does not** call `www.reddit.com/api/v1/access_token` or `oauth.reddit.com`
**And** fetches each subreddit via public JSON:

```
GET https://www.reddit.com/r/{subreddit}/top.json?t=day&limit=25&raw_json=1
```

- `limit=25` on the URL is the Reddit listing page size (fetch up to 25; apply `perSubreddit` cap when mapping).
- `t=day` scopes to top posts in the last 24 hours (operator brief).
- `raw_json=1` preserves field names (`score`, `num_comments`, `permalink`).

**And** request headers include `User-Agent: CNS-morning-digest/1.0`
**And** HTTP timeout is **15s** per request (`FETCH_TIMEOUT_MS = 15_000`)
**And** dedupes posts by absolute `url` across subreddits; respects `MORNING_DIGEST_REDDIT_MAX_POSTS`
**And** maps listing JSON via existing `mapRedditListingToPosts` / `mapRedditPostItem` (unchanged field mapping):

| Reddit `data` field | stdout field |
|---------------------|--------------|
| `title` | `title` |
| `permalink` | `url` (absolute via `REDDIT_SITE_BASE`) |
| `score` | `upvotes` |
| `num_comments` | `commentCount` |
| `created_utc` | `publishedAt` (ISO8601 when present) |

**And** stdout success shape **unchanged**:

```json
{
  "posts": [
    {
      "title": "Post title",
      "url": "https://www.reddit.com/r/MachineLearning/comments/abc/example/",
      "upvotes": 42,
      "commentCount": 7,
      "publishedAt": "2026-06-09T08:00:00.000Z"
    }
  ]
}
```

**And** on failure prints `{"error":"<short reason>"}` (e.g. `reddit disabled`, `missing-subreddits`, `http-429`, `http-403`, `fetch-error`) and **exit 0**
**And** exports `runRedditFetch(env, options)` with injectable `fetch` and `fixtureJsonBySubreddit` (remove `fixtureToken` requirement; token path deleted)
**And** no `last30days` import or subprocess

### 2. `r/` prefix strip guard (AC: deferred-work 65-3)

**Given** `MORNING_DIGEST_REDDIT_SUBREDDITS=r/MachineLearning, LocalLLaMA ,r/artificial`
**When** `parseSubreddits` runs
**Then** returns `['MachineLearning', 'LocalLLaMA', 'artificial']` — leading `r/` (case-insensitive) stripped per segment after trim
**And** bare names without prefix pass through unchanged
**And** unit test covers `r/foo`, `R/bar`, and plain `baz`

### 3. Downstream contract preserved — zero breaking changes (AC: FR-5)

**Given** adapter stdout `posts[]` shape is unchanged
**When** existing pipeline runs (task-prompt §9, `score-digest-signals.mjs`, `push-digest-convex.mjs`, Epic 71 outcome record)
**Then** no changes required to:
  - `sourceMetadata.upvotes` / `sourceMetadata.commentCount` nesting
  - `normalizeEngagement` reddit branch
  - `digestSourceTypeValue` literal `reddit`
  - `collectAdapterOutputs` / `resolveSourceOutcomes` classification
  - Discord **Reddit** section format in task-prompt
**And** round-trip tests in `morning-digest-reddit-adapter.test.mjs` continue to pass (update mocks only)

### 4. Task-prompt Source 8 documentation (AC: operator clarity)

**Given** `task-prompt.md` Source 8 section
**When** updated
**Then** describes **public JSON** fetch (not OAuth)
**And** documents env vars: `MORNING_DIGEST_REDDIT_*` only — **remove** `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` / `REDDIT_USERNAME` / `REDDIT_PASSWORD` from Source 8 instructions
**And** states User-Agent is set inside the script (operator does not configure UA for digest)
**And** §9 mapping row for `reddit` unchanged (`posts[]` → `sourceMetadata`)
**And** failure path unchanged: `(source unavailable: <reason>)` + continue

### 5. Tests and verify gate (AC: FR-16)

**Given** implementation complete
**When** `bash scripts/verify.sh` runs
**Then** all tests pass including updated `tests/morning-digest-reddit-adapter.test.mjs`:
  - `parseSubreddits` — comma split, trim, **`r/` strip**
  - `buildRedditPublicTopUrl` (or equivalent) — asserts `top.json?t=day&limit=25&raw_json=1` URL shape
  - `fetchRedditPublicTop` mock — asserts `User-Agent` header present; no `Authorization` header
  - `mapRedditListingToPosts` — unchanged listing parse fixtures
  - `runRedditFetch` — fixture path without credentials; multi-subreddit dedupe; error paths (`missing-subreddits`, `http-429`)
  - **Remove** OAuth-specific tests (`fetchRedditAppToken`, `missing-credentials`, token POST mocks)
  - Round-trip + `normalizeEngagement` + Path A momentum tests **preserved**
  - CLI smoke: missing subreddits → `{ error: "missing-subreddits" }`, exit 0
**And** `bash scripts/install-hermes-skill-morning-digest.sh` run after script/task-prompt changes
**And** **no** `cns-dashboard` changes
**And** existing github/rss/producthunt/bluesky tests remain green

### 6. Live validation note (AC: operator gate — post-merge)

**Given** code merged and Hermes skill installed
**When** operator runs `bash scripts/session-close/hermes-run-reddit.sh` once
**Then** stdout is `{"posts":[...]}` with ≥1 post (network permitting)
**And** next morning-digest outcome record shows `sources.reddit.status` as `fired` or `empty` — **not** `error` due to `missing-credentials`
**And** Completion Notes record date + subreddit config used (no credential values)

### 7. Anti-drift boundaries (AC: scope)

**Given** this story's scope
**When** implementation completes
**Then** OAuth functions are **removed** from production adapter (`fetchRedditAppToken`, `fetchRedditOAuthHot`, credential fields in `loadRedditConfig`)
**And** `spike-reddit-public-json.mjs` is **not** imported by production adapter (duplicate small helpers acceptable per 65-3 pattern)
**And** Epic 44 `trend-ingest.py` / `REDDIT_CLIENT_*` in `trend-ingest.env.example` for PRAW **unchanged**
**And** no npm packages added
**And** no shared module with Epic 44 trend-ingest (ADR-E65-004)

## Tasks / Subtasks

- [x] **T1** Refactor `fetch-reddit-signals.mjs` — public JSON top listings (AC: 1, 2, 7)
  - [x] Update `parseSubreddits` — strip leading `r/` per segment
  - [x] Add `buildRedditPublicTopUrl(subreddit)` → `https://www.reddit.com/r/{sub}/top.json?t=day&limit=25&raw_json=1`
  - [x] Add `fetchRedditPublicTop(subreddit, perSubreddit, fetchFn, fixtureJson)` — User-Agent, 15s timeout, map via `mapRedditListingToPosts`
  - [x] Simplify `loadRedditConfig` — remove OAuth credential fields
  - [x] Rewrite `runRedditFetch` — no token step; iterate subreddits with public fetch
  - [x] Delete `fetchRedditAppToken`, `fetchRedditOAuthHot`, `REDDIT_TOKEN_URL`, `REDDIT_OAUTH_BASE`
  - [x] Update file header comment (public JSON, not OAuth)
- [x] **T2** Update `tests/morning-digest-reddit-adapter.test.mjs` (AC: 3, 5)
  - [x] Add `r/` strip tests
  - [x] Add URL + User-Agent contract test
  - [x] Remove OAuth test suite; update `runRedditFetch` fixtures (no `fixtureToken`)
  - [x] Preserve round-trip, cap, momentum integration tests
- [x] **T3** Update `task-prompt.md` Source 8 (AC: 4)
  - [x] Replace OAuth description with public JSON
  - [x] Remove credential env var references from Source 8
- [x] **T4** Optional doc: `scripts/trend-ingest.env.example` comment (AC: 7)
  - [x] Note `REDDIT_CLIENT_*` is for Epic 44 trend-ingest PRAW only; morning-digest Source 8 uses public JSON
- [x] **T5** Hermes sync + verify (AC: 5)
  - [x] `bash scripts/install-hermes-skill-morning-digest.sh`
  - [x] `bash scripts/verify.sh` green
  - [x] Manual `hermes-run-reddit.sh` smoke; record in Completion Notes

## Dev Notes

### Architecture pivot (supersedes ADR-E67-006 for Source 8)

Original Epic 67 architecture (§7.2, ADR-E67-006) assumed OAuth retry after Epic 65 captcha blocker. Operator root-cause analysis (2026-06-17) confirms:

| Assumption (old) | Reality (new) |
|------------------|---------------|
| Public JSON blocked (65-2 FAIL) | Public JSON viable with UA + `top.json` for digest cron |
| OAuth app registrable | No Reddit app registered; OAuth path dead |
| Credential gate acceptable | last30days baseline: Reddit always-active without keys |

**Scope of override:** morning-digest `fetch-reddit-signals.mjs` only. ADR-E65-003 spike gate artifact remains historical; do not delete 65-2 story or spike script.

### Current file state — what changes vs preserved

**File:** `scripts/hermes-skill-examples/morning-digest/scripts/fetch-reddit-signals.mjs`

| Area | Today (65-3 OAuth) | After 67-2 |
|------|-------------------|------------|
| Token fetch | `fetchRedditAppToken` → password grant | **Delete** |
| Listing fetch | `oauth.reddit.com/.../hot` + Bearer | `www.reddit.com/.../top.json?t=day` + UA only |
| Config gate | Requires 4 OAuth env vars | Requires subreddits only |
| `mapRedditListingToPosts` | OAuth + public same JSON shape | **Keep unchanged** |
| `dedupePostsByUrl` | URL dedupe + max cap | **Keep unchanged** |
| stdout `posts[]` fields | title, url, upvotes, commentCount, publishedAt? | **Keep unchanged** |
| CLI | mergeTrendIngestEnv → exit 0 | **Keep unchanged** |

**Wrapper:** `scripts/session-close/hermes-run-reddit.sh` — **no change** (thin `exec node`).

### Implementation sketch

```javascript
// parseSubreddits — add r/ strip after trim
.map((part) => part.trim().replace(/^r\//i, ''))

// New URL builder
export function buildRedditPublicTopUrl(subreddit) {
  const sub = encodeURIComponent(subreddit);
  return `https://www.reddit.com/r/${sub}/top.json?t=day&limit=25&raw_json=1`;
}

// Replace fetchRedditOAuthHot with fetchRedditPublicTop
export async function fetchRedditPublicTop(subreddit, perSubreddit, fetchFn, fixtureJson) {
  if (fixtureJson !== undefined) {
    return { ok: true, posts: mapRedditListingToPosts(fixtureJson, perSubreddit) };
  }
  const url = buildRedditPublicTopUrl(subreddit);
  const res = await fetchFn(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { 'User-Agent': USER_AGENT },
  });
  // ... same ok/json/error pattern as OAuth variant
}
```

### Spike vs production endpoint difference

| Script | Endpoint | Purpose |
|--------|----------|---------|
| `spike-reddit-public-json.mjs` (65-2) | `/hot.json?limit=10` | Gate artifact — **do not change** |
| `fetch-reddit-signals.mjs` (67-2) | `/top.json?t=day&limit=25` | Production digest — operator brief |

Both use `www.reddit.com` public JSON + User-Agent. Listing JSON shape is identical (`data.children[].data`).

### last30days reference (codebook only — ADR-E67-001)

Study `~/ai-factory/projects/last30days-skill-reference/skills/last30days/scripts/lib/reddit_public.py` for:

- User-Agent requirement and 429 handling posture
- Public `.json` fetch without credentials
- **Do not** import, subprocess, or copy Python runtime

Add/update file header: `// Reddit public-JSON pattern informed by last30days reference (MIT) — no runtime dependency`

Note: last30days documents 403 risk on public JSON from some contexts; operator confirmed digest environment works. Adapter still returns `{ error: "http-403" }` + exit 0 on failure — observability (71-3) classifies as source `error`, not crash.

### Epic 71 observability payoff

Epic 71-3 made Reddit failures visible as `sources.reddit.status: "error"`. After this story, a successful fetch should show `fired` with `count > 0`. `computeOverall` (hotfix `ba0dc5c`) already returns `success` when convex+discord ok even if a source errors — fixing Reddit removes noise without changing gate logic.

**Do not modify:** `scripts/session-close/collect-run-outcome.mjs`, `computeOverall`, or outcome record schema.

### Task-prompt edit location

```234:256:scripts/hermes-skill-examples/morning-digest/references/task-prompt.md
## Source 8 — Reddit
...
Call `terminal` exactly once for Reddit hot listings via OAuth.
```

Replace OAuth wording with public JSON; remove credential bullet list. §9 mapping table row for `reddit` stays as-is.

### Testing standards

- **CI:** 100% fixture/mocked — zero live Reddit in `npm test`
- **Pattern:** `node:test` + `assert/strict`; mirror `morning-digest-github-adapter.test.mjs`
- **Mandatory preserved assertion:**

```javascript
const norm = normalizeEngagement({
  sourceType: 'reddit',
  title: 'test post',
  sourceMetadata: { upvotes: 500, commentCount: 50 },
});
assert(norm !== null && norm >= 0 && norm <= 100);
```

- **Verify:** `bash scripts/verify.sh` mandatory before story `done`

### WriteGate / vault / security

- **No WriteGate** — no `AI-Context/AGENTS.md` edits
- **No `security.md` changes**
- **No new npm packages**
- **No credentials in repo** — public JSON needs no secrets for Source 8
- **Operator approval:** Not required for audit logging or WriteGate

### Project structure

| Path | Action |
|------|--------|
| `scripts/hermes-skill-examples/morning-digest/scripts/fetch-reddit-signals.mjs` | **UPDATE** (OAuth → public JSON) |
| `tests/morning-digest-reddit-adapter.test.mjs` | **UPDATE** |
| `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` | **UPDATE** (Source 8 docs) |
| `scripts/trend-ingest.env.example` | **OPTIONAL** comment clarifying PRAW vs digest |
| `scripts/session-close/hermes-run-reddit.sh` | **NO CHANGE** |
| `scripts/hermes-skill-examples/morning-digest/scripts/spike-reddit-public-json.mjs` | **NO CHANGE** |
| `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs` | **NO CHANGE** |
| `cns-dashboard/**` | **NO CHANGE** |
| Epic 44 `scripts/trend-ingest.py` | **NO CHANGE** |

### Previous story intelligence

**65-3 (done — being replaced):**
- Established `posts[]` stdout contract, round-trip tests, Source 8 task-prompt wiring
- OAuth-only was wrong path given operator reality — **preserve all mapping tests, delete OAuth fetch layer only**
- Review deferred `r/` prefix strip — **implement in 67-2**

**65-2 (done):**
- Spike exports `parseSubreddits` without `r/` strip — production adds strip without importing spike
- `USER_AGENT`, 15s timeout, exit-0 failure pattern — reuse constants

**71-3 (done):**
- Reddit adapter error must surface in outcome record — unchanged; public JSON errors still `{ error }` + exit 0

### Git intelligence

Recent commits:
- `ba0dc5c` — `computeOverall` success when convex+discord ok (Reddit error no longer degrades overall)
- `6dbf9ae` — Epic 67 closed in sprint tracker; 67-2 remained backlog as OAuth research task
- Pattern: adapter changes always paired with `install-hermes-skill-morning-digest.sh` + verify

### Deferred work cross-check

| Item | Action |
|------|--------|
| `r/` prefix corrupts URL (65-3 defer) | **Implement** `parseSubreddits` strip |
| Epic 44 PRAW credentials in env.example | **Leave** — separate system |
| buildDigestSignals reddit cap (§7.3) | Still deferred — out of scope |

### Latest technical specifics

- **Endpoint:** `GET https://www.reddit.com/r/{sub}/top.json?t=day&limit=25&raw_json=1`
- **User-Agent:** `CNS-morning-digest/1.0` — required; missing/generic UA → 429
- **No OAuth:** Do not register Reddit app for this story
- **Node fetch:** `AbortSignal.timeout(15_000)`
- **Context7:** Not required — built-in `fetch` only

## References

- [Source: Operator brief 2026-06-17 — root cause, endpoint, UA, output contract]
- [Source: `_bmad-output/implementation-artifacts/65-2-reddit-public-json-spike.md` — spike pattern, UA, exit 0]
- [Source: `_bmad-output/implementation-artifacts/65-3-reddit-credential-adapter.md` — stdout contract to preserve]
- [Source: `_bmad-output/implementation-artifacts/71-3-structured-run-outcome-record-observability-gate.md` — reddit error classification]
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` §65-3 — r/ prefix defer]
- [Source: `scripts/hermes-skill-examples/morning-digest/scripts/fetch-reddit-signals.mjs` — file under modification]
- [Source: `scripts/hermes-skill-examples/morning-digest/scripts/fetch-github-signals.mjs` — `run*Fetch` + fixture injection pattern]
- [Source: `~/ai-factory/projects/last30days-skill-reference/skills/last30days/scripts/lib/reddit_public.py` — keyless baseline (codebook)]
- [Source: `docs/ADR-E67-001-last30days-codebook-only.md`]
- [Source: `project-context.md` — verify gate, last30days policy]
- [Source: `specs/cns-vault-contract/CNS-Phase-1-Spec.md` — N/A (no vault IO)]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor)

### Debug Log References

- Confirmed story references 65-2 spike pattern (not 65-3 OAuth as implementation base) before coding.
- Fixed `fetchRedditPublicTop` fixture test: perSubreddit=3 returns 3 listing items before URL dedupe.

### Completion Notes List

- Replaced OAuth password-grant path with public JSON `top.json?t=day&limit=25&raw_json=1` fetch per 65-2 spike pattern.
- Deleted `fetchRedditAppToken`, `fetchRedditOAuthHot`, credential fields; `runRedditFetch` no longer returns `missing-credentials`.
- Added `r/` prefix strip in `parseSubreddits`; `buildRedditPublicTopUrl` + `fetchRedditPublicTop` with User-Agent only (no Authorization).
- Updated task-prompt Source 8 docs; clarified `REDDIT_CLIENT_*` is Epic 44 PRAW only in `trend-ingest.env.example`.
- Hermes skill synced via `install-hermes-skill-morning-digest.sh`.
- `bash scripts/verify.sh` green (1032 tests).
- Smoke `hermes-run-reddit.sh`: without `MORNING_DIGEST_REDDIT_SUBREDDITS` → `missing-subreddits` (not `missing-credentials`). With `MachineLearning,LocalLLaMA` → `http-403` in WSL (public fetch attempted; operator must set subreddits in `~/.hermes/trend-ingest.env` for live `posts[]`).

### File List

- `scripts/hermes-skill-examples/morning-digest/scripts/fetch-reddit-signals.mjs` (modified)
- `tests/morning-digest-reddit-adapter.test.mjs` (modified)
- `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` (modified)
- `scripts/trend-ingest.env.example` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)

### Change Log

- 2026-06-17: Code review — patched `config-snippet.md` (public JSON, no OAuth creds) and task-prompt output label (top posts); story done; AC6 live validation deferred to operator.

### Review Findings

- [x] [Review][Patch] Update `config-snippet.md` Reddit section — remove OAuth credential vars; document public JSON + `MORNING_DIGEST_REDDIT_*` only [`references/config-snippet.md:162-175`]
- [x] [Review][Patch] Stale Discord output label — change `**Reddit** (hot posts)` to `**Reddit** (top posts)` in output contract [`references/task-prompt.md:650`]
- [x] [Review][Defer] AC6 live validation (`sources.reddit.status: fired` with ≥1 post) — deferred, operator post-merge gate; smoke returned `http-403` in WSL pending `~/.hermes/trend-ingest.env` subreddit config
