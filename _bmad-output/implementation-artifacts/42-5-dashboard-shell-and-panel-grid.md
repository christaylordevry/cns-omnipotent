---
story_id: 42-5
epic: 42
planning_epic: "Epic 42 / internal Epic 2 Story 2.1"
title: dashboard-shell-and-panel-grid
status: done
output_repo: cns-dashboard
cns_repo_touch: none
---

# Story 42.5: Dashboard shell and panel grid

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

**Planning map:** Epic 42 **Epic 2** Story **2.1** — `42-5-dashboard-shell-and-panel-grid`.

## Story

As a **CNS operator**,
I want **a single-page dashboard with dark theme and six panel slots on a desktop grid**,
so that **I have one situational-awareness surface without navigating between apps**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 42: CNS Dashboard Web App |
| **Sub-epic** | Epic 2 (Operator Dashboard Access & Trust Chrome) — **first UI story** |
| **Output repo** | `cns-dashboard` at `/home/christ/ai-factory/projects/cns-dashboard` |
| **CNS repo touch** | **None** — `Omnipotent.md` diff should be story artifacts only; `bash scripts/verify.sh` must stay green |
| **Depends on** | 42-1 scaffold, 42-2 `getDashboardSnapshot`, 42-4 sync push (for manual seed verification) |
| **Next stories** | 42-6 StaleBanner + last-sync chrome; 42-7 `useQuery` live data; 42-8 trend Epic 44 badge; 42-9 Vercel deploy |

### Scope boundary (critical)

| In scope (42-5) | Out of scope (later stories) |
|-----------------|----------------------------|
| `DashboardShell.svelte` + responsive CSS grid (FR2, FR4) | `StaleBanner.svelte` + stale logic (42-6, FR27) |
| Six **placeholder** panel components mounting in grid (UX-DR3) | `useQuery(getDashboardSnapshot)` / live Convex data (42-7, FR28) |
| Dark theme already on `<html class="dark">` — extend panel card tokens (FR3, UX-DR2) | Trend **"Coming in Epic 44"** badge copy (42-8, FR31–32) |
| Header chrome: title + **stub** last-sync slot (`—` or "Not wired") | Real `syncMetadata` timestamp display (42-6, FR26) |
| `+page.svelte` composes shell only | `searchNotes`, `obsidian-uri.ts`, VaultSearch behavior (Epic 4 / 42-10+) |
| `npm run check`, `build`, `test` in `cns-dashboard` | Vercel production deploy (42-9) |
| Grep gate: zero vault/MCP paths in `src/` (FR34, NFR-S5, NFR-I4) | Panel business logic (Epic 3 stories 42-10+) |

**AC interpretation:** Planning AC says "Given Convex has been seeded" — use that for **manual smoke** after `npx tsx scripts/dashboard-sync.ts`, but placeholders **must render** even when Convex tables are empty (no `useQuery` yet).

## Acceptance Criteria

1. **Shell layout (AC: shell)**  
   **Given** the app is served at `/` (local or preview)  
   **When** viewport width is ≥1280px  
   **Then** `DashboardShell` renders a **2–3 column** CSS grid with all six panels visible on one page without route changes and **without horizontal scroll** (FR2, FR4; UX-DR1, UX-DR3)  
   **And** narrower desktop widths may collapse to a single column without breaking layout.

2. **Dark theme (AC: theme)**  
   **When** the dashboard loads  
   **Then** dark theme remains default (`class="dark"` on `<html>` from 42-1) and panel cards use sufficient contrast for body text on `bg-gray-950` / card surfaces (FR3, UX-DR2, NFR-A1 partial).

3. **Placeholder panels (AC: panels)**  
   **When** the grid mounts  
   **Then** these six components exist under `src/lib/components/panels/` and each shows a visible panel title + placeholder body (no live metrics):  
   `VaultHealthPanel`, `McpStatusPanel`, `HermesFeedPanel`, `RunChainPanel`, `VaultSearchPanel`, `TrendStubPanel`  
   **And** `+page.svelte` imports only `DashboardShell` (shell imports panels).

4. **Trust boundary (AC: boundary)**  
   **When** searching `cns-dashboard/src/`  
   **Then** **zero** matches for: `CNS_VAULT_ROOT`, `Knowledge-Vault-ACTIVE`, `agent-log`, `/mnt/c/`, `obsidian://`, MCP server names used as endpoints, or filesystem vault paths (FR34, NFR-S5, NFR-I4).

5. **Build gate (AC: build)**  
   **When** implementation completes  
   **Then** `npm run check`, `npm run build`, and `npm test` pass in `cns-dashboard`  
   **And** `bash scripts/verify.sh` passes in `Omnipotent.md` with no changes outside `_bmad-output/` (and optional sprint-status).

6. **Standing task: Operator guide**  
   **When** shipped  
   **Then** note "Operator guide: no update required" in Dev Agent Record — UI not yet deployed to production (42-9).

## Tasks / Subtasks

- [x] Add `src/lib/components/DashboardShell.svelte` — header (title + stub last-sync), `<main>` grid, semantic landmarks (AC: shell, theme)
- [x] Add six panel files under `src/lib/components/panels/*.svelte` with shared card styling pattern (AC: panels)
- [x] Replace centered placeholder in `src/routes/+page.svelte` with `<DashboardShell />` (AC: shell)
- [x] Tailwind grid: e.g. `grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3 max-w-[1600px] mx-auto` — verify at 1280px in browser (AC: shell)
- [x] Run boundary grep on `src/`; fix any accidental vault/MCP strings (AC: boundary)
- [x] Run `npm run check && npm run build && npm test` in `cns-dashboard` (AC: build)
- [x] Optional smoke: with `npx convex dev` + sync env, run `npx tsx ../Omnipotent.md/scripts/dashboard-sync.ts` and confirm layout still renders (AC: shell manual)
- [x] Standing task: Operator guide — no update required (AC: standing)

### Review Findings

- [x] [Review][Patch] Commit `cns-dashboard` implementation — eight UI files are modified/untracked on `master` with no `feat:` commit; story Dev Notes expect a sibling-repo commit before marking done.
- [x] [Review][Patch] Trim `TrendStubPanel` placeholder copy — Dev Notes scope says "minimal placeholder title only"; body references Epic 44/42-8 (defer badge to 42-8). [`TrendStubPanel.svelte`:7-8]
- [x] [Review][Patch] Guard FR4 horizontal scroll at shell root — add `overflow-x-hidden` on `DashboardShell` outer wrapper so future wide panel content cannot introduce page-level scroll. [`DashboardShell.svelte`:10]
- [x] [Review][Defer] Add `<svelte:head><title>` for browser tab — not required by 42-5 AC; defer to accessibility polish story. — deferred, pre-existing gap from 42-1 scaffold
- [x] [Review][Defer] Vite Node.js ≥20.19 warning during build — environment/toolchain, not introduced by 42-5 UI. — deferred, pre-existing

## Dev Notes

### Current repo state (do not redo)

| Artifact | Status |
|----------|--------|
| `src/routes/+layout.svelte` | `setupConvex(PUBLIC_CONVEX_URL)` already wired [42-1] |
| `src/app.html` | `<html class="dark">` [42-1] |
| `src/routes/+page.svelte` | **Replace** centered "CNS Dashboard" h1 with shell |
| `convex/dashboard.ts` | `getDashboardSnapshot` exists — **do not call from panels in 42-5** |
| `src/routes/layout.css` | Tailwind v4 `@import 'tailwindcss'` |

### Target file tree (this story only)

```text
cns-dashboard/src/
├── routes/
│   └── +page.svelte              # <DashboardShell />
└── lib/
    └── components/
        ├── DashboardShell.svelte
        └── panels/
            ├── VaultHealthPanel.svelte
            ├── McpStatusPanel.svelte
            ├── HermesFeedPanel.svelte
            ├── RunChainPanel.svelte
            ├── VaultSearchPanel.svelte
            └── TrendStubPanel.svelte
```

[Source: `architecture-epic-42-cns-dashboard.md` § Project Structure]

### Layout implementation hints

- **Grid:** UX-DR1 — 2–3 columns at ≥1280px. Suggested: `grid-cols-1 md:grid-cols-2 xl:grid-cols-3` with consistent `gap-4` and `min-w-0` on panels to prevent overflow.
- **Panel card:** `rounded-lg border border-gray-800 bg-gray-900/80 p-4` + `<h2 class="text-sm font-medium text-gray-200">` per panel; body `text-gray-400 text-sm`.
- **Placeholder copy:** e.g. "Live metrics in Story 42-7" — avoid implying fake data counts.
- **Header stub:** `Last sync: —` satisfies UX-DR4 shell chrome until 42-6 wires `syncMetadata`.
- **VaultSearchPanel:** placeholder only — no input, no debounce, no `obsidian-uri.ts` (UX-DR6 is Epic 4).
- **TrendStubPanel:** minimal placeholder title only; Epic 44 badge is **42-8**.

### Svelte 5 + convex-svelte (for 42-7, not this story)

`setupConvex` is already in `+layout.svelte`. **Do not** add `useQuery` yet.

When 42-7 implements live data:

```svelte
import { useQuery } from 'convex-svelte';
import { api } from '../../convex/_generated/api.js';

const snapshot = useQuery(api.dashboard.getDashboardSnapshot, {});
```

[Source: Context7 `/get-convex/convex-svelte` — `useQuery` pattern]

### Architecture compliance

| Rule | 42-5 action |
|------|-------------|
| Browser never reads vault/MCP | Placeholders only; no `fetch` to local paths |
| CNS repo unchanged | No `scripts/dashboard-sync.ts` edits |
| Naming | `PascalCase.svelte` panels [architecture naming patterns] |
| FR mapping | FR2–FR4, FR34 in this story; FR26–FR28 deferred to 42-6–42-7 |

### Testing requirements

| Check | Command |
|-------|---------|
| Typecheck | `npm run check` |
| Production build | `npm run build` |
| Convex contract tests | `npm test` (existing `tests/convex/dashboard.test.ts` — must still pass) |
| Trust boundary | `rg -i 'CNS_VAULT_ROOT|Knowledge-Vault|agent-log|/mnt/c/|obsidian://' src/` → no matches |
| CNS gate | `bash scripts/verify.sh` from Omnipotent.md |

Component unit tests for Svelte panels are **optional** (not in AC); do not add `@testing-library/svelte` unless operator approves new devDependency.

### Previous story intelligence (42-4)

- Sync runs every 3 min via Hermes cron; `ingestDashboardSnapshot` populates Convex when env is set.
- Manual seed for layout smoke: `source ~/.hermes/dashboard-sync.env && npx tsx scripts/dashboard-sync.ts` from Omnipotent.md (no push if `--no-push` — use full push for Convex data).
- Review pattern: keep CNS diff zero; all UI work in sibling `cns-dashboard` repo; commit there separately from Omnipotent.md story artifacts.

### Git intelligence

Latest Omnipotent.md commit: `2bee82f` — Epic 42 stories 42-1–42-4 (scaffold, schema, sync, cron). **First dashboard UI commit** should live in **`cns-dashboard` git**, e.g. `feat: dashboard shell and six placeholder panels (Epic 42-5)`.

### Latest tech stack (pinned in repo)

| Package | Version |
|---------|---------|
| `svelte` | ^5.55.2 |
| `@sveltejs/kit` | ^2.57.0 |
| `convex` | ^1.39.1 |
| `convex-svelte` | ^0.0.12 |
| `tailwindcss` | ^4.2.2 |

Use Context7 (`/get-convex/convex-svelte`, `/websites/svelte_dev_kit`) before changing layout or Convex wiring.

### Project structure notes

- `cns-dashboard` is a **sibling repo**, not a subdirectory of Omnipotent.md.
- CI (`.github/workflows/ci.yml`) still deferred to 42-9 — not required for 42-5 AC.

### References

- [Source: `_bmad-output/planning-artifacts/epics-epic-42-cns-dashboard.md` § Epic 2 Story 2.1]
- [Source: `_bmad-output/planning-artifacts/architecture-epic-42-cns-dashboard.md` § Project Structure, Naming, Anti-Patterns]
- [Source: `_bmad-output/planning-artifacts/prd-epic-42-cns-dashboard.md` § Responsive Design, Accessibility]
- [Source: `_bmad-output/implementation-artifacts/42-1-scaffold-cns-dashboard-repository.md`]
- [Source: `_bmad-output/implementation-artifacts/42-4-sync-push-secret-guard-hermes-cron.md`]
- [Source: Context7 `/get-convex/convex-svelte` — setupConvex, useQuery (42-7)]

## Standing tasks (every story)

### Standing task: Update operator guide

- [x] If this story changes any user-facing behavior (new tool, new workflow, new constraint, new panel, new integration): update `03-Resources/CNS-Operator-Guide.md` via vault MCP.
- [x] If no user-facing behavior changed: note "Operator guide: no update required" in Dev Agent Record.

## Dev Agent Record

### Agent Model Used

Composer (Cursor)

### Debug Log References

- Trust boundary grep on `cns-dashboard/src/`: zero matches.
- `npm run check`, `build`, `test` in cns-dashboard: all pass (5 convex tests).
- `bash scripts/verify.sh` in Omnipotent.md: VERIFY PASSED.

### Implementation Plan

- `DashboardShell`: header with title + `Last sync: —` stub; `<main>` with `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`, `max-w-[1600px]`, `min-w-0` on panels.
- Six placeholder panels with shared card tokens (`border-gray-800`, `bg-gray-900/80`, contrast-safe text).
- `+page.svelte` imports only `DashboardShell`; no `useQuery` (deferred to 42-7).

### Completion Notes List

- Implemented first dashboard UI in sibling `cns-dashboard` repo: shell + six placeholder panels.
- Responsive grid: 1 col mobile, 2 cols `md`, 3 cols `xl` (≥1280px) per UX-DR1.
- Operator guide: **no update required** — UI not deployed to production until 42-9.
- Optional Convex seed smoke skipped in CI; placeholders render without live data per AC.

### File List

**cns-dashboard** (sibling repo):

- `src/lib/components/DashboardShell.svelte` (new)
- `src/lib/components/panels/VaultHealthPanel.svelte` (new)
- `src/lib/components/panels/McpStatusPanel.svelte` (new)
- `src/lib/components/panels/HermesFeedPanel.svelte` (new)
- `src/lib/components/panels/RunChainPanel.svelte` (new)
- `src/lib/components/panels/VaultSearchPanel.svelte` (new)
- `src/lib/components/panels/TrendStubPanel.svelte` (new)
- `src/routes/+page.svelte` (modified)

**Omnipotent.md**:

- `_bmad-output/implementation-artifacts/42-5-dashboard-shell-and-panel-grid.md` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)

## Change Log

- 2026-05-24: Story created (ready-for-dev).
- 2026-05-24: Implemented dashboard shell and six placeholder panels in cns-dashboard; status → review.
- 2026-05-25: Code review (3 layers) — 3 patch applied (batch), 2 defer, 7 dismissed; status → done.
