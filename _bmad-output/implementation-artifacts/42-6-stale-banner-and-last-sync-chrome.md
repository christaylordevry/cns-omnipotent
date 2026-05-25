---
story_id: 42-6
epic: 42
planning_epic: "Epic 42 / internal Epic 2 Story 2.2"
title: stale-banner-and-last-sync-chrome
status: done
output_repo: cns-dashboard
cns_repo_touch: none
---

# Story 42.6: Sync freshness chrome and StaleBanner

Status: done

**Planning map:** Epic 42 **Epic 2** Story **2.2** — `42-6-stale-banner-and-last-sync-chrome`.

## Story

As a **CNS operator**,
I want **to see when data was last synced and when it is stale**,
so that **I trust eventual consistency and detect sync failures early**.

## Context

| Topic | Detail |
|-------|--------|
| **Output repo** | `cns-dashboard` at `/home/christ/ai-factory/projects/cns-dashboard` |
| **CNS repo touch** | **None** — Omnipotent.md diff = story artifacts only |
| **Depends on** | 42-5 shell, 42-2 `getDashboardSnapshot`, 42-4 sync push |
| **Out of scope** | Panel live metrics (`useQuery` data in panels → 42-7); trend badge (42-8) |

### Scope boundary

| In scope (42-6) | Out of scope |
|-----------------|--------------|
| `StaleBanner.svelte` + stale logic (FR27, UX-DR5) | Wiring panel bodies to snapshot (42-7) |
| Header last-sync from `syncMetadata` (FR26, UX-DR4) | Vercel deploy (42-9) |
| `useQuery(getDashboardSnapshot)` in shell **only** for `syncMetadata` | New Convex tables/queries |
| Pure `sync-freshness.ts` + unit tests | Operator guide (not deployed) |

**Stale rule:** `now - lastSyncAt > 6 minutes` OR `lastSyncStatus !== "ok"` (architecture). Text labels on banner (NFR-A3 partial).

## Acceptance Criteria

1. **Last sync (AC: timestamp)**  
   **Given** `syncMetadata` exists in Convex  
   **When** the dashboard loads  
   **Then** the header shows a human-readable last successful sync time from `lastSyncAt` (FR26; UX-DR4)  
   **And** when `syncMetadata` is absent, the header shows `—` without fabricating a timestamp.

2. **Stale banner (AC: stale)**  
   **When** `now - lastSyncAt > 6 minutes` or `lastSyncStatus !== "ok"`  
   **Then** `StaleBanner` displays prominently below the header while the panel grid remains visible (FR27, NFR-R3; UX-DR5)  
   **And** stale/error states include explicit text labels, not color alone (NFR-A3 partial).

3. **Trust boundary (AC: boundary)**  
   **When** searching `cns-dashboard/src/`  
   **Then** zero forbidden vault/MCP path strings (same grep as 42-5).

4. **Build gate (AC: build)**  
   **Then** `npm run check`, `npm run build`, `npm test` pass in `cns-dashboard`; `bash scripts/verify.sh` green in Omnipotent.md.

5. **Standing task: Operator guide**  
   **Then** note "Operator guide: no update required" — not production-deployed until 42-9.

## Tasks / Subtasks

- [x] Add `src/lib/utils/sync-freshness.ts` — stale threshold, format timestamp, banner copy helpers
- [x] Add `tests/lib/sync-freshness.test.ts` — unit tests for stale/error/ok paths
- [x] Add `src/lib/components/StaleBanner.svelte` — `role="alert"`, text labels (AC: stale)
- [x] Wire `DashboardShell.svelte` — `useQuery(getDashboardSnapshot)`, header timestamp, banner (AC: timestamp, stale)
- [x] Boundary grep on `src/` (AC: boundary)
- [x] Run `npm run check && npm run build && npm test` in `cns-dashboard` (AC: build)
- [x] Standing task: Operator guide — no update required (AC: standing)

## Dev Notes

- `STALE_THRESHOLD_MS = 6 * 60 * 1000`
- Re-tick `now` on interval (~30s) so age-based staleness updates without reload
- Context7: `/get-convex/convex-svelte` — `useQuery` returns `{ data, isLoading, error }`
- Import api: `../../../convex/_generated/api.js` from `src/lib/components/`

## Dev Agent Record

### Agent Model Used

Composer (Cursor)

### Debug Log References

- Trust boundary grep: zero matches in `src/`.
- Tests: 14 passed (9 sync-freshness + 5 convex).
- `bash scripts/verify.sh`: VERIFY PASSED.

### Completion Notes List

- `useQuery(getDashboardSnapshot)` wired in shell only; panels remain placeholders (42-7).
- Stale banner: error status or age > 6 min; panels stay visible (NFR-R3).
- Header shows formatted `lastSyncAt` with `(stale)` / `(error)` suffixes; `—` when no metadata.
- Operator guide: no update required until 42-9 deploy.

### File List

**cns-dashboard:**

- `src/lib/utils/sync-freshness.ts` (new)
- `tests/lib/sync-freshness.test.ts` (new)
- `src/lib/components/StaleBanner.svelte` (new)
- `src/lib/components/DashboardShell.svelte` (modified)

**Omnipotent.md:**

- `_bmad-output/implementation-artifacts/42-6-stale-banner-and-last-sync-chrome.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-05-25: Story created and implementation started (dev-story after 42-5 done).
- 2026-05-25: Implemented StaleBanner + sync chrome; status → review.
- 2026-05-25: BMAD code review — batch-applied 6 patches + decision (A); 17 tests pass; status → done.

### Review Findings

- [x] [Review][Decision] Convex query error UX — Resolved (A): hide stale banner when `snapshot.error` — [`DashboardShell.svelte`]

- [x] [Review][Patch] Suppress stale banner when subscription errors [`DashboardShell.svelte:56-59`]
- [x] [Review][Patch] Treat clock-skew / future `lastSyncAt` as stale [`sync-freshness.ts:17-24`]
- [x] [Review][Patch] Guard non-finite `lastSyncAt` in header formatter [`sync-freshness.ts:50-54`]
- [x] [Review][Patch] Clamp negative age in stale banner detail copy [`sync-freshness.ts:42-46`]
- [x] [Review][Patch] Treat empty-string `lastSyncError` like missing detail [`sync-freshness.ts:35-39`]
- [x] [Review][Patch] Add unit test for `formatLastSyncLabel` `(error)` suffix [`tests/lib/sync-freshness.test.ts`]

- [x] [Review][Defer] 30s `nowMs` tick can lag staleness up to one interval — deferred, documented in Dev Notes — [`DashboardShell.svelte:22-27`]
- [x] [Review][Defer] Shell subscribes to full `getDashboardSnapshot` for metadata only — deferred, panels wire same query in 42-7 — [`DashboardShell.svelte:18`]
- [x] [Review][Defer] No component/integration tests for shell or `StaleBanner` — deferred, story scoped unit tests on pure helpers — [story scope]
- [x] [Review][Defer] Background-tab timer throttling for 30s interval — deferred, enhancement — [`DashboardShell.svelte:22-27`]
