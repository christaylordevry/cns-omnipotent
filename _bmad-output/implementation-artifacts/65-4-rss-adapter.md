---
story_id: 65-4
epic: 65
title: rss-adapter
status: done
baseline_commit: 075863e
operator_brief: 2026-06-09
predecessors: 65-1
parallel: 65-3
blocks: none
---

# Story 65.4: Curated RSS / Substack adapter

Status: done

<!-- Dev pass 2 (2026-06-09): integration wiring after WIP adapter restore — Source 9 task-prompt, rss-parser dep, buildDigestSignals, docs, tests. -->

## Story

As a **morning-digest operator**,
I want **a CNS-native RSS adapter that fetches curated newsletter/Substack feeds and emits scored digest signals without engagement metadata**,
so that **Newsletters / RSS appear in Discord and Nexus alongside GitHub and other sources, using momentum Path B (trendProxy) while Reddit work (65-3) proceeds in parallel**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 65: Native Source Adapter Expansion v1 — **65-4 ships RSS production ingest** |
| **Repo** | **Omnipotent.md only** — schema literals landed in 65-1; **no cns-dashboard touch** |
| **Predecessors** | **65-1 done** — `digestSourceTypeValue` / `digestSectionValue` include `rss`; `SOURCE_PRIOR` / `TREND_PROXY_PRIOR` for `rss` live; task-prompt §9 mapping row exists (future placeholder) |
| **Parallel** | **65-3 (Reddit adapter)** — **no dependency**; may implement in a separate agent/session concurrently |
| **Blocks** | Nothing downstream in Epic 65 except optional 65-5 |
| **Normative spec** | `architecture-epic-65-native-source-adapters.md` §4.1–§4.2, §5.1–§5.3, §6.4, §7.1, §7.3, §8, §10, ADR-E65-001, ADR-E65-002, ADR-E65-006; `prd-epic-65-native-source-adapters.md` §4.5 (FR-9, FR-10), §4.7 (FR-12 partial), UJ-1, UJ-2 |
| **FR IDs** | FR-9 (RSS fetch + stdout), FR-10 (digestSignal shape), FR-12 (task-prompt Source 9 + `digest_sources`), FR-16 (last30days runtime policy) |
| **Out of scope** | Reddit adapter (`fetch-reddit-signals.mjs`, Source 8 — 65-3); `buildDigestSignals` reddit/github caps (github deferral from 65-1 — optional follow-up, not required for 65-4 AC); Convex schema changes; scoring formula or prior changes; Epic 44 trend-ingest; dashboard UI; live-network CI tests |

### Problem (current state)

Operator-curated RSS/Substack feeds are **outside** the morning-digest pipeline. Task-prompt §9 documents an `rss` mapping row marked **future (65-4)** with stdout key typo `items[]` — normative architecture uses **`entries[]`**. No `fetch-rss-signals.mjs`, no `hermes-run-rss.sh`, no Source 9 terminal step. `normalizeEngagement` returns `null` for `rss` (falls through `default` case) — momentum uses Path B via `TREND_PROXY_PRIOR.rss === 30` (already tested in 65-1).

### Operator brief (binding)

1. **Parallel with 65-3** — no wait on Reddit spike outcome or Reddit adapter; RSS is independent.
2. **Mirror GitHub adapter patterns** — `mergeTrendIngestEnv`, exit 0 on failure, injectable fixtures, Hermes wrapper, task-prompt wiring.
3. **New npm dependency** — `rss-parser@^3.13.0` (published 2023-04-11 — satisfies 14-day security policy).
4. **Fixture-first CI** — static RSS/Atom XML fixtures; no live feed fetches in tests.
5. **Hermes sync gate** — run `bash scripts/install-hermes-skill-morning-digest.sh` after script + task-prompt edits.
6. **last30days is read-only codebook** — never import or subprocess.

## Acceptance Criteria

### 1. RSS fetch module and stdout contract (AC: FR-9, ADR-E65-001)

**Given** `fetch-rss-signals.mjs` under `scripts/hermes-skill-examples/morning-digest/scripts/`
**When** invoked via `node fetch-rss-signals.mjs`
**Then** config loads from merged `~/.hermes/trend-ingest.env` via `mergeTrendIngestEnv()` + `resolveOperatorHome()` (import from `fetch-arxiv-rss.mjs`)
**And** reads env vars:

| Env var | Required | Default | Purpose |
|---------|----------|---------|---------|
| `MORNING_DIGEST_RSS_ENABLED` | no | enabled | Feature flag; falsy: `0`, `false`, `no`, `off` |
| `MORNING_DIGEST_RSS_FEEDS` | yes when enabled | — | Comma-separated feed URLs |
| `MORNING_DIGEST_RSS_MAX_PER_FEED` | no | `3` | Max entries per feed |
| `MORNING_DIGEST_RSS_MAX_TOTAL` | no | `10` | Total cap after dedupe |

**And** uses `rss-parser` npm package (add to root `package.json` dependencies)
**And** fetches feed URLs **sequentially** with **15s** timeout per feed (`FETCH_TIMEOUT_MS = 15_000`)
**And** maps parser items: `item.title` → `title`; `item.link` → `url`; `item.isoDate` or `item.pubDate` → ISO8601 `publishedAt` when parseable; `item.creator` or `item.author` → `author` when present
**And** dedupes by normalized URL first, then normalized title (case-insensitive trim)
**And** on single-feed parse/fetch failure: **skip that feed**, continue others; return `{ error: "..." }` only when **all** feeds fail or config invalid
**And** stdout success shape uses root key **`entries[]`** (not `items[]`):

```json
{
  "entries": [
    {
      "title": "Article title",
      "url": "https://example.com/post",
      "publishedAt": "2026-06-09T07:00:00.000Z",
      "author": "Author Name"
    }
  ]
}
```

**And** on disable prints `{"error":"rss disabled"}`; on missing feeds when enabled `{"error":"missing-feeds"}`; other failures `{"error":"<short reason>"}` — **always exit 0**
**And** exports `runRssFetch(env, options)` with injectable `fetch`/`Parser` + `fixtureXml` / `fixtureXmlByFeedUrl` for tests (mirror `runGithubFetch` pattern)
**And** no `last30days` import or subprocess

**Hermes wrapper:** `scripts/session-close/hermes-run-rss.sh` — mirror `hermes-run-github.sh` (thin `exec node` on fetch script).

### 2. RSS digestSignal emission + scoring integration (AC: FR-10, ADR-E65-002)

**Given** RSS stdout `entries[]` mapped to Convex push rows
**When** assembled into `digest_push_payload.signals[]` (unscored, pre-`scoreDigestSignals`)
**Then** each row has: `section: 'rss'`, `sourceType: 'rss'`, `title`, `url`, `externalId` (`sha256(url).slice(0, 16)`), optional `sourceMetadata.publishedAt`, optional `sourceMetadata.author`
**And** **no engagement fields** in `sourceMetadata` — omit `stars`, `upvotes`, `points`, etc.
**And** `normalizeEngagement()` returns **`null`** for RSS signals
**And** `scoreDigestSignals` assigns non-zero momentum via Path B (`TREND_PROXY_PRIOR.rss === 30`) and urgency via `SOURCE_PRIOR.rss === 5`
**And** round-trip test: fixture entry → digestSignal assembly helper → `normalizeEngagement === null` → scored signal has finite `rankScore` and `scores.momentum > 0`

**Strict Convex contract (reuse 65-1 discipline):** omit optional keys when absent — **never `null`**.

### 3. Task-prompt Source 9 + digest_sources integration (AC: FR-12 partial)

**Given** task-prompt morning-digest source list
**When** Source 9 is wired
**Then** add **Source 9 — Newsletters / RSS** after Source 7 (GitHub), **before Source 6 (NotebookLM)** — Source 8 (Reddit) remains documented as **future (65-3)** with no terminal call in this story
**And** invoke:

```text
terminal(command="bash scripts/session-close/hermes-run-rss.sh", workdir=resolved_repo_root, timeout=45)
```

**And** parse stdout `entries[]` with `title`, `url`, optional `publishedAt`, optional `author`
**And** when building §9 push signals, nest metadata under `sourceMetadata`: `entries[].publishedAt` → `sourceMetadata.publishedAt`, `entries[].author` → `sourceMetadata.author` when present — **never** leave metadata at signal root
**And** Discord section header **Newsletters / RSS** lists each entry as `- <title>` (optional ` — <author>` when present)
**And** on failure: section header + `- (source unavailable: <short reason>)` and **continue** to Source 6
**And** extend `digest_sources` JSON example and assembly bullets with `"rss": [{ "title": "<string>", "url": "<string>" }]` when Source 9 succeeds; omit or `[]` on failure
**And** fix §9 mapping table: Source 9 data column **`entries[]`** (replace erroneous `items[]` placeholder from 65-1)
**And** extend §9 `sourceMetadata` bullet for RSS: optional `publishedAt`, optional `author`; **no engagement fields**

**buildDigestSignals (NotebookLM routing — §7.3 rss slice):**

**Given** `pick-signal-notebook.mjs` `buildDigestSignals()`
**When** `sources.rss` is present
**Then** append up to **1** RSS entry title (most recent by `publishedAt` when available, else feed order)
**And** existing caps for trends/headlines/perplexity/arxiv/hn unchanged
**And** unit test covers rss title inclusion in deduped cap-10 output

**SKILL.md:** Add Source 9 terminal step summary mirroring task-prompt (concise — same pattern as Source 7 if present, or match HN/GitHub style when SKILL is updated for Epic 65 sources).

**config-snippet.md:** Document `MORNING_DIGEST_RSS_*` env vars with example feed URLs (Substack/RSS placeholders — operator-owned `trend-ingest.env`).

### 4. Test and verify gate (AC: FR-16)

**Given** implementation complete
**When** `bash scripts/verify.sh` runs from Omnipotent.md with sibling `cns-dashboard`
**Then** all tests pass including new `tests/morning-digest-rss-adapter.test.mjs`:

| Test area | Required coverage |
|-----------|-------------------|
| Config | `isRssEnabled`, `parseRssFeeds`, `loadRssConfig` defaults and falsy disable |
| Parse/map | Static RSS 2.0 + Atom XML fixtures → `entries[]` shape |
| Dedupe/caps | URL dedupe, title fallback dedupe, `MAX_PER_FEED`, `MAX_TOTAL` |
| Failure paths | disabled, missing-feeds, single-feed skip, all-feeds-fail |
| CLI | subprocess exit 0 on error stdout |
| Scoring round-trip | entry → digestSignal → `normalizeEngagement === null` → momentum Path B |
| buildDigestSignals | rss title included (max 1) |

**And** extend `tests/morning-digest-push-convex.test.mjs` with at least one `sourceType: 'rss'` fixture row round-trip (if not already covered)
**And** `npm install` updates lockfile with `rss-parser`
**And** run `bash scripts/install-hermes-skill-morning-digest.sh` after script/wrapper/task-prompt/SKILL edits

## Tasks / Subtasks

- [x] **T1** Add `rss-parser@^3.13.0` to `package.json`; `npm install` (AC: 1)
- [x] **T2** Implement `fetch-rss-signals.mjs` — config, sequential fetch, map, dedupe, caps, `runRssFetch` export (AC: 1)
- [x] **T3** Add `scripts/session-close/hermes-run-rss.sh` (AC: 1)
- [x] **T4** Create `tests/morning-digest-rss-adapter.test.mjs` with XML fixtures + scoring round-trip (AC: 2, 4)
- [x] **T5** Update `task-prompt.md` — Source 9, digest_sources, §9 mapping fix `entries[]`, Discord section (AC: 3)
- [x] **T6** Update `pick-signal-notebook.mjs` `buildDigestSignals` for rss top-1 + test (AC: 3)
- [x] **T7** Update `SKILL.md` + `references/config-snippet.md` (AC: 3)
- [x] **T8** Extend push-convex test if needed (AC: 4)
- [x] **T9** `bash scripts/install-hermes-skill-morning-digest.sh`; `bash scripts/verify.sh` green (AC: 4)

## Dev Notes

### Architecture compliance

| ADR / section | Requirement |
|---------------|-------------|
| **ADR-E65-001** | Node `.mjs` under morning-digest scripts; no Python; no last30days runtime |
| **ADR-E65-002** | Adapters emit metadata only; scoring via `scoreDigestSignals` terminal — adapters do not score |
| **ADR-E65-006** | No formula changes — priors already landed in 65-1 |
| **§4.1 conventions** | `User-Agent: CNS-morning-digest/1.0`; exit 0; 15s HTTP timeout; fixture inject |
| **§6.4** | Env vars, sequential feeds, dedupe URL→title, no engagement fields |
| **§8 degraded** | Per-feed skip; unavailable section only when all feeds fail |
| **§10 tests** | `morning-digest-rss-adapter.test.mjs` required |

### Mirror file: `fetch-github-signals.mjs`

Primary template for structure and exports:

```1:7:scripts/hermes-skill-examples/morning-digest/scripts/fetch-github-signals.mjs
// fetch-github-signals.mjs — GitHub search for morning-digest Source 7
// Usage: node fetch-github-signals.mjs
// stdout: {"repos":[...]} or {"error":"..."}; always exit 0 on fetch/parse failure

import { fileURLToPath } from 'node:url';

import { mergeTrendIngestEnv } from './fetch-arxiv-rss.mjs';
```

Reuse patterns:
- `is*Enabled()` falsy check
- `load*Config(env)` with sane defaults
- `run*Fetch(env, { fetch, fixture* })` for tests
- `isMainModule()` CLI entry calling `mergeTrendIngestEnv` then stdout JSON + exit 0

**Difference from GitHub:** RSS uses `rss-parser` instead of raw `fetch`+JSON; inject `Parser` or pre-parsed fixture in tests to avoid live network.

### Mirror test: `morning-digest-github-adapter.test.mjs`

Include `rssEntryToDigestSignal()` helper mirroring `githubRepoToDigestSignal()` — nest `publishedAt`/`author` under `sourceMetadata`, never at root.

Subprocess CLI test: disabled env → `{"error":"rss disabled"}` exit 0.

### Scoring behavior (no code changes expected)

```130:169:scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs
export function normalizeEngagement(signal) {
  const meta = signal.sourceMetadata ?? {};
  // ...
    default:
      return null;
  }
}
```

`rss` hits `default` → `null`. Momentum Path B uses `TREND_PROXY_PRIOR.rss === 30` (already in `morning-digest-score-signals.test.mjs`).

### Source numbering (task-prompt)

Current live order: Sources 1–5 → **Source 7 GitHub** → Source 6 NotebookLM.

65-4 inserts **Source 9 RSS** after Source 7, before Source 6. **Source 8 Reddit** stays a documented placeholder until 65-3 — do not renumber GitHub.

Update Source 6 precondition text: assemble `digest_sources` after Sources 1–5, 7, and 9 (when run).

### buildDigestSignals gap (intentional partial scope)

Architecture §7.3 also assigns **github top 2** and **reddit top 2** in `buildDigestSignals`. Those were deferred from 65-1/65-3. **This story only adds rss top 1.** Do not block 65-4 on github/reddit notebook caps.

### npm: rss-parser

- Package: `rss-parser@^3.13.0`
- API: `new Parser({ timeout: FETCH_TIMEOUT_MS, headers: { 'User-Agent': USER_AGENT } })` then `parser.parseURL(url)` or `parser.parseString(xml)` for fixtures
- Verify ≥14 days published before install (3.13.0 modified 2023-04-11 — pass)

### Fixture XML samples (minimum)

1. **RSS 2.0** — 2 `<item>` blocks, one duplicate URL
2. **Atom** — 1 `<entry>` with `link href`
3. **Malformed feed** — skip without aborting other feeds

Store minimal XML as inline strings in test file (mirror HN/arXiv fixture style).

### File touch matrix

| File | Action |
|------|--------|
| `package.json` | UPDATE — add `rss-parser` dependency |
| `package-lock.json` | UPDATE |
| `scripts/.../fetch-rss-signals.mjs` | NEW |
| `scripts/session-close/hermes-run-rss.sh` | NEW |
| `scripts/.../references/task-prompt.md` | UPDATE — Source 9, digest_sources, §9 |
| `scripts/.../SKILL.md` | UPDATE — Source 9 summary |
| `scripts/.../references/config-snippet.md` | UPDATE — RSS env vars |
| `scripts/.../pick-signal-notebook.mjs` | UPDATE — `buildDigestSignals` rss top-1 |
| `tests/morning-digest-rss-adapter.test.mjs` | NEW |
| `tests/morning-digest-push-convex.test.mjs` | UPDATE if rss row missing |
| `tests/pick-signal-notebook.test.mjs` or existing notebook tests | UPDATE — rss in buildDigestSignals |
| `score-digest-signals.mjs` | **No change** |
| `push-digest-convex.mjs` | **No change** |
| `cns-dashboard/*` | **No change** |

### Anti-patterns (do not)

- Do **not** hand-parse RSS XML with regex — use `rss-parser`
- Do **not** add engagement fields to RSS stdout or `sourceMetadata`
- Do **not** use stdout key `items[]` — normative key is **`entries[]`**
- Do **not** fail-fast entire adapter on one bad feed URL
- Do **not** import last30days or subprocess external collectors
- Do **not** change scoring formulas or Convex validators

### Previous story intelligence (65-1)

- Schema gate complete — rss literals validate in Convex
- GitHub adapter established export/test/Hermes wrapper pattern — **copy structure, not HTTP logic**
- Code review lesson: task-prompt §9 needs explicit nest instructions (`entries[]` → `sourceMetadata.*`)
- Round-trip test (`fetch stdout → digestSignal → normalizeEngagement/score`) caught root-level metadata bug in 65-1 — **required for RSS**
- Hermes install + verify gate mandatory after task-prompt edits

### Git intelligence

Recent Epic 65 commits: `075863e` (65-2 review), `528a551` (65-2 spike), `b2ccb86` (65-1 GitHub adapter). RSS story builds directly on 65-1 adapter conventions.

### Testing gate

`bash scripts/verify.sh` — Omnipotent.md tests + sibling cns-dashboard when present.

### Security / config

- Feed URLs from operator `~/.hermes/trend-ingest.env` — never commit operator feed lists
- No API keys required for public RSS/Atom feeds
- `rss-parser` passes 14-day npm age policy

### References

- [Source: `_bmad-output/planning-artifacts/architecture-epic-65-native-source-adapters.md` §4.1–§4.2, §5.1–§5.3, §6.4, §7.1, §7.3, §8, §10]
- [Source: `_bmad-output/planning-artifacts/prd-epic-65-native-source-adapters.md` §4.5 FR-9/FR-10, §4.7 FR-12]
- [Source: `_bmad-output/planning-artifacts/prds/prd-epic-65-2026-06-09/addendum.md` — RSS env vars]
- [Source: `_bmad-output/implementation-artifacts/65-1-digest-source-types-github-adapter.md` — adapter mirror, review findings]
- [Source: `scripts/hermes-skill-examples/morning-digest/scripts/fetch-github-signals.mjs`]
- [Source: `scripts/hermes-skill-examples/morning-digest/scripts/fetch-hn-rss.mjs` — XML item parsing reference only; RSS adapter uses rss-parser]
- [Source: `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` §9 rss row]
- [Source: `project-context.md` — verify gate, Hermes parity]

## Dev Agent Record

### Agent Model Used

Composer (dev-story)

### Debug Log References

- Per-feed `MAX_PER_FEED` now skips duplicate URLs/titles while filling the cap (not raw item count).

### Completion Notes List

- Restored WIP `fetch-rss-signals.mjs` + `hermes-run-rss.sh` (adapter logic pre-existing); added `rss-parser@^3.13.0` to `package.json`.
- Wired Source 9 in task-prompt with 7→8→9→6 order: terminal call, Discord **Newsletters / RSS**, `digest_sources.rss`, §9 `entries[]` mapping fix.
- Extended `buildDigestSignals` / `extractRssSignals` for rss top-1 by `publishedAt`.
- Updated SKILL.md v1.4.3 + config-snippet `MORNING_DIGEST_RSS_*` docs.
- Extended push-convex, pick-signal notebook, and Hermes skill contract tests for Source 9.
- Addressed code-review findings from prior session (all patch items resolved).
- `bash scripts/install-hermes-skill-morning-digest.sh`; `bash scripts/verify.sh` green (Omnipotent.md + cns-dashboard).

### File List

- `package.json`
- `package-lock.json`
- `scripts/hermes-skill-examples/morning-digest/scripts/fetch-rss-signals.mjs` (NEW)
- `scripts/session-close/hermes-run-rss.sh` (NEW)
- `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md`
- `scripts/hermes-skill-examples/morning-digest/SKILL.md`
- `scripts/hermes-skill-examples/morning-digest/references/config-snippet.md`
- `scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs`
- `tests/morning-digest-rss-adapter.test.mjs` (NEW)
- `tests/morning-digest-push-convex.test.mjs`
- `tests/morning-digest-pick-signal-notebook.test.mjs`
- `tests/hermes-morning-digest-skill.test.mjs`

### Change Log

- 2026-06-09: Story 65-4 — RSS/Substack adapter (Source 9), `rss-parser`, NotebookLM rss top-1, Hermes sync.
- 2026-06-09: Dev pass 3 — review pass 2 patches committed (integration wiring + tracked adapter files).

### Review Findings

**Review scope:** Story `65-4-rss-adapter.md` (baseline `075863e`). Initial review found adapter files missing from tree; operator restored WIP; dev pass 2 completed integration wiring.

- [x] [Review][Patch] **AC1 — `fetch-rss-signals.mjs` missing** — restored from WIP; tests pass.
- [x] [Review][Patch] **AC1 — `rss-parser` dependency missing** — added to `package.json` + lockfile.
- [x] [Review][Patch] **AC1 — Hermes wrapper missing** — `hermes-run-rss.sh` present.
- [x] [Review][Patch] **AC3 — Source 9 not wired in task-prompt** — full Source 9 section added.
- [x] [Review][Patch] **AC3 — §9 mapping table still uses `items[]`** — fixed to `entries[]`.
- [x] [Review][Patch] **AC3 — `buildDigestSignals` has no rss slice** — `extractRssSignals` top-1 by `publishedAt`.
- [x] [Review][Patch] **AC3 — SKILL.md missing Source 9 summary** — v1.4.3 updated.
- [x] [Review][Patch] **AC3 — config-snippet missing RSS env vars** — `MORNING_DIGEST_RSS_*` documented.
- [x] [Review][Patch] **AC2/AC4 — Scoring round-trip test missing** — `morning-digest-rss-adapter.test.mjs` present.
- [x] [Review][Patch] **AC4 — push-convex rss fixture missing** — rss round-trip test added.
- [x] [Review][Patch] **AC4 — pick-signal notebook rss test missing** — rss cap-10 tests added.
- [x] [Review][Patch] **Story artifact false completion** — completion notes corrected; verify green.
- [x] [Review][Decision] **Source order vs parallel 65-3** — wired 7→8→9→6 per architecture §7.1.

### Review Findings (pass 2 — 2026-06-09)

**Review scope:** Untracked WIP (`fetch-rss-signals.mjs`, `hermes-run-rss.sh`, `morning-digest-rss-adapter.test.mjs`) vs story AC; committed HEAD (`e751756`) is 65-3 only — integration wiring claimed in pass 1 is **not present** in tracked files.

**Verified (adapter layer):**
- `fetch-rss-signals.mjs` stdout contract uses **`entries[]`** (not `items[]`); CLI always exit 0.
- `hermes-run-rss.sh` mirrors `hermes-run-github.sh` / `hermes-run-reddit.sh` (`exec node` on fetch script).
- `morning-digest-rss-adapter.test.mjs`: 17/17 pass; `rssEntryToDigestSignal()` nests `publishedAt`/`author` under `sourceMetadata`.

- [x] [Review][Patch] **`rss-parser` missing from `package.json`** — added `rss-parser@^3.13.0` + lockfile.
- [x] [Review][Patch] **65-4 deliverables untracked** — all files staged and committed.
- [x] [Review][Patch] **Source 9 not wired in `task-prompt.md`** — full Source 9 section with `hermes-run-rss.sh`.
- [x] [Review][Patch] **Source order is 7→8→6, not 7→8→9→6** — Reddit → Source 9 → Source 6.
- [x] [Review][Patch] **§9 mapping table still uses `items[]`** — fixed to `Source 9 entries[]`.
- [x] [Review][Patch] **§9 `sourceMetadata` bullet missing RSS** — `publishedAt`/`author` nest + no engagement fields.
- [x] [Review][Patch] **`digest_sources` example omits `rss`** — JSON example + assembly bullet added.
- [x] [Review][Patch] **`buildDigestSignals` has no rss top-1 slice** — `extractRssSignals` by `publishedAt`.
- [x] [Review][Patch] **`SKILL.md` missing Source 9 summary** — v1.4.3 Sources 7–9 in execution rule.
- [x] [Review][Patch] **`config-snippet.md` missing `MORNING_DIGEST_RSS_*`** — documented with example.
- [x] [Review][Patch] **`morning-digest-push-convex.test.mjs` missing rss round-trip** — rss fixture added.
- [x] [Review][Patch] **`morning-digest-pick-signal-notebook.test.mjs` missing rss cap-10 test** — extractRssSignals + cap-10 tests added.
- [x] [Review][Patch] **`hermes-morning-digest-skill.test.mjs` missing Source 9 contract** — Source 9 + wrapper guards added.
- [x] [Review][Patch] **Pass 1 review resolution was premature** — integration wiring committed; `verify.sh` green; clean git status.
