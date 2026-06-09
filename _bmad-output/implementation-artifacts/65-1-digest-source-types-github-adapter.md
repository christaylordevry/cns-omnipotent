---
story_id: 65-1
epic: 65
title: digest-source-types-github-adapter
status: review
baseline_commit: 4a7fd2f
operator_brief: 2026-06-09
predecessors: 64-1, 64-5, 64-8
blocks: 65-3, 65-4
parallel: 65-2
---

# Story 65.1: digestSourceTypeValue extension + GitHub adapter

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a **CNS operator consuming ranked intelligence in the Nexus cockpit**,
I want **`digestSourceTypeValue` to accept `github`, `reddit`, and `rss` literals and a GitHub search adapter feeding the morning-digest pipeline**,
so that **Epic 65 adapter stories can push scored signals to Convex without another schema migration, GitHub repos appear in Discord and Nexus with engagement-aware ranking, and 65-2/65-3/65-4 can land their adapters on a stable contract**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 65: Native Source Adapter Expansion v1 — **65-1 is the schema gate** (mirror 64-1); blocks Convex push of new source types |
| **Repo** | **Cross-repo** — schema: `cns-dashboard` (`validators.ts`, `digest.test.ts`); adapter + priors: Omnipotent.md |
| **Predecessors** | **64-1** (engagement fields on `sourceMetadata`); **64-4** (`normalizeEngagement` github/reddit branches already coded); **64-5** (scoring orchestrator); **64-8** (push threading) |
| **Parallel track** | **65-2** (Reddit spike) may start once 65-1 is **in review** — no schema dependency on 65-2 |
| **Normative spec** | `architecture-epic-65-native-source-adapters.md` §3, §4–§6.1, §5.4, §7.1; ADR-E65-001, ADR-E65-002, ADR-E65-006 |
| **FR IDs** | FR-1 (schema literals), FR-2 (mapping contract), FR-3 (GitHub fetch), FR-4 (digestSignal emission), FR-16 (verify gate) |
| **Out of scope** | Reddit production adapter (65-3, blocked by 65-2); RSS adapter (65-4); HN metadata upgrade (65-5); scoring formula changes; `buildDigestSignals` cap-10 allocation (defer to 65-3/65-4 when those sources land); dashboard UI; Epic 44 trend-ingest unification; `last30days` runtime import |

### Problem (current state)

`cns-dashboard/convex/validators.ts` defines `digestSourceTypeValue` with only five literals (`google_trends`, `newsapi`, `arxiv`, `hackernews`, `deep_signal`). Push payloads with `sourceType: 'github'` are **rejected** at the Convex validator boundary.

`digestSectionValue` lacks `github`, `reddit`, `rss` section literals — new signals cannot pair section + sourceType per strict contract.

`score-digest-signals.mjs` already implements `normalizeEngagement()` branches for `github` and `reddit`, but **`SOURCE_PRIOR` and `TREND_PROXY_PRIOR` omit github/reddit/rss** — urgency and Path B momentum default to 0 for those types.

No `fetch-github-signals.mjs` or `hermes-run-github.sh` exists. Task-prompt §9 lists GitHub/Reddit as "future" in `sourceMetadata` bullets; strict-schema union lists only five source types.

Epic 64 retro explicitly flagged: *"`digestSourceTypeValue` GitHub/Reddit/RSS literals — not yet in schema (Epic 65 scope)"*.

### Operator brief (binding)

1. **65-1 is the schema gate again** — extend `digestSourceTypeValue` with `github`, `reddit`, `rss` **before** any adapter pushes signals (same pattern as 64-1).
2. **Cross-repo touch** — schema in `cns-dashboard`; GitHub adapter logic Omnipotent.md only.
3. **WSL dev workflow** — when editing cns-dashboard validators from WSL, open cns-dashboard via the **operator WSL PowerShell launcher** for schema-side work; verify from Omnipotent.md with `bash scripts/verify.sh` / `CNS_DASHBOARD_ROOT`.
4. **65-2 parallel** — Reddit spike runs in parallel once 65-1 is in review (not blocked on 65-1 completion).
5. FR-1 bundles all three literals even though only GitHub adapter ships in this story — reddit/rss rows must validate when 65-3/65-4 land.

## Acceptance Criteria

### 1. digestSourceTypeValue + digestSectionValue literals (AC: FR-1)

**Given** the cns-dashboard digest signal validators
**When** `digestSourceTypeValue` and `digestSectionValue` are extended
**Then** each union adds `v.literal('github')`, `v.literal('reddit')`, and `v.literal('rss')`
**And** `digestSignalInputValidator` and `digestSignalRowValidator` pick up the extended unions automatically (no drift between input and row validators)
**And** push payload with `sourceType: 'github'`, `section: 'github'` passes `addDigestSignal`
**And** push payload with `sourceType: 'reddit'`, `section: 'reddit'` passes (fixture only — no production Reddit ingest in 65-1)
**And** push payload with `sourceType: 'rss'`, `section: 'rss'` passes (fixture only)
**And** unknown literal (e.g. `producthunt`) is still rejected
**And** `keywordSourceTypeValue` is **unchanged** (keywords pipeline is separate — do not extend unless spec explicitly requires)

**Apply in:** `cns-dashboard/convex/validators.ts` only — `schema.ts` uses validator-driven tables; no hand-edit expected.

### 2. Morning-digest mapping contract (AC: FR-2)

**Given** task-prompt §9 signal mapping
**When** documentation is updated for Epic 65
**Then** mapping table adds rows:

| section | sourceType | Engagement fields in sourceMetadata |
|---------|------------|--------------------------------------|
| `github` | `github` | `stars` (required for normalization), `forks`, `publishedAt` optional |
| `reddit` | `reddit` | `upvotes` (required for normalization), `commentCount`, `publishedAt` optional |
| `rss` | `rss` | `publishedAt`, `author` optional; **no engagement fields** |

**And** strict-schema bullet lists extended unions for `section` and `sourceType`
**And** Source **7 — GitHub** is documented: invoke `hermes-run-github.sh` after Source 5 (HN), before Source 6 (NotebookLM); 45s terminal timeout; failure → `(source unavailable: …)` bullet
**And** Sources 8–9 (Reddit, RSS) are documented as **future** (65-3, 65-4) — mapping rows present, no Hermes invocation yet
**And** optional keys omitted when absent — never `null`

### 3. GitHub fetch module and stdout contract (AC: FR-3, ADR-E65-001)

**Given** `fetch-github-signals.mjs` under morning-digest scripts
**When** enabled via `MORNING_DIGEST_GITHUB_ENABLED` (default enabled; falsy: `0`, `false`, `no`, `off`)
**Then** script reads config from merged `~/.hermes/trend-ingest.env` via `mergeTrendIngestEnv()` + `resolveOperatorHome()` (import from `fetch-arxiv-rss.mjs`)
**And** requires `MORNING_DIGEST_GITHUB_QUERIES` (comma-separated GitHub search query strings) when enabled
**And** calls GitHub REST Search API: `GET https://api.github.com/search/repositories?q={encodeURIComponent(query)}&sort=stars&order=desc&per_page={perQuery}`
**And** headers: `Accept: application/vnd.github+json`, `User-Agent: CNS-morning-digest/1.0`, optional `Authorization: Bearer ${GITHUB_TOKEN}` when token set
**And** dedupes repos by `html_url` across queries; respects `MORNING_DIGEST_GITHUB_MAX_REPOS` (default 5) and `MORNING_DIGEST_GITHUB_PER_QUERY` (default 3)
**And** stdout success shape:

```json
{
  "repos": [
    {
      "title": "owner/repo",
      "url": "https://github.com/owner/repo",
      "stars": 1234,
      "forks": 56,
      "publishedAt": "2026-06-01T12:00:00.000Z"
    }
  ]
}
```

**And** maps API fields: `full_name` → `title`; `html_url` → `url`; `stargazers_count` → `stars`; `forks_count` → `forks`; prefer `pushed_at` over `created_at` for `publishedAt`
**And** on failure prints `{"error":"<short reason>"}` (e.g. `github disabled`, `http-403`, `missing-queries`) and **exit 0**
**And** 15s HTTP timeout per request; no `last30days` import or subprocess
**And** exports `runGithubFetch(env, options)` with injectable `fetch` + fixture JSON for tests (mirror `runHnFetch` pattern)

**Hermes wrapper:** `scripts/session-close/hermes-run-github.sh` — mirror `hermes-run-hn.sh` (exec node on fetch script).

### 4. GitHub digestSignal emission + scoring integration (AC: FR-4, ADR-E65-002)

**Given** GitHub stdout `repos[]` mapped to Convex push rows
**When** assembled into `digest_push_payload.signals[]` (unscored, pre-`scoreDigestSignals`)
**Then** each row has: `section: 'github'`, `sourceType: 'github'`, `title`, `url`, `externalId` (stable hash), `sourceMetadata.stars` (number), optional `sourceMetadata.forks`, optional `sourceMetadata.publishedAt`
**And** `normalizeEngagement()` returns non-null 0–100 when `stars` present
**And** fixture `{ stars: 50000, forks: 5000 }` → `normalizedEngagement === 100` (existing cap test in `morning-digest-score-signals.test.mjs`)
**And** fixture `{ stars: 500 }` → non-null (~48 primary-only band per architecture §5.2)
**And** `scoreDigestSignals` assigns non-zero urgency/momentum via new priors (§5.4 below)

**Scoring prior extension (ADR-E65-006 — constants only, no formula changes):**

| Map | Key | Value |
|-----|-----|-------|
| `SOURCE_PRIOR` | `github` | 5 |
| `SOURCE_PRIOR` | `reddit` | 8 |
| `SOURCE_PRIOR` | `rss` | 5 |
| `TREND_PROXY_PRIOR` | `github` | 40 |
| `TREND_PROXY_PRIOR` | `reddit` | 42 |
| `TREND_PROXY_PRIOR` | `rss` | 30 |

**And** extend `DigestSourceType` typedef to include `'rss'` where applicable
**And** unit tests assert priors are non-zero for github/reddit/rss

### 5. Test and verify gate (AC: FR-16)

**Given** implementation complete
**When** `bash scripts/verify.sh` runs from Omnipotent.md with sibling `cns-dashboard`
**Then** all tests pass including:
  - `cns-dashboard/tests/convex/digest.test.ts` — accept github signal with `sourceMetadata.stars`; reject invalid sourceType
  - `tests/morning-digest-github-adapter.test.mjs` (new) — config, parse, stdout, dedupe, disabled/missing-queries paths
  - `tests/morning-digest-score-signals.test.mjs` (extend) — prior entries; adapter-shaped github row → Path A momentum
  - `tests/morning-digest-push-convex.test.mjs` (extend) — github `sourceType` passthrough on mocked Convex HTTP
**And** run `bash scripts/install-hermes-skill-morning-digest.sh` after script/wrapper changes (Epic 64 retro parity gate)
**And** existing HN/arXiv/NewsAPI tests remain green (no regressions)

### 6. Anti-drift boundaries (AC: scope)

**Given** this story's scope
**When** implementation completes
**Then** there is **no** `fetch-reddit-signals.mjs` or `fetch-rss-signals.mjs` production module
**And** no `spike-reddit-public-json.mjs` (65-2)
**And** no changes to `normalizeEngagement` formulas or caps
**And** no changes to `pick-signal-notebook.mjs` / `buildDigestSignals` source-order (65-3/65-4)
**And** no npm packages added (GitHub uses built-in `fetch` only)

## Tasks / Subtasks

- [x] **T1** `cns-dashboard/convex/validators.ts` — schema literals (AC: 1)
  - [x] Extend `digestSourceTypeValue` with `github`, `reddit`, `rss`
  - [x] Extend `digestSectionValue` with `github`, `reddit`, `rss`
  - [x] Confirm input + row validators inherit automatically
- [x] **T2** `cns-dashboard/tests/convex/digest.test.ts` — validator coverage (AC: 1, 5)
  - [x] Happy path: `addDigestSignal` with `sourceType: 'github'`, `section: 'github'`, `sourceMetadata: { stars: 100, forks: 5 }`
  - [x] Accept reddit/rss fixture payloads (no production ingest — validator-only)
  - [x] Reject invalid `sourceType` literal
- [x] **T3** `fetch-github-signals.mjs` + `hermes-run-github.sh` (AC: 3)
  - [x] Implement `loadGithubConfig`, `fetchGithubSearch`, `parseSearchResponse`, `runGithubFetch`
  - [x] Env: `MORNING_DIGEST_GITHUB_ENABLED`, `MORNING_DIGEST_GITHUB_QUERIES`, `MORNING_DIGEST_GITHUB_MAX_REPOS`, `MORNING_DIGEST_GITHUB_PER_QUERY`, `GITHUB_TOKEN`
  - [x] Main module: mergeTrendIngestEnv → stdout JSON → exit 0 on all paths
- [x] **T4** `score-digest-signals.mjs` — prior table extension (AC: 4)
  - [x] Add github/reddit/rss to `SOURCE_PRIOR` and `TREND_PROXY_PRIOR`
  - [x] Extend typedef for `rss` sourceType
- [x] **T5** Omnipotent.md tests (AC: 4, 5)
  - [x] New `tests/morning-digest-github-adapter.test.mjs` — fixture HTTP, field mapping, dedupe, error paths
  - [x] Extend `morning-digest-score-signals.test.mjs` — prior assertions; github adapter row → normalizeEngagement + momentum Path A
  - [x] Extend `morning-digest-push-convex.test.mjs` — github signal in `addDigestSignal` args
- [x] **T6** `task-prompt.md` — §9 mapping + Source 7 (AC: 2)
  - [x] Add github/reddit/rss mapping rows and strict-schema unions
  - [x] Document Source 7 GitHub terminal step (after HN, before NotebookLM)
  - [x] Document GitHub → digestSignal assembly: `repos[]` → signals with `sourceMetadata.stars`/`forks`
- [x] **T7** Verify + Hermes sync (AC: 5)
  - [x] `bash scripts/verify.sh` green
  - [x] `bash scripts/install-hermes-skill-morning-digest.sh`

## Dev Notes

### Cross-repo workflow (critical)

**Schema side (cns-dashboard):**
- Open repo via **operator WSL PowerShell launcher** when editing from WSL (sibling-repo verify workaround per sprint-change-proposal-2026-06-08).
- Touch **only** `convex/validators.ts` + `tests/convex/digest.test.ts` — not `schema.ts` unless validator export forces it.

**Adapter side (Omnipotent.md):**
- All fetch/scoring/task-prompt/test work stays in this repo.
- Verify integrates both: `bash scripts/verify.sh` runs Omnipotent.md `npm test` + sibling cns-dashboard vitest.

```bash
# From Omnipotent.md repo root
bash scripts/verify.sh
# Override sibling path if needed:
CNS_DASHBOARD_ROOT=/path/to/cns-dashboard bash scripts/verify.sh
```

**Commits:** Prefer **one commit in cns-dashboard** + **one in Omnipotent.md** (mirror 64-1 / 61-5). Message style: `feat(epic-65): 65-1 digest source types + GitHub adapter`.

### Architecture compliance

| ADR | Requirement for 65-1 |
|-----|----------------------|
| **ADR-E65-001** | Native Node `.mjs` adapter; Hermes wrapper; always exit 0 on fetch failure |
| **ADR-E65-002** | Emit raw `stars`/`forks` in `sourceMetadata`; never pre-normalize; match `normalizeEngagement` field names |
| **ADR-E65-006** | Schema literals + scoring prior tables extended together in this story |
| **ADR-E64-001** | Scoring compute stays Omnipotent.md — no server-side score computation in Convex |
| **ADR-E64-005 / E65-005** | last30days reference codebook only — MIT attribution comment if algorithmically derived; zero runtime import |

### Current validators (today — must read before editing)

```122:136:cns-dashboard/convex/validators.ts
export const digestSectionValue = v.union(
	v.literal('trends'),
	v.literal('headlines'),
	v.literal('arxiv'),
	v.literal('hackernews'),
	v.literal('deep_signal')
);

export const digestSourceTypeValue = v.union(
	v.literal('google_trends'),
	v.literal('newsapi'),
	v.literal('arxiv'),
	v.literal('hackernews'),
	v.literal('deep_signal')
);
```

`sourceMetadataValidator` **already** has `stars`, `forks`, `upvotes`, `commentCount` from 64-1 — **no metadata field additions** in 65-1.

### Target validator shape (normative — architecture §3.1–3.2)

```typescript
export const digestSourceTypeValue = v.union(
  v.literal('google_trends'),
  v.literal('newsapi'),
  v.literal('arxiv'),
  v.literal('hackernews'),
  v.literal('deep_signal'),
  v.literal('github'),
  v.literal('reddit'),
  v.literal('rss'),
);

export const digestSectionValue = v.union(
  v.literal('trends'),
  v.literal('headlines'),
  v.literal('arxiv'),
  v.literal('hackernews'),
  v.literal('deep_signal'),
  v.literal('github'),
  v.literal('reddit'),
  v.literal('rss'),
);
```

### GitHub adapter reference pattern

Mirror `fetch-hn-rss.mjs`:
- `mergeTrendIngestEnv` at main entry
- Exported `run*Fetch(env, { fetch, fixtureJson })` for tests
- `isMainModule()` guard for CLI vs import
- `FETCH_TIMEOUT_MS = 15_000`, `USER_AGENT = 'CNS-morning-digest/1.0'`

**GitHub Search API response mapping:**

| API field | stdout field |
|-----------|--------------|
| `items[].full_name` | `title` |
| `items[].html_url` | `url` |
| `items[].stargazers_count` | `stars` |
| `items[].forks_count` | `forks` |
| `items[].pushed_at` (fallback `created_at`) | `publishedAt` |

### digestSignal assembly (task-prompt agent step)

From each `repos[]` entry → push signal (unscored):

```json
{
  "section": "github",
  "sourceType": "github",
  "title": "owner/repo",
  "url": "https://github.com/owner/repo",
  "rank": 1,
  "externalId": "<sha256(url).slice(0,16)>",
  "sourceMetadata": {
    "stars": 1234,
    "forks": 56,
    "publishedAt": "2026-06-01T12:00:00.000Z"
  }
}
```

Post-`scoreDigestSignals`: `rank` reassigned by descending `rankScore`; `scores`, `disposition`, `normalizedEngagement`, `rankScore` populated.

### Scoring prior gap (today)

```17:31:scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs
const SOURCE_PRIOR = {
  newsapi: 15,
  hackernews: 10,
  google_trends: 10,
  deep_signal: 5,
  arxiv: 0,
};

const TREND_PROXY_PRIOR = {
  google_trends: 40,
  hackernews: 45,
  newsapi: 35,
  arxiv: 25,
  deep_signal: 50,
};
```

Add github/reddit/rss per architecture §5.4. **`normalizeEngagement` github branch already exists** — do not duplicate caps (`GH_STARS_CAP`, `GH_FORKS_CAP` exported from same module).

### Integration assertion (mandatory — architecture §10)

```javascript
const norm = normalizeEngagement({
  sourceType: 'github',
  title: 'test/repo',
  sourceMetadata: { stars: 500, forks: 10 },
});
assert(norm !== null && norm >= 0 && norm <= 100);
```

### Previous epic learnings (64-1 pattern)

- Schema gate first — one cross-repo touch; adapter compute stays Omnipotent.md
- Sort test expectation in 64-1 review: read architecture §3.3 literally for tie-break rules (not applicable to 65-1 validators but same review discipline)
- Hermes skill install required after task-prompt / script changes
- Strict Convex contract: omit optional keys, never `null`
- Fixture-first `node:test` `.mjs` tests — extend existing files where possible, new file for new adapter

### Epic 64 retro carry-forward

- Live digest smoke before enabling cron — operator gate recommended, not story blocker
- `digestSourceTypeValue` extension was explicitly deferred to Epic 65 — this story closes that gap
- Parallel 65-2 spike has **no schema dependency** — can start when 65-1 enters review

### Testing requirements

| File | Repo | Action |
|------|------|--------|
| `convex/validators.ts` | cns-dashboard | UPDATE |
| `tests/convex/digest.test.ts` | cns-dashboard | UPDATE |
| `scripts/.../fetch-github-signals.mjs` | Omnipotent.md | NEW |
| `scripts/session-close/hermes-run-github.sh` | Omnipotent.md | NEW |
| `scripts/.../score-digest-signals.mjs` | Omnipotent.md | UPDATE (priors only) |
| `scripts/.../references/task-prompt.md` | Omnipotent.md | UPDATE |
| `tests/morning-digest-github-adapter.test.mjs` | Omnipotent.md | NEW |
| `tests/morning-digest-score-signals.test.mjs` | Omnipotent.md | UPDATE |
| `tests/morning-digest-push-convex.test.mjs` | Omnipotent.md | UPDATE |
| `push-digest-convex.mjs` | Omnipotent.md | **No change** (passthrough) |
| `pick-signal-notebook.mjs` | Omnipotent.md | **No change** (65-3/65-4) |
| `convex/schema.ts` | cns-dashboard | **No edit expected** |

**Gate:** `bash scripts/verify.sh` green before marking done.

### Security / config notes

- `GITHUB_TOKEN` optional — unauthenticated search works with lower rate limit; degrade, don't abort
- Never commit tokens; config lives in `~/.hermes/trend-ingest.env`
- No new npm packages in 65-1 (GitHub REST via built-in `fetch`)

### References

- [Source: `_bmad-output/planning-artifacts/architecture-epic-65-native-source-adapters.md` §3, §4–§6.1, §5.4, §7.1, §9, §10]
- [Source: `_bmad-output/planning-artifacts/prd-epic-65-native-source-adapters.md` §4.1, §4.2, FR-1..FR-4]
- [Source: `_bmad-output/planning-artifacts/prds/prd-epic-65-2026-06-09/addendum.md`]
- [Source: `_bmad-output/implementation-artifacts/64-1-digest-signals-schema-extension.md` — cross-repo schema gate pattern]
- [Source: `_bmad-output/implementation-artifacts/epic-64-retro-2026-06-09.md` — schema literal deferral, Hermes sync gate]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-06-08.md` — Epic 65 story table, WSL verify note]
- [Source: `scripts/hermes-skill-examples/morning-digest/scripts/fetch-hn-rss.mjs` — adapter conventions]
- [Source: `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs` — normalizeEngagement github branch]
- [Source: `project-context.md` — verify gate, cross-repo layout]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor)

### Debug Log References

### Completion Notes List

- Extended `digestSourceTypeValue` and `digestSectionValue` in cns-dashboard with `github`, `reddit`, `rss` literals (schema gate for Epic 65).
- Added `fetch-github-signals.mjs` + `hermes-run-github.sh` mirroring HN adapter pattern (GitHub Search API, dedupe, exit 0 on failure).
- Extended `SOURCE_PRIOR` / `TREND_PROXY_PRIOR` for github/reddit/rss; `normalizeEngagement` github branch unchanged.
- Updated task-prompt Source 7 (GitHub) + §9 mapping rows; Reddit/RSS documented as future (65-3/65-4).
- `bash scripts/verify.sh` green (Omnipotent.md + sibling cns-dashboard); Hermes skill synced.

### File List

**cns-dashboard**
- `convex/validators.ts`
- `tests/convex/digest.test.ts`

**Omnipotent.md**
- `scripts/hermes-skill-examples/morning-digest/scripts/fetch-github-signals.mjs` (NEW)
- `scripts/session-close/hermes-run-github.sh` (NEW)
- `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs`
- `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md`
- `tests/morning-digest-github-adapter.test.mjs` (NEW)
- `tests/morning-digest-score-signals.test.mjs`
- `tests/morning-digest-push-convex.test.mjs`
- `tests/hermes-morning-digest-skill.test.mjs`

### Change Log

- 2026-06-09: Story 65-1 implementation — schema literals + GitHub adapter + scoring priors + task-prompt Source 7.

### Review Findings

**Operator-requested checks (2026-06-09):**

- **§6.1 engagement field names — PASS (fetch + scorer layers).** `fetch-github-signals.mjs` maps `stargazers_count` → stdout `stars` and `forks_count` → stdout `forks`. `normalizeEngagement` reads `sourceMetadata.stars` / `sourceMetadata.forks` — names match; no `stargazers_count` or alternate key leaks into the scoring path. Tests assert cap fixture `{ stars: 50000, forks: 5000 }` → 100 and adapter row `{ stars: 500 }` → 48.
- **resolveOperatorHome — PASS (Node entry, not bash wrapper).** `hermes-run-github.sh` is a thin `exec node` mirror of `hermes-run-hn.sh` (no HOME logic in bash — expected). CLI path calls `mergeTrendIngestEnv(process.env)`, which invokes `resolveOperatorHome` inside `fetch-arxiv-rss.mjs` before reading `~/.hermes/trend-ingest.env`. Same pattern as HN/arXiv adapters.

- [x] [Review][Patch] task-prompt §9 GitHub mapping lacks explicit nest instruction [`task-prompt.md:387`] — fixed: explicit repos[] → sourceMetadata.stars/forks mapping in Source 7 and §9.
- [x] [Review][Patch] No fetch stdout → sourceMetadata round-trip test [`tests/morning-digest-github-adapter.test.mjs`] — fixed: round-trip test with root-level negative control.
- [x] [Review][Patch] cns-dashboard schema changes uncommitted in sibling repo [`cns-dashboard/convex/validators.ts`, `cns-dashboard/tests/convex/digest.test.ts`] — committed in cns-dashboard repo (mirror 64-1).
- [x] [Review][Defer] Multi-query GitHub fetch fail-fast on first HTTP error [`fetch-github-signals.mjs:196-198`] — deferred, pre-existing pattern choice vs arXiv `continue`; not in story AC.
- [x] [Review][Defer] No dedicated `resolveOperatorHome` test in github adapter test file — deferred; shared function covered in `morning-digest-arxiv-rss.test.mjs`; HN adapter has same gap.
