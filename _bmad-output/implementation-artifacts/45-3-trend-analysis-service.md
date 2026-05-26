---
story_id: 45-3
epic: 45
title: trend-analysis-service
status: done
output_repo: cns-dashboard
---

# Story 45-3: TrendAnalysisService — trend type and breakpoints

Status: done

## Acceptance Criteria

- Add `simple-statistics@^7.8.8` to package.json
- `convex/lib/trendAnalysisService.ts`: `detectTrendType`, `detectBreakpoints`
- Unit tests for six trend types + no-breakpoint case
- Imported only from Node action path (45-4), not from queries

## Tasks / Subtasks

- [x] Install `simple-statistics`
- [x] Implement lib module + tests
- [x] `npm test` green

## Dev Notes

- Layer 2 per PRD §4.2: R² model competition (linear, exponential, log, polynomial); FLAT when best R² &lt; 0.3
- Breakpoints: rolling index-based regression (window 5), flag timestamps where |Δslope| &gt; mean + 2σ
- Depends on 45-2; consumed by 45-4 `trendAnalytics.ts` only

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log

- Context7 `/simple-statistics/simple-statistics` for `linearRegression`, `linearRegressionLine`, `rSquared`.
- Breakpoint detection uses index-based windows (not day-scale) so slope-change spikes are detectable at step transitions.
- No imports of this module from `trendIntelligence.ts` or queries (45-4 wires it).

### Completion Notes List

- Added `simple-statistics@^7.8.8` to `cns-dashboard/package.json`.
- `convex/lib/trendAnalysisService.ts`: `detectTrendType` (six types + FLAT threshold), `detectBreakpoints` (mean + 2σ on rolling slope deltas).
- `tests/lib/trend-analysis-service.test.ts`: 11 Vitest cases (six trend types, FLAT/noisy, rSquared bounds, breakpoint + no-breakpoint).
- cns-dashboard: 104 tests passing.

### File List

**cns-dashboard:**

- `package.json` (modified)
- `package-lock.json` (modified)
- `convex/lib/trendAnalysisService.ts` (new)
- `tests/lib/trend-analysis-service.test.ts` (new)

**Omnipotent.md:**

- `_bmad-output/implementation-artifacts/45-3-trend-analysis-service.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Review Findings

- [x] [Review][Dismiss] R² transforms — exponential fits `log(y)` vs `x`, logarithmic fits `y` vs `log(x+1)`, polynomial fits `y` vs `x²`; R² evaluated on original scale. Matches PRD §4.2.
- [x] [Review][Dismiss] Breakpoint σ — `simple-statistics` `standardDeviation` is population σ (divisor `n`). Import aliased to `populationStandardDeviation` for intent.
- [x] [Review][Patch] Magic numbers — `BREAKPOINT_SIGMA_MULTIPLIER`, `LOG_DAY_OFFSET`, `POLYNOMIAL_SLOPE_DERIVATIVE` in `trendAnalysisService.ts`.

### Change Log

- 2026-05-26: Story 45-3 — Layer 2 TrendAnalysisService + `simple-statistics` + unit tests.
- 2026-05-26: Code review — named breakpoint/polynomial constants; population σ import alias (no logic change).
