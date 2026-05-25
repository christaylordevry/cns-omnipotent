---
story_id: 44-1-2
epic: 44
planning_epic: "Epic 44 / Epic 1 Story 1.2"
title: ingest-signal-batch
status: done
output_repo: cns-dashboard
cns_repo_touch: none
---

# Story 44-1-2: ingestSignalBatch mutation with tests

Status: done

**Planning map:** Epic 44 Story 1.2 — `44-1-2-ingest-signal-batch`.

## Story

As a **developer**,
I want **`trends:ingestSignalBatch` to validate batches, insert events, compute momentum, merge trendTopics, sync watchlist, and prune retention**,
So that **concurrent 15m and 60m cron runs merge safely without Python-side aggregation**.

## Context

| Topic | Detail |
|-------|--------|
| **Output repo** | `cns-dashboard` only |
| **CNS repo touch** | **None** — sprint/story artifacts only in Omnipotent.md |
| **Depends on** | Story 44-1-1 (`trendValidators`, schema) |
| **Normative** | `architecture-epic-44-trend-intelligence-layer-1.md` § Momentum, § trendTopics Materialisation, § ingestSignalBatch |
| **Out of scope** | `getTrendTopics` / `getSignalSources` (Story 44-1-3), Python `trend-ingest.py` (Epic 44 Epic 2) |

## Acceptance Criteria

1. **Mutation (AC: mutation)** — `convex/trends.ts` exports `ingestSignalBatch` with `batch: signalIngestBatchValidator`; path `trends:ingestSignalBatch`.
2. **Watchlist (AC: watchlist)** — Replace mirror: delete slugs not in batch; upsert batch entries.
3. **Events (AC: events)** — Skip existing `dedupeKey`; else insert with momentum (prior null → 0, else clamp formula, ε=1e-6).
4. **Materialisation (AC: topics)** — Merge `sourceBreakdown` per touched source only; `momentumScore` = mean non-stale momentums; stale thresholds C8 (news/reddit 30m, trends 2h).
5. **Retention (AC: retention)** — Prune to ≤500 events per `topicSlug` by oldest `collectedAt`.
6. **Return (AC: return)** — `{ inserted, skipped, topicsUpdated }`; transaction rolls back on validation failure.
7. **Tests (AC: test)** — `tests/convex/trends.test.ts` covers dedupe, multi-source merge, retention cap, validator reject; `npm test` and `npm run build` pass.

## Tasks / Subtasks

- [x] Add `convex/trends.ts` with `ingestSignalBatch` and helpers (AC: mutation, watchlist, events, topics, retention, return)
- [x] Add `tests/convex/trends.test.ts` (AC: test)
- [x] Wire deferred 44-1-1 review: batch validator reject path in tests (AC: test)
- [x] Run `npm test` and `npm run build` in cns-dashboard (AC: test)
- [x] Update sprint-status and story file to review (AC: all)

### Review Findings

- [x] [Review][Decision] Empty watchlist batch — **Guard:** `syncWatchlist` returns early when `watchlist` is empty (no mirror wipe).
- [x] [Review][Patch] Convex `api.d.ts` — `npx convex codegen`; `trends` module registered.
- [x] [Review][Patch] `activeSources` — `signalSources` patches filtered to `batch.activeSources` before upsert.
- [x] [Review][Patch] Stale refresh — all `sourceBreakdown` entries get C8 `stale` recomputed at materialisation `now`.
- [x] [Review][Defer] No automated test for C8 stale thresholds or stale refresh on partial batch — [`tests/convex/trends.test.ts`] — deferred, follow-up hardening
- [x] [Review][Defer] `findPriorNormalizedValue` collects all topic events per insert — [`convex/trends.ts`:101-104] — deferred, acceptable at 500 retention cap for MVP
- [x] [Review][Defer] `note-search.test.ts` import path fix (`noteSearch`) — collateral rename, out of 44-1-2 scope — deferred

## Dev Notes

- `now` for stale = `Date.now()` at materialisation time inside mutation.
- Do not remove breakdown entries for sources absent from batch (C4).
- `lifecycleStage: null` on trendTopics rows.
- Epic 42 `dashboard.ts` / `ingestDashboardSnapshot` untouched.

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log

- Story file created at dev start (no prior `ready-for-dev` artifact; user targeted 44-1-2).

### Completion Notes List

- Added `convex/trends.ts` with `ingestSignalBatch`: watchlist replace, signalSources upsert, dedupe + momentum, trendTopics merge (per-source upsert, C8 stale), retention prune, return counts.
- Seven Vitest cases in `tests/convex/trends.test.ts` including 44-1-1 deferred validator reject.
- cns-dashboard: 44 tests pass; `npm run build` OK. Epic 42 dashboard tests unchanged.
- **Operator guide: no update required** (server-only mutation; HTTP push documented in Epic 44 Epic 2).

### File List

**cns-dashboard** (`/home/christ/ai-factory/projects/cns-dashboard/`):

- `convex/trends.ts` (new)
- `tests/convex/trends.test.ts` (new)
- `convex/_generated/api.d.ts` (codegen)

**Omnipotent.md**:

- `_bmad-output/implementation-artifacts/44-1-2-ingest-signal-batch.md` (new)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-05-26: Epic 44 Story 1.2 — `ingestSignalBatch` mutation + tests in cns-dashboard.
- 2026-05-26: Code review — empty-watchlist guard, activeSources filter, stale recompute, codegen; 9 trend tests (46 total).
