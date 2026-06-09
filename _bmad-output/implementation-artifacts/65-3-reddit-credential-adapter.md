---
story_id: 65-3
epic: 65
title: reddit-credential-adapter
status: done
baseline_commit: 075863e
operator_brief: 2026-06-09
predecessors: 65-1, 65-2
blocks: none
spike_gate: 65-2 FAIL — credential fallback only
---

# Story 65.3: Reddit OAuth credential adapter

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a **CNS operator consuming ranked intelligence in the Nexus cockpit**,
I want **a Reddit fetch adapter using OAuth credentials that feeds the morning-digest pipeline with engagement metadata**,
so that **Reddit posts appear in Discord and Convex with `sourceMetadata.upvotes` and `commentCount` driving `normalizeEngagement`, the digest degrades gracefully when Reddit is unavailable, and production ingest works under unattended cron after the 65-2 spike documented public-JSON failure**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 65: Native Source Adapter Expansion v1 — **65-3 is the Reddit production adapter** (blocked until 65-2 gate cleared) |
| **Repo** | **Omnipotent.md only** — no `cns-dashboard` schema touch (65-1 landed `reddit` literals); no Convex schema changes |
| **Predecessors** | **65-1** (schema + priors + task-prompt §9 reddit mapping row); **65-2** (spike gate — **FAIL**, credential path mandated) |
| **65-2 spike outcome (binding)** | Live spike 2026-06-08: `goNoGo: FAIL`, `parseSuccessRate: 0`, `sustainedBlock: true` — all 3 cycles HTTP **403**. **Implement Branch B (OAuth credential) only** — do **not** ship public-JSON as primary fetch path. [Source: `65-2-reddit-public-json-spike.md` Completion Notes] |
| **Normative spec** | `architecture-epic-65-native-source-adapters.md` §5.3, §6.3 (Branch B), §7.1, §10; ADR-E65-001, ADR-E65-002, ADR-E65-003, ADR-E65-004; `prd-epic-65-native-source-adapters.md` §4.4 (FR-7, FR-8) |
| **FR IDs** | FR-7 (Reddit fetch — credential branch per spike), FR-8 (digestSignal emission shape), FR-12 (task-prompt Source 8), FR-16 (verify gate) |
| **Out of scope** | Public-JSON primary adapter (65-2 FAIL forbids); RSS adapter (65-4); HN metadata upgrade (65-5); `buildDigestSignals` cap-10 reddit slot (defer §7.3 — same as 65-1 deferred github slot); scoring formula / prior changes; Epic 44 `trend-ingest.py` Reddit unification; dashboard UI; `last30days` runtime import; npm packages |

### Problem (current state)

65-1 extended schema and priors; 65-2 proved public `.json` hot listings return sustained **403** from this environment. No `fetch-reddit-signals.mjs` or `hermes-run-reddit.sh` exists. Task-prompt §9 documents reddit mapping as **future (65-3)** with no Source 8 terminal step. `normalizeEngagement` reddit branch is live (`upvotes` + `commentCount`) but **no production stdout → digestSignal path** for Reddit.

### Operator brief (binding)

1. **Credential fallback only** — 65-2 FAIL artifact is normative; OAuth Reddit API (`oauth.reddit.com`) is the sole production fetch strategy.
2. **Same adapter pattern as GitHub (65-1)** — `runRedditFetch`, fixture injection, `mergeTrendIngestEnv`, exit 0 on all failure paths, Hermes wrapper shell script, task-prompt Source 8.
3. **Raw engagement only** — emit `upvotes` and `commentCount` in stdout `posts[]`; nest under `sourceMetadata` in §9 assembly; never pre-normalize.
4. **Env in `~/.hermes/trend-ingest.env`** — `MORNING_DIGEST_REDDIT_*` feature/target caps + `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` / `REDDIT_USERNAME` / `REDDIT_PASSWORD` for script-app OAuth.
5. **Independent failure isolation** — Reddit failure → `(source unavailable: …)`; digest continues (existing constraint #7).

## Acceptance Criteria

### 1. Reddit OAuth fetch module and stdout contract (AC: FR-7, ADR-E65-001, §6.3 Branch B)

**Given** `fetch-reddit-signals.mjs` under morning-digest scripts
**When** enabled via `MORNING_DIGEST_REDDIT_ENABLED` (default enabled; falsy: `0`, `false`, `no`, `off`)
**Then** config loads from merged `~/.hermes/trend-ingest.env` via `mergeTrendIngestEnv()` + `resolveOperatorHome()` (import from `fetch-arxiv-rss.mjs`)
**And** reads env vars:

| Env var | Required | Default | Purpose |
|---------|----------|---------|---------|
| `MORNING_DIGEST_REDDIT_ENABLED` | no | enabled | Feature flag |
| `MORNING_DIGEST_REDDIT_SUBREDDITS` | yes when enabled | — | Comma-separated subreddit names **without** `r/` prefix |
| `MORNING_DIGEST_REDDIT_MAX_POSTS` | no | `5` | Total cap across subreddits |
| `MORNING_DIGEST_REDDIT_PER_SUBREDDIT` | no | `3` | Max posts per subreddit fetch |
| `REDDIT_CLIENT_ID` | yes when enabled | — | OAuth app client id |
| `REDDIT_CLIENT_SECRET` | yes when enabled | — | OAuth app secret |
| `REDDIT_USERNAME` | yes when enabled | — | Script-app Reddit username (password grant) |
| `REDDIT_PASSWORD` | yes when enabled | — | Script-app password or app-specific password |

**And** implements `fetchRedditAppToken(clientId, clientSecret, username, password, fetchFn)` — POST `https://www.reddit.com/api/v1/access_token` with `grant_type=password`, HTTP Basic auth (`client_id:client_secret`), body `username` + `password`, `User-Agent: CNS-morning-digest/1.0`
**And** fetches each configured subreddit via OAuth API:

```
GET https://oauth.reddit.com/r/{subreddit}/hot?limit={perSubreddit}&raw_json=1
Authorization: Bearer {access_token}
User-Agent: CNS-morning-digest/1.0
```

**And** HTTP timeout is **15s** per request (`FETCH_TIMEOUT_MS = 15_000`)
**And** dedupes posts by absolute `url` across subreddits; respects `MORNING_DIGEST_REDDIT_MAX_POSTS` total cap
**And** maps OAuth listing JSON per architecture §5.3:

| Reddit `data` field | stdout field |
|---------------------|--------------|
| `title` | `title` |
| `permalink` | `url` (prefix `https://www.reddit.com` when relative) |
| `score` | `upvotes` |
| `num_comments` | `commentCount` |
| `created_utc` | `publishedAt` (ISO8601 when present) |

**And** stdout success shape:

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

**And** on failure prints `{"error":"<short reason>"}` (e.g. `reddit disabled`, `missing-subreddits`, `missing-credentials`, `token-error`, `http-403`) and **exit 0**
**And** **no** public-JSON `www.reddit.com/r/.../hot.json` fetch in production module (65-2 FAIL — credential path only)
**And** no `last30days` import or subprocess
**And** exports `runRedditFetch(env, options)` with injectable `fetch`, `fixtureToken`, `fixtureJsonBySubreddit` for tests (mirror `runGithubFetch`)

**Hermes wrapper:** `scripts/session-close/hermes-run-reddit.sh` — mirror `hermes-run-github.sh` (`exec node` on fetch script).

### 2. Reddit digestSignal emission + scoring integration (AC: FR-8, ADR-E65-002)

**Given** Reddit stdout `posts[]` mapped to Convex push rows
**When** assembled into `digest_push_payload.signals[]` (unscored, pre-`scoreDigestSignals`)
**Then** each row has: `section: 'reddit'`, `sourceType: 'reddit'`, `title`, `url`, `externalId` (stable hash), `sourceMetadata.upvotes` (number, **required** for normalization), optional `sourceMetadata.commentCount`, optional `sourceMetadata.publishedAt`
**And** **never** leave `upvotes`/`commentCount` at signal root — `normalizeEngagement` reads only `sourceMetadata.upvotes` / `sourceMetadata.commentCount`
**And** `normalizeEngagement` reddit branch returns non-null 0–100 when `upvotes` present
**And** fixture `{ upvotes: 10000, commentCount: 2000 }` → `normalizedEngagement === 100` (`RD_UPVOTES_CAP` / `RD_COMMENTS_CAP`)
**And** fixture `{ upvotes: 500, commentCount: 50 }` → non-null; drives Path A momentum via adapter integration test
**And** `scoreDigestSignals` uses existing priors (`SOURCE_PRIOR.reddit: 8`, `TREND_PROXY_PRIOR.reddit: 42` from 65-1) — **no prior changes** in 65-3

**Mandatory integration assertion (architecture §10):**

```javascript
const norm = normalizeEngagement({
  sourceType: 'reddit',
  title: 'test post',
  sourceMetadata: { upvotes: 500, commentCount: 50 },
});
assert(norm !== null && norm >= 0 && norm <= 100);
```

### 3. Task-prompt Source 8 + §9 assembly (AC: FR-12)

**Given** adapter and wrapper exist
**When** `task-prompt.md` is updated
**Then** **Source 8 — Reddit** is documented after Source 7 (GitHub), before Source 6 (NotebookLM):

```text
terminal(command="bash scripts/session-close/hermes-run-reddit.sh", workdir=resolved_repo_root, timeout=45)
```

**And** parse stdout: `posts[]` with `title`, `url`, `upvotes`, `commentCount`, optional `publishedAt`
**And** §9 nest instruction: `posts[].upvotes` → `sourceMetadata.upvotes`, `posts[].commentCount` → `sourceMetadata.commentCount`, `posts[].publishedAt` → `sourceMetadata.publishedAt` when present
**And** Discord **Reddit** section lists `- <title> — <upvotes> upvotes, <commentCount> comments`
**And** on failure: section header **Reddit** + `- (source unavailable: <short reason>)` and **continue** to Source 6
**And** `digest_sources` JSON example extended with optional `reddit: [{ title, url, upvotes }]` after `github`
**And** §9 mapping row for `reddit` updated from "future — 65-3" to Source 8 `posts[]`
**And** Source 7 failure path updated to **continue to Source 8** (not directly to Source 6) when Reddit enabled

### 4. Test and verify gate (AC: FR-16)

**Given** implementation complete
**When** `bash scripts/verify.sh` runs from Omnipotent.md
**Then** all tests pass including new `tests/morning-digest-reddit-adapter.test.mjs` covering:
  - `parseSubreddits` / `loadRedditConfig` — comma split, trim, defaults, disabled flag
  - `fetchRedditAppToken` — mocked token POST (Basic auth header, grant_type=password)
  - `mapRedditListingToPosts` — fixture `data.children[].data` → `posts[]` field mapping (`score`→`upvotes`, `num_comments`→`commentCount`, permalink→absolute url)
  - `runRedditFetch` — mocked OAuth hot fetch across subreddits, dedupe, caps, `delayMs` N/A (single-pass fetch)
  - Missing subreddits / missing credentials / disabled → `{ error: ... }`, exit 0 CLI smoke
  - **Round-trip:** `posts[]` → digestSignal `sourceMetadata` → `normalizeEngagement` non-null
  - **Path A momentum:** adapter-shaped reddit row through `scoreDigestSignals` assigns non-zero momentum
**And** extend `tests/morning-digest-push-convex.test.mjs` — reddit `sourceType` passthrough on mocked Convex HTTP (mirror github row from 65-1)
**And** extend `tests/hermes-morning-digest-skill.test.mjs` if install script parity requires reddit wrapper listing
**And** run `bash scripts/install-hermes-skill-morning-digest.sh` after script/wrapper/task-prompt changes
**And** **no** changes to `cns-dashboard` (verify may still run sibling tests — must remain green)
**And** existing github/HN/spike tests remain green (no regressions)

### 5. Anti-drift boundaries (AC: scope)

**Given** this story's scope
**When** implementation completes
**Then** there is **no** public-JSON production fetch in `fetch-reddit-signals.mjs` (spike module remains gate-only artifact)
**And** no changes to `spike-reddit-public-json.mjs` behavior (may import shared pure parsers only if zero behavioral change to spike)
**And** no changes to `normalizeEngagement` formulas, caps, or priors
**And** no changes to `pick-signal-notebook.mjs` / `buildDigestSignals` reddit slot allocation (§7.3 deferred)
**And** no npm packages added (built-in `fetch` only)
**And** no shared Reddit module with Epic 44 trend-ingest (ADR-E65-004)
**And** no credential values committed to repo

## Tasks / Subtasks

- [x] **T1** `fetch-reddit-signals.mjs` — OAuth credential adapter (AC: 1)
  - [x] `isRedditEnabled`, `parseSubreddits`, `loadRedditConfig`
  - [x] `fetchRedditAppToken` — password grant; export for unit tests
  - [x] `mapRedditListingToPosts(json, cap)` — §5.3 field mapping
  - [x] `fetchRedditOAuthHot(subreddit, token, perSubreddit, fetchFn, fixtureJson)`
  - [x] `dedupePostsByUrl`, `runRedditFetch` with injectable fixtures
  - [x] Main: `mergeTrendIngestEnv` → stdout JSON → exit 0 on all paths
- [x] **T2** `hermes-run-reddit.sh` (AC: 1)
  - [x] Mirror `hermes-run-github.sh` — thin `exec node` wrapper
- [x] **T3** `tests/morning-digest-reddit-adapter.test.mjs` (AC: 2, 4)
  - [x] Config, token mock, listing parse, dedupe, error paths
  - [x] Round-trip + normalizeEngagement + Path A momentum integration
  - [x] CLI smoke: missing-subreddits, missing-credentials
- [x] **T4** `task-prompt.md` — Source 8 + §9 + digest_sources (AC: 3)
  - [x] Source 8 terminal step; update Source 7 failure → continue to Source 8
  - [x] §9 nest mapping for reddit; remove "future — 65-3" markers
  - [x] `digest_sources` example includes `reddit`
- [x] **T5** Push test extension (AC: 4)
  - [x] `morning-digest-push-convex.test.mjs` — reddit signal fixture
- [x] **T6** Verify + Hermes sync (AC: 4)
  - [x] `bash scripts/install-hermes-skill-morning-digest.sh`
  - [x] `bash scripts/verify.sh` green

### Review Findings

**65-1 parity focus (2026-06-09):**

- ✅ **Field-name chain verified:** `score`→`upvotes`, `num_comments`→`commentCount` in adapter; task-prompt §9 nests `posts[].upvotes`→`sourceMetadata.upvotes`, `posts[].commentCount`→`sourceMetadata.commentCount`; `normalizeEngagement` reddit branch reads `meta.upvotes` + `meta.commentCount` only. Round-trip test + root-level negative control + architecture §10 assertion present.
- ✅ **65-2 FAIL gate verified:** No `hot.json`, no spike import, no public listing fetch. Network calls limited to `POST www.reddit.com/api/v1/access_token` and `GET oauth.reddit.com/r/{sub}/hot`. `REDDIT_SITE_BASE` is permalink prefix only.

- [x] [Review][Patch] `access_token: null` passes token guard as literal `"null"` [`fetch-reddit-signals.mjs:194-200`] — fixed: require non-empty string `access_token`; null/undefined/non-string → `token-error`.

- [x] [Review][Defer] `r/` prefix in `MORNING_DIGEST_REDDIT_SUBREDDITS` corrupts OAuth URL silently [`parseSubreddits` + `fetchRedditOAuthHot:220`] — deferred, operator misconfig; story docs say omit `r/` prefix.

## Dev Notes

### 65-2 spike gate (mandatory citation — ADR-E65-003)

65-2 live artifact **FAIL** blocks public-JSON production path:

| Metric | Value |
|--------|-------|
| `goNoGo` | **FAIL** |
| `parseSuccessRate` | 0 |
| `sustainedBlock` | true |
| Cycle failures | 3/3 HTTP **403** (`http-403`) |
| Subreddits tested | `MachineLearning`, `LocalLLaMA`, `artificial` |
| **65-3 branch** | **Credential fallback only** (architecture §6.3 Branch B) |

Do **not** implement Branch A (public-JSON) as primary or fallback in `fetch-reddit-signals.mjs`. The spike script remains the only public-JSON caller.

### Architecture compliance

| ADR | Requirement for 65-3 |
|-----|----------------------|
| **ADR-E65-001** | Native Node `.mjs`; Hermes wrapper; always exit 0; `mergeTrendIngestEnv`; 15s timeout; `CNS-morning-digest/1.0` UA |
| **ADR-E65-002** | Emit raw `upvotes`/`commentCount` in `sourceMetadata`; never pre-normalize; match `normalizeEngagement` field names |
| **ADR-E65-003** | Story cites 65-2 FAIL; credential branch only |
| **ADR-E65-004** | No shared module with Epic 44 trend-ingest Reddit |
| **ADR-E65-005** | last30days reference codebook only — MIT attribution comment if fetch logic derived; zero runtime import |
| **ADR-E64-005** | Same runtime policy extends to Epic 65 |

### GitHub adapter reference pattern (mirror exactly)

Study `fetch-github-signals.mjs` and `tests/morning-digest-github-adapter.test.mjs`:

```167:228:scripts/hermes-skill-examples/morning-digest/scripts/fetch-github-signals.mjs
export async function runGithubFetch(env, options = {}) {
  const fetchFn = options.fetch ?? globalThis.fetch;
  // ...
}
// main: mergeTrendIngestEnv → JSON stdout → process.exit(0)
```

Reddit differences:
- Token acquisition step before hot listing fetches (`fetchRedditAppToken`)
- OAuth endpoint host `oauth.reddit.com` (not `www.reddit.com` public JSON)
- stdout root is `posts[]` (not `repos[]`)
- Dedupe by post `url` (permalink-based absolute URL)
- Config requires OAuth credentials when enabled (GitHub token optional)

**Round-trip helper pattern** (copy from github test file):

```javascript
function redditPostToDigestSignal(post, rank) {
  const sourceMetadata = { upvotes: post.upvotes };
  if (post.commentCount !== undefined) sourceMetadata.commentCount = post.commentCount;
  if (post.publishedAt) sourceMetadata.publishedAt = post.publishedAt;
  return {
    section: 'reddit',
    sourceType: 'reddit',
    title: post.title,
    url: post.url,
    rank,
    sourceMetadata,
  };
}
```

### normalizeEngagement reddit contract (already implemented — do not change)

```153:160:scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs
    case 'reddit': {
      if (!Number.isFinite(meta.upvotes)) {
        return null;
      }
      return Math.round(
        0.75 * logNorm(meta.upvotes, RD_UPVOTES_CAP) +
          0.25 * logNorm(commentCount, RD_COMMENTS_CAP),
      );
```

Caps: `RD_UPVOTES_CAP = 10000`, `RD_COMMENTS_CAP = 2000`. Missing `commentCount` uses 0 for secondary term (same as HN/github secondary fields).

### OAuth token flow (Branch B — normative for this story)

1. **Grant type:** Reddit **script app** password grant (`grant_type=password`) — required for unattended cron read access to subreddit hot listings. Architecture §6.3 lists username/password as script-app context; finalize as password grant in this story (not client_credentials-only — insufficient for subreddit hot in typical Reddit app configs).

2. **Token request:**
   - URL: `POST https://www.reddit.com/api/v1/access_token`
   - Header: `Authorization: Basic ${base64(client_id + ':' + client_secret)}`
   - Header: `User-Agent: CNS-morning-digest/1.0`
   - Body (application/x-www-form-urlencoded): `grant_type=password&username=...&password=...`

3. **Hot listing:** reuse same listing JSON shape as spike (`data.children[].data`) — OAuth with `raw_json=1` returns identical field names (`score`, `num_comments`, `permalink`, `title`, `created_utc`).

4. **Token caching:** In-process only for single CLI invocation (fetch token once per `runRedditFetch` call). No disk cache in v1.

5. **Credential missing:** Return `{ error: 'missing-credentials' }` when any of `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USERNAME`, `REDDIT_PASSWORD` absent while enabled.

### OAuth listing fixture (for tests)

```json
{
  "data": {
    "children": [
      {
        "data": {
          "title": "Example ML post",
          "score": 420,
          "num_comments": 37,
          "permalink": "/r/MachineLearning/comments/abc123/example/",
          "created_utc": 1717920000
        }
      }
    ]
  }
}
```

Expected stdout post:
- `title`: `"Example ML post"`
- `url`: `"https://www.reddit.com/r/MachineLearning/comments/abc123/example/"`
- `upvotes`: `420`
- `commentCount`: `37`
- `publishedAt`: ISO8601 from `created_utc`

### Task-prompt source ordering note

Current flow: Sources 1–5 → **Source 7 GitHub** → Source 6 NotebookLM. Add **Source 8 Reddit** after Source 7, before Source 6. Update Source 7 failure bullet from "continue to Source 6" → "continue to Source 8" (then Source 8 failure → Source 6). Source numbering stays non-sequential (historical); do not renumber Sources 1–6.

### Epic 44 boundary (do not cross)

Epic 44 Reddit (`44-3-2`) lives in `trend-ingest.py` — separate Convex tables, separate config. Morning-digest adapter **must not** import or call trend-ingest collectors. Duplicate fetch logic in v1 is acceptable per ADR-E65-004.

### Spike module reuse (optional, minimal)

`spike-reddit-public-json.mjs` exports `parseSubreddits` with identical semantics to production config parsing. Options:
- **Preferred:** duplicate tiny `parseSubreddits` in `fetch-reddit-signals.mjs` (matches `parseGithubQueries` isolation — no production→spike import)
- **Avoid:** importing spike module from production adapter (wrong dependency direction)

Implement **`mapRedditListingToPosts`** in production module — spike's `parseRedditListing` only returns `{ parseOk, postCount }`, not full post objects.

### Testing standards

- **CI:** 100% fixture/mocked — zero live Reddit/OAuth calls in `npm test`
- **File:** `tests/morning-digest-reddit-adapter.test.mjs` per architecture §10
- **Pattern:** import exported functions; `node:test` + `assert/strict` (match `morning-digest-github-adapter.test.mjs`)
- **Verify:** `bash scripts/verify.sh` mandatory before story `done`
- **Hermes sync:** `bash scripts/install-hermes-skill-morning-digest.sh` after script/wrapper/task-prompt changes (Epic 64 retro gate)

### WriteGate / vault / security

- **No WriteGate** — story does not touch `AI-Context/AGENTS.md` or vault paths
- **No `security.md` changes**
- **No new npm packages** — built-in `fetch` only
- **No API keys in repo** — credentials live in `~/.hermes/trend-ingest.env` only
- **Operator approval:** Adding Reddit OAuth app credentials to `trend-ingest.env` is operator action — document env var names in Completion Notes, never values

### Project structure

| Path | Action |
|------|--------|
| `scripts/hermes-skill-examples/morning-digest/scripts/fetch-reddit-signals.mjs` | **NEW** |
| `scripts/session-close/hermes-run-reddit.sh` | **NEW** |
| `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` | **UPDATE** (Source 8, §9, digest_sources) |
| `tests/morning-digest-reddit-adapter.test.mjs` | **NEW** |
| `tests/morning-digest-push-convex.test.mjs` | **UPDATE** |
| `tests/hermes-morning-digest-skill.test.mjs` | **UPDATE** (if wrapper parity test needed) |
| `scripts/hermes-skill-examples/morning-digest/scripts/spike-reddit-public-json.mjs` | **NO CHANGE** (gate artifact) |
| `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs` | **NO CHANGE** (priors + normalizeEngagement done in 65-1/64-4) |
| `cns-dashboard/**` | **NO CHANGE** |
| `pick-signal-notebook.mjs` | **NO CHANGE** (§7.3 deferred) |

### Previous story intelligence

**65-1 (done):**
- GitHub adapter pattern: `run*Fetch`, fixture injection, exit 0, `mergeTrendIngestEnv`, round-trip test to `sourceMetadata`
- Schema literals and priors already include `reddit` — no cns-dashboard work in 65-3
- task-prompt §9 reddit row exists as "future" — 65-3 activates Source 8
- Review patches: explicit §9 nest instructions, fetch→sourceMetadata round-trip test — **apply same discipline for reddit**

**65-2 (done):**
- FAIL artifact mandates credential path; sustained 403 on public JSON
- `parseSubreddits`, listing JSON shape, `User-Agent`, 15s timeout conventions established
- Review patches: block-detection ordering, cycle floor — irrelevant to OAuth adapter except shared UA/timeout constants

### Git intelligence

Recent Epic 65 commits:
- `075863e` — 65-2 spike review patches
- `528a551` — 65-2 spike FAIL artifact
- `b2ccb86` — 65-1 GitHub adapter (primary pattern to mirror)

### Deferred work cross-check

No items in `deferred-work.md` block 65-3. `buildDigestSignals` reddit slot (architecture §7.3) explicitly deferred — same as github slot in 65-1.

### Latest technical specifics

- **Reddit OAuth API:** `oauth.reddit.com` with Bearer token from script-app password grant
- **User-Agent:** Required on token and API requests — `CNS-morning-digest/1.0`
- **Rate limits:** Authenticated OAuth has higher limits than public JSON; still degrade on `http-429` → `{ error: 'http-429' }`, exit 0
- **Node fetch:** `AbortSignal.timeout(15_000)` (same as GitHub/HN)
- **Context7:** Not required — no new library; built-in `fetch` only

## References

- [Source: `_bmad-output/implementation-artifacts/65-2-reddit-public-json-spike.md` — **FAIL artifact, 65-3 branch instruction**]
- [Source: `_bmad-output/implementation-artifacts/65-1-digest-source-types-github-adapter.md` — adapter pattern, task-prompt Source 7, round-trip tests]
- [Source: `_bmad-output/planning-artifacts/architecture-epic-65-native-source-adapters.md` §5.3, §6.3 Branch B, §7.1, §10, ADR-E65-001/002/003/004]
- [Source: `_bmad-output/planning-artifacts/prd-epic-65-native-source-adapters.md` §4.4, FR-7, FR-8, FR-12]
- [Source: `_bmad-output/planning-artifacts/prds/prd-epic-65-2026-06-09/addendum.md` — env vars, credential path]
- [Source: `scripts/hermes-skill-examples/morning-digest/scripts/fetch-github-signals.mjs` — `run*Fetch` + main module pattern]
- [Source: `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs` — normalizeEngagement reddit branch, RD_* caps]
- [Source: `scripts/hermes-skill-examples/morning-digest/scripts/spike-reddit-public-json.mjs` — listing JSON shape reference only]
- [Source: `tests/morning-digest-github-adapter.test.mjs` — test structure, round-trip helper]
- [Source: `project-context.md` — verify gate, last30days codebook policy]
- [Source: `specs/cns-vault-contract/CNS-Phase-1-Spec.md` — N/A (no vault IO)

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor)

### Debug Log References

- Workspace had partial 65-4 RSS WIP on tracked files; reverted to baseline and scoped diff to 65-3 only. Untracked 65-4 files moved to `/tmp/wip-65-4-omnipotent` for verify isolation.

### Completion Notes List

- Added `fetch-reddit-signals.mjs` — OAuth password-grant token + `oauth.reddit.com/r/{sub}/hot` fetch; `mergeTrendIngestEnv` at CLI entry (same as GitHub); no public-JSON path.
- stdout maps `score`→`upvotes`, `num_comments`→`commentCount`, `permalink`→absolute `url`; §9 round-trip tests assert `sourceMetadata.upvotes` / `sourceMetadata.commentCount` (root-level fields null-score).
- Added `hermes-run-reddit.sh` thin wrapper; task-prompt Source 8 + §9 mapping + `digest_sources.reddit`; Source 7 failure continues to Source 8.
- 20 tests in `morning-digest-reddit-adapter.test.mjs`; reddit passthrough in push-convex test; hermes skill test extended for Source 8.
- Operator action: add `MORNING_DIGEST_REDDIT_SUBREDDITS`, `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USERNAME`, `REDDIT_PASSWORD` to `~/.hermes/trend-ingest.env` (never commit values).
- `bash scripts/verify.sh` green after Hermes skill install.

### File List

- `scripts/hermes-skill-examples/morning-digest/scripts/fetch-reddit-signals.mjs` (NEW)
- `scripts/session-close/hermes-run-reddit.sh` (NEW)
- `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` (UPDATE)
- `tests/morning-digest-reddit-adapter.test.mjs` (NEW)
- `tests/morning-digest-push-convex.test.mjs` (UPDATE)
- `tests/hermes-morning-digest-skill.test.mjs` (UPDATE)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (UPDATE)

### Change Log

- 2026-06-09: Story 65-3 — Reddit OAuth credential adapter, Source 8 task-prompt, tests, Hermes wrapper.
