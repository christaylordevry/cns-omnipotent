---
story_id: 44-5-2
epic: 44
planning_epic: "Epic 44 / Epic 5 Story 5.2"
title: flat-active-stale-signal-states-ui
status: done
output_repo: cns-dashboard
cns_repo_touch: none
---

# Story 44-5-2: Flat, active, and stale signal states in UI

Status: done

**Planning map:** Epic 44 Story 5.2 — `44-5-2-flat-active-stale-signal-states-ui`.

## Story

As a **CNS operator**,
I want **to tell flat signal from broken ingest and see stale sources**,
So that **I skip run-chain on cold topics with confidence**.

## Context

| Topic | Detail |
|-------|--------|
| **Output repo** | `cns-dashboard` at `/home/christ/ai-factory/projects/cns-dashboard` |
| **CNS repo touch** | **None** — sprint/story artifacts only in Omnipotent.md |
| **Depends on** | 44-5-1 (live panel wire-up, formatters baseline) |
| **Normative** | `epics-epic-44-trend-intelligence-layer-1.md` Story 5.2; FR31–FR32, FR36–FR37; UX-DR7–DR9, UX-DR11; NFR-A1–A3, NFR-P4 |
| **Out of scope** | Convex schema/query changes, Python ingest, vault writes |

## Acceptance Criteria

1. **Flat vs active (AC: flat-active)** — Topic rows with healthy ingest and `momentumScore < 0.05` read as neutral **Flat** (text + styling), not as empty/no-data. Active rows use distinct **Active** presentation with text label (FR31, UX-DR7).

2. **No ingest per topic (AC: no-ingest-row)** — Topic in list with empty `sourceBreakdown` and no contributing sources shows **Awaiting signals** (or equivalent) — distinct from **Flat** (FR31).

3. **Stale sources (AC: stale)** — Per-source badges show **Stale** text when `sourceBreakdown[].stale` is true (FR32, UX-DR8).

4. **Footer health detail (AC: footer)** — Ingest health footer shows `errorCount` and truncated `lastError` when present on `signalSources` rows (FR36–FR37, UX-DR11; closes 44-5-1 defer).

5. **Accessibility (AC: a11y)** — Section `aria-labelledby`; momentum `aria-label` includes presentation state; source badges have text status not color-only (NFR-A1–A3, UX-DR9).

6. **Build gate (AC: build)** — `npm run check`, `npm run build`, `npm test` pass in cns-dashboard; `bash scripts/verify.sh` green in Omnipotent.md.

## Tasks / Subtasks

- [x] Extend `trend-panel-format.ts` with topic presentation state, stale badge labels, source health detail (AC: flat-active, no-ingest-row, stale, footer)
- [x] Update `TrendStubPanel.svelte` row + footer presentation (AC: flat-active, stale, footer, a11y)
- [x] Vitest coverage for new formatters (AC: build)
- [x] Run check/build/test + `scripts/verify.sh` (AC: build)
- [x] Update sprint-status; mark Epic 44 done

## Dev Notes

### Presentation states (UX-DR7)

| State | Condition |
|-------|-----------|
| `awaiting` | `sourceBreakdown.length === 0` and `sources.length === 0` |
| `flat` | Has ingest signals, `momentumScore < 0.05` |
| `active` | `momentumScore >= 0.05` |

### Stale badge (UX-DR8)

Append visible **Stale** on badge when breakdown entry `stale === true`.

### Footer (FR36)

When `errorCount > 0`, show `N error(s)`; when `lastError`, show truncated operator-safe line (max ~80 chars).

## Dev Agent Record

### Agent Model Used

Composer (Cursor)

### Debug Log

- Story created and implemented in same session after 44-5-1 production validation (live panel, no stub badge).

### Completion Notes List

- Three topic presentation states: **Awaiting signals**, **Flat** (neutral gray), **Active** (emerald text) — distinct from panel-level empty state.
- Source badges show `· Stale` suffix and amber styling when `sourceBreakdown.stale`.
- Ingest health footer surfaces `errorCount` and truncated `lastError` per source row.
- `aria-describedby` on live panel; momentum `aria-label` uses topic-aware state.
- cns-dashboard: 60 tests pass; Omnipotent `scripts/verify.sh`: VERIFY PASSED.
- Epic 44 marked **done** in sprint-status (44-4-2 remains `review` — seven-day reliability doc).

### File List

**cns-dashboard** (`/home/christ/ai-factory/projects/cns-dashboard/`):

- `src/lib/types/trend-panel.ts` (modified — `TrendTopicSourceBreakdown` type)
- `src/lib/utils/trend-panel-format.ts` (modified)
- `src/lib/components/panels/TrendStubPanel.svelte` (modified)
- `tests/lib/trend-panel-format.test.ts` (modified)

**Omnipotent.md**:

- `_bmad-output/implementation-artifacts/44-5-2-flat-active-stale-signal-states-ui.md` (new)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified)

### Change Log

- 2026-05-26: Story 44-5-2 — flat/active/awaiting topic states, stale source badges, ingest footer error detail; Epic 44 closed.
