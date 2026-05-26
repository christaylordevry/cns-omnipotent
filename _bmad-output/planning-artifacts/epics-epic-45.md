---
stepsCompleted: [1, 2]
inputDocuments:
  - prd-epic-45-trend-intelligence-engine.md
  - architecture-epic-45-trend-intelligence-layer-2.md
  - epic-46-ui-spec.md
project_name: CNS Trend Intelligence Layer 2
date: "2026-05-26"
---

# Epic 45 — Epic Breakdown

## Epic List

| Epic | Title | Stories |
|------|-------|---------|
| 45 | Trend Intelligence Engine (Layer 2) | 45-1 … 45-7 |

## Epic 45: Trend Intelligence Engine

**Goal:** Compute lifecycle scores, forecasts, and anomalies on Epic 44 signal data; expose Convex queries for Epic 46.

**Normative:** `architecture-epic-45-trend-intelligence-layer-2.md`

### Story 45-1: Schema and query layer
### Story 45-2: TrendAnalyzer (lifecycle + investment)
### Story 45-3: TrendAnalysisService (trend type + breakpoints)
### Story 45-4: Analytics action wire + cron
### Story 45-5: Anomaly detection on ingest
### Story 45-6: ARIMA forecasting
### Story 45-7: Reliability soak + query polish

See implementation artifacts `45-*-*.md` for full acceptance criteria.
