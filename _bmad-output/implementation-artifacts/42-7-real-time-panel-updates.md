---
story_id: 42-7
epic: 42
planning_epic: "Epic 42 / internal Epic 2 Story 2.3"
title: real-time-panel-updates
status: review
output_repo: cns-dashboard
cns_repo_touch: none
---

# Story 42.7: Real-time panel updates via Convex subscriptions

Status: done

**Planning map:** Epic 42 **Epic 2** Story **2.3** — `42-7-real-time-panel-updates`. Wires **Epic 3** panel bodies (FR5–FR19) via one shell subscription (FR28).

## Story

As a **CNS operator**,
I want **panels to update automatically after each sync push**,
so that **I never manually refresh during routine monitoring**.

## Context

| Topic | Detail |
|-------|--------|
| **Output repo** | `cns-dashboard` at `/home/christ/ai-factory/projects/cns-dashboard` |
| **CNS repo touch** | **None** |
| **Depends on** | 42-6 shell `useQuery`, 42-2 `getDashboardSnapshot`, 42-4 sync |
| **Out of scope** | `searchNotes` / VaultSearch UI (Epic 4); trend Epic 44 badge (42-8); Vercel deploy (42-9); Hermes watchdog row (not in Convex schema yet) |

### Scope boundary

| In scope (42-7) | Out of scope |
|-----------------|--------------|
| Single `useQuery` in shell; pass slices as props (no per-panel queries) | Second `useQuery` per panel or polling |
| Live `VaultHealthPanel`, `McpStatusPanel`, `HermesFeedPanel`, `RunChainPanel` | `VaultSearchPanel` search behavior |
| `panel-format.ts` + unit tests | Watchdog cron UI (FR15 — no sync field) |
| Empty/loading states; last-known data when stale (NFR-R3) | Trend badge copy (42-8) |

## Acceptance Criteria

1. **Subscription (AC: subscribe)**  
   **Given** `convex-svelte` is configured and `getDashboardSnapshot` returns data  
   **When** a sync push updates Convex  
   **Then** subscribed panels reflect new data without page reload (FR28, NFR-P3; UX-DR14)  
   **And** implementation uses **one** `useQuery(getDashboardSnapshot)` in `DashboardShell` — no polling interval.

2. **Vault health (AC: vault)**  
   **When** `vaultHealth` is populated  
   **Then** `VaultHealthPanel` shows note count, lint ERRORS/WARNINGS, inbox depth, PAKE distribution, and `lintStale` indicator (FR5–FR9; UX-DR10).

3. **MCP status (AC: mcp)**  
   **When** `mcpStatus` has seven rows  
   **Then** `McpStatusPanel` shows vault-io `lastCallAt` and others as configured/status unknown without fabricated timestamps (FR10–FR12)  
   **And** each row shows badge text **and** color styling (FR13, NFR-A3 partial; UX-DR7).

4. **Hermes feed (AC: feed)**  
   **When** `agentLogEntries` exist  
   **Then** `HermesFeedPanel` lists up to 20 entries with timestamp, action, tool, surface, target path, summary (FR14, FR16; UX-DR9).

5. **Run chain (AC: runchain)**  
   **When** `runChainStatus` exists  
   **Then** `RunChainPanel` shows state and last run / synthesis title or em-dash when missing (FR17–FR19; UX-DR11).

6. **Placeholders (AC: defer)**  
   **Then** `VaultSearchPanel` and `TrendStubPanel` remain non-search / non-trend placeholders.

7. **Build gate (AC: build)**  
   **Then** `npm run check`, `npm run build`, `npm test` pass in `cns-dashboard`; `bash scripts/verify.sh` green in Omnipotent.md.

8. **Standing task: Operator guide**  
   **Then** note "Operator guide: no update required" until 42-9.

## Tasks / Subtasks

- [x] Add `src/lib/types/dashboard-snapshot.ts` and `src/lib/utils/panel-format.ts` + `tests/lib/panel-format.test.ts`
- [x] Wire `DashboardShell.svelte` — pass snapshot slices + loading/error to four ops panels (AC: subscribe)
- [x] Implement `VaultHealthPanel.svelte` (AC: vault)
- [x] Implement `McpStatusPanel.svelte` (AC: mcp)
- [x] Implement `HermesFeedPanel.svelte` (AC: feed)
- [x] Implement `RunChainPanel.svelte` (AC: runchain)
- [x] Keep `VaultSearchPanel` / `TrendStubPanel` placeholders (AC: defer)
- [x] Boundary grep on `src/` (trust boundary)
- [x] Run `npm run check && npm run build && npm test` in `cns-dashboard` (AC: build)
- [x] Standing task: Operator guide — no update required (AC: standing)

## Dev Notes

- Context7: `/get-convex/convex-svelte` — `useQuery` returns `{ data, isLoading, error, isStale }`; pass props to children.
- Reuse `formatLastSyncAt` from `sync-freshness.ts` for panel timestamps.
- MCP row `badge` field is display text from sync; map status to Tailwind badge colors.
- Import api path unchanged: `../../../convex/_generated/api.js` from `DashboardShell.svelte`.

## Dev Agent Record

### Agent Model Used

Composer (Cursor)

### Debug Log References

- Trust boundary grep: zero forbidden vault/MCP path strings in `src/`.
- `cns-dashboard`: 22 tests pass (5 panel-format + 12 sync-freshness + 5 convex).
- `bash scripts/verify.sh`: VERIFY PASSED.

### Completion Notes List

- One `useQuery(getDashboardSnapshot)` in shell; four ops panels receive props (no per-panel queries, no polling).
- Vault health, MCP (7 rows + dual-encoded badges), Hermes feed (20 entries), run-chain panels show live Convex data.
- Loading/error/empty states preserve last-known data when stale banner is shown (NFR-R3).
- FR15 watchdog UI deferred — not present in `DashboardSnapshot` schema.
- Operator guide: no update required until 42-9 deploy.
- Code review: NFR-R3 panel error guard, Hermes each-key, `mcpBadgeClass` fallback, PAKE count sanitize; 24 tests pass.

### File List

**cns-dashboard:**

- `src/lib/types/dashboard-snapshot.ts` (new)
- `src/lib/utils/panel-format.ts` (new)
- `tests/lib/panel-format.test.ts` (new)
- `src/lib/components/DashboardShell.svelte` (modified)
- `src/lib/components/panels/VaultHealthPanel.svelte` (modified)
- `src/lib/components/panels/McpStatusPanel.svelte` (modified)
- `src/lib/components/panels/HermesFeedPanel.svelte` (modified)
- `src/lib/components/panels/RunChainPanel.svelte` (modified)

**Omnipotent.md:**

- `_bmad-output/implementation-artifacts/42-7-real-time-panel-updates.md` (new)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)

## Change Log

- 2026-05-25: Story created; dev-story 42-7 started.
- 2026-05-25: Live panel wiring + format helpers; 22 tests pass; status → review.
- 2026-05-25: BMAD code review — batch-applied 4 patches; 24 tests pass; status → done.

### Review Findings

- [x] [Review][Patch] Suppress panel error copy when snapshot still has data (NFR-R3) [`DashboardShell.svelte:36`]
- [x] [Review][Patch] Strengthen Hermes feed `{#each}` key to avoid duplicate-key collisions [`HermesFeedPanel.svelte:33`]
- [x] [Review][Patch] Add `mcpBadgeClass` fallback for unexpected `status` values [`panel-format.ts:28-30`]
- [x] [Review][Patch] Sanitize PAKE distribution counts in `sortedPakeEntries` [`panel-format.ts:56-61`]

- [x] [Review][Defer] No Svelte component/integration tests for panel wiring — deferred, matches 42-6 scope (pure-helper unit tests only) — [story scope]
- [x] [Review][Defer] `dashboard-snapshot.ts` types maintained separately from Convex validators — deferred, acceptable until codegen — [`dashboard-snapshot.ts`]
- [x] [Review][Defer] No `aria-live` region on panels for subscription-driven updates — deferred, NFR-A3 polish — [panel components]
