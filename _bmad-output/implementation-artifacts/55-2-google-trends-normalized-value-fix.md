---
story_id: 55-2
epic: 55
title: google-trends-normalized-value-fix
status: done
baseline_commit: 38218d3
---

# Story 55.2: Google Trends zero normalizedValue investigation and fix

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a **CNS operator reading the morning digest Trending Now section**,  
I want **google_trends ingest to return meaningful non-zero normalizedValue scores for watchlist keywords**,  
so that **the digest ranks topics correctly and `pick-signal-notebook.mjs` can route Deep Signal to NotebookLM when scores exceed threshold**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 55: Hermes morning-digest reliability (operator brief 2026-06-02) |
| **Predecessor** | **55-1** (trigger reliability — digest now runs); **49-6** (digest reads trends via dry-run); **44-3-1** (pytrends collector) |
| **Problem** | Morning digest **Trending Now** shows all topics at **0 normalizedValue** / **0 value**. Digest completes but trend scores are meaningless; `pick-signal-notebook.mjs` (`SCORE_THRESHOLD = 0.75`) never routes. |
| **Pre-investigation (create-story)** | Live dry-run on 2026-06-02 reproduces bug: all 5 watchlist events emit `"value": 0, "normalizedValue": 0.0`. |
| **Likely root cause (confirmed)** | `fetch_google_trends_interest()` uses **`series.iloc[-1]`** on non-partial hourly data — the **last complete UTC hour** is 0 for every watchlist keyword at investigation time, while **max/mean over the 7-day window are non-zero** (see Dev Notes). |
| **Not the cause** | pytrends missing (ingest runs); keyword obscurity alone (SvelteKit max=100 in window); normalization formula (`interest/100` is correct when interest input is wrong). |
| **In scope** | `scripts/trend-ingest.py` (`fetch_google_trends_interest`, `build_google_trends_event`, metadata), `scripts/run-trend-ingest-cron.sh` (only if wrapper change needed), `tests/test_trend_ingest*.py` |
| **Out of scope** | Changing watchlist keywords, Convex schema, dashboard components, morning-digest skill content, `pick-signal-notebook.mjs` threshold |

### Operator brief (binding)

1. Run trend ingest manually for `google_trends` and inspect raw output.
2. Check `fetch_google_trends_interest` — is `normalizedValue` computed correctly from pytrends `interest_over_time`?
3. Distinguish **obscure keywords (no volume)** vs **code bug (normalizing to 0)**.
4. Fix root cause; document in completion notes.

## Acceptance Criteria

### 1. Root cause documented (AC: audit)

**Given** manual investigation of live pytrends output vs ingest output  
**When** the dev agent completes the story  
**Then** Dev Agent Record → Completion Notes states the confirmed root cause with evidence (raw series tail, aggregation choice, before/after dry-run snippet)  
**And** the fix directly addresses that cause.

### 2. Non-zero ingest for watchlist (AC: ingest)

**Given** operator watchlist at `~/.hermes/trend-watchlist.yaml` (5 keywords as of 2026-06-02)  
**When** dev runs:

```bash
python3 scripts/trend-ingest.py --dry-run --sources google_trends
```

**Then** **at least one** event in `events[]` has `normalizedValue > 0` and `value > 0`  
**And** scores differentiate keywords (not all identical unless Google data truly flat).

### 3. Honest zero semantics preserved (AC: fr18)

**Given** architecture FR18 / Epic 44 captcha-empty rules  
**When** pytrends returns empty/captcha/invalid for a keyword  
**Then** **no event** is emitted for that keyword (existing behaviour)  
**And** the fix does **not** substitute `0` on API failure.

**When** Google legitimately returns all-zero interest for a keyword across the entire non-partial window  
**Then** emitting `normalizedValue: 0` is acceptable — but completion notes must cite evidence that watchlist keywords are not in that state today.

### 4. Aggregation metadata (AC: metadata)

**Then** `metadata` on google_trends events documents how `value` was derived from the hourly series (extend `normalisationMethod` or add `metadata.interestAggregation` — e.g. `latest_non_partial_hour`, `max_non_partial_window`, `mean_last_24h`)  
**And** choice aligns with morning-digest “Trending Now” intent (rankable scores, not trailing-hour noise).

### 5. Tests and verify gate (AC: test)

**Then** `tests/test_trend_ingest.py` includes regression case: **trailing-zero series** where `iloc[-1]` would be 0 but window has non-zero history → ingest must return non-zero (or document chosen aggregation in test name)  
**And** existing Google Trends tests updated for new aggregation (mock series with `isPartial` column)  
**And** `python3 -m unittest tests.test_trend_ingest tests.test_trend_ingest_reliability` passes  
**And** `bash scripts/verify.sh` passes.

### 6. Scope guards (AC: scope)

**Then** this story does **not** change watchlist YAML, Convex schema, dashboard UI, or `SCORE_THRESHOLD` in `pick-signal-notebook.mjs`.

## Tasks / Subtasks

- [x] **T1** Reproduce — run dry-run + live pytrends probe per keyword; capture tail of `interest_over_time` frame and compare to ingest output (AC: 1, 2)
- [x] **T2** Fix aggregation in `fetch_google_trends_interest` — replace naive `iloc[-1]` with documented strategy (see Dev Notes candidates) (AC: 2, 4)
- [x] **T3** Update `build_google_trends_event` metadata if aggregation field added (AC: 4)
- [x] **T4** Add/adjust unit tests — trailing-zero regression + update `test_fetch_google_trends_interest_returns_latest_interest` (AC: 5)
- [x] **T5** Run `bash scripts/verify.sh`; record before/after dry-run in Completion Notes (AC: 2, 5)
- [x] **T6** Document root cause and aggregation rationale in Dev Agent Record (AC: 1)

### Review Findings

- [x] [Review][Patch] Stage story artifact with implementation commit [`_bmad-output/implementation-artifacts/55-2-google-trends-normalized-value-fix.md`]
- [x] [Review][Defer] Sub-0.5 mean rounds to zero indistinguishable from true all-zero window [`scripts/trend-ingest.py:701`] — deferred, pre-existing rounding semantics; watchlist keywords not affected today
- [x] [Review][Defer] Fetch tests omit `isPartial` row filtering — mocks lack `.index`/`.loc` so partial-hour exclusion untested [`tests/test_trend_ingest.py:709`] — deferred, production path unchanged; AC5 satisfied
- [x] [Review][Defer] Missing `isPartial` column includes incomplete hour in mean [`scripts/trend-ingest.py:734-738`] — deferred, pre-existing pytrends frame shape dependency
- [x] [Review][Defer] NaN/non-numeric series values raise unhandled exceptions in aggregation [`scripts/trend-ingest.py:700-701`] — deferred, pre-existing corrupt-frame gap (same class as prior `iloc[-1]` path)

## Dev Notes

### Confirmed failure mode (create-story live evidence)

**Dry-run output (2026-06-02):** all 5 events `"value": 0, "normalizedValue": 0.0`.

**Per-keyword pytrends probe (same session, `timeframe="now 7-d"`, `geo=""`):**

| Keyword | `last_non_partial` (current code) | max | mean |
|---------|-------------------------------------|-----|------|
| AI agent orchestration | **0** | 100 | 19.4 |
| local LLM routing | **0** | 100 | 0.6 |
| SvelteKit | **0** | 100 | 22.4 |
| programmatic SEO | **0** | 100 | 3.0 |
| Obsidian plugins | **0** | 100 | 13.5 |

**Conclusion:** Keywords have real relative interest in the 7-day window. Bug is **value selection**, not API failure or obscurity.

### Bug location

```724:733:scripts/trend-ingest.py
    series = frame[entry.keyword].dropna()
    if partial is not None and hasattr(partial, "loc") and hasattr(series, "index"):
        series = series[partial.loc[series.index] == False]  # noqa: E712
    if series.empty:
        raise TrendsEmptyResponseError("no interest values")

    interest = int(series.iloc[-1])
    if interest < 0 or interest > 100:
        raise TrendsEmptyResponseError("interest out of range")
    return interest
```

**Why `iloc[-1]` fails:** For niche terms at low-traffic UTC hours, the **most recent complete hour** is often 0 even when the same day had peaks (e.g. SvelteKit: 22:00→100, 23:00→0). Morning digest runs in AEDT morning ≈ late UTC evening — systematically hits trailing zeros.

**Normalization is correct:** `build_google_trends_event` sets `normalized = interest / 100.0` — when `interest=0`, output is honestly zero.

### Fix candidates (pick one; document rationale)

| Strategy | Pros | Cons |
|----------|------|------|
| **Max of non-partial window** | Always reflects peak relative interest in 7d; all watchlist keywords → 100 today | Many keywords tie at 1.0 — weak rank differentiation |
| **Mean of non-partial window** | Differentiates keywords (0.006–0.224 today); stable | “Trending Now” is average-week not latest hour |
| **Mean/max of last 24h non-partial** | Closer to “recent” semantics | Slightly more code |
| **Latest non-zero non-partial** | Avoids trailing zero | Arbitrary if series ends with zeros for days |

**Recommendation:** Prefer **mean of non-partial values in the window** (or **max over last 24h**) for digest ranking — verify against operator intent in completion notes. **Do not** keep `iloc[-1]` without strong justification.

If aggregation changes, update test `test_fetch_google_trends_interest_returns_latest_interest` (currently expects last element `72` from `[40, 72]`).

### Story 49-2 context

No story file `49-2-*.md` in repo. **49-6** references “49-2 fixed ingest: dry-run returns 5 events” — that fix was likely the **`now 7-d` timeframe** (events emit) not trailing-hour selection. **55-2** closes the remaining gap: events exist but scores are all zero.

### Downstream impact

**Morning digest** (`scripts/hermes-skill-examples/morning-digest/`):

- Calls `bash scripts/session-close/hermes-run-trend-ingest.sh` → `trend-ingest.py --dry-run --sources google_trends`
- Sorts `events[]` by `normalizedValue` desc, top 5
- **No skill changes required** if ingest returns meaningful scores

**pick-signal-notebook.mjs:**

- `SCORE_THRESHOLD = 0.75` on **notebook scorer**, not raw trend score
- Trend keywords feed `SIGNALS_JSON`; zero trend display does not block digest but **empty/zero signals reduce routing quality**
- Out of scope to change threshold

### Architecture compliance

| Rule | Source | Action |
|------|--------|--------|
| `normalizedValue = interest / 100` | `architecture-epic-44` § Normalisation | Keep — fix `interest` input |
| FR18: no zero on failure | Epic 44 | Keep skip-on-empty; zero only if window truly all-zero |
| `trends_interest_over_100` | metadata | Keep or extend with aggregation subfield |
| `windowHours: 168` | `GOOGLE_TRENDS_WINDOW_HOURS` | Unchanged |
| Partial rows | `isPartial` filter | Keep filtering partial; apply aggregation on remaining series |

### Files in scope

| File | Action |
|------|--------|
| `scripts/trend-ingest.py` | UPDATE — `fetch_google_trends_interest`, possibly helper `_aggregate_trends_interest(series)` |
| `tests/test_trend_ingest.py` | UPDATE — aggregation tests, trailing-zero regression |
| `tests/test_trend_ingest_reliability.py` | UPDATE only if behaviour change breaks reliability expectations |
| `scripts/run-trend-ingest-cron.sh` | READ — unlikely change (passes through to trend-ingest.py) |
| `scripts/session-close/hermes-run-trend-ingest.sh` | READ — digest wrapper; no change expected |

### Previous story intelligence (55-1)

- Fixed morning-digest **trigger** and `skill_view` path; digest now runs full contract.
- Trending Now content was blocked by **trigger**, not scores — now scores are the visible gap.
- [Source: `_bmad-output/implementation-artifacts/55-1-morning-digest-trigger-reliability.md`]

### Previous story intelligence (44-3-1)

- Established pytrends collector, `TrendsEmptyResponseError`, rate-limit abort, per-keyword isolation.
- Test `test_fetch_google_trends_interest_returns_latest_interest` encodes **last-value** semantics — must update with fix.
- [Source: `_bmad-output/implementation-artifacts/44-3-1-google-trends-collector-pytrends.md`]

### Git intelligence

| Commit | Relevance |
|--------|-----------|
| `38218d3` | 55-1 baseline |
| `47e0b9d` | 44-3-1 pytrends collector introduced `fetch_google_trends_interest` |
| `3dc67e9` | 49-4 investigate-trend (adjacent Hermes trend surface) |

### Latest tech (pytrends — Context7 `/generalmills/pytrends`)

- `interest_over_time()` returns DataFrame with keyword columns + `isPartial` boolean.
- `timeframe="now 7-d"` is valid (1 or 7 days only for `now #-d` form).
- Values are **relative** 0–100 within the requested window (100 = peak for that keyword in window).
- No library helper for “current interest” — aggregation is caller responsibility.
- Optional import pattern already used; `pip install pytrends` on WSL.

### Testing requirements

```bash
# Reproduce (before fix)
python3 scripts/trend-ingest.py --dry-run --sources google_trends | jq '.events[] | {keyword, value, normalizedValue}'

python3 -m unittest tests.test_trend_ingest tests.test_trend_ingest_reliability
bash scripts/verify.sh
```

**Mock pattern:** Fake DataFrame with `isPartial` + keyword column; series ending in `[100, 0]` or `[100, 50, 0]` to prove trailing-zero regression.

### Anti-patterns

- Do **not** change watchlist keywords to popular terms (out of scope; masks bug).
- Do **not** emit fake non-zero on empty/captcha (FR18 regression).
- Do **not** change Convex ingest schema or dashboard panels.
- Do **not** modify `pick-signal-notebook.mjs` threshold without operator request.
- Do **not** add npm dependencies — Python-only change.

### Project context reference

- [Source: `project-context.md` — verify gate, Hermes paths]
- [Source: `specs/cns-vault-contract/CNS-Phase-1-Spec.md` — read-only; no vault writes]
- [Source: `_bmad-output/planning-artifacts/architecture-epic-44-trend-intelligence-layer-1.md` § Normalisation, pytrends Partial-Run]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor)

### Debug Log References

- Reproduced bug: dry-run before fix returned all 5 keywords at `value: 0, normalizedValue: 0.0`
- Root cause confirmed: `series.iloc[-1]` on non-partial hourly data picks trailing UTC hour (often 0 at AEDT morning digest time) despite non-zero window history

### Completion Notes List

**Root cause:** `fetch_google_trends_interest` used `series.iloc[-1]` after filtering partial rows. At investigation time (2026-06-02), the last complete UTC hour was 0 for every watchlist keyword while max/mean over the 7-day window were non-zero (e.g. SvelteKit: last=0, max=100, mean≈22.4). Normalization (`interest/100`) was correct; the bug was value selection, not API failure or keyword obscurity.

**Fix:** Added `_aggregate_trends_interest()` using **mean of non-partial window values** (`TRENDS_INTEREST_AGGREGATION = "mean_non_partial_window"`). Rationale: differentiates keywords for morning-digest ranking (avoids many ties at 1.0 from max strategy) and avoids trailing-hour noise. Metadata extended on google_trends events with `interestAggregation`.

**Before fix (dry-run):**
```json
[{"keyword":"AI agent orchestration","value":0,"normalizedValue":0.0},
 {"keyword":"local LLM routing","value":0,"normalizedValue":0.0},
 {"keyword":"SvelteKit","value":0,"normalizedValue":0.0},
 {"keyword":"programmatic SEO","value":0,"normalizedValue":0.0},
 {"keyword":"Obsidian plugins","value":0,"normalizedValue":0.0}]
```

**After fix (dry-run):**
```json
[{"keyword":"AI agent orchestration","value":17,"normalizedValue":0.17},
 {"keyword":"local LLM routing","value":1,"normalizedValue":0.01},
 {"keyword":"SvelteKit","value":23,"normalizedValue":0.23},
 {"keyword":"programmatic SEO","value":4,"normalizedValue":0.04},
 {"keyword":"Obsidian plugins","value":14,"normalizedValue":0.14}]
```

All scores differentiate keywords; all non-zero. FR18 preserved: empty/captcha still emits no event; all-zero window would still emit 0 honestly.

**Tests:** Added `test_aggregate_trends_interest_*`, `test_fetch_google_trends_interest_trailing_zero_series`; replaced last-value test with mean aggregation test. `python3 -m unittest tests.test_trend_ingest tests.test_trend_ingest_reliability` and `bash scripts/verify.sh` pass.

### File List

- `scripts/trend-ingest.py` — `_aggregate_trends_interest`, aggregation constant, metadata field
- `tests/test_trend_ingest.py` — regression and updated aggregation tests
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — status in-progress → review
- `_bmad-output/implementation-artifacts/55-2-google-trends-normalized-value-fix.md` — story record

## Change Log

- 2026-06-02: Story 55-2 created (ready-for-dev) — pre-investigation confirms trailing-hour `iloc[-1]` root cause.
- 2026-06-02: Implemented mean_non_partial_window aggregation; dry-run scores non-zero; verify.sh pass.

## References

- [Source: operator brief Epic 55 Story 55-2]
- [Source: `_bmad-output/implementation-artifacts/55-1-morning-digest-trigger-reliability.md`]
- [Source: `_bmad-output/implementation-artifacts/49-6-morning-digest-upgrade.md` § Source 1]
- [Source: `_bmad-output/implementation-artifacts/44-3-1-google-trends-collector-pytrends.md`]
- [Source: `scripts/trend-ingest.py` — `fetch_google_trends_interest`, `build_google_trends_event`]
- [Source: `scripts/session-close/hermes-run-trend-ingest.sh`]
- [Source: `scripts/hermes-skill-examples/morning-digest/scripts/pick-signal-notebook.mjs`]
- [Source: Context7 `/generalmills/pytrends` — interest_over_time, timeframe, isPartial]
