---
story_id: 42-8
epic: 42
planning_epic: "Epic 42 / internal Epic 2 Story 2.4"
title: trend-stub-panel
status: done
output_repo: cns-dashboard
cns_repo_touch: none
---

# Story 42.8: Trend intelligence stub panel

Status: done

**Planning map:** Epic 42 **Epic 2** Story **2.4** — `42-8-trend-stub-panel`. Completes FR31–FR32 / UX-DR8 without Epic 44 backend work.

## Story

As a **CNS operator**,
I want **a trend panel that clearly defers real analytics to Epic 44**,
so that **the six-panel layout is complete without scope creep**.

## Context

| Topic | Detail |
|-------|--------|
| **Output repo** | `cns-dashboard` at `/home/christ/ai-factory/projects/cns-dashboard` |
| **CNS repo touch** | **None** |
| **Depends on** | 42-5 `TrendStubPanel` shell slot, 42-7 live ops panels |
| **Out of scope** | Convex tables, sync collectors, Epic 44 trend engine, `useQuery` wiring |

### Scope boundary

| In scope (42-8) | Out of scope |
|-----------------|--------------|
| Static mock metrics in `TrendStubPanel.svelte` | Live trend queries or Convex schema |
| Visible **"Coming in Epic 44"** badge (FR32) | VaultSearch search behavior |
| Panel title + subtitle clarifying placeholder | Vercel deploy (42-9) |

## Acceptance Criteria

1. **Placeholder content (AC: mock)**  
   **When** I view the trend panel on the dashboard grid  
   **Then** I see labeled placeholder/mock metric rows (not fabricated live counts) and copy that states analytics ship in Epic 44 (FR31; UX-DR8).

2. **Epic 44 badge (AC: badge)**  
   **When** the panel renders  
   **Then** an explicit **"Coming in Epic 44"** badge is visible in the panel header area with badge styling consistent with other panels (FR32; NFR-A3 partial).

3. **No backend (AC: static)**  
   **Then** no new Convex tables, mutations, sync script changes, or `useQuery` calls are added for trend data.

4. **Trust boundary (AC: boundary)**  
   **When** searching `cns-dashboard/src/`  
   **Then** zero forbidden vault/MCP path strings are introduced.

5. **Build gate (AC: build)**  
   **Then** `npm run check`, `npm run build`, `npm test` pass in `cns-dashboard`; `bash scripts/verify.sh` green in Omnipotent.md.

6. **Standing task: Operator guide**  
   **Then** note "Operator guide: no update required" until 42-9.

## Tasks / Subtasks

- [x] Implement `TrendStubPanel.svelte` mock layout + Epic 44 badge (AC: mock, badge)
- [x] Confirm `DashboardShell` still mounts panel without props (AC: static)
- [x] Boundary grep on `src/` (AC: boundary)
- [x] Run `npm run check && npm run build && npm test` in `cns-dashboard` (AC: build)
- [x] Standing task: Operator guide — no update required (AC: standing)

### Review Findings

- [x] [Review][Patch] Screen readers cannot perceive metric values [`TrendStubPanel.svelte:31`] — fixed: `aria-label="Unavailable"` on `<dd>`, removed `aria-hidden`.

## Dev Notes

- Reuse badge ring pattern from `McpStatusPanel` / `RunChainPanel` (`ring-1 ring-inset`, sky or violet accent for “coming soon”).
- Mock rows: use em-dash `—` for values; labels like “7-day quality trend”, “Research velocity”, “Open knowledge seeds” — clearly illustrative.
- Do **not** imply real synced numbers (42-5 review: avoid fake data counts).
- Title: **Trend Intelligence** (matches FR31 wording).

## Dev Agent Record

### Agent Model Used

Composer (Cursor)

### Completion Notes List

- `TrendStubPanel` shows three em-dash placeholder metrics and a violet **Coming in Epic 44** badge; no Convex or `useQuery` changes.
- Trust boundary grep: zero forbidden strings in `src/`.
- `cns-dashboard`: 24 tests pass; `bash scripts/verify.sh`: VERIFY PASSED.
- Operator guide: no update required until 42-9 deploy.

### File List

**cns-dashboard:**

- `src/lib/components/panels/TrendStubPanel.svelte` (modified)

**Omnipotent.md:**

- `_bmad-output/implementation-artifacts/42-8-trend-stub-panel.md` (new)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)

### Change Log

- 2026-05-25: Story created; dev-story 42-8 started after 42-7 done.
- 2026-05-25: Trend stub UI implemented; status → review.
- 2026-05-26: Code review patch (dd `aria-label="Unavailable"`); status → done.
