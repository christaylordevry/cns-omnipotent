---
story_id: 44-3-1
epic: 44
planning_epic: "Epic 44 / Epic 3 Story 3.1"
title: google-trends-collector-pytrends
status: done
output_repo: Omnipotent.md
cns_repo_touch: scripts/trend-ingest.py
---

# Story 44-3-1: Google Trends collector (pytrends)

Status: done

**Planning map:** Epic 44 Story 3.1 — `44-3-1-google-trends-collector-pytrends`.

## Story

As a **CNS operator**,
I want **hourly Google Trends signals for each watchlist keyword**,
So that **search-volume momentum appears in the trend panel**.

## Context

| Topic | Detail |
|-------|--------|
| **Output repo** | `Omnipotent.md` (`scripts/trend-ingest.py` + tests) |
| **Depends on** | 44-2-1 (batch/watchlist), 44-2-2 (HTTP push + secret guard), 44-1-2 (`ingestSignalBatch`) |
| **Normative** | `architecture-epic-44-trend-intelligence-layer-1.md` § Wire Contract, dedupeKey, Normalisation, pytrends Partial-Run |
| **Reference** | Existing `topic_slug`, `build_batch`, `push_signal_batch`, `parse_sources_arg` in `scripts/trend-ingest.py` |
| **Out of scope** | Reddit/News collectors (44-3-2), CLI `--source` flag polish (44-3-3), cron docs (44-4-1), `dashboard-sync.ts` |

## Acceptance Criteria

1. **Collect (AC: collect)** — When `google_trends` is in `activeSources` (via `--sources google_trends` or sole source), run pytrends per watchlist keyword and append `SignalEventInput`-shaped dicts to `batch.events` with `source: google_trends`, `signalType: search_volume`, `normalizedValue: interest/100`, `metadata.normalisationMethod: trends_interest_over_100`, `windowHours`, `collectedAt`, `ingestRunId`, `dedupeKey` per architecture § dedupeKey (UTC hour floor).
2. **Per-keyword isolation (AC: isolate)** — One keyword failure does not abort other keywords in the same run (FR15).
3. **Rate limit abort (AC: ratelimit)** — On HTTP 429 or 403 from trends API for keyword N: stop remaining trends keywords for this run; set `signalSources` patch for `google_trends` to `partial` or `error` with `lastError` (no substring secrets); prior keywords' events remain in batch (FR17, NFR-R6).
4. **Captcha/empty (AC: empty)** — Captcha or empty/invalid pytrends response: emit **no** event for that keyword; never use `normalizedValue: 0` as failure substitute (FR18).
5. **Source patch (AC: patch)** — After collect loop, include `signalSources` entry for `google_trends` (`ok` | `partial` | `error`, `lastRun`, `errorCount`, `lastError`) when trends was in `activeSources`.
6. **Push integration (AC: push)** — Non-dry-run: existing secret scan + HTTP push unchanged; exit 0 when push succeeds with ≥1 event **or** valid `signalSources` health update per architecture pytrends semantics.
7. **Tests (AC: test)** — Extend `tests/test_trend_ingest.py` with mocked pytrends: success event shape, per-keyword continue-on-error, 429 aborts remainder, empty/captcha no event, dedupeKey stability, `signalSources` patch states.
8. **Boundary (AC: boundary)** — `bash scripts/verify.sh` passes; only `scripts/trend-ingest.py` + tests in production diff scope; document optional `pip install pytrends` in story/dev notes (no `package.json` / `verify.sh` edits for trend logic).

## Tasks / Subtasks

- [x] Add `collect_google_trends` module section (injectable pytrends client for tests)
- [x] Implement `dedupe_key_for_event` helper (sha256, UTC hour floor) shared for trends events
- [x] Wire `run()` to populate `events` + `signalSources` when `google_trends` ∈ `activeSources`
- [x] Handle 429/403 stop-loop and captcha/empty semantics
- [x] Extend unit tests (mock pytrends); run `python3 -m unittest tests.test_trend_ingest`
- [x] Run `bash scripts/verify.sh`; set sprint-status `review`

## Dev Notes

### Event shape (wire JSON)

```json
{
  "topicSlug": "ai-agents",
  "keyword": "AI agents",
  "source": "google_trends",
  "signalType": "search_volume",
  "value": 72,
  "normalizedValue": 0.72,
  "region": "global",
  "windowHours": 168,
  "collectedAt": 1746000000000,
  "dedupeKey": "<64-char hex>",
  "ingestRunId": "<uuid>",
  "metadata": { "normalisationMethod": "trends_interest_over_100" }
}
```

### dedupeKey (normative)

```
windowStartMs = collectedAt - (windowHours * 3_600_000)
windowStartHour = floor_to_utc_hour(windowStartMs)
dedupeKey = sha256_hex(f"{topicSlug}|{source}|{signalType}|{windowStartHour}")
```

### pytrends dependency

- Use optional import: if `pytrends` missing, FATAL with install hint when `google_trends` requested.
- Package is mature (>14 days); operator installs via `pip install pytrends` on WSL — not added to npm gate.

### Prior art (44-2-2)

- Push path, secret scan, env file parsing — **do not regress**.
- Default `--sources` empty → no collectors run (watchlist-only push) until operator passes `--sources google_trends`.

### Testing strategy

- Mock `TrendReq` or inject `collect_google_trends(..., fetch_interest=callable)` so CI needs no live Google API.
- No live network in unittest.

## Dev Agent Record

### Completion Notes List

- Added `collect_google_trends`, `dedupe_key_for_event`, `build_google_trends_event`, optional `pytrends` import.
- Wired `run()` when `--sources google_trends`; dry-run includes collected events + `signalSources` patch.
- Partial-run semantics: per-keyword continue; 429/403 aborts remainder; empty/captcha → no event (no zero substitute).
- `tests/test_trend_ingest.py`: 47 tests after code-review patches (Google Trends + CLI push/health paths).
- `bash scripts/verify.sh` OK. Operator: `pip install pytrends` on WSL before live trends collect.

### File List

- `scripts/trend-ingest.py`
- `tests/test_trend_ingest.py`
- `_bmad-output/implementation-artifacts/44-3-1-google-trends-collector-pytrends.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-05-26: Story 44-3-1 created (ready-for-dev) after 44-2-2 done.
- 2026-05-26: Google Trends collector (pytrends) + unittest coverage; status → review.
- 2026-05-26: Code review batch-fix — shared TrendReq, geo uppercase, rate-limit heuristic, +8 tests; status → done.

### Review Findings

- [x] [Review][Patch] Reuse one `TrendReq` client per collect run [`scripts/trend-ingest.py:433`]
- [x] [Review][Patch] Uppercase non-global `geo` for pytrends [`scripts/trend-ingest.py:432`]
- [x] [Review][Patch] Narrow rate-limit substring heuristic [`scripts/trend-ingest.py:418-424`]
- [x] [Review][Patch] Missing CLI test: pytrends absent + `--sources google_trends` → FATAL exit 1 [`tests/test_trend_ingest.py`]
- [x] [Review][Patch] Missing CLI test: push exit 0 with google_trends `signalSources` only (zero events) [`tests/test_trend_ingest.py`]
- [x] [Review][Patch] No mocked `fetch_google_trends_interest` / `TrendReq` tests [`tests/test_trend_ingest.py`]

- [x] [Review][Defer] Python unittest not in `verify.sh` [`scripts/verify.sh`] — deferred, pre-existing from 44-2-1/44-2-2; AC boundary still requires manual `python3 -m unittest tests.test_trend_ingest`.
