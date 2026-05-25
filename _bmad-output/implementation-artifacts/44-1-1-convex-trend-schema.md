---
story_id: 44-1-1
epic: 44
planning_epic: "Epic 44 / Epic 1 Story 1.1"
title: convex-trend-schema
status: done
output_repo: cns-dashboard
cns_repo_touch: none
---

# Story 44-1-1: Convex trend schema and validators

Status: done

**Planning map:** Epic 44 Story 1.1 — `44-1-1-convex-trend-schema`.

## Story

As a **developer**,
I want **four trend tables and normative validators in cns-dashboard**,
So that **ingestSignalBatch has a typed contract isolated from Epic 42 dashboard tables**.

## Context

| Topic | Detail |
|-------|--------|
| **Output repo** | `cns-dashboard` only |
| **CNS repo touch** | **None** — sprint/story artifacts only in Omnipotent.md |
| **Depends on** | Epic 42 schema live (`convex/schema.ts` six tables) |
| **Normative** | `architecture-epic-44-trend-intelligence-layer-1.md` § Convex Schema, § Wire Contract |
| **Out of scope** | `convex/trends.ts`, `ingestSignalBatch`, Epic 42 `dashboard.ts` / `validators.ts` edits |

## Acceptance Criteria

1. **Schema (AC: schema)** — `convex/schema.ts` adds `signalEvents`, `trendTopics`, `signalSources`, `watchlist` per architecture § Convex Schema; Epic 42 tables unchanged.
2. **Fields (AC: fields)** — `camelCase` fields (`normalizedValue`, `momentumScore`, `lastUpdated`, `sourceBreakdown` with `stale` boolean).
3. **Indexes (AC: indexes)** — `by_dedupeKey`, `by_topicSlug_collectedAt`, `by_topicSlug` on `trendTopics`, `by_name` on `signalSources`, `by_topicSlug` on `watchlist`.
4. **Validators (AC: validators)** — `convex/trendValidators.ts` exports `SourceName`, `SignalType`, `SignalEventInput`, `SignalSourcePatch`, `WatchlistEntry`, and `SignalIngestBatch` matching wire contract.
5. **Boundary (AC: boundary)** — No edits to `ingestDashboardSnapshot`, `dashboard.ts` ingest path, or Epic 42 table shapes.
6. **Tests (AC: test)** — Vitest covers validator accept/reject and schema module load; `npm test` and `npm run build` pass in cns-dashboard.

## Tasks / Subtasks

- [x] Add `convex/trendValidators.ts` with enums and batch wire validators (AC: validators)
- [x] Extend `convex/schema.ts` with four trend tables and indexes (AC: schema, fields, indexes)
- [x] Add `tests/convex/trend-validators.test.ts` (AC: test)
- [x] Run `npm test` and `npm run build` in cns-dashboard (AC: test)
- [x] Confirm Epic 42 `dashboard.test.ts` still passes; CNS `bash scripts/verify.sh` green (AC: boundary, test)

### Review Findings

- [x] [Review][Patch] AC6 reject coverage is thin — added `rejects signalSources with invalid status` [`tests/convex/trend-validators.test.ts`]
- [x] [Review][Patch] Validator export smoke test omits AC4 exports — assert all six wire validators + `sampleBatch()` shape [`tests/convex/trend-validators.test.ts`]
- [x] [Review][Defer] `note-search.test.ts` import path fix — deferred, pre-existing broken import required for `npm test` gate; out of story scope but acceptable [`tests/convex/note-search.test.ts`]
- [x] [Review][Defer] Wire `signalIngestBatchValidator` reject paths — deferred until `ingestSignalBatch` wires validators in Story 44-1-2; Convex has no standalone public parse API in this repo [`convex/trendValidators.ts`]

## Dev Notes

- `signalEvents` stores `momentum` on insert (Story 44-1-2); `SignalEventInput` omits momentum.
- `lifecycleStage`: `v.union(v.string(), v.null())` reserved MVP null.
- `metadata`: `v.any()` on stored events; batch input uses same.
- Index names: architecture uses `by_topicSlug_collectedAt` (camelCase `collectedAt` in index field list).

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log

- Story file created at dev start (epic had no `ready-for-dev` artifact yet).
- Pre-existing `note-search.test.ts` import path fixed (`noteSearch` vs `note-search`) so `npm test` gate passes.

### Completion Notes List

- Added `convex/trendValidators.ts`: `sourceNameValue`, `signalTypeValue`, `signalEventInputValidator`, `signalSourcePatchValidator`, `watchlistEntryValidator`, `signalIngestBatchValidator`, plus stored-row validators for schema.
- Extended `convex/schema.ts` with four Epic 44 tables and indexes; Epic 42 tables untouched.
- `npx convex dev --once` deployed indexes to `amiable-ox-862`.
- Vitest: 4 trend tests + 36 total cns-dashboard; CNS `verify.sh` 642 tests green.
- **Operator guide: no update required.**

### File List

**cns-dashboard** (`/home/christ/ai-factory/projects/cns-dashboard/`):

- `convex/trendValidators.ts` (new)
- `convex/schema.ts`
- `tests/convex/trend-validators.test.ts` (new)
- `tests/convex/note-search.test.ts` (import fix)
- `convex/_generated/` (convex codegen)

**Omnipotent.md**:

- `_bmad-output/implementation-artifacts/44-1-1-convex-trend-schema.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-05-26: Epic 44 Story 1.1 — trend schema + validators in cns-dashboard.
- 2026-05-26: Code review — strengthened AC4/AC6 Vitest coverage (5 tests).
