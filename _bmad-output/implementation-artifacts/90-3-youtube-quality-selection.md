---
story_id: 90-3
epic: 90
title: youtube-quality-selection
status: done
created: 2026-07-23
operator_brief: 2026-07-23
baseline_commit: 610d5e3081d33f3c45b1b33ea63406ec7b47f0fc
predecessors: 90-4, 90-2, 72-1
sequencing: AFTER 90-4 (youtube survives dedupe); quality selection now verifiable E2E
design_gate: APPROVED_2026-07-23 — P1-P7; lookback 72; keep 12; floor AND 200/5; NO velocity-without-floor fallback; vel min-age default 1h env-configurable
implemented: 2026-07-23
do_not_touch: score-digest-signals.mjs; dedupe-digest-signals.mjs; hardcoded API keys; WriteGate / vault_log_action / security.md; adapter exit-0 / stdout contract
same_failure_shape_as: 89-1 github (cannot rank a quality signal you never fetched)
sim_artifacts:
  - _bmad-output/implementation-artifacts/90-3-sim-before-after-2026-07-23.json
  - _bmad-output/implementation-artifacts/90-3-before-after-sim-2026-07-23.txt
---

# Story 90.3: Make YouTube intake high-signal (best-of, not newest)

Status: done

<!-- DESIGN GATE APPROVED 2026-07-23. Implemented; ready for code-review. -->

Epic: **90 — Intake health** · **`90-3-youtube-quality-selection`**  
**Depends on:** 90-4 (youtube `v=` survives dedupe) · **Predecessors:** 90-2 (obs), 72-1 (adapter)  
**Repo:** Omnipotent.md only (`hermes-consolidation`)

## Story

As a **CNS operator reading morning-digest / Nexus youtube signals**,
I want **the YouTube fetcher to over-fetch a wider candidate pool and keep the best ~10–15 by view-velocity with a quality floor**,
so that **the digest surfaces genuinely popular/rising videos instead of the newest zero-engagement uploads that currently crowd the cap**.

---

## Problem (verified in code)

`fetch-youtube-signals.mjs` today:

1. `search.list` with `order: 'date'` + `publishedAfter` = last **24h** (`PER_QUERY_DEFAULT=3`)
2. `dedupeVideosById(..., maxVideos)` **caps at 25 in encounter/date order** — **before** any quality judgment
3. `videos.list` enriches `viewCount` / `likeCount` / `commentCount` — but only as metadata on the already-selected 25
4. Result: low-view/low-like recent uploads fill the slot; popular videos outside the date-first 3×query window are never fetched

Same failure shape as **89-1 github**: you cannot rank a quality signal you never fetched.

**Downstream is already correct — do not touch:**

- `score-digest-signals.mjs:306-322` ranks youtube engagement as `0.6·views + 0.3·likes + 0.1·comments` (log-norm); null engagement → Path B (`TREND_PROXY_PRIOR.youtube=40`) and **survives**
- `dedupe-digest-signals.mjs` (90-4) preserves distinct youtube primaries via `canonicalDomainPath` embedding `v=`

The fix belongs **entirely in the fetcher's candidate selection**.

---

## Proposed ship package (PENDING APPROVAL)

| ID | Decision | Proposed default | Env var | Rationale |
|----|----------|------------------|---------|-----------|
| **P1** | Over-fetch breadth | `PER_QUERY=10` (was 3) | `MORNING_DIGEST_YOUTUBE_PER_QUERY` | 10 queries × 10 = up to 100 raw hits → ~90 unique after id-dedupe (sim: 93) |
| **P2** | Widen lookback | `LOOKBACK_HOURS=72` (was 24) | `MORNING_DIGEST_YOUTUBE_LOOKBACK_HOURS` | Popular-but-slightly-older videos enter the pool; freshness tradeoff explicit below |
| **P3** | Search order | keep `order: 'date'` | `MORNING_DIGEST_YOUTUBE_SEARCH_ORDER` (default `date`) | Client-side rank after enrich; see order evaluation |
| **P4** | Rank signal | **view-velocity** = `viewCount / max(hoursSincePublish, 1/60)` | (in-code; optional env later) | Deltas-not-levels; fits cockpit premise |
| **P5** | Quality floor | `MIN_VIEWS=200`, `MIN_LIKES=5` | `MORNING_DIGEST_YOUTUBE_MIN_VIEWS`, `…_MIN_LIKES` | Drops zero-engagement spam; see floor defense |
| **P6** | Keep-N | **12** (target 10–15) | Remap `MORNING_DIGEST_YOUTUBE_MAX_VIDEOS` → keep-N after rank (default **12**, hard max still 50) | Best-of-best, not mixed 25 |
| **P7** | Candidate cap | enrich at most **100** unique ids | `MORNING_DIGEST_YOUTUBE_CANDIDATE_MAX` (default 100) | Bound `videos.list` cost; dedupe-by-id still runs first |

### Explicit freshness / quality tradeoff (P2)

| Lookback | What you gain | What you risk |
|----------|---------------|---------------|
| **24h** (today) | Strict morning freshness | Popular videos published 25–48h ago never appear; pool is mostly brand-new zeros |
| **72h** (proposed) | Rising videos with a day or two of traction enter the candidate set | A 60h-old mega-hit can outrank a 2h-old breakout **unless** velocity is used (P4 mitigates) |
| **48h** (alt) | Milder stale risk | Smaller pool; sim used 72h — if operator prefers tighter freshness, ship 48 with same floor/rank |

**Recommendation:** ship **72h**. Velocity already penalizes stale absolute-view dumps relative to fresh fast-risers. Operator can pin `LOOKBACK_HOURS=48` in `~/.hermes/trend-ingest.env` without code change.

### Search order evaluation (P3) — REJECT relevance/viewCount

Live spot-check (`q=claude code`, `publishedAfter=72h`, top 5) [Source: YouTube Data API v3 `search.list` order enum]:

| `order` | What came back | Verdict |
|---------|----------------|---------|
| **`date`** | Fresh niche (hundreds of views, hours old) | **KEEP** — candidate pool for client rank |
| **`relevance`** | Evergreen tutorials (14k–40k views) | **REJECT** — levels, not deltas; days/weeks old inside the window |
| **`viewCount`** | Mega-virals (28k–97k) | **REJECT** — same; cockpit wants rising signal, not all-time winners |

**Ship:** `order: 'date'` + enrich full candidate pool + client-side velocity rank. Do **not** switch API order to `viewCount`/`relevance`.

### Ranking signal (P4) — pick VIEW-VELOCITY

| Signal | Formula | Pros | Cons |
|--------|---------|------|------|
| **View-velocity (PICK)** | `views / max(hoursSincePublish, 1/60)` | Matches deltas-not-levels; fresh fast riser beats stale absolute pile; independent of scorer | Brand-new (<~15 min) can spike if views>0 — floor (P5) and 1-minute age floor damp this |
| Absolute engagement composite (scorer already uses) | `0.6·logNorm(views)+0.3·logNorm(likes)+0.1·logNorm(comments)` | Aligns with Path A score | Favors older videos with big totals; duplicates scorer job; worse for morning “what’s rising” |
| Absolute views only | `viewCount` | Simple | Same stale bias; ignores age |

**Why not reuse the scorer composite in the fetcher?** Scorer correctly ranks **among signals already stored**. Fetcher’s job is **which candidates enter**. Velocity is the right filter for intake; composite remains correct downstream. **Do not edit `score-digest-signals.mjs`.**

Tie-break: higher `viewCount`, then higher `likeCount`.

### Quality floor (P5) — starting values defended

Live floor sensitivity on the **93-candidate** pool (72h × perQuery 10):

| Floor | Survivors | keep-12 med views | Notes |
|-------|-----------|-------------------|-------|
| views≥100 likes≥0 | ~14 | ~682 | Soft; keeps low-like shorts |
| **views≥200 likes≥5** | **~10** | **~703** | **RECOMMENDED** — fills keep≈10–12 without starvation |
| views≥500 likes≥5 | ~9 | ~715 | Slightly sparse |
| views≥500 likes≥10 | ~7 | ~754 | Used in first sim pass — **too sparse** for keep-12 |
| views≥1000 likes≥10 | ~2 | — | Starvation |

**Defense:**

- **MIN_VIEWS=200:** On BEFORE’s date-25, only 4/25 had ≥100 views and 2/25 had ≥200+likes — the current set is almost all noise. 200 is a low bar for “someone watched this” in AI-topic YouTube within 72h.
- **MIN_LIKES=5:** Absolute-view shorts can rack views with near-zero likes (sim: `1267v / 3L` shorts would dominate velocity). Likes floor kills engagement-bait without needing a separate shorts heuristic.
- Soft-fail: if floor wipes the pool to 0, **return `{videos:[]}`** (precision over recall; **no** velocity-without-floor fallback) and emit a loud stderr line `quality-floor-wiped: N candidates enriched, 0 cleared floor` so persistent starve is catchable by log inspection and distinguishable from empty-fetch (`enriched=0` → `{error}`).

### Keep-N (P6)

- Default **12** (mid of operator’s 10–15 target)
- Remap existing `MORNING_DIGEST_YOUTUBE_MAX_VIDEOS` from “pre-enrich date cap” → “post-rank keep-N”
- In-code default changes **25 → 12**; hard max remains **50**
- `MORNING_DIGEST_YOUTUBE_CANDIDATE_MAX` (new, default **100**) caps unique ids enriched

### Pipeline change (binding for implementer)

```text
TODAY:
  search(date,24h,perQuery=3) → concat → dedupeVideosById(cap=25) → enrich(25) → stdout

PROPOSED:
  search(date,72h,perQuery=10) → concat → dedupeVideosById(cap=CANDIDATE_MAX)
    → enrich(all candidates) → floor(minViews,minLikes) → sort(viewVelocity desc)
    → slice(keepN=MAX_VIDEOS) → stdout
```

`dedupeVideosById` **still runs** (90-4 handles cross-source dups; fetcher must not emit duplicate videoIds from overlapping queries).

### Quota honesty (P7)

| Phase | Units (10 queries) |
|-------|---------------------|
| `search.list` | 10 × **100** = **1000** |
| `videos.list` enrich | **1** per request, batch ≤50 → ceil(candidates/50). Sim: 93 ids → **2** |
| **Total** | **~1002** |
| `QUOTA_WARN_THRESHOLD` | **2000** (keep) |
| Daily free quota | 10 000 — ~10× headroom at one morning run |

**Fix the estimate** in `runYoutubeFetch` (today: `queries*100 + maxVideos` understates enrich-all / overstates keep-N):

```text
estimatedQuota = queries.length * 100 + Math.ceil(candidateCount / 50)
```

Log on stderr when over warn: include `candidates-enriched=N keep=K`.

**Candidates-enriched vs final-kept (sim):** enriched **93** → floored ~10 → kept **12** (or fewer if floor sparse).

---

## REQUIRED: live before/after simulation

Artifacts (committed with this story):

- `_bmad-output/implementation-artifacts/90-3-before-after-sim-2026-07-23.txt`
- `_bmad-output/implementation-artifacts/90-3-sim-before-after-2026-07-23.json`

**Method:** one wide `order=date` pass (lookback 72h, maxResults 10 / query × 10 queries), enrich all unique ids. Reconstruct BEFORE as first-3-per-query within 24h + date-order cap 25. AFTER = floor + velocity + keep-N.

### Summary (simAt ≈ 2026-07-23T04:10Z)

| Set | n | views med/avg/max | likes med/avg | vel med/avg |
|-----|---|-------------------|---------------|-------------|
| **BEFORE** (date-cap 25) | 25 | **6** / 123 / 1267 | **0** / 2 | 5.9 / 60.5 |
| **AFTER** (vel keep; floor 500/10 first pass) | 7 | **742** / 1210 / 3498 | **21** / 47 | 223 / 249 |
| **AFTER recommended** (floor 200/5 → ~10 surv) | ~10–12 | med views **~700** | med likes **~15–20** | med vel **~195** |

- Overlap BEFORE ∩ AFTER-kept: **1 / 25** — selection almost entirely replaced
- Newly selected examples (not in BEFORE): Codex Micro keyboard **3498v**, Best AI Coding Tools **1256v**, Claude Code command packs **690–993v**
- Dropped BEFORE junk: dozens of **0–30 view** uploads that currently occupy the digest

**Quality lift:** ~**100×** median views; near-total removal of zero-engagement spam.

First sim pass used floor 500/10 (only 7 survivors). **Ship recommendation softens to 200/5** per sensitivity table above — still massive lift vs BEFORE.

### BEFORE top (date-ordered) — illustrative

```
 31v  2L | Are Your AI Agents Really Production Ready?
 20v  2L | The Tiniest AI Agent on GitHub Has Nearly 50K Stars
  1v  0L | AI Agents Take Off, Gemini Flash Updates…
618v 15L | AIへの指示は「8割」いらなかった——Claude Code…   ← rare keeper
1267v 3L | 3 AI tools… #shorts                         ← high views, low likes
```

### AFTER (view-velocity, floor 500/10 pass)

```
3498v  94L vel=492 | OpenAI launches Codex Micro…
 618v  15L vel=279 | AIへの指示は「8割」いらなかった…
 993v  14L vel=245 | 100 Claude Code Commands Part 2
 742v  21L vel=223 | You can now run massive AI models…
1256v 131L vel=110 | Best AI Coding Tools 2026
```

---

## Acceptance Criteria

### 1. Over-fetch + lookback (AC: breadth)

**Given** bare cron env (no YOUTUBE breadth overrides)  
**When** `loadYoutubeConfig` runs  
**Then** defaults are `perQuery=10`, `lookbackHours=72`, `maxVideos` (keep-N)=`12`, `candidateMax=100`  
**And** env overrides in `~/.hermes/trend-ingest.env` win (double-quote values with spaces)  
**And** search still uses `publishedAfter` ISO from lookback

### 2. Search order (AC: order)

**Given** `searchVideosForQuery`  
**When** building `search.list` params  
**Then** `order` defaults to `date`  
**And** unit test documents that `relevance`/`viewCount` are not the production default  
**And** optional `MORNING_DIGEST_YOUTUBE_SEARCH_ORDER` only accepts known enum values; invalid → `date`

### 3. Enrich-then-rank (AC: rank)

**Given** unique candidates after `dedupeVideosById(..., candidateMax)`  
**When** fetch completes successfully  
**Then** **all** candidates are enriched before selection  
**And** ranking uses view-velocity (not absolute views alone, not scorer composite)  
**And** output length ≤ keep-N (`MAX_VIDEOS`)  
**And** stdout items still include `viewCount`/`likeCount`/`commentCount`/`publishedAt` for the scorer

### 4. Quality floor (AC: floor)

**Given** enriched candidates  
**When** floor applied  
**Then** rows with `viewCount < MIN_VIEWS` OR `likeCount < MIN_LIKES` are dropped before keep-N  
**And** fixture test: high-velocity low-like short below floor is excluded; high-velocity above floor is kept  
**And** if floor yields 0 → return `{videos:[]}` (precision over recall; **no** velocity-without-floor fallback). Stderr warns floor wipe. Optional ops softener: halve floor via env (e.g. 100/3), never remove it.

### 5. Quota estimate (AC: quota)

**Given** N candidates to enrich  
**When** estimating quota  
**Then** estimate is `queries*100 + ceil(N/50)` (not `+ maxVideos`)  
**And** warn still fires above `QUOTA_WARN_THRESHOLD=2000`  
**And** Completion Notes record candidates-enriched vs final-kept from a real or fixture run

### 6. Contracts preserved (AC: contract)

**Given** any failure path  
**Then** exit **0** and stdout `{error:"..."}` or `{videos:[...]}` unchanged in shape  
**And** `score-digest-signals.mjs` and `dedupe-digest-signals.mjs` **untouched** (git diff clean)  
**And** no hardcoded API keys  
**And** `dedupeVideosById` still removes duplicate videoIds within the fetcher

### 7. Tests + verify (AC: verify)

**Given** fixture-based unit tests  
**When** `node --test tests/morning-digest-youtube-adapter.test.mjs` and `bash scripts/verify.sh`  
**Then** both exit 0  
**And** new tests prove: floor drops junk; velocity reorders; keep-N truncates; config defaults; enrich happens before rank  
**And** Completion Notes paste real passing test output

---

## Tasks / Subtasks

- [x] Task 1 — Config surface (AC: breadth, order)
  - [x] Extend `loadYoutubeConfig` with `minViews`, `minLikes`, `candidateMax`, `searchOrder`, `velocityMinAgeHours`
  - [x] Change defaults: perQuery 10, lookback 72, maxVideos 12, candidateMax 100, minViews 200, minLikes 5, velocityMinAgeHours 1
  - [x] Document env keys in `references/config-snippet.md` + task-prompt Source 13 bullet (N default 12)
- [x] Task 2 — Selection pipeline (AC: rank, floor, quota)
  - [x] Export pure helpers: `hoursSincePublish`, `viewVelocity`, `applyQualityFloor`, `rankVideosByVelocity`, `selectYoutubeVideos`, `estimateYoutubeQuota`
  - [x] Rewire `runYoutubeFetch`: dedupe(candidateMax)→enrich→floor→rank→keep-N
  - [x] Floor wipe → `{videos:[]}` + stderr (NO velocity-without-floor fallback)
  - [x] Fix quota estimate to candidates-enriched
- [x] Task 3 — Tests (AC: floor, rank, verify)
  - [x] Fixture cases for velocity ordering, floor drop, keep-N, config defaults, empty-on-wipe
  - [x] Preserve existing CLI exit-0 / disabled / missing-key tests
- [x] Task 4 — Ops pin (optional)
  - [x] Skipped explicit `~/.hermes/trend-ingest.env` pins — in-code defaults apply under bare cron; config-snippet documents ops pins
- [x] Task 5 — Verify gate
  - [x] `bash scripts/verify.sh` green; Hermes skill reinstalled for parity; candidates-enriched vs kept in stderr + Completion Notes

### Review Findings

- [x] [Review][Decision] Floor-wipe payload vs 90-2 drop visibility — **resolved 2026-07-23: keep `{videos:[]}`**. Floor wipe is working-as-designed QUIET, not a drop; `{error}` would lie about adapter health and pollute `errors_by_source`. Digest-layer wipe visibility deferred separately. Follow-up patch: louder stderr distinguishing wipe (enriched=N) from empty-fetch (enriched=0).
- [x] [Review][Patch] Louder floor-wipe stderr: `quality-floor-wiped: N candidates enriched, 0 cleared floor` (distinguish from empty-fetch) [`fetch-youtube-signals.mjs`]
- [x] [Review][Patch] Cap `perQuery` at YouTube `maxResults` 50 [`fetch-youtube-signals.mjs`]
- [x] [Review][Patch] Clamp `lookbackHours` to a safe hard max so extreme env cannot make `publishedAfterIso` throw Invalid Date outside the fetch try/catch [`fetch-youtube-signals.mjs`]
- [x] [Review][Patch] Guard `selectYoutubeVideos` when `keepN` is undefined/non-finite (`slice(0, undefined)` returns full pool) [`fetch-youtube-signals.mjs`]
- [x] [Review][Patch] Guard non-finite / negative `viewCount` in `viewVelocity` → 0 (NaN breaks sort) [`fetch-youtube-signals.mjs`]
- [x] [Review][Patch] Future / clock-skew `publishedAt` (age 0) currently ranks as `views/minAgeHours`; treat as untrusted → velocity 0 [`fetch-youtube-signals.mjs`]
- [x] [Review][Patch] Add fixture that contrasts date-order BEFORE vs velocity+floor AFTER on the same pool (median/set membership lift), not only post-pipeline ID asserts [`morning-digest-youtube-adapter.test.mjs`]
- [x] [Review][Patch] Add tests: `candidateMax` bounds enrichment; undated/zero-view ranked last; fewer-than-keepN no pad/crash; missing `likeCount` → 0 via `parseStatCount` [`morning-digest-youtube-adapter.test.mjs`]
- [x] [Review][Patch] Completion Notes: record concrete candidates-enriched→kept (fixture or sim); strike stale Proposed soft-fail “velocity-without-floor fallback” text (contradicts AC4 / design_gate) [`90-3-youtube-quality-selection.md`]
- [x] [Review][Defer] Quota warn only after search (needs actual candidate N; pre-flight would be worst-case only) — deferred, pre-existing posture / AC-aligned
- [x] [Review][Defer] First-come `dedupeVideosById` across queries under `candidateMax` (later queries can starve) — deferred, pre-existing helper semantics
- [x] [Review][Defer] No stable `videoId`/`publishedAt` final tie-break beyond views/likes — deferred, out of P4 tie-break spec
- [x] [Review][Defer] Invalid `SEARCH_ORDER` silently → `date` with no stderr — deferred, AC2 intentional
- [x] [Review][Defer] Allowlist includes `title`/`videoCount` (odd with `type=video`) — deferred, YouTube enum surface
- [x] [Review][Defer] Unbounded `velocityMinAgeHours` / no `candidateMax < keepN` config rejection — deferred, ops misconfig edge
- [x] [Review][Defer] Healthy runs always `console.error` select stats (cron noise risk) — deferred, observability choice aligned with 90-2

---

## Dev Notes

### Files to touch (ONLY)

| File | Change |
|------|--------|
| `scripts/hermes-skill-examples/morning-digest/scripts/fetch-youtube-signals.mjs` | Config defaults + select pipeline |
| `tests/morning-digest-youtube-adapter.test.mjs` | Ranking/floor/keep-N fixtures |
| `scripts/hermes-skill-examples/morning-digest/references/config-snippet.md` | Env table |
| `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` | Source 13 emit-N default |

### Files NOT to touch

| File | Why |
|------|-----|
| `score-digest-signals.mjs` | Downstream engagement Path A already correct |
| `dedupe-digest-signals.mjs` | 90-4 just shipped; youtube identity preserved |
| Convex / dashboard | No schema change — stdout shape unchanged |
| Other social fetchers | Out of scope |

### Current state of UPDATE file (must preserve)

`runYoutubeFetch` today (`fetch-youtube-signals.mjs`):

- Enabled / apiKey / queries guards → `{error}`
- Per-query `searchVideosForQuery` with fatal quota abort
- Partial query failure continues (non-fatal)
- `dedupeVideosById(searchHits, config.maxVideos)` **early cap** ← **this is what changes**
- Enrich then `toStdoutVideo`
- CLI: `mergeTrendIngestEnv` → stdout JSON → always exit 0

**Preserve:** exit-0, error strings, fatal quota behavior, fixture injection hooks (`fixtureSearchByQuery`, `fixtureVideosListByBatch`), `mergeTrendIngestEnv`, no new npm deps.

### Interaction with 90-4

After 90-4, distinct `watch?v=` urls survive as primaries. Quality selection is now **observable** in `storedPrimaryCount` / yt-stage stderr (90-2). Over-fetch may pull near-dup titles across queries — fetcher `dedupeVideosById` removes same `videoId`; 90-4 entity proportion handles cross-source title glue. **Do not** reintroduce a fetcher-side title fuzzy collapse.

### Previous story intelligence

| Story | Carry-forward |
|-------|---------------|
| **90-4** | youtube primaries restored; design was propose-then-stop with real before/after sim — same gate posture |
| **90-2** | yt-stage + triple counts; use them to validate keep-N in prod after ship |
| **72-1** | Adapter contract, quota model (100/search + 1/videos.list batch), env via `mergeTrendIngestEnv` |
| **89-1** | Same thesis: widen fetch substrate before ranking; don’t invent rank on a truncated set |

### Git intelligence (recent)

```
610d5e3 feat(90-4): dedupe over-collapse — youtube v= canon, entity ≥0.5
8e0f1c9 feat(90-2): silent drop observability
f7327f5 feat(90-1): Reddit Atom RSS restore
0bfb3c6 feat(youtube): YouTube Data API v3 adapter (72-1)
```

### Latest tech (Context7 / YouTube Data API v3)

- `search.list` `order`: `date` | `rating` | `relevance` | `title` | `videoCount` | `viewCount` ([docs](https://developers.google.com/youtube/v3/docs/search/list))
- `search.list` quota: **100** units/call
- Prefer date-order candidate generation + local rank over API `viewCount` for rising-signal use cases

### Project context

- Morning-digest adapters are Node ESM under `scripts/hermes-skill-examples/morning-digest/scripts/`
- Verify: `bash scripts/verify.sh`
- No WriteGate / vault mutation in this story
- Spec touch: none required beyond existing adapter patterns; cite Epic 90 intake-health thread in sprint-status

### Anti-patterns (dev agent MUST NOT)

1. Cap at keep-N **before** enrich (recreates the bug)
2. Switch API `order` to `viewCount` thinking it replaces velocity
3. Edit the scorer “to match” fetcher ranking
4. Hardcode the API key or put secrets in the story/tests
5. Claim done without fixture proof of floor + velocity + real verify output
6. Implement before operator marks design_gate approved

---

## Operator review — APPROVED 2026-07-23

1. **P1–P7 shipped** as proposed (perQuery 10, lookback 72, order date, view-velocity, floor 200/5 AND, keep 12, candidateMax 100)
2. Lookback **72** (velocity self-corrects)
3. Keep-N **12**
4. Floor **AND** (views≥200 AND likes≥5)
5. **NO** velocity-without-floor fallback; floor wipe → `{videos:[]}`; ops may halve floor via env
6. Velocity min-age denominator default **1h**, env `MORNING_DIGEST_YOUTUBE_VELOCITY_MIN_AGE_HOURS`

---

## Dev Agent Record

### Agent Model Used

Composer (dev-story 90-3)

### Debug Log References

- Live sim artifacts from create-story: `90-3-before-after-sim-2026-07-23.txt`, `90-3-sim-before-after-2026-07-23.json`
- Hermes skill install required for verify parity after script/docs edit

### Completion Notes List

- Pipeline: search(date,72h,perQuery=10) → dedupe(candidateMax=100) → enrich all → floor(200 AND 5) → velocity rank (minAge=1h) → keep-N=12
- Quota: `estimateYoutubeQuota(queries, candidates)` = `queries*100 + ceil(N/50)`; stderr logs `candidates-enriched` vs `kept`
- Floor wipe returns `{videos:[]}` (QUIET / precision); loud stderr `quality-floor-wiped: N candidates enriched, 0 cleared floor`; task-prompt treats empty as “no high-signal videos today”
- Candidates-enriched → kept (recorded): live sim ~93 → ~10–12 (floor 200/5); unit fixture quality pool 5 → 3 (keepN=5, floor drops junk+low-likes); E2E keepN=3 fixture 5 → 3; floor-wipe fixture 2 → 0
- Scorer + 90-4 dedupe: git diff clean (untouched)
- Code-review patches 2026-07-23: perQuery≤50, lookback≤720h, keepN/viewCount/future-ts guards, before/after lift fixture, candidateMax enrich bound test
- Tests: `node --test tests/morning-digest-youtube-adapter.test.mjs` → **38 pass / 0 fail**
- `bash scripts/verify.sh` → **VERIFY PASSED** (after `install-hermes-skill-morning-digest.sh`)

### File List

- `scripts/hermes-skill-examples/morning-digest/scripts/fetch-youtube-signals.mjs`
- `tests/morning-digest-youtube-adapter.test.mjs`
- `scripts/hermes-skill-examples/morning-digest/references/config-snippet.md`
- `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md`
- `_bmad-output/implementation-artifacts/90-3-youtube-quality-selection.md`
- `_bmad-output/implementation-artifacts/90-3-before-after-sim-2026-07-23.txt`
- `_bmad-output/implementation-artifacts/90-3-sim-before-after-2026-07-23.json`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- (install) `~/.hermes/skills/cns/morning-digest/` mirrored via install script

### Change Log

- 2026-07-23 — Story created with live before/after sim; design_gate PENDING_OPERATOR_APPROVAL
- 2026-07-23 — Design APPROVED; implemented P1–P7; verify green; status → review
- 2026-07-23 — Code review: keep `{videos:[]}` on wipe; applied 9 patches; status → done
