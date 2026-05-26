---
story_id: 44-1-3
epic: 44
planning_epic: "Epic 44 / Epic 1 Story 1.3"
title: trend-queries-get-topics-sources
status: done
output_repo: cns-dashboard
cns_repo_touch: none
---

# Story 44-1-3: Trend queries getTrendTopics and getSignalSources

Status: done

**Planning map:** Epic 44 Story 1.3 — `44-1-3-trend-queries-get-topics-sources`.

## Story

As a **CNS operator**,
I want **read-only Convex queries for panel aggregates and source health**,
So that **the browser never scans full signalEvents history**.

## Context

| Topic | Detail |
|-------|--------|
| **Output repo** | `cns-dashboard` only |
| **CNS repo touch** | **None** — sprint/story artifacts only in Omnipotent.md |
| **Depends on** | Stories 44-1-1 (schema), 44-1-2 (`ingestSignalBatch` materialisation) |
| **Normative** | `architecture-epic-44-trend-intelligence-layer-1.md` § Queries, NFR-P2 |
| **Out of scope** | `TrendStubPanel.svelte` wiring (Epic 44 later story), Python ingest |

## Acceptance Criteria

1. **getTrendTopics (AC: topics)** — `convex/trends.ts` exports `getTrendTopics` with `{ limit?: number }` default 10; sorted `momentumScore` desc; `stripConvexDoc` on each row.
2. **getSignalSources (AC: sources)** — exports `getSignalSources` with no args; all `signalSources` sorted by `name`; includes status, lastRun, errorCount, lastError.
3. **NFR-P2 (AC: nfr)** — handlers query only `trendTopics` and `signalSources` — never `signalEvents`.
4. **Tests (AC: test)** — `tests/convex/trends.test.ts` covers empty tables and multi-topic ordering; `npm test` and `npm run build` pass.

## Tasks / Subtasks

- [x] Add `getTrendTopics` and `getSignalSources` to `convex/trends.ts` (AC: topics, sources, nfr)
- [x] Extend `tests/convex/trends.test.ts` for query cases (AC: test)
- [x] Run `npm test` and `npm run build` in cns-dashboard (AC: test)
- [x] Update sprint-status and story file to review (AC: all)

## Dev Notes

- Reuse `stripConvexDoc` pattern from `dashboard.ts` (local helpers in `trends.ts` to avoid cross-module churn).
- No new schema indexes required; topic count bounded by watchlist scale.
- Epic 42 `dashboard.ts` untouched.

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log

- Story file created at dev start (user targeted 44-1-3; no prior artifact).

### Completion Notes List

- Added `getTrendTopics` and `getSignalSources` to `convex/trends.ts` with local `stripConvexDoc` helpers; NFR-P2 satisfied (no `signalEvents` reads in query handlers).
- Five new Vitest cases: empty topics/sources, momentum ordering, default limit 10 + explicit limit, source name sort with health fields, stripped Convex metadata.
- cns-dashboard: 51 tests pass; `npm run build` OK. Convex codegen updated `api.d.ts`.
- **Operator guide: no update required** (read-only queries; panel wiring is a later story).
- Code review (2026-05-26): added `rejects invalid limit values` test — 52 tests in suite after patch (15 in `trends.test.ts`).

### File List

**cns-dashboard** (`/home/christ/ai-factory/projects/cns-dashboard/`):

- `convex/trends.ts` (modified)
- `tests/convex/trends.test.ts` (modified)
- `convex/_generated/api.d.ts` (codegen)

**Omnipotent.md**:

- `_bmad-output/implementation-artifacts/44-1-3-trend-queries-get-topics-sources.md` (new)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-05-26: Epic 44 Story 1.3 — `getTrendTopics` + `getSignalSources` queries + tests in cns-dashboard.
- 2026-05-26: Code review patch — invalid `limit` rejection tests in `trends.test.ts`.

### Review Findings

- [x] [Review][Patch] Add tests for invalid `getTrendTopics` limit [`cns-dashboard/tests/convex/trends.test.ts`] — added `rejects invalid limit values` for 0, -1, NaN, Infinity.
- [x] [Review][Defer] Full-table `collect()` before `slice` [`cns-dashboard/convex/trends.ts:357-359`] — deferred, pre-existing pattern; watchlist scale makes index/limit push-down optional per story dev notes.
- [x] [Review][Defer] No upper cap on `limit` arg [`cns-dashboard/convex/trends.ts:352-359`] — deferred, pre-existing; AC/spec default 10 only; row count bounded by watchlist.
