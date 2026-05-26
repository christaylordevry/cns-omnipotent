---
story_id: 45-7
epic: 45
title: reliability-soak-query-polish
status: review
output_repo: cns-dashboard
---

# Story 45-7: Reliability soak and query polish

Status: review

## Acceptance Criteria

- `python3 scripts/audit-trend-ingest-reliability.py --days 7 --fail-under 0.90` passes (≥90% signal delivery)
- `python3 scripts/audit-trend-analytics-soak.py --days 7` passes (scores fresh ≤75 min; `computedAt` gaps ≤90 min)
- `getLatestScores` sorted by `investmentScore` desc (stable `topicSlug` tie-break)
- `getTopicSignalHistory` display `value` on 0–100 scale (clamped)
- Hourly `runAnalyticsPass` appends JSONL to `~/.hermes/logs/trend-analytics.log`
- Sprint tracking: `45-7-soak` in `review` for operator 7-day gate

## Tasks / Subtasks

- [x] Analytics soak log + `audit-trend-analytics-soak.py` + unit tests
- [x] Query polish (`getLatestScores` sort, `normalizeSignalDisplayValue`, shared soak helpers)
- [x] Convex tests for sort order and signal history clamping
- [x] Wire soak audit into `scripts/verify.sh`
- [ ] Operator: 7-day production soak — run audits above, then move `45-7-soak` → `done`

## Dev Agent Record

### Implementation Plan

- `convex/lib/analyticsSoak.ts` — freshness (75 min) and gap (90 min) pure functions.
- `convex/lib/analyticsSoakLog.ts` — append pass JSONL (`TREND_ANALYTICS_LOG` override).
- `runAnalyticsPass` logs per-topic `scored` / `computedAt`; forecast `computedAt` aligned with score row.
- `scripts/audit-trend-analytics-soak.py` + `tests/test_trend_analytics_soak.py` in Omnipotent.md repo.
- Query: `getLatestScores` investmentScore desc + topicSlug tie-break; signal history uses shared normalizer.

### Completion Notes

- ✅ 133 cns-dashboard Vitest tests pass (includes `analytics-soak.test.ts`, expanded `trend-intelligence.test.ts`).
- ✅ Python soak audit tests pass via `verify.sh`.
- ⏳ Operator 7-day soak on deployed Convex cron still required before `45-7-soak` → `done`.

### Operator soak commands

```bash
# After ≥7 days of hourly analytics cron in production:
python3 scripts/audit-trend-ingest-reliability.py --days 7 --fail-under 0.90
python3 scripts/audit-trend-analytics-soak.py --days 7
```

### File List

- `cns-dashboard/convex/lib/analyticsSoak.ts`
- `cns-dashboard/convex/lib/analyticsSoakLog.ts`
- `cns-dashboard/convex/trendAnalytics.ts`
- `cns-dashboard/convex/trendIntelligence.ts`
- `cns-dashboard/tests/lib/analytics-soak.test.ts`
- `cns-dashboard/tests/convex/trend-intelligence.test.ts`
- `Omnipotent.md/scripts/audit-trend-analytics-soak.py`
- `Omnipotent.md/tests/test_trend_analytics_soak.py`
- `Omnipotent.md/scripts/verify.sh`

### Review Findings

- [x] [Review][Patch] Document `TREND_ANALYTICS_LOG` in `scripts/trend-ingest.env.example` — fixed 2026-05-27
- [x] [Review][Patch] Python soak audit `computedAt` used truthiness (`and computed`) — mis-handled `0`/NaN vs TS `Number.isFinite` [`scripts/audit-trend-analytics-soak.py`] — fixed 2026-05-27
- [x] [Review][Patch] Document 75m/90m thresholds vs 60m hourly cron headroom [`convex/lib/analyticsSoak.ts`, `audit-trend-analytics-soak.py`] — fixed 2026-05-27
- [x] [Review][Patch] `normalizeSignalDisplayValue` — add `Infinity` Vitest parity with `NaN` [`tests/lib/analytics-soak.test.ts`] — fixed 2026-05-27

### Change Log

- 2026-05-27: Story 45-7 — soak logging, analytics audit script, query polish, tests.
- 2026-05-27: Code review patches — env doc, soak threshold comments, Python finite-ms parity, Infinity clamp test.
