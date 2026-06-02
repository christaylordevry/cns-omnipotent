---
story_id: 45-2
epic: 45
title: trend-analyzer
status: review
output_repo: cns-dashboard
---

# Story 45-2: TrendAnalyzer — lifecycle and investment scoring

Status: done

## Story

As the **analytics engine**,
I want **pure TypeScript lifecycle and investment scoring**,
So that **Layer 1 scores run without npm dependencies in Convex lib**.

## Acceptance Criteria

- `convex/lib/trendAnalyzer.ts` implements `classifyLifecycleStage`, `calculateInvestmentScore`, `assessRisks`, `calculateMomentumTrajectory`, `estimateDaysToPeak`
- `classifyLifecycleStage` returns `INSUFFICIENT_DATA` (lib-only, not persisted) when `signals.length < 5` and values are not all-zero; `DORMANT` only for genuine inactivity
- Unit tests for all lifecycle stages and edge cases (&lt;5 signals, all-zero)
- No `"use node"` in lib file

## Tasks / Subtasks

- [x] Implement `convex/lib/trendAnalyzer.ts`
- [x] Add `tests/lib/trend-analyzer.test.ts`
- [x] `npm test` green

## Dev Notes

- Port from PAKE `trend_analyzer.py` per PRD §4.1
- Depends on 45-1 complete

## Pre-Review Flags (45-4 integration — patch in review, do not defer to 45-4)

**Code review focus prompt:** Focus on: (1) DORMANT vs INSUFFICIENT_DATA distinction for &lt; 5 signals, (2) export surface completeness including `estimateDaysToPeak`, (3) any magic numbers that should be named constants. Don't re-implement — patch findings only.

### 1. DORMANT catch-all vs insufficient data

**Current behavior:** `classifyLifecycleStage` returns `DORMANT` when `signals.length < MIN_SIGNALS` (5) — see `convex/lib/trendAnalyzer.ts` early return.

**Risk:** Brand-new watchlist topics in their first hour (&lt; 5 points) are classified as **dead**, not **unclassified**. PRD/spec intent: DORMANT = genuinely inactive. `runAnalyticsPass` has `if (signals.length < 5) continue`, so no score row is written today — but any future caller that classifies without that guard would persist a misleading `lifecycleStage: DORMANT` and `investmentScore` with DORMANT multiplier (0.1).

**Reviewer action:** Decide `INSUFFICIENT_DATA` (or throw / null) vs DORMANT for &lt; 5 signals; align tests and export type if the union changes. Do not leave “no data yet” conflated with “dead topic.”

### 2. `estimateDaysToPeak` export surface

**Current behavior:** `estimateDaysToPeak` **is** exported (`export function estimateDaysToPeak` in `trendAnalyzer.ts`). Story AC lists only four functions; Completion Notes mention it “for 45-4 wiring.”

**Risk:** Undocumented export → 45-4 either omits `daysToPeak` or re-implements; documented-only-four → reviewer may mark as scope creep.

**Reviewer action:** Confirm export is intentional; add to story AC / module doc comment, or make internal if 45-4 will compute `daysToPeak` inside a single `computeLayer1` helper. Resolve here so 45-4’s first import does not surprise-compile.

### 3. PEAK volume plateau threshold

**Current behavior:** `Math.abs(volumeGrowth) < 0.1` is **inline** in the PEAK branch (not a named constant).

**Reviewer action:** Extract e.g. `PEAK_VOLUME_PLATEAU_THRESHOLD = 0.1` at module top with other thresholds; single place to tune after first week of live data.

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log

- No PAKE Python source in workspace; implemented from PRD §4.1 lifecycle rules and investment formula.
- PEAK classified before DECLINING when `|volumeGrowth| < 0.1` and momentum negative (plateau + soft decline).
- Short series (&lt;6 points) use first-to-last momentum delta so EMERGING works with exactly 5 signals.

### Completion Notes List

- `convex/lib/trendAnalyzer.ts`: `classifyLifecycleStage`, `calculateInvestmentScore`, `assessRisks`, `calculateMomentumTrajectory`, plus `estimateDaysToPeak` for Layer 1 row fields in 45-4.
- Pure TS, no `"use node"`, no npm deps.
- 15 Vitest cases: all lifecycle stages, &lt;5 signals, all-zero, investment bounds, risk fields.
- cns-dashboard: 86 tests passing.

### File List

**cns-dashboard:**

- `convex/lib/trendAnalyzer.ts` (new)
- `tests/lib/trend-analyzer.test.ts` (new)

**Omnipotent.md:**

- `_bmad-output/implementation-artifacts/45-2-trend-analyzer.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Review Findings

- [x] [Review][Patch] DORMANT vs INSUFFICIENT_DATA for &lt; 5 signals [`trendAnalyzer.ts`] — split early return; all-zero short series stays DORMANT
- [x] [Review][Patch] `estimateDaysToPeak` export surface — module doc + Vitest coverage; AC updated
- [x] [Review][Patch] PEAK volume plateau magic number — `PEAK_VOLUME_PLATEAU_THRESHOLD` + related lifecycle thresholds named

### Change Log

- 2026-05-26: Story 45-2 — Layer 1 TrendAnalyzer lib + unit tests.
- 2026-05-26: Code review patches — INSUFFICIENT_DATA, named constants, estimateDaysToPeak tests.
