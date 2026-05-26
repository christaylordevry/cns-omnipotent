---
story_id: 45-5
epic: 45
title: anomaly-detection
status: done
output_repo: cns-dashboard
---

# Story 45-5: Anomaly detection

Status: done

## Acceptance Criteria

- `detectAnomalies` at 2.5σ in `lib/predictiveAnalytics.ts`
- `checkAnomalies` internalAction; `insertAnomalies` mutation
- `ingestSignalBatch` schedules `checkAnomalies` via `scheduler.runAfter(0, ...)`
- Unit tests: spike, drop, below threshold, insufficient data

## Tasks / Subtasks

- [x] Implement anomaly detection module
- [x] Wire ingest + mutations
- [x] Tests

### Review Findings

- [x] [Review][Patch] `checkAnomalies` used 30-day window instead of spec 7-day [`convex/trendAnalytics.ts`]
- [x] [Review][Patch] Scheduler skipped via optional chaining when `runAfter` missing [`convex/trends.ts`]
- [x] [Review][Patch] Dedupe key scoped with `topicId` + retry/7-day tests [`convex/trendIntelligence.ts`, `tests/convex/trend-anomaly-detection.test.ts`]
