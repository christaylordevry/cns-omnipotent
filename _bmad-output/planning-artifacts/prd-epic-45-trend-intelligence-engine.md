# PRD — Epic 45: Trend Intelligence Engine (Layer 2)
**BMAD Artifact Type:** Product Requirements Document  
**Epic:** 45  
**Date:** 2026-05-26  
**Author:** Pre-BMAD research synthesis  
**Status:** Ready for BMAD story generation  
**Depends on:** Epic 44 (signal ingestion, `signalEvents` / `trendTopics` / `signalSources` / `watchlist` tables live in Convex)  
**Feeds:** Epic 46 (all charts, scores, forecasts, anomalies displayed in the dashboard UI)

---

## 1. Problem Statement

Epic 44 built the data pipeline: raw signals arrive every 15 minutes (News) and every hour (Google Trends) and land in `signalEvents` and `trendTopics` in Convex. The data exists. Nothing is being done with it.

Right now you can see signal counts and raw trend values in the dashboard stub panel. You cannot see whether a topic is emerging or declining, whether its score is worth acting on, whether something unusual just happened, or where it's headed in the next two weeks. That intelligence gap is what Epic 45 closes.

Epic 45 is a **pure analytics layer**. It reads existing signal data, computes scored intelligence, and writes that intelligence back to new Convex tables. No new data sources. No UI changes. No Discord alerts. Just algorithms producing actionable outputs that Epic 46 will visualise.

---

## 2. Goals

1. Every watchlist topic has a **lifecycle stage** (EMERGING / GROWING / PEAK / DECLINING / DORMANT) and **investment score** (0.0–1.0) updated every hour.
2. Every watchlist topic has a **14-day forecast** with confidence intervals, updated every hour.
3. Anomalous signal events are **detected and flagged** as they arrive (2.5σ threshold).
4. Every watchlist topic has a **trend type classification** (LINEAR_UP/DOWN, EXPONENTIAL, LOGARITHMIC, POLYNOMIAL, FLAT) and associated R² quality score.
5. All computed results are available as Convex reactive queries, ready for Epic 46 to consume with no further computation on the client.

---

## 3. Non-Goals (Explicit Scope Boundary)

- **No UI changes** — zero modifications to the current dashboard panels. Epic 46 owns all display.
- **No new signal sources** — no new ingestion pipelines. Epic 44 growth handles that.
- **No Discord alerts** — scores computed and stored, but alert delivery is Epic 47.
- **No K-means clustering** — meaningful only at 30+ topics. Deferred.
- **No ADF stationarity test** — no useful JS port; not consumed by scoring logic. Deferred.
- **No full SARIMA seasonal modelling** — simplified additive decomposition is sufficient at current data volume.

---

## 4. Algorithm Architecture

Three algorithm layers, implemented in order of dependency. Each is a TypeScript module inside the Convex `/convex/` directory.

### 4.1 Layer 1: TrendAnalyzer — Lifecycle and Investment Scoring

**Source:** Ported from `src/services/trends/intelligence/trend_analyzer.py` in the PAKE_SYSTEM audit.  
**Dependencies:** None — pure TypeScript arithmetic.  
**Input:** Array of `SignalPoint` (timestamp, value, source) for a given topic over a rolling 30-day window.

**Outputs per topic:**
- `lifecycleStage`: `EMERGING | GROWING | PEAK | DECLINING | DORMANT`  
  Classification logic: based on age-in-hours, momentum direction (last 5 points vs prior 5), and volume growth direction.
- `investmentScore`: `0.0–1.0`  
  Composite: `baseTrendStrength × lifecycleMultiplier + volumeGrowthBonus + momentumTrajectoryBonus × platformMultiplier`  
  Lifecycle multipliers: EMERGING=1.0, GROWING=0.9, PEAK=0.6, DECLINING=0.3, DORMANT=0.1
- `momentumTrajectory`: `number[]` — rolling 5-point smoothed momentum history
- `daysToPeak`: `number` — estimated days until peak based on current momentum direction
- `volatilityRisk`, `declineRisk`, `timingRisk`, `platformRisk`, `overallRisk`: `0.0–1.0` each

### 4.2 Layer 2: TrendAnalysisService — Trend Type and Breakpoints

**Source:** Ported from `src/services/analytics/trend_analysis_service.py`.  
**Dependencies:** `simple-statistics` npm package (zero-dependency, TypeScript-typed, linear regression + R²).  
**Input:** Array of `[timestamp, value]` pairs for a topic.

**Outputs per topic:**
- `trendType`: `LINEAR_UP | LINEAR_DOWN | EXPONENTIAL | LOGARITHMIC | POLYNOMIAL | FLAT`  
  Detection: fit each model type via `simple-statistics` linear regression (with log/power transforms for non-linear types), select best by R² score, classify direction by slope sign.
- `trendSlope`: `number` — slope of the best-fit line
- `rSquared`: `number` — R² goodness-of-fit (0.0–1.0); below 0.3 → FLAT
- Breakpoints: timestamps where rolling regression slope change exceeds `mean + 2σ` threshold. Written to `trendScores.breakpoints: number[]`.

Simplified seasonal decomposition (not stored in `trendScores` directly, used internally by Layer 3 for detrending before forecast):
- Trend component: 7-period centred moving average
- Seasonal component: mean of residuals per day-of-week
- Residual: raw minus trend minus seasonal

### 4.3 Layer 3: PredictiveAnalyticsService — Forecasting and Anomaly Detection

**Source:** Ported from `src/services/analytics/predictive_analytics_service.py`.  
**Dependencies:** `arima` npm package (`zemlyansky/arima` — ARIMA/AutoARIMA, WASM-compiled, Node.js compatible).

**Forecasting output per topic:**
- 14-day forecast: `predictedValues: number[]` (14 values, daily)
- `confidenceLower: number[]`, `confidenceUpper: number[]` — 95% confidence intervals
- `modelType: "ARIMA" | "LINEAR_EXTRAPOLATION"` — falls back to linear if insufficient data (<14 points)
- `timestamps: number[]` — Unix ms per prediction step

**Anomaly detection** (runs on every signal batch ingestion, not just hourly):
- Z-score: `(value - rollingMean) / rollingStdDev` over a 7-day rolling window
- Threshold: 2.5σ
- Output: `direction: "SPIKE" | "DROP"`, `sigmaDistance: number`, `observedValue`, `expectedValue`

---

## 5. Convex Schema Additions

Add to `convex/schema.ts`. These are append-only additions — no modifications to existing Epic 44 tables.

```typescript
trendScores: defineTable({
  topicId: v.id("trendTopics"),
  keyword: v.string(),
  computedAt: v.number(),

  // Layer 1 — TrendAnalyzer
  lifecycleStage: v.union(
    v.literal("EMERGING"), v.literal("GROWING"), v.literal("PEAK"),
    v.literal("DECLINING"), v.literal("DORMANT")
  ),
  investmentScore: v.number(),
  daysToPeak: v.number(),
  momentumTrajectory: v.array(v.number()),

  // Layer 2 — TrendAnalysisService
  trendType: v.union(
    v.literal("LINEAR_UP"), v.literal("LINEAR_DOWN"),
    v.literal("EXPONENTIAL"), v.literal("LOGARITHMIC"),
    v.literal("POLYNOMIAL"), v.literal("FLAT")
  ),
  trendSlope: v.number(),
  rSquared: v.number(),
  breakpoints: v.array(v.number()),

  // Risk
  volatilityRisk: v.number(),
  declineRisk: v.number(),
  timingRisk: v.number(),
  platformRisk: v.number(),
  overallRisk: v.number(),

  hasAnomaly: v.boolean(),
})
.index("by_topicId", ["topicId"])
.index("by_computedAt", ["computedAt"]),

trendForecasts: defineTable({
  topicId: v.id("trendTopics"),
  computedAt: v.number(),
  horizon: v.number(),
  predictedValues: v.array(v.number()),
  confidenceLower: v.array(v.number()),
  confidenceUpper: v.array(v.number()),
  modelType: v.string(),
  timestamps: v.array(v.number()),
})
.index("by_topicId", ["topicId"]),

trendAnomalies: defineTable({
  topicId: v.id("trendTopics"),
  sourceId: v.optional(v.id("signalSources")),
  detectedAt: v.number(),
  signalTimestamp: v.number(),
  observedValue: v.number(),
  expectedValue: v.number(),
  sigmaDistance: v.number(),
  direction: v.union(v.literal("SPIKE"), v.literal("DROP")),
})
.index("by_topicId", ["topicId"])
.index("by_detectedAt", ["detectedAt"]),

trendAlerts: defineTable({
  topicId: v.id("trendTopics"),
  keyword: v.string(),
  condition: v.union(
    v.literal("ANOMALY_SPIKE"), v.literal("ANOMALY_DROP"),
    v.literal("STAGE_CHANGE"), v.literal("SCORE_ABOVE"), v.literal("SCORE_BELOW")
  ),
  threshold: v.optional(v.number()),
  createdAt: v.number(),
  active: v.boolean(),
})
.index("by_topicId", ["topicId"])
.index("by_active", ["active"]),
```

---

## 6. Convex Function Architecture

### 6.1 Runtime Decision

All analytics computation runs in **`internalAction` with `"use node"`** at the top of the file. This is non-negotiable:
- `arima` package uses WASM — requires Node.js runtime
- `simple-statistics` works in both runtimes but is simpler in Node.js
- Node.js runtime gives 512MB memory vs Convex runtime's 64MB

### 6.2 File Structure

```
convex/
  schema.ts              ← Add new tables (Story 45-1)
  trendIntelligence.ts   ← All Epic 45 queries and mutations
  trendAnalytics.ts      ← internalAction (Node.js) — analytics engine entry point
  lib/
    trendAnalyzer.ts     ← Layer 1: lifecycle + investment scoring
    trendAnalysisService.ts  ← Layer 2: trend type + breakpoints
    predictiveAnalytics.ts   ← Layer 3: ARIMA forecast + anomaly detection
    signalUtils.ts       ← Shared: normalisation, rolling window, moving average
```

### 6.3 Cron Schedule

```typescript
// convex/crons.ts addition
crons.interval("run trend analytics", { hours: 1 }, internal.trendAnalytics.runAnalyticsPass);
```

### 6.4 Analytics Pass Flow

```typescript
// convex/trendAnalytics.ts
"use node";

export const runAnalyticsPass = internalAction(async (ctx) => {
  // 1. Load all watchlist topics
  const topics = await ctx.runQuery(internal.trendIntelligence.getAllTopics);

  // 2. For each topic (sequential — no fan-out needed at ≤8 topics)
  for (const topic of topics) {
    // 3. Load 30-day signal history
    const signals = await ctx.runQuery(
      internal.trendIntelligence.getSignalsForTopic,
      { topicId: topic._id, days: 30 }
    );

    if (signals.length < 5) continue; // Not enough data yet

    // 4. Run all three algorithm layers
    const scores  = computeTrendScores(topic, signals);  // Layer 1 + 2
    const forecast = computeForecast(topic, signals);    // Layer 3

    // 5. Write results atomically
    await ctx.runMutation(internal.trendIntelligence.upsertTrendScore, scores);
    await ctx.runMutation(internal.trendIntelligence.upsertForecast, forecast);
  }
});
```

### 6.5 Anomaly Detection Trigger

Anomaly detection runs **on signal ingestion** (not just hourly) so anomalies are flagged in near-real-time. Add a call from the existing `ingestSignalBatch` mutation:

```typescript
// After writing new signals, schedule anomaly check
await ctx.scheduler.runAfter(0, internal.trendAnalytics.checkAnomalies, {
  topicId, newSignals
});
```

---

## 7. NPM Dependencies

Add to `cns-dashboard/package.json`:

```json
"arima": "^0.2.8",
"simple-statistics": "^7.8.8"
```

Both are pure JS/WASM with TypeScript definitions. No native addons. No Python.

---

## 8. Stories

### Phase A — Core scoring (highest value, ship first)

---

**Story 45-1: Schema and query layer**  
Add `trendScores`, `trendForecasts`, `trendAnomalies`, `trendAlerts` tables to `schema.ts`. Write the Convex queries Epic 46 will consume: `getLatestScores`, `getTopicScoreHistory`, `getRecentAnomalies`, `getTopicForecast`. Write validators. Tests: schema compiles, validators accept/reject correct shapes.

AC:
- All four tables defined in schema with correct indexes
- `getLatestScores` returns one score per watchlist topic (most recent `computedAt`)
- `getRecentAnomalies({ hours: 24 })` returns anomalies sorted by `detectedAt` desc
- `getTopicForecast({ topicId })` returns most recent forecast
- 642 existing tests still passing

---

**Story 45-2: TrendAnalyzer — lifecycle and investment scoring**  
Implement `convex/lib/trendAnalyzer.ts`. Pure TypeScript, no npm dependencies. Port the lifecycle classifier and investment score formula from the PAKE audit.

AC:
- `classifyLifecycleStage(signals)` returns correct stage for synthetic test cases:
  - 5 signals, all increasing, age < 72h → EMERGING
  - Steady growth over 14 days → GROWING
  - Volume plateau + declining momentum → PEAK
  - Sustained decline > 7 days → DECLINING
- `calculateInvestmentScore()` returns value in [0.0, 1.0]
- `assessRisks()` returns all five risk fields in [0.0, 1.0]
- `calculateMomentumTrajectory()` returns array of length min(5, signals.length)
- Unit tests cover all lifecycle stage transitions and edge cases (< 5 signals, all-zero values)

---

**Story 45-3: TrendAnalysisService — trend type and breakpoints**  
Install `simple-statistics`. Implement `convex/lib/trendAnalysisService.ts`. R² fitting for trend type classification; rolling regression for breakpoint detection.

AC:
- `detectTrendType(points)` correctly classifies:
  - Linearly increasing series → LINEAR_UP
  - Linearly decreasing series → LINEAR_DOWN
  - Exponential growth series → EXPONENTIAL
  - Flat/noisy series (R² < 0.3) → FLAT
- `detectBreakpoints(points)` returns timestamps where slope change exceeds mean + 2σ — tested against synthetic series with known breakpoint at midpoint
- `rSquared` field is in [0.0, 1.0]
- Unit tests cover all six trend types and the no-breakpoint case

---

**Story 45-4: Analytics action — wire and schedule**  
Implement `convex/trendAnalytics.ts` (`"use node"`). Wire Layers 1 + 2 into `runAnalyticsPass`. Add to `crons.ts`. Write mutations `upsertTrendScore` and upsert logic.

AC:
- `runAnalyticsPass` correctly loops all watchlist topics
- Topics with < 5 signals are skipped without error
- `upsertTrendScore` updates existing row if same `topicId` exists (no duplicates)
- Cron registered at 1-hour interval in Convex dashboard
- Integration test: seed 3 topics + 30 signals each → run `runAnalyticsPass` → all three have `trendScores` rows with correct structure
- 642+ tests passing (new tests added, no regressions)

---

### Phase B — Forecasting and anomaly detection

---

**Story 45-5: Anomaly detection**  
Install `simple-statistics` (already added in 45-3). Implement `convex/lib/predictiveAnalytics.ts` anomaly detection. Wire into signal ingestion path via `scheduler.runAfter`.

AC:
- `detectAnomalies(signals, threshold=2.5)` correctly flags:
  - A value at +3.0σ as `SPIKE`
  - A value at -2.8σ as `DROP`
  - A value at +2.0σ as not anomalous (below threshold)
- `checkAnomalies` internalAction reads last 7 days of signals, computes rolling mean/stddev, writes new `trendAnomalies` rows for any new signals above threshold
- `ingestSignalBatch` schedules `checkAnomalies` after successful write
- `getRecentAnomalies` query returns correct results for the last 24h
- Unit tests cover spike, drop, insufficient data (< 3 signals), and threshold boundary

---

**Story 45-6: ARIMA forecasting**  
Install `arima` npm package. Implement the forecasting module in `predictiveAnalytics.ts`. Wire into `runAnalyticsPass`. Add `upsertForecast` mutation.

AC:
- `computeForecast(signals)` returns:
  - `predictedValues` array of length 14
  - `confidenceLower` and `confidenceUpper` arrays of length 14
  - `modelType: "ARIMA"` when ≥ 14 signal points available
  - `modelType: "LINEAR_EXTRAPOLATION"` when < 14 signal points (fallback using simple-statistics linear regression)
- ARIMA initialised as `{ p: 2, d: 1, q: 2 }` — sensible defaults for weekly trend data
- `runAnalyticsPass` writes forecast rows after scoring rows
- Integration test: topic with 21+ signals → forecast has 14 non-null predicted values and intervals where `lower ≤ predicted ≤ upper` for all 14 points
- Convex Node.js action can load the WASM module successfully (smoke test in CI)

---

**Story 45-7: Reliability soak and query polish**  
Run the full pipeline for 7 days. Verify data quality and fix any edge cases found. Polish the query layer for Epic 46 consumption.

AC:
- `python3 scripts/audit-trend-ingest-reliability.py --days 7` passes with ≥ 90% signal delivery rate
- All 8 watchlist topics have `trendScores` rows updated within the last 75 minutes at any given check time
- `getTopicSignalHistory({ topicId, days: 30 })` returns correctly normalised values (0–100 scale)
- `getLatestScores` returns results sorted by `investmentScore` desc (Epic 46 needs this)
- No `computedAt` gaps > 90 minutes in the 7-day soak log
- Score version written to `sprint-status.yaml` as `45-7-soak` in `review`

---

## 9. Success Metrics

After Epic 45 is complete, these must all be true:

| Metric | Target |
|---|---|
| All watchlist topics have scores | 8/8 topics with `trendScores` row, updated within last 75 min |
| Forecast coverage | 8/8 topics with 14-day forecast row |
| Anomaly detection latency | Anomalies flagged within 5 min of signal ingestion |
| Analytics pass duration | Single pass (8 topics) completes in < 60 seconds |
| Test coverage | All new algorithm modules have unit tests; total passing ≥ 680 |
| No regressions | `bash scripts/verify.sh` passes throughout |
| Epic 46 query contract | All five queries (`getLatestScores`, `getTopicScoreHistory`, `getRecentAnomalies`, `getTopicForecast`, `getSignalsForTopic`) return correctly shaped data |

---

## 10. Risks and Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| `arima` WASM fails to compile in Convex Node.js action | Medium | Test WASM load in Story 45-6 smoke test before wiring to cron; fallback to LINEAR_EXTRAPOLATION is built in |
| Insufficient signal data for ARIMA (< 14 points for a new topic) | High — certain for new watchlist additions | Fallback to linear extrapolation is in the spec (Story 45-6 AC) |
| Google Trends pytrends warm-up errors cause gaps in signal history | Low (already observed, affects Trends only not News) | Analytics pass skips topics with < 5 signals; existing NewsAPI data is sufficient to compute scores |
| Convex action exceeds 10-min timeout | Very low — 8 topics, milliseconds each | Architecture uses sequential processing; fan-out available if watchlist ever exceeds 30 |
| Reddit signals still absent (account aging) | Confirmed — expected | Not a blocker; News + Google Trends sufficient for MVP scores |

---

## 11. Definition of Done (Epic Level)

Epic 45 is **done** when:
1. Stories 45-1 through 45-7 are all in `done` state in `sprint-status.yaml`
2. All five Epic 46 queries return correctly shaped data from live production (`amiable-ox-862.convex.cloud`)
3. `bash scripts/verify.sh` passes with ≥ 680 tests
4. The existing trend dashboard panel shows live `investmentScore` and `lifecycleStage` for at least one watchlist topic (even as raw text — full visualisation is Epic 46)
5. Story 45-7 reliability soak is in `review` and running automatically

---

## 12. Dependencies and Handoff

### What Epic 45 requires from Epic 44 (already done)
- `signalEvents` table populated with hourly/15-min signals ✓
- `trendTopics` table with watchlist keywords ✓
- `signalSources` table ✓
- `trends.ts` `ingestSignalBatch` mutation (to add anomaly check scheduler call) ✓

### What Epic 45 delivers to Epic 46
- `getLatestScores` → topic sidebar lifecycle badges + investment scores + risk bars
- `getTopicSignalHistory` → hero chart timeline data
- `getRecentAnomalies` → anomaly feed
- `getTopicForecast` → forecast sparklines + full 14-day chart
- `trendAlerts` table → alert creation UI (store-only in Epic 46)

---

*End of Epic 45 PRD. Feed into `bmad-create-architecture` next, then `bmad-create-epics-and-stories` to generate story files.*
