---
story_id: 45-1
epic: 45
title: schema-and-query-layer
status: done
output_repo: cns-dashboard
cns_repo_touch: none
---

# Story 45-1: Schema and query layer

Status: done

## Story

As a **dashboard developer**,
I want **four intelligence tables and Epic 46 Convex queries**,
So that **Epic 46 can subscribe to scores, forecasts, and anomalies without client-side analytics**.

## Context

| Topic | Detail |
|-------|--------|
| **Output repo** | `cns-dashboard` only |
| **Normative** | `architecture-epic-45-trend-intelligence-layer-2.md` |
| **Depends on** | Epic 44 tables + `trends.ts` live |
| **Out of scope** | `trendAnalytics.ts`, `lib/*`, npm deps, cron, ingest hook |

## Acceptance Criteria

1. **Schema** — `trendScores`, `trendForecasts`, `trendAnomalies`, `trendAlerts` in `schema.ts` with indexes per architecture.
2. **Validators** — Row validators in `trendValidators.ts`; Vitest accept/reject.
3. **getLatestScores** — One latest score per watchlist topic (via `topicId`); omit topics without `trendTopics` row or score.
4. **getRecentAnomalies** — `{ hours }` filter, `detectedAt` desc.
5. **getTopicForecast** — Latest forecast for `topicId` or null.
6. **getTopicScoreHistory** — Scores for `topicId`, `computedAt` desc.
7. **getTopicSignalHistory** — Signals for topic over `days`, normalised 0–100 scale in response.
8. **Tests** — `npm test` passes in cns-dashboard; no regressions.

## Tasks / Subtasks

- [x] Add Epic 45 row validators to `convex/trendValidators.ts` (AC: validators)
- [x] Extend `convex/schema.ts` with four tables + indexes (AC: schema)
- [x] Create `convex/trendIntelligence.ts` with public queries — **no** `"use node"` (AC: 3–7)
- [x] Add `tests/convex/trend-intelligence-validators.test.ts` (AC: validators)
- [x] Add `tests/convex/trend-intelligence.test.ts` (AC: 3–7)
- [x] Run `npm test` and `npm run build` in cns-dashboard (AC: 8)

## Dev Notes

- Use `topicId: v.id("trendTopics")` on intelligence tables; resolve slug via `trendTopics.by_topicSlug`.
- Do **not** create `trendAnalytics.ts` in this story.
- Internal mutations (`upsertTrendScore`, etc.) belong to Story 45-4.

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log

- Architecture doc signed off `"use node"` placement before implementation.
- Fixed `resolveTopicIdBySlug` ctx typing; tests use `Date.now()`-relative timestamps for window queries.

### Completion Notes List

- Four intelligence tables + indexes in `schema.ts`; row validators in `trendValidators.ts`.
- `trendIntelligence.ts`: public queries `getLatestScores`, `getTopicScoreHistory`, `getRecentAnomalies`, `getTopicForecast`, `getTopicSignalHistory`; internal `getAllTopics`, `getSignalsForTopic` for Stories 45-4+.
- No `trendAnalytics.ts` or npm analytics deps (per story scope).
- Vitest: 71 tests passing in cns-dashboard.

### File List

**cns-dashboard:**

- `convex/trendValidators.ts`
- `convex/schema.ts`
- `convex/trendIntelligence.ts` (new)
- `tests/convex/trend-intelligence-validators.test.ts` (new)
- `tests/convex/trend-intelligence.test.ts` (new)

**Omnipotent.md:**

- `_bmad-output/planning-artifacts/architecture-epic-45-trend-intelligence-layer-2.md` (new)
- `_bmad-output/planning-artifacts/prd-epic-45-trend-intelligence-engine.md` (copied)
- `_bmad-output/planning-artifacts/epic-46-ui-spec.md` (copied)
- `_bmad-output/planning-artifacts/epics-epic-45.md` (new)
- `_bmad-output/implementation-artifacts/45-1-schema-and-query-layer.md`
- `_bmad-output/implementation-artifacts/45-2` … `45-7` story stubs (new)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-05-26: Epic 45 Story 45-1 — intelligence schema + Epic 46 query layer.

### Review Findings

- [x] [Review][Patch] Validator reject tests missing (AC 2) [`tests/convex/trend-intelligence-validators.test.ts`] — added 3 reject cases
- [x] [Review][Patch] `getTopicScoreHistory` untested (AC 6) [`tests/convex/trend-intelligence.test.ts`] — added sort-order test
- [x] [Review][Patch] `getRecentAnomalies` missing Epic 46 feed fields [`convex/trendIntelligence.ts`] — enrich with `keyword` + `topicSlug`
- [x] [Review][Patch] `getTopicSignalHistory` value not clamped 0–100 [`convex/trendIntelligence.ts`] — clamp after scale
- [x] [Review][Defer] Epic 46 UI spec uses `api.trends.*` namespace — architecture C8 places queries in `api.trendIntelligence.*`; Epic 46 stories should import from `trendIntelligence` — deferred, doc fix in Epic 46 PRD
