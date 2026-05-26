---
story_id: 44-4-2
epic: 44
planning_epic: "Epic 44 / Epic 4 Story 4.2"
title: seven-day-pipeline-reliability-verification
status: review
output_repo: Omnipotent.md
cns_repo_touch: scripts/audit-trend-ingest-reliability.py, scripts/verify.sh, tests/test_trend_ingest_reliability.py
---

# Story 44-4-2: Seven-day pipeline reliability verification

Status: review

**Planning map:** Epic 44 Story 4.2 — `44-4-2-seven-day-pipeline-reliability-verification`.

## Story

As a **CNS operator**,
I want **confidence that scheduled ingest meets freshness targets**,
So that **I trust the trend panel for daily prioritisation**.

## Context

| Topic | Detail |
|-------|--------|
| **Output repo** | `Omnipotent.md` (audit CLI + verify gate + operator guide) |
| **Depends on** | 44-4-1 (cron install, structured `trend-ingest.log`) |
| **Normative** | `epics-epic-44-trend-intelligence-layer-1.md` Story 4.2; NFR-R1, NFR-R2, NFR-R5; Journey 4 |
| **Reference** | `scripts/trend-ingest.py` (`build_ingest_log_record`, outcomes), §16.5 operator guide |
| **Out of scope** | Epic 5 panel wiring; automated 7-day CI soak |

## Acceptance Criteria

1. **Reliability audit (AC: audit)** — `scripts/audit-trend-ingest-reliability.py` reads structured JSON lines from `TREND_INGEST_LOG` (default `~/.hermes/logs/trend-ingest.log`), accepts `--days` (default 7), reports per source (`news`, `reddit`, `google_trends`): expected cron slots (15m / 15m / 60m), actual runs, success count, success rate. Success = `outcome` `ok` with `httpStatus` null or 200; `watchlist_only` counts as success. Exit non-zero when any source &lt; 95% (NFR-R1).

2. **Failure visibility (AC: nfr-r2)** — Operator guide documents that cron keeps firing on failure; audit lists recent `outcome: error` lines with `jq`; no “disable cron on error” guidance.

3. **Freshness check (AC: nfr-r5)** — Operator guide documents manual Convex/dashboard check: `trendTopics.lastUpdated` within 30 min (news/reddit) or 2 h (google_trends) when source healthy; audit script prints freshness reminder thresholds.

4. **Partial degradation (AC: journey-4)** — Operator guide §16.5 adds “Reliability verification” subsection: per-source independence (FR16), 7-day audit command, interpreting missed slots vs errors.

5. **Verify gate (AC: verify)** — `bash scripts/verify.sh` runs `python3 -m unittest` for trend ingest + reliability tests; all pass.

6. **Operator 7-day window (AC: operator-manual)** — After cron enabled ≥7 days, operator runs audit script and records pass/fail in Dev Agent Record. **Story stays `review` until operator confirms pass.**

## Tasks / Subtasks

- [x] Add `scripts/audit-trend-ingest-reliability.py` (parse log, per-source stats, `--fail-under 0.95`)
- [x] Add `tests/test_trend_ingest_reliability.py` with fixture log lines
- [x] Wire `python3 -m unittest` for trend tests in `scripts/verify.sh` (NFR-R4 / 44-4-1 deferral)
- [x] Extend `CNS-Operator-Guide.md` §16.5 — reliability verification + partial degradation
- [x] Run unittest + `bash scripts/verify.sh`
- [ ] Operator: 7-day cron soak + audit pass — record result below, then move story to `done`

### Review Findings

- [x] [Review][Patch] Reject non-positive `--days` — `expected_runs_for_window` returns 0 and all sources report 100% success_rate, so `run()` exits 0 with no data [`scripts/audit-trend-ingest-reliability.py:124-127`, `:190-195`] — fixed 2026-05-26
- [x] [Review][Patch] Coerce string `httpStatus` in `is_successful_run` — JSON or hand-edited logs with `"200"` fail the ok path [`scripts/audit-trend-ingest-reliability.py:116-121`] — fixed 2026-05-26
- [x] [Review][Defer] Log lines with `activeSources` length ≠ 1 are dropped from per-source stats — safe for cron (single source per run); manual multi-source runs are mis-counted [`scripts/audit-trend-ingest-reliability.py:102-107`] — deferred, cron-only path is normative
- [x] [Review][Defer] Full log file read into memory on each audit — acceptable for 7-day JSONL at expected volume [`scripts/audit-trend-ingest-reliability.py:64-77`] — deferred, operator-scale only

## Dev Notes

### Expected cron slots (7 days)

| Source | Interval | Expected runs / 7d |
|--------|----------|-------------------|
| news | 15 min | 672 |
| reddit | 15 min | 672 |
| google_trends | 60 min | 168 |

### Audit command (operator)

```bash
python3 scripts/audit-trend-ingest-reliability.py --days 7
```

## Dev Agent Record

### Agent Model Used

Composer (dev-story)

### Completion Notes List

- Added `audit-trend-ingest-reliability.py` — per-source success rate vs expected slots, `--json`, `--fail-under`.
- Operator guide §16.5 reliability block + v1.34.1 version row.
- `verify.sh` runs `tests.test_trend_ingest` + `tests.test_trend_ingest_reliability`.
- **Operator gate:** run audit after ≥7 days live cron; story not `done` until recorded.
- **Code review (2026-05-26):** Patched `--days <= 0` guard (exit 2) and string `httpStatus` coercion in `is_successful_run`.

### File List

- `scripts/audit-trend-ingest-reliability.py`
- `tests/test_trend_ingest_reliability.py`
- `scripts/verify.sh`
- `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`
- `_bmad-output/implementation-artifacts/44-4-2-seven-day-pipeline-reliability-verification.md` (this file)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-05-26: Story 44-4-2 created (ready-for-dev).
- 2026-05-26: Audit tooling, verify gate, operator guide — dev complete (review; operator 7-day pending).

### References

- [Source: `_bmad-output/planning-artifacts/epics-epic-44-trend-intelligence-layer-1.md` — Story 4.2]
- [Source: `_bmad-output/implementation-artifacts/44-4-1-cron-install-documentation-env-example.md`]
