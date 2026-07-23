---
story_id: 90-1
epic: 90
title: restore-reddit-intake
status: done
created: 2026-07-22
revised: 2026-07-22
operator_brief: 2026-07-22
baseline_commit: e9049d3
predecessors: 67-2, 65-3, 65-2, 65-4, 44-3-2
related_deferred: deferred-work.md — trend-ingest env quote bug class; CHORE 1 continuous-layer truth
design_gate: APPROVED_2026-07-23 — adapter-only omit upvotes; scorer untouched; Q2 content match; Q3 UA; Q4 Firecrawl deferred
oauth_approach: DROPPED — operator cannot register Reddit script app
json_ua_approach: DROPPED — www.reddit.com/.../top.json 403s all UAs (infra block)
approach: app-free Atom RSS (verified 200 from operator WSL IP 2026-07-22)
do_not_touch: tiktok, instagram, pinterest, threads, linkedin (credit-exhausted — operator deferred)
deferred_upgrade: Firecrawl stealth enrich of top-N posts for real upvotes/comments — DO NOT BUILD NOW
---

# Story 90.1: Restore Reddit intake via app-free RSS (both layers)

Status: done

<!-- Redesign 2026-07-22 — OAuth/(a) JSON dropped; RSS + scoring proposal. STOP for operator design-gate review before /bmad-dev-story. -->

Epic: **90 — Continuous-layer Reddit restore (cockpit ambient corroboration)**  
Tracked as: **`90-1-restore-reddit-intake`**  
**Repos:** Omnipotent.md only (`hermes-consolidation`) — no `cns-dashboard` schema/UI  
**Does not touch:** WriteGate, `vault_log_action`, `security.md` mutators, ScrapeCreators credit-exhausted sources

## Story

As a **CNS operator running the always-alive Nexus cockpit**,
I want **Reddit restored on both the continuous trend layer and morning-digest Source 8 via app-free Atom RSS**,
so that **ambient-motion corroboration regains ~50% of its three-source base (google_trends + news + reddit) without a Reddit developer app, OAuth tokens, or fabricated engagement**.

---

## Why this matters (cockpit, not digest hygiene)

Reddit is **1 of only 3** continuous trend sources. Digest Source 8 is the same platform surface for the morning orient lens. Restoring Reddit is **cockpit-material ambient corroboration**.

| Layer | Path today | Failure (verified 2026-07-22) |
|-------|------------|-------------------------------|
| **Digest Source 8** | `fetch-reddit-signals.mjs` → `…/top.json` | `{"error":"http-403"}` exit 0 |
| **Trend ingest** | `trend-ingest.py` → PRAW | `status: error` — needs `REDDIT_CLIENT_*` (unavailable: no script app) |

**Out of scope:** TikTok / Instagram / Pinterest / Threads / LinkedIn (credit-exhausted).

---

## Design-gate answers (operator 2026-07-22) — binding

| # | Question | Answer |
|---|----------|--------|
| 1 | Story key `90-1` / epic 90? | **YES — keep** |
| 2 | Register script app / OAuth (b)? | **NO — dropped.** Persistent blocker; PRAW blocked by the same wall |
| 3 | Reddit username for UA? | **Optional.** Generic descriptive contact string; no personal account |
| 4 | Override 67-2 “public JSON only”? | **NOT an override.** Still unauthenticated public access; **endpoint only** changes (`json` → `rss`). 67-2 spirit preserved |

---

## Dropped approaches (do not revive)

### OAuth / PRAW credentials — DEAD

Operator **cannot** register a Reddit script app. Therefore:

- No `client_credentials` / password grant / any OAuth token
- Trend-layer PRAW (`REDDIT_CLIENT_ID` / `SECRET` / `USER_AGENT`) is blocked by the **same** wall
- Do **not** reintroduce OAuth into `fetch-reddit-signals.mjs`
- Do **not** require `REDDIT_CLIENT_*` for trend reddit after this story

### Public JSON + UA fix — DEAD

Verified via **node fetch** (adapter runtime) from residential WSL IP:

- `www.reddit.com/r/<sub>/top.json` → **403** on generic UA, Reddit-compliant `script:…`, **and** browser UAs
- Block is **infra-level** for unauthenticated `.json`, not a User-Agent typo
- Spike `spike-reddit-public-json.mjs` does **not** contain a working approach (same `.json` pattern)

---

## New approach — app-free Atom RSS (verified)

**Live proof (2026-07-22, operator WSL, node fetch):**

```text
GET https://www.reddit.com/r/MachineLearning/top/.rss?t=day
→ HTTP 200
→ Content-Type: application/atom+xml; charset=UTF-8
→ 7 <entry> elements
```

Sample mapped fields from first three entries:

| title (trunc) | link | id | updated | author |
|---------------|------|----|---------|--------|
| SkewAdam: … MoE … [R] | `…/comments/1v38k1m/…` | `t3_1v38k1m` | 2026-07-22T07:04:40Z | `/u/Kooky-Ad-4124` |
| Looking for feedback … Snake AI [P] | `…/comments/1v2xktw/…` | `t3_1v2xktw` | 2026-07-21T22:33:50Z | `/u/Due_Highlight_9341` |
| Happy openreview refresh day [D] | `…/comments/1v3enzq/…` | `t3_1v3enzq` | 2026-07-22T12:25:54Z | `/u/GuestCheap9405` |

**Reddit RSS provides NO `score` / `num_comments`.** Do not invent them.

**Rate limit:** rapid successive calls **429**’d in testing → pace subreddit loop **~2s** between subreddits; fetch each sub **once per run** when matching multiple trend keywords.

**User-Agent:** keep a descriptive hardcoded const (no secret). Prefer **NO new env vars** for RSS. If an env override is added anyway, spaced values in `~/.hermes/*.env` **MUST** be double-quoted (46-day starvation class).

**Endpoint note vs 67-2:** public unauthenticated access preserved; URL changes from:

```text
…/r/{sub}/top.json?t=day&limit=25&raw_json=1   → 403
…/r/{sub}/top/.rss?t=day                       → 200 Atom
```

---

## Source-of-truth check (constitution / specs)

| Artifact | Verdict |
|----------|---------|
| `specs/cns-vault-contract/AGENTS.md` | No vault/AGENTS edits |
| `modules/security.md` | No secrets required for RSS path; never invent credential writes |
| WriteGate / `vault_log_action` | **N/A** — not touched |
| `project-context.md` | Context7 if touching `rss-parser` / PRAW removal; `verify.sh` gate |
| Story **67-2** | Spirit preserved (public, unauthenticated); **endpoint** `json`→`rss` documented |
| Story **65-4** | Newsletter RSS pattern (`rss-parser`, exit 0, fixtures) — **mirror for Atom parse**, do not unify modules with Epic 44 |
| ADR-E65-004 | Keep Node digest vs Python trend separate; no shared Reddit package |
| `deferred-work.md` | Quote rule if any spaced env added; prefer no new env |

---

## Critical — scoring must not silently kill upvote-less Reddit

### The trap

```213:221:scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs
    case 'reddit':
    case 'producthunt': {
      if (!Number.isFinite(meta.upvotes)) {
        return null;
      }
      return Math.round(
        0.75 * logNorm(meta.upvotes, RD_UPVOTES_CAP) +
          0.25 * logNorm(commentCount, RD_COMMENTS_CAP),
      );
```

Two failure modes if the adapter is naïve:

1. **Omit upvotes** → `normalizeEngagement` returns `null`. `scoreDigestSignals` itself still emits Path B (trendProxy) rows today — but tests, Discord copy, and `extractRedditSignals` sort-by-upvotes assume engagement exists.
2. **Worse — emit `upvotes: 0`** (current JSON mapper defaults missing scores to `0`) → `Number.isFinite(0)` is true → Path A with **zero** engagement → momentum crushed (`0.75*0 + 0.25*42 ≈ 11`) instead of full Path B (`momentum = 42`). This is the YouTube-class silent degradation: signals “survive” but are scored as empty engagement trash.

**Binding rule:** RSS posts must **omit** `upvotes` / `commentCount` (undefined), never coerce to `0`.

### Proposed scoring rule (PROPOSE — approve before implement)

| Situation | Behavior |
|-----------|----------|
| `sourceType: 'reddit'` **with** finite `sourceMetadata.upvotes` | Keep Path A (logNorm upvotes/comments) — reserved for deferred Firecrawl enrich |
| `sourceType: 'reddit'` **without** finite upvotes (RSS) | `normalizeEngagement` → **`null`** (do **not** fabricate synthetic upvotes) |
| Momentum | Path B: `scoreMomentum` uses `TREND_PROXY_PRIOR.reddit` (**42**) when NE is null |
| Urgency | Existing `scoreUrgency` / `recencyScore(publishedAt)` from Atom `<updated>` |
| Relevance / personalRelevance | Existing title-token F1 vs domain / goals — no change |
| Rank | Existing `computeRankScore` engagement-absent branch (redistributes engagement weight onto momentum) |
| `producthunt` | **Split** out of the shared `reddit` switch arm — PH still requires upvotes |

**Do not:** invent fake upvotes, map author karma, or hardcode engagement constants per post.

### Simulated before/after on real RSS fetch (2026-07-22)

Inputs: three Atom entries from `r/MachineLearning` (table above), assembled as digestSignals **without** `upvotes`, scored via live `scoreDigestSignals` with a representative watchlist token ctx (`moe`, `optimizer`, `gpu`, …), `runAt = 2026-07-22T14:00:00Z`.

**BEFORE (naïve `upvotes: 0` coercion — DO NOT SHIP):** Path A with zero engagement → momentum ≈ 11; ranks collapse; looks “live” but is engagement-poisoned.

**AFTER (proposed — omit upvotes → null NE → Path B):** actual measured output from current scorer (Path B already works when upvotes are omitted):

| title (trunc) | NE | momentum | urgency | relevance | rankScore | disposition |
|---------------|----|----------|---------|-----------|-----------|-------------|
| SkewAdam: … MoE … | null | 42 | 58 | 38 | **37** | watch |
| Looking for feedback … Snake AI | null | 42 | 58 | 27 | **35** | watch |
| Happy openreview refresh day | null | 42 | 68 | 0 | **31** | watch |

**Survival:** `3/3` inputs → `3/3` scored payload rows; all finite `rankScore`; none `ignore`.

**Implementer must re-run this simulation in Completion Notes** after the scoring/test changes (same subreddit or fixture Atom) and paste the table. A scoring rule not re-proven against real/fixture RSS data is a hypothesis.

### Test obligation (scoring)

Fixture-based regression in `tests/` (no live network):

1. Atom → `posts[]` mapping (title, url, externalId from `<id>`, publishedAt from `<updated>`, author; **no** upvotes key)
2. RSS-shaped reddit signal (no upvotes) **survives** `scoreDigestSignals` (length preserved, finite rankScore, momentum === trendProxy path, `normalizedEngagement` absent)
3. Explicit anti-regression: posting `upvotes: 0` is **not** the RSS contract (assert omit, or assert Path B only when upvotes undefined)

Update existing reddit round-trip tests that currently **require** non-null `normalizeEngagement` for every reddit row — they describe JSON-era engagement, not RSS.

### Secondary hygiene (in scope if touched)

- `extractRedditSignals` / notebook pick: when upvotes absent, sort by `publishedAt` desc (not all-zero upvotes)
- Discord / task-prompt Reddit bullets: show title + relative time / author; do **not** print `undefined upvotes`

---

## Dual-path RSS design

### Digest — `fetch-reddit-signals.mjs`

| Item | Spec |
|------|------|
| URL | `https://www.reddit.com/r/{sub}/top/.rss?t=day` |
| UA | Hardcoded descriptive const, e.g. `linux:cns-morning-digest:1.0 (by /u/cns_operator)` — no personal account required |
| Pace | ~**2000 ms** delay between subreddit fetches |
| Parse | Atom `<entry>`: title, `link@href` → url, `<id>` → stable id/externalId, `<updated>` → publishedAt, author `<name>` |
| Stdout success | `{ "posts": [ { title, url, publishedAt?, author?, externalId? } ] }` — **omit** upvotes/commentCount |
| Stdout failure | `{ "error": "…" }` (e.g. `http-429`, `http-403`, `missing-subreddits`, parse errors) |
| Exit | **0** on all fetch/parse failure paths |
| Config | Keep `MORNING_DIGEST_REDDIT_*` (enabled, subreddits, max posts, per subreddit) — **no new env required** |
| Deps | Prefer reuse existing `rss-parser` (already in repo for 65-4) **or** small Atom extract helpers; Context7 if extending parser usage |
| Wrapper | `hermes-run-reddit.sh` unchanged thin `exec node` |
| Tests | Fixture Atom XML; assert UA header; assert pacing hook injectable or delay=0 in tests |

### Trend — `trend-ingest.py` (off PRAW)

| Item | Spec |
|------|------|
| Remove | Runtime dependency on PRAW / `REDDIT_CLIENT_*` for the reddit source path |
| Feeds | Same subreddit list as digest: read `MORNING_DIGEST_REDDIT_SUBREDDITS` from `trend-ingest.env` (already present; **no new env**) |
| Fetch | `urllib` GET each `…/r/{sub}/top/.rss?t=day` once per run; descriptive UA header; **~2s** between subs |
| Match | For each watchlist keyword, count entries whose title (and optional summary text) case-insensitively contains the keyword → `mention_count` / existing norm-cache path |
| Metadata | Update `collectionMethod` to a new literal e.g. `reddit_rss_top_day_title_match` (document in tests) |
| Errors | Per-keyword / source isolation unchanged; missing subreddits → clear `lastError` (not credential message) |
| Docs | `trend-ingest.env.example`: mark `REDDIT_CLIENT_*` **deprecated / unused** for reddit; document RSS + shared subreddit env |
| Tests | Fixture Atom XML in `tests/test_trend_ingest.py`; no live Reddit; no praw required for reddit unit path |

**Why keyword×RSS (not r/all search):** without OAuth, Reddit search API is unavailable; title-match over curated subs is the lightest app-free proxy that still feeds the continuous layer.

---

## Documented upgrade path (DO NOT BUILD NOW)

If per-post engagement later matters for the judgment queue: enrich **top-N** RSS posts with real upvotes/comments via **Firecrawl stealth proxy** against the `.json` URL (Firecrawl is live in operator Cursor). Operator-deferred. Story may mention in Dev Notes only — **zero implementation** in 90-1.

---

## Design decisions — APPROVED 2026-07-23 (with scope correction)

| # | Decision | Proposed binding rule |
|---|----------|------------------------|
| 1 | Story key / epic | **`90-1` / epic 90** (confirmed) |
| 2 | Transport | App-free Atom RSS both layers; JSON/OAuth/PRAW out |
| 3 | Scoring | Omit upvotes on RSS → null NE → Path B (**scorer untouched**; do **not** split producthunt — shared arm already nulls missing upvotes; Firecrawl enrich must take Path A) |
| 4 | Env | Prefer **no new** vars; reuse `MORNING_DIGEST_REDDIT_SUBREDDITS`; hardcoded UA |
| 5 | Pace | ~2s between subreddit fetches; one fetch per sub per trend run |
| 6 | 67-2 | Endpoint change only; public unauthenticated spirit kept |
| 7 | Firecrawl enrich | Deferred upgrade only |
| 8 | Verify | `bash scripts/verify.sh` exit 0; fixture tests + live proof in Completion Notes |

---

## Acceptance Criteria

### 1. Digest RSS adapter (AC: digest)

**Given** `fetch-reddit-signals.mjs`  
**When** enabled with configured subreddits  
**Then** fetches `https://www.reddit.com/r/{sub}/top/.rss?t=day` with descriptive UA  
**And** paces ≥ ~2s between subreddits  
**And** maps Atom → `posts[]` with title, url, optional publishedAt/author/externalId; **no** upvotes/commentCount keys  
**And** stdout `{posts:[…]}` \| `{error:"…"}` and **exit 0** on failure  
**And** no OAuth, no `REDDIT_CLIENT_*`, no `.json` primary fetch

### 2. Scoring Path B for upvote-less reddit (AC: score)

**Given** RSS-shaped reddit digestSignals  
**When** `scoreDigestSignals` runs  
**Then** signals are **not** null-dropped; length preserved  
**And** `normalizeEngagement` is null when upvotes absent  
**And** momentum follows Path B (trendProxy), urgency uses publishedAt, rankScore finite  
**And** `producthunt` still requires upvotes via **shared** reddit/producthunt arm (no split — operator correction)  
**And** Completion Notes include a real RSS (or fixture-from-live) before/after survival table  
**And** fixture regression test locks survival (AC test)

### 3. Trend RSS collector replaces PRAW (AC: trend)

**Given** `python3 scripts/trend-ingest.py --source reddit`  
**When** `MORNING_DIGEST_REDDIT_SUBREDDITS` is set and network allows  
**Then** reddit source does **not** error on missing `REDDIT_CLIENT_*`  
**And** uses Atom RSS + keyword title-match; paces fetches  
**And** dry-run / live shows `signalSources.reddit` not credentials-missing  
**And** unit tests cover mapping/match with fixtures (praw optional/absent for reddit path)

### 4. Docs + contracts (AC: docs)

**Given** shipped strategy  
**When** docs update  
**Then** `task-prompt.md` Source 8 describes RSS (not JSON/OAuth); Discord line format without required upvotes  
**And** `config-snippet.md` / `trend-ingest.env.example` deprecate `REDDIT_CLIENT_*` for ingest; document RSS + subreddit env  
**And** note 67-2 endpoint change (`json`→`rss`), spirit preserved

### 5. Proofs + verify (AC: quality)

**Given** implementation complete  
**When** proofs run  
**Then** **Live digest:** subreddit → HTTP 200 → non-empty Atom → mapped non-empty `posts[]` (Completion Notes)  
**Then** **Live trend:** reddit source auth-error gone; prefer non-error `signalSources` patch (document rate-limit empties separately)  
**And** unit tests: Atom→posts + scoring survival regression; **no live API in unit tests**  
**And** paste actual passing test output in Completion Notes  
**And** `bash scripts/install-hermes-skill-morning-digest.sh` if skill files changed  
**And** `bash scripts/verify.sh` exits **0**

### 6. Anti-drift (AC: scope)

**Then** no TikTok/IG/Pinterest/Threads/LinkedIn changes  
**And** no Firecrawl enrich implementation  
**And** no OAuth revival  
**And** no fabricated upvotes  
**And** no WriteGate / vault secret writes  
**And** no cns-dashboard schema change required for RSS omit-upvotes (optional fields already)

---

## Tasks / Subtasks

- [x] **T0** Design gate — operator approves RSS + scoring proposal (this revision)
- [x] **T1** Digest: switch `fetch-reddit-signals.mjs` to Atom RSS + pacing + omit upvotes (AC: 1)
- [x] **T2** Scorer untouched; adapter/build regression locks omit-upvotes → Path B (AC: 2)
- [x] **T3** `extractRedditSignals` / task-prompt Discord line hygiene if needed (AC: 2, 4)
- [x] **T4** Trend: replace PRAW reddit path with RSS title-match collector (AC: 3)
- [x] **T5** Docs: env.example, config-snippet, task-prompt Source 8 (AC: 4)
- [x] **T6** Fixture tests (Atom map + scoring survival + trend match) (AC: 2, 5)
- [x] **T7** Hermes sync + `bash scripts/verify.sh` (AC: 5)
- [x] **T8** Live dual-path proof + Completion Notes tables (AC: 5)

### Review Findings

- [x] [Review][Decision→Patch] Trend keyword match: word-boundary via `re.search(r"\b" + re.escape(needle) + r"\b", haystack, re.IGNORECASE)` — operator chose option 2 (2026-07-23); multi-word phrases kept; no stemming/fuzzy
- [x] [Review][Patch] Wrap Atom `ET.ParseError` as `CollectorKeywordError` [`scripts/trend-ingest.py:parse_reddit_atom_entries`]
- [x] [Review][Patch] Guard `NaN` upvotes/commentCount with `Number.isFinite` [`build-digest-push-payload.mjs`]
- [x] [Review][Patch] Mixed engagement sort: missing upvotes use `-Infinity`, then publishedAt tie-break [`pick-signal-notebook.mjs:extractRedditSignals`]
- [x] [Review][Patch] Harden Atom `link` object/array via `atomLinkHref` [`fetch-reddit-signals.mjs:mapRedditAtomItem`]
- [x] [Review][Patch] Deduplicate subreddit names (case-insensitive) in `parse_reddit_subreddits` / `parseSubreddits`
- [x] [Review][Patch] AC: quality — paste actual passing test / `verify.sh` runner output into Completion Notes
- [x] [Review][Patch] Digest partial success: skip failed/429 subreddit; return collected posts; `ADAPTER_BUDGET_MS=45_000` loop bound (elevated from defer)
- [x] [Review][Patch] Trend partial success: `load_reddit_rss_corpus` skips failed subs; `REDDIT_RSS_BUDGET_SEC=45` (elevated from defer; mirrors digest)
- [x] [Review][Defer] HTTP 200 Atom with zero `<entry>` yields silent zero mention counts — deferred, empty-feed vs error semantics unresolved by AC
- [x] [Review][Defer] Cross-subreddit post double-count without id/url dedupe in trend corpus — deferred, current tests encode flat-corpus counting
- [x] [Review][Defer] Weak tests replace `_praw` gate with no-op `REDDIT_COLLECTION_METHOD` patch — deferred, coverage smell not a runtime defect
- [x] [Review][Defer] `externalId` Atom tag URI vs prior URL-hash identity; URL dedupe ignores `externalId` — deferred, continuity follow-up

---

## Dev Notes

### Files

| File | Change |
|------|--------|
| `scripts/hermes-skill-examples/morning-digest/scripts/fetch-reddit-signals.mjs` | JSON → RSS Atom |
| `scripts/hermes-skill-examples/morning-digest/scripts/score-digest-signals.mjs` | Split reddit / producthunt; Path B contract |
| `scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs` | Sort reddit by publishedAt when no upvotes |
| `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md` | Source 8 RSS |
| `scripts/hermes-skill-examples/morning-digest/references/config-snippet.md` | Deprecate REDDIT_CLIENT for digest/trend |
| `scripts/trend-ingest.py` | Off PRAW; RSS collector |
| `scripts/trend-ingest.env.example` | Deprecate REDDIT_CLIENT_*; RSS notes |
| `tests/morning-digest-reddit-adapter.test.mjs` | Atom fixtures + omit-upvotes |
| `tests/morning-digest-score-signals.test.mjs` and/or reddit adapter | Survival regression |
| `tests/test_trend_ingest.py` | RSS fixtures; no creds required |
| Social ScrapeCreators adapters | **DO NOT TOUCH** |

### Must preserve

- Exit 0 + `{posts}|{error}` digest contract (field optionality changes for engagement only)
- `mergeTrendIngestEnv` / `resolveOperatorHome`
- Trend norm-cache / cross-source isolation
- Hermes morning-digest install parity

### Previous story intelligence

| Story | Lesson |
|-------|--------|
| 65-2 / 67-2 | Public JSON was viable then / re-broken now at infra; keep public posture via RSS |
| 65-3 | OAuth dead without app registration |
| 65-4 | `rss-parser` + Path B null engagement pattern for newsletter `rss` sourceType |
| 44-3-2 | Trend reddit was PRAW mention_count — replace collection method, keep norm-cache shape |

### References

- [Source: live node fetch `…/top/.rss?t=day` → 200 Atom, 2026-07-22]
- [Source: `score-digest-signals.mjs` reddit/producthunt arm + Path B `scoreMomentum` / `computeRankScore`]
- [Source: `fetch-reddit-signals.mjs` current JSON + UA]
- [Source: `trend-ingest.py` `create_reddit_client` / `fetch_reddit_mention_count`]
- [Source: `_bmad-output/implementation-artifacts/67-2-reddit-public-json-adapter.md`]
- [Source: `_bmad-output/implementation-artifacts/65-4-rss-adapter.md`]
- [Source: `specs/cns-vault-contract/modules/security.md`]

---

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent router)

### Debug Log References

- Live node fetch `…/top/.rss?t=day` → HTTP 200 Atom (10 entries) after rate-limit cooldown; intermittent 429/403 under burst load documented.
- Operator correction verified: `normalizeEngagement` null → Path B already; `upvotes: 0` was the Path A trap — fixed adapter-side only.

### Completion Notes List

- 2026-07-22: Story redirected — OAuth and JSON+UA dropped; app-free RSS + scoring Path B proposal with live Atom→score survival table. **STOP for design-gate approval.**
- 2026-07-23: Design gate **APPROVED** with scope correction: **do not** edit `normalizeEngagement` / split producthunt; adapter must **omit** upvotes (not `: 0`); regression at adapter→build→score boundary; trend keyword match includes Atom `<content>`; Firecrawl enrich stays deferred (why scorer stays untouched).
- **Digest adapter:** `fetch-reddit-signals.mjs` → Atom RSS + ~2s pace + hardcoded UA; stdout posts omit upvotes/commentCount.
- **Trend:** `trend-ingest.py` off PRAW; `reddit_rss_top_day_title_content_match`; shared `MORNING_DIGEST_REDDIT_SUBREDDITS`.
- **verify.sh:** exit 0 after Hermes skill reinstall (code-review patches 2026-07-23).
- **Code-review patches (2026-07-23):** word-boundary keyword match; ParseError→CollectorKeywordError; NaN engagement guard; mixed upvote sort; Atom link href harden; subreddit dedupe; digest+trend partial success + 45s budget. Scorer untouched.

#### Pasted test / verify output (AC: quality) — 2026-07-23 code-review patch pass

```text
# Focused node (reddit adapter + pick-signal)
ℹ tests 98
ℹ pass 98
ℹ fail 0

# Focused python (IngestLogTests reddit RSS / word-boundary / partial / budget)
Ran 7 tests in 0.001s
OK

# Full gate (after bash scripts/install-hermes-skill-morning-digest.sh)
ℹ tests 1507
ℹ pass 1507
Ran 97 tests in 0.084s
OK
==> Hermes skill install gate
==> VERIFY PASSED
```

#### Live Atom→score survival (re-run 2026-07-23)

Live Atom from `r/MachineLearning` (node fetch HTTP 200, 10 `<entry>`), mapped without upvotes, scored via existing `scoreDigestSignals` (scorer untouched):

| title (trunc) | NE | momentum | urgency | relevance | rankScore | disposition |
|---------------|----|----------|---------|-----------|-----------|-------------|
| SkewAdam: … MoE … | null | 42 | 58 | 30 | **35** | watch |
| Happy openreview refresh day | null | 42 | 58 | 14 | **32** | watch |
| NeurIPS 2026 Reviews Are Out | null | 42 | 78 | 0 | **32** | watch |

**Survival:** 3/3 inputs → 3/3 scored rows; all `rankScore>0`; none `ignore`. Anti-regression: `upvotes:0` still Path A poison (tested).

#### Live dual-path proofs

- **Digest:** `runRedditFetch` live → `posts=3`, keys `[title,url,publishedAt,author,externalId]`, `upvotes` absent.
- **Trend:** `collect_reddit` live one-sub → `status:ok`, method `reddit_rss_top_day_title_content_match`, MoE/openreview mention counts >0; no `REDDIT_CLIENT_*` / praw errors.
- Rate-limit note: rapid successive Reddit hits can 429/403; ~2s pacing + Accept header mitigates; exit 0 error JSON preserved.

### File List

- `scripts/hermes-skill-examples/morning-digest/scripts/fetch-reddit-signals.mjs`
- `scripts/hermes-skill-examples/morning-digest/scripts/build-digest-push-payload.mjs`
- `scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs`
- `scripts/hermes-skill-examples/morning-digest/references/task-prompt.md`
- `scripts/hermes-skill-examples/morning-digest/references/config-snippet.md`
- `scripts/hermes-skill-examples/morning-digest/SKILL.md`
- `scripts/trend-ingest.py`
- `scripts/trend-ingest.env.example`
- `tests/morning-digest-reddit-adapter.test.mjs`
- `tests/morning-digest-pick-signal-notebook.test.mjs`
- `tests/hermes-morning-digest-skill.test.mjs`
- `tests/test_trend_ingest.py`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/90-1-restore-reddit-intake.md`

## Change Log

- 2026-07-23: Restore Reddit via Atom RSS on digest + trend; omit upvotes (Path B); scorer untouched; verify.sh green.
- 2026-07-23: Code review patches — word-boundary match; partial-success+45s budget both layers; ParseError/NaN/link/dedupe/sort; verify.sh green (1507 node / 97 python).


## Open questions for operator (this redesign) — RESOLVED 2026-07-23

1. Scoring proposal — **APPROVED with correction:** omit upvotes → null NE → Path B; **do not** split producthunt; never fabricate upvotes; scorer untouched.
2. Trend keyword×RSS — **YES**, and match Atom `<content>` (not title-only).
3. UA hardcoded `linux:cns-morning-digest:1.0 (by /u/cns_operator)` — **YES**.
4. Firecrawl enrich deferred — **YES** (exactly why scorer stays untouched).
