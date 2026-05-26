---
story_id: 45-6
epic: 45
title: arima-forecasting
status: done
output_repo: cns-dashboard
---

# Story 45-6: ARIMA forecasting

Status: done

## Acceptance Criteria

- Add `arima@^0.2.8` (npm latest; no `1.x` published)
- `computeForecast` returns 14-day arrays; ARIMA when ≥14 points else `LINEAR_EXTRAPOLATION`
- `upsertForecast` mutation; wired in `runAnalyticsPass`
- Integration test + WASM smoke in CI

## Tasks / Subtasks

- [x] Install arima
- [x] Implement forecast in `predictiveAnalytics.ts`
- [x] Wire pass + tests

## Dev Agent Record

### Implementation Plan

- Installed `arima@^0.2.8` (npm latest; normative AC/architecture updated from erroneous `^1.0.13`).
- `computeForecast`: 14-day horizon; ARIMA `{ p: 2, d: 1, q: 2 }` when ≥14 points; linear extrapolation fallback; ARIMA errors fall back to linear.
- `upsertForecast` mirrors `upsertTrendScore` dedupe semantics.
- `runAnalyticsPass` writes forecast after score upsert.

### Completion Notes

- ✅ `arima` WASM loads in Node smoke test (`tests/lib/arima-wasm-smoke.test.ts`).
- ✅ Unit tests for linear vs ARIMA paths and interval ordering (`tests/lib/predictive-analytics.test.ts`).
- ✅ Integration: 30-signal topics get `trendForecasts` rows with `ARIMA` and valid bands (`tests/convex/trend-analytics.test.ts`).
- ✅ `bash scripts/verify.sh` passed (CNS 642 + cns-dashboard 123 tests).

### File List

- `cns-dashboard/package.json`
- `cns-dashboard/package-lock.json`
- `cns-dashboard/convex/lib/predictiveAnalytics.ts`
- `cns-dashboard/convex/trendIntelligence.ts`
- `cns-dashboard/convex/trendAnalytics.ts`
- `cns-dashboard/tests/lib/predictive-analytics.test.ts`
- `cns-dashboard/tests/lib/predictive-analytics-arima-fallback.test.ts`
- `cns-dashboard/tests/lib/arima-wasm-smoke.test.ts`
- `cns-dashboard/tests/convex/trend-analytics.test.ts`
- `_bmad-output/planning-artifacts/architecture-epic-45-trend-intelligence-layer-2.md`
- `_bmad-output/planning-artifacts/prd-epic-45-trend-intelligence-engine.md`

### Change Log

- 2026-05-27: Story 45-6 — ARIMA forecasting, upsertForecast, analytics pass wiring, tests.
- 2026-05-27: Code review — stale forecast delete, non-finite ARIMA guard, tests, `simple-statistics` restore, docs `^0.2.8`.

### Review Findings

- [x] [Review][Decision] **AC package version** — Resolved 1A: AC + architecture + PRD updated to `arima@^0.2.8`.

- [x] [Review][Decision] **Stale forecast rows** — Resolved 2A: `deleteForecastsForTopic` on `MIN_SIGNALS` skip.

- [x] [Review][Patch] **Restore `simple-statistics` ^7.8.9** [`package.json`]

- [x] [Review][Patch] **ARIMA failure → linear fallback test** [`tests/lib/predictive-analytics-arima-fallback.test.ts`]

- [x] [Review][Patch] **LINEAR_EXTRAPOLATION integration test** [`tests/convex/trend-analytics.test.ts`]

- [x] [Review][Patch] **Non-finite ARIMA output fallback** [`convex/lib/predictiveAnalytics.ts`]

- [x] [Review][Defer] **ARIMA trains on value sequence only, not calendar spacing** — deferred (see `deferred-work.md`).
