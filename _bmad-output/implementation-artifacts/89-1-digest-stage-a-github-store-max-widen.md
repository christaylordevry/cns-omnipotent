---
story_id: 89-1
epic: 89
title: digest-stage-a-github-store-max-widen
status: done
created: 2026-07-21
operator_brief: 2026-07-21
design_gate: GO
baseline_commit: 024f2ec
predecessors: 65-1, 65-8, OPS-2
related: deferred-work.md CHORE 2, curation-selection-research-2026-07-21.md
correction: >
  2026-07-21 — narrowed: STORE_MAX write-all only. SHORTLIST_MAX + Polymarket exclusion
  moved to 89-3 (no judgment shortlist exists in code today).
supersedes_filename: 89-1-digest-stage-a-github-pool-and-polymarket-exclusion.md
---

# Story 89.1: Stage A — GitHub STORE_MAX widen (write-all into digestSignals)

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

> [!abstract] Stage A is data accumulation, not a UX improvement
> This story only widens what is **written** to `digestSignals`. It does **not** build a
> judgment shortlist, cap shortlist composition, or exclude Polymarket from a selector that
> does not exist yet. Day-one operator-visible top-N by `rankScore` will **not** look better
> (see simulation: `"it is good now!"` at #5 after a hypothetical poly filter). The point is
> **~40 GitHub rows/day stored** so Stage B can compute star velocity from real history.

## Story

As a **CNS operator running an always-alive intelligence cockpit**,
I want **morning-digest GitHub fetch to write a wide candidate pool into `digestSignals` (the only star-history store)**,
so that **Stage B can later derive velocity from accumulated `sourceMetadata.stars` — including the long tail that today's MAX_REPOS=5 discards**.

## Why this exists (north star)

Nexus is a **continuous intelligence cockpit**. GitHub currently emits **LEVEL** signals
(absolute stars). An analyst surface needs **DELTA** signals. Velocity requires history.
History requires writing more than five mega-repos per day.

This is **upstream fetch/store widening** only. Selection rules (GitHub shortlist cap,
Polymarket type-exclusion) live in **89-3**, owned by whoever builds the judgment shortlist
selector (WDS Phase 4 IA — **not implemented** as of 2026-07-21).

## Non-goals (hard)

- Not a dashboard redesign
- Not a `rankScore` re-blend / new composite score
- Not a matcher change / not BD-5 / not BD-6
- Not trend-layer analytics / cluster layer
- Not Stage B velocity ranking or inventing a threshold from today's 5 repos
- **Not** building a judgment shortlist selector
- **Not** `SHORTLIST_MAX` / `MORNING_DIGEST_GITHUB_SHORTLIST_MAX` (nothing would read it)
- **Not** Polymarket shortlist exclusion (no shortlist path to exclude from — see 89-3)
- **Not** a shortlist-eligibility field on `digestSignals` (would force OPS-2 contract regen)
- **Not** capping GitHub at write time to "keep digest share at 6.7%" — rejected

## Evidence (measured 2026-07-21 — do NOT re-derive)

1. **Curated GitHub queries do not fix level bias.** 12 correctly-parsed queries still return
   the same mega-repos (search sorts by absolute stars).

2. **Star velocity is computable from stored history** (`externalId` stable;
   `sourceMetadata.stars` persists). 07-18 → 07-21 on the only 5 stored repos:

   | Repo | 07-18 | 07-21 | Δabs | Δpct |
   |------|------:|------:|-----:|-----:|
   | obra/superpowers | 256602 | 258124 | +1522 | +0.593% |
   | langgenius/dify | 149173 | 149505 | +332 | +0.223% |
   | langchain-ai/langchain | 142004 | 142181 | +177 | +0.125% |
   | FoundationAgents/MetaGPT | 69414 | 69444 | +30 | +0.043% |
   | labring/FastGPT | 29014 | 29040 | +26 | +0.090% |

3. **Pool truncated before anything else.** `fetch-github-signals.mjs`:
   `MAX_REPOS_DEFAULT=5`, `PER_QUERY_DEFAULT=3`; neither set in env.
   12×3 ≈ 36 fetched → 31 discarded → 5 largest kept.

4. **Cold-start cliff is the dominant case.** Four stored runs = **same 5 repos every day**.
   Widen to ~40 → ~87% have no prior observation on day one. Do not fit a Stage B threshold
   to five mega-repo points.

5. **Live validation (operator):** `PER_QUERY=5` / `MAX_REPOS=40` returns **exactly 40**
   distinct repos after dedupe. Long tail previously discarded (emergence lives here):

   | Repo | Stars (order-of-magnitude) |
   |------|----------------------------:|
   | llm-d/llm-d-router | 261 |
   | yagil/ChatIDE | 222 |
   | alejandroll10/idea-evaluation-pipeline | 138 |
   | zeitstein/brimm | 110 |
   | Netxeo/skill-file-security | 69 |
   | CodingWithCalvin/VS-MCPServer | 64 |

6. **Absolute floor is load-bearing (Stage B note).** A 69-star repo gaining 6 stars is
   **+8.7%** and would out-rank every mega-repo on pure percent. Carry into 89-2 / Stage B.

### Env quoting bug (already fixed 2026-07-21 — do not regress)

Values with **spaces** in `~/.hermes/trend-ingest.env` **MUST be double-quoted**. Five lines
were silently unset (`FOO=a b c` → `FOO=a` + command-not-found for `b`). Verify after edits by
sourcing and checking for `command not found`. Backup:
`~/.hermes/trend-ingest.env.bak-20260721-144626`.

## Stage map

| Story | Scope | Status |
|-------|--------|--------|
| **89-1 (this)** | STORE_MAX=40 / PER_QUERY=5; write **all** fetched GitHub rows to `digestSignals` | implement after **go** |
| **89-2** | Stage B: velocity rank + threshold from accumulated distribution | backlog (after warm-up) |
| **89-3** | Judgment shortlist selection rules: GitHub SHORTLIST_MAX=5 + Polymarket type-exclusion | backlog (when shortlist exists) |

## Finding — no judgment shortlist in code (2026-07-21)

Verified in Omnipotent.md `scripts/` and cns-dashboard `src/` + `convex/`:

- Zero hits for `isJudgmentShortlistEligible` / `judgmentShortlist` / shortlist selectors
- `post-digest-discord.mjs` = 2000-char chunking only — no top-N selection
- Dashboard = rank-ordered **feed**, not a shortlist
- "Judgment shortlist" = WDS Phase 4 IA concept only (`ia-cockpit.md`)

Therefore this story **must not** claim ACs against a selector that does not exist.
Shipping an unread env knob or an unused eligibility field is the silent-no-op pattern
the project has been removing.

---

## Decisions — APPROVED (narrowed)

### D1. STORE_MAX / PER_QUERY (this story)

| Name | Env | Value | Enforced where |
|------|-----|------:|----------------|
| **STORE_MAX** | `MORNING_DIGEST_GITHUB_MAX_REPOS` | **40** | `fetch-github-signals.mjs` → `dedupeReposByUrl(..., maxRepos)` |
| **PER_QUERY** | `MORNING_DIGEST_GITHUB_PER_QUERY` | **5** | same fetcher → per-query parse / `per_page` |

**There is no separate store.** `build-digest-push-payload.mjs` (~line 200) writes **every**
repo the fetcher returns into `digestSignals`. That write **is** the store.
`digestSignals.sourceMetadata.stars` is the only substrate Stage B velocity can join on.

**Contract:** fetcher returns ≤40 → push writes **all** of them. Do **not** truncate at write
time. Feed share ~40 GitHub of ~110 rows is fine (secondary intake surface).

**Rate limits:** 12 search requests/run ≪ ~30/min authenticated. No pagination. Do not raise
query count here.

### D2. Warm-up before Stage B (89-2)

**7 consecutive successful digests** after 89-1 ships, each with
**`sourceType === 'github'` count ≥ 30** in that run's `digestSignals` (target 40).

Reachable only because write-all stores ~40/day. (A write-time emit cap of 5 would make
this gate permanently false.)

### D3. Cold-start / velocity / abs floor (specify for 89-2; do not implement here)

- **&lt;2 observations** → no velocity; unknown ≠ hot; exclude from velocity rank
- **Formula (89-2):** pctDelta primary + **absolute floor load-bearing** (derive thresholds
  from Stage-A distribution — do **not** fit to 5 mega-repos)
- Percent vs absolute already disagree on FastGPT vs MetaGPT (07-18→07-21)

### D4. Cut from this story → **89-3**

| Cut | Why |
|-----|-----|
| SHORTLIST_MAX=5 | No shortlist selection path to enforce or test |
| Polymarket hard shortlist exclusion | Same — no path; type-exclusion rationale preserved in 89-3 |
| `MORNING_DIGEST_GITHUB_SHORTLIST_MAX` | Env var nothing reads = silent no-op |
| `digestSignals` eligibility field | OPS-2 contract regen; out of scope |

---

## Mandatory simulation (keep verbatim)

Source: `~/.hermes/digest-push-2026-07-{18,19,20,21}.json` — 5 distinct GitHub `externalId`s only.

### BEFORE — raw top-5 by `rankScore` (2026-07-21)

| # | rankScore | Type | Title |
|--:|----------:|------|-------|
| 1 | 48 | github | langchain-ai/langchain |
| 2 | 47 | polymarket | Will Alibaba have the best AI model… July 2026? |
| 3 | 45 | polymarket | Will the next Claude Opus… by July 24, 2026? |
| 4 | 42 | github | langgenius/dify |
| 5 | 42 | polymarket | Will the next Claude Opus… by Oct 31, 2026? |

### Hypothetical AFTER poly filter only (not shipped in 89-1 — illustrates data-accumulation framing)

| # | rankScore | Type | Title | Factor |
|--:|----------:|------|-------|--------|
| 1 | 48 | github | langchain-ai/langchain | absolute_stars / rankScore — velocity **not** applied |
| 2 | 42 | github | langgenius/dify | absolute_stars / rankScore |
| 3 | 41 | github | obra/superpowers | absolute_stars / rankScore |
| 4 | 40 | github | labring/FastGPT | absolute_stars / rankScore |
| 5 | 40 | twitter | it is good now! | Non-poly fill — **next-worst promoted** |

**Label:** Stage A **alone does not improve** the operator-visible surface. Removing
Polymarket (when a selector eventually exists) just promotes the next-worst items. 89-1 only
accumulates rows.

### HYPOTHETICAL Stage B on today's 5-repo history — DO NOT SHIP

Illustrative (`ABS_FLOOR=100`, `PCT_THRESH=0.1%` — **not** real thresholds):

| Repo | Factor |
|------|--------|
| obra/superpowers | INCLUDE pct=+0.593% abs=+1522 |
| langgenius/dify | INCLUDE pct=+0.223% abs=+332 |
| langchain-ai/langchain | INCLUDE pct=+0.125% abs=+177 |
| labring/FastGPT | EXCLUDE fail_abs_floor / fail_pct |
| FoundationAgents/MetaGPT | EXCLUDE fail_abs_floor / fail_pct |

**DO NOT SHIP a threshold fitted to 5 mega-repos.**

---

## Acceptance Criteria

### AC1 — STORE_MAX write-all (GitHub)

**Given** `fetch-github-signals.mjs` + `build-digest-push-payload.mjs`  
**When** 89-1 lands  
**Then** defaults / env yield **STORE_MAX=40** and **PER_QUERY=5**  
**And** fetcher returns up to 40 distinct repos after URL dedupe  
**And** push writes **every** returned GitHub repo as a `digestSignal` (no write-time truncate)  
**And** each row has stable `externalId` + `sourceMetadata.stars`  
**And** a successful widened run stores **≥30** (target 40) `sourceType === 'github'` rows  

### AC2 — Env + quoting

**Given** `~/.hermes/trend-ingest.env` + `config-snippet.md` (+ example if present)  
**When** keys are documented/set  
**Then** `MORNING_DIGEST_GITHUB_MAX_REPOS` and `MORNING_DIGEST_GITHUB_PER_QUERY` are documented with approved defaults  
**And** there is **no** `SHORTLIST_MAX` / `EMIT_MAX` env introduced  
**And** space-bearing values are double-quoted; sourcing does not produce `command not found`  

### AC3 — No selection / no Stage B / no schema games

**Given** this story's PR  
**When** reviewed  
**Then** no shortlist selector is built  
**And** no Polymarket exclusion filter is added "for later"  
**And** no shortlist-eligibility field is added to `digestSignals` / OPS-2 contract  
**And** no velocity threshold / `rankScore` re-blend / matcher work  

### AC4 — Tests + verify

**Given** unit tests for github fetch config + push writes all fetched repos  
**When** `bash scripts/verify.sh` runs  
**Then** gate passes  

## Tasks / Subtasks

- [x] **T0 — Operator says go** (blocking)
- [x] **T1 — Fetcher defaults** (AC: #1, #2)
  - [x] `MAX_REPOS_DEFAULT=40`, `PER_QUERY_DEFAULT=5` (or env-driven with those defaults)
  - [x] Document in `config-snippet.md`; quote guidance
  - [x] Keep `sort=stars` (no API change)
- [x] **T2 — Confirm write-all** (AC: #1)
  - [x] Do not add a truncate in `build-digest-push-payload.mjs` GitHub loop
  - [x] Test: N fetched repos → N github signals in payload
- [x] **T3 — Ops env** (AC: #2)
  - [x] Set `MORNING_DIGEST_GITHUB_MAX_REPOS=40` and `_PER_QUERY=5` in `~/.hermes/trend-ingest.env`
  - [x] Hermes skill install/sync if example paths require it
- [x] **T4 — Tests + verify** (AC: #4)
  - [x] Extend `tests/morning-digest-github-adapter.test.mjs`
  - [x] `bash scripts/verify.sh`
- [x] **T5 — Warm-up note**
  - [x] Track toward 89-2: 7 digests with github rows stored ≥30

### Review Findings

- [x] [Review][Defer] NexusDigestSignalFeed + Convex read ceiling silently drop rows above 100 [`cns-dashboard/.../NexusDigestSignalFeed.svelte:29` / `convex/digest.ts:337`] — deferred, pre-existing display clamp; ~133 total signals after github 5→40 crosses it; Stage B reads stored `digestSignals` rows and is unaffected
- [x] [Review][Defer] validate-epic-68-digest SIGNALS_LIMIT=100 undercounts widened runs [`scripts/validate-epic-68-digest.mjs:18`] — deferred, audit/read path only; warns when truncated
- [x] [Review][Defer] Discord digest gains ~+1 chunk (~1620 chars from +35 GitHub bullets) [`post-digest-discord.mjs:7,181-197`] — deferred, noisier post only; no message-count / rate-limit hold at ~+1 sequential chunk
- [x] [Review][Defer] Shared 45s Convex push timeout headroom shrinks with ~+35 sequential addDigestSignal [`push-digest-convex.mjs:25,523-533`] — deferred, monitor first widened live push; no evidenced failure; not a write-path cap

## Dev Notes

### Anti-pattern (must not ship)

```js
// WRONG — unreachable warm-up; long-tail history never lands
pushOnly(repos.slice(0, 5));
```

```js
// RIGHT — write all STORE_MAX
pushAll(repos); // ≤40 digestSignals with sourceMetadata.stars
```

### Current code (UPDATE)

| File | Today | 89-1 change |
|------|-------|-------------|
| `fetch-github-signals.mjs` | defaults 5 / 3 | STORE_MAX=40, PER_QUERY=5 |
| `build-digest-push-payload.mjs` ~200 | Already writes all fetched | Keep; raise fetcher output only |
| Shortlist / Polymarket filters | N/A (no selector) | **Out of scope** → 89-3 |
| `score-digest-signals.mjs` | Scores all rows | Do not re-blend |

### Preserve

- `externalId = shortSha256(url)`
- `sourceMetadata.stars` / `forks` nesting (OPS-2)
- `resolveOperatorHome()` + `mergeTrendIngestEnv`
- WriteGate / vault / matcher untouched

### References

- [Source: `fetch-github-signals.mjs`] — truncation bug
- [Source: `build-digest-push-payload.mjs`] — write loop = store
- [Source: `89-3-judgment-shortlist-github-cap-and-polymarket-exclusion.md`] — deferred selection rules
- [Source: deferred-work.md CHORE 2]

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Debug Log References

- Live fetch: `/tmp/89-1-github-fetch.json` — `repo_count=40`, `distinct_urls=40`
- Long-tail markers present: `llm-d/llm-d-router` (261), `CodingWithCalvin/VS-MCPServer` (64)
- Write-path: `write_path_fetched=40` → `write_path_github_signals=40` (1:1)
- Option (a) stripped-env live fetch still returned 40 (in-code defaults reach `loadGithubConfig`)
- `bash scripts/verify.sh` → **VERIFY_EXIT_CODE=0**

### Completion Notes List

- **Defaults choice: (a)** raised `MAX_REPOS_DEFAULT=40` / `PER_QUERY_DEFAULT=5` so Stage A accumulates history without depending on operator-local env alone. Env pins still set in `~/.hermes/trend-ingest.env` as belt-and-suspenders; Stage B warm-up clock can start on next successful digests.
- Why not (b): documenting/env-only would ship the silent-no-op this epic removes — code defaults would keep writing 5 mega-repos.
- No truncate added to `build-digest-push-payload.mjs` GitHub loop; write-all test covers N→N with `sourceMetadata.stars` + `externalId`.
- No SHORTLIST_MAX / EMIT_MAX / Polymarket / velocity / schema / matcher / dashboard work.
- Warm-up toward 89-2: need **7 consecutive digests** each with `sourceType === 'github'` count **≥30** (target 40) after this ship.

### File List

- `scripts/hermes-skill-examples/morning-digest/scripts/fetch-github-signals.mjs`
- `scripts/hermes-skill-examples/morning-digest/references/config-snippet.md`
- `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md`
- `tests/morning-digest-github-adapter.test.mjs`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/89-1-digest-stage-a-github-store-max-widen.md`

### Change Log

- 2026-07-21 — Raised GitHub STORE_MAX/PER_QUERY in-code defaults to 40/5; documented env pins + quote guidance; write-all unit test; ops env + skill sync; verify exit 0.

---

**Stage B warm-up (T5):** Clock starts with the next successful morning-digest runs that store ≥30 github `digestSignals` rows each.
