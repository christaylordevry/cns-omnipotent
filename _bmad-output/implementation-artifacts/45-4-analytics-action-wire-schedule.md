---
story_id: 45-4
epic: 45
title: analytics-action-wire-schedule
status: review
output_repo: cns-dashboard
---

# Story 45-4: Analytics action — wire and schedule

Status: done

## Acceptance Criteria

- `convex/trendAnalytics.ts` with **file-level** `"use node"` only
- `runAnalyticsPass` loops watchlist, skips &lt;5 signals, upserts scores (Layers 1+2)
- `upsertTrendScore` internalMutation in `trendIntelligence.ts`
- `convex/crons.ts` hourly interval
- Integration test: seed topics + signals → pass → `trendScores` rows exist

## Tasks / Subtasks

- [x] Create `trendAnalytics.ts` + `crons.ts`
- [x] Wire internal mutations
- [x] Integration test
- [x] `npm test` green

## Dev Agent Record

### Implementation Plan

- `runAnalyticsPass` internalAction (`"use node"` file-level) loads watchlist via `getAllTopics`, 30-day signals via `getSignalsForTopic`, skips `< 5` points.
- Layer 1+2 scoring in `convex/lib/computeTrendScores.ts` (normalized × 100 for analyzer inputs); persists via `upsertTrendScore` internalMutation (patch-or-insert on `by_topicId`).
- Hourly cron in `convex/crons.ts`. Forecast / Layer 3 deferred to Story 45-6.

### Completion Notes

- 109 tests passing in `cns-dashboard` (`npm test`).
- Integration: 3 topics × 30 signals → `runAnalyticsPass` → one `trendScores` row per topic; upsert idempotency and `< 5` skip covered.

### File List

- `cns-dashboard/convex/trendAnalytics.ts` (new)
- `cns-dashboard/convex/crons.ts` (new)
- `cns-dashboard/convex/lib/computeTrendScores.ts` (new)
- `cns-dashboard/convex/trendIntelligence.ts` (modified — `upsertTrendScore`)
- `cns-dashboard/tests/convex/trend-analytics.test.ts` (new)
- `cns-dashboard/tests/lib/compute-trend-scores.test.ts` (new)

## Change Log

- 2026-05-26: Story 45-4 — analytics pass, cron, upsert mutation, integration tests.
