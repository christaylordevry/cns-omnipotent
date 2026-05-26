---
story_id: 44-5-1
epic: 44
planning_epic: "Epic 44 / Epic 5 Story 5.1"
title: wire-trend-stub-panel-live-convex-queries
status: done
output_repo: cns-dashboard
cns_repo_touch: none
---

# Story 44-5-1: Wire TrendStubPanel to live Convex queries

Status: done

**Planning map:** Epic 44 Story 5.1 — `44-5-1-wire-trend-stub-panel-live-convex-queries`.

## Story

As a **CNS operator**,
I want **the Trend Intelligence panel to show live top topics and source health**,
So that **I know what to research today without opening Google Trends or Reddit**.

## Context

| Topic | Detail |
|-------|--------|
| **Output repo** | `cns-dashboard` at `/home/christ/ai-factory/projects/cns-dashboard` |
| **CNS repo touch** | **None** — sprint/story artifacts only in Omnipotent.md |
| **Depends on** | 44-1-3 (`getTrendTopics`, `getSignalSources`), ingest pipeline 44-2.x / 44-3.x |
| **Normative** | `epics-epic-44-trend-intelligence-layer-1.md` Story 5.1; FR28–FR30, FR33–FR35; UX-DR3–DR6, DR10–DR11; NFR-P1, NFR-A2 |
| **Out of scope** | Full flat/stale/error UX polish (44-5-2), Python ingest, Convex schema changes |

## Acceptance Criteria

1. **Live topics (AC: topics)** — `TrendStubPanel.svelte` uses `useQuery(api.trends.getTrendTopics, { limit: 10 })`; rows show keyword, momentum score with text + `aria-label`, and source badges with visible labels (`google_trends`, `reddit`, `news` or friendly equivalents) (FR28–FR30, UX-DR3, UX-DR6, UX-DR10).

2. **Remove stub chrome (AC: stub)** — When at least one topic has `lastUpdated` within 2 hours, remove em-dash placeholder metrics and the **Coming in Epic 44** badge (FR35, UX-DR4).

3. **Empty state (AC: empty)** — When no topics returned, show actionable copy referencing `~/.hermes/trend-watchlist.yaml` and trend ingest cron setup — no mock metric rows (FR34, UX-DR5).

4. **Source health strip (AC: health)** — Panel footer lists `getSignalSources` rows with text status labels (`ok` / `partial` / `error`) and last-run time (FR36, UX-DR11).

5. **Trust boundary (AC: boundary)** — No `fetch` to Google, Reddit, or News; no vault path strings in new `src/` code (FR41, NFR-I4).

6. **Build gate (AC: build)** — `npm run check`, `npm run build`, `npm test` pass in cns-dashboard; `bash scripts/verify.sh` green in Omnipotent.md.

## Tasks / Subtasks

- [x] Add `src/lib/types/trend-panel.ts` and `src/lib/utils/trend-panel-format.ts` with Vitest coverage (AC: topics, stub, health)
- [x] Wire `TrendStubPanel.svelte` to `useQuery` for topics + sources (AC: topics, empty, health, boundary)
- [x] Remove placeholder metrics / Epic 44 badge when recent live data exists (AC: stub)
- [x] Run `npm run check && npm run build && npm test` in cns-dashboard (AC: build)
- [x] Run `bash scripts/verify.sh` in Omnipotent.md (AC: build)
- [x] Update sprint-status → `review`

## Dev Notes

### Query wiring

```svelte
const trendTopics = useQuery(api.trends.getTrendTopics, { limit: 10 });
const signalSources = useQuery(api.trends.getSignalSources, {});
```

### Recent data (UX-DR4)

Treat `lastUpdated` as recent when `now - lastUpdated <= 2 * 60 * 60 * 1000` (matches slowest google_trends cron window per architecture C8).

### Momentum presentation (5.1 scope)

- `momentumScore >= 0.05` → label **Active** (text, not color-only)
- else → **Flat**
- Empty table → **No ingest data** empty state (FR31 partial; 44-5-2 deepens stale/error per topic)

### Source badge labels (NFR-A2)

| source | Display |
|--------|---------|
| google_trends | Google Trends |
| reddit | Reddit |
| news | News |

### Operator guide

No update required until 44-5-2 (panel troubleshooting copy may expand).

## Dev Agent Record

### Agent Model Used

Composer (Cursor)

### Debug Log

- Sprint had no `ready-for-dev` entry; 44-4-2 in `review`. Story 44-5-1 created at dev start per Epic 44 Story 5.1.

### Completion Notes List

- Wired `TrendStubPanel` to `getTrendTopics` (limit 10) and `getSignalSources` via `convex-svelte` `useQuery` — real-time subscription, no external API calls.
- Replaced em-dash mock rows with live topic list or actionable empty state (watchlist + env + cron install).
- Epic 44 badge hidden when `hasRecentTrendData` (any topic `lastUpdated` within 2h).
- Added ingest health footer with text status badges and last-run labels.
- Extracted formatters to `trend-panel-format.ts` with 5 Vitest cases; fixed pre-existing `svelte-check` error in `trend-validators.test.ts` (invalid insert cast).
- cns-dashboard: 57 tests pass; check + build OK. Omnipotent `scripts/verify.sh`: VERIFY PASSED.
- Code review: surfaced `getSignalSources` query failure in ingest health footer when topics query succeeds.

### File List

**cns-dashboard** (`/home/christ/ai-factory/projects/cns-dashboard/`):

- `src/lib/types/trend-panel.ts` (new)
- `src/lib/utils/trend-panel-format.ts` (new)
- `src/lib/components/panels/TrendStubPanel.svelte` (modified)
- `tests/lib/trend-panel-format.test.ts` (new)
- `tests/convex/trend-validators.test.ts` (modified — svelte-check fix)

**Omnipotent.md**:

- `_bmad-output/implementation-artifacts/44-5-1-wire-trend-stub-panel-live-convex-queries.md` (new)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)

### Change Log

- 2026-05-26: Story 44-5-1 created at dev start; implemented live Trend panel wire-up in cns-dashboard; status → review.
- 2026-05-26: Code review batch-fix — ingest health footer shows error when `getSignalSources` fails; status → done.

### Review Findings

- [x] [Review][Patch] Surface `getSignalSources` query failures [`TrendStubPanel.svelte:33-39`]
- [x] [Review][Defer] Split unrelated `docs/DEPLOY.md` cron troubleshooting from 44-5-1 commit — out of story file list
- [x] [Review][Defer] Footer omits `errorCount` / `lastError` on source rows (FR36 full detail) — deferred to 44-5-2 per story out-of-scope
