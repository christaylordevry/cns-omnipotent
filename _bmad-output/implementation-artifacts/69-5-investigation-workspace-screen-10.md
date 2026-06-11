---
baseline_commit: 5d57b37
cns_dashboard_baseline: cf6296d
---

# Story 69.5: Investigation Workspace — Screen 10

Status: ready-for-dev

**Epic gate:** Requires **69-4 done** (digest feed + `digestSignal` inspector mode — "Add to investigate" attaches to feed cards and inspector). **69-4 is done** (`eae57d6` / `cf6296d` chain in cns-dashboard). Stories 69-1/69-2/69-3 are independent enrichments; board may ship without them but should not regress inspector actions.

**Scope note:** Epic 66 story **66-2** (Screen 10) was deferred; **Epic 69-5 is the normative delivery** per `prd-epic-69-2026-06-11/prd.md` §4.5. Route is `/nexus/investigate` (not Epic 66 draft `/nexus/orchestration`). After 69-5 ships, mark **66-2** `done` or `cancelled` with superseded-by note in sprint planning.

**Implementation repo:** `../cns-dashboard` only (Convex schema + SvelteKit UI). **No Omnipotent.md changes** — board consumes existing `digestSignals` and `investigationSessions`.

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a CNS operator running multi-day signal investigations,
I want a persistent kanban board at `/nexus/investigate` backed by Convex,
so that I can track signals under active investigation across browser sessions and link them to Epic 66 AI investigation sessions without relying on ephemeral drawer state alone.

## Acceptance Criteria

### AC1 — investigationBoardItems schema (FR-9)

**Given** the cns-dashboard Convex schema deploys  
**When** `investigationBoardItems` is added per addendum A5  
**Then** the table shape is:

```typescript
investigationBoardItems: defineTable({
  digestSignalId: v.id('digestSignals'),
  digestRunId: v.id('digestRuns'),
  column: v.union(
    v.literal('triage'),
    v.literal('investigating'),
    v.literal('waiting'),
    v.literal('resolved')
  ),
  note: v.optional(v.string()),
  addedAt: v.number(),
  updatedAt: v.number(),
  workspaceId: v.optional(v.string()) // omitted on insert v1 — ADR-E66-004 pattern
})
  .index('by_column_updated', ['column', 'updatedAt'])
  .index('by_signal', ['digestSignalId'])
```

**And** validators live in `convex/validators.ts` (`investigationBoardColumnValue`, `investigationBoardItemRowValidator`, list-item return validator)  
**And** **one board row per `digestSignalId` globally** (PRD §8 Q3 resolution — `by_signal` uniqueness enforced in mutations, not per `digestRunId`)  
**And** Convex unit tests cover schema indexes

### AC2 — Board CRUD mutations and list query (FR-9)

**Given** a valid `digestSignals` row exists  
**When** board APIs are invoked  
**Then** the following **public** functions exist in `convex/investigationBoard.ts` (name `[ASSUMPTION]` — keep module name aligned with table):

| Function | Behavior |
|----------|----------|
| `addToInvestigationBoard` | Insert with `column: 'triage'`, `addedAt`/`updatedAt` = `Date.now()`. If row exists for `digestSignalId`, **no duplicate** — return existing id (idempotent) OR move existing row to `triage` and refresh `updatedAt` (document chosen behavior in test name). |
| `moveBoardItem` | Patch `column` + `updatedAt`. Reject unknown `boardItemId`. |
| `removeBoardItem` | Delete by id. |
| `updateBoardItemNote` | Patch optional `note` + `updatedAt`. Max length 2000 chars. |
| `listInvestigationBoard` | Returns items grouped by column in order: `triage` → `investigating` → `waiting` → `resolved`; within column sort `updatedAt` desc. |

**And** each list item includes denormalized display fields for cards without N+1 client fetches:

```typescript
{
  boardItemId: Id<'investigationBoardItems'>,
  digestSignalId, digestRunId, column, note, addedAt, updatedAt,
  title: string,
  disposition?: DigestSignalDisposition,
  rankScore?: number,
  sourceType: string
}
```

**Implementation:** join `digestSignals` in query handler (or batch `db.get` per item — acceptable for MVP board sizes &lt;100).  
**And** `workspaceId` **omitted** on all inserts (match `investigationSessions` v1)  
**And** `tests/convex/investigation-board.test.ts` covers add idempotency, move, note update, remove, list grouping

### AC3 — Latest session badge query (FR-11)

**Given** board cards must surface Epic 66 session state  
**When** `getLatestInvestigationSessionForSignal({ digestSignalId })` is called  
**Then** it returns the **single most recent** `investigationSessions` row for that signal **across all actions** (`explain`, `compare`, `trace`, `ask_ai`), ordered by `createdAt` desc  
**And** returns `null` when no sessions exist  
**And** requires new index on `investigationSessions`: `.index('by_signal_created', ['digestSignalId', 'createdAt'])` — add without breaking existing `by_signal_action_created`  
**And** unit test: two sessions different actions → returns newer `createdAt`

**Badge copy mapping (UI consumes):**

| Session `status` | Badge |
|------------------|-------|
| `pending` | `Queued` |
| `streaming` | `Streaming…` |
| `complete` | `{Action label} complete` (e.g. `Explain complete`) |
| `error` | `Investigation error` |
| no session | no badge |

Action label: map `explain`→`Explain`, `compare`→`Compare`, `trace`→`Trace`, `ask_ai`→`Ask AI`.

### AC4 — Investigation board UI route (FR-10)

**Given** the operator navigates to `/nexus/investigate`  
**When** the page loads  
**Then** `src/routes/nexus/investigate/+page.svelte` renders a **kanban board** with four columns: **Triage**, **Investigating**, **Waiting**, **Resolved**  
**And** each column lists cards showing: **title**, **disposition chip** (text + colour per `dispositionColour()`), **rankScore** percent when present, **added date** (relative or `addedAt` formatted)  
**And** card **primary tap** opens Intelligence Inspector via `openInspectorForDigestSignal(digestSignalId, digestRunId)`  
**And** card shows **session badge** from AC3 when a session exists  
**And** each card has a **column move menu** (dropdown or action sheet) — v1 **no drag-and-drop** (PRD §6.3)  
**And** optional **note** edit inline or via small modal — calls `updateBoardItemNote`  
**And** empty columns show muted placeholder copy  
**And** board subscribes reactively via `useQuery(api.investigationBoard.listInvestigationBoard)`  
**And** mobile (≤768px): **tabbed column selector** showing one column at a time (addendum A5/A7 — not four-column horizontal scroll)  
**And** styles in `nexus-theme.css` follow `.nx-panel` / charcoal shell tokens

### AC5 — "Add to investigation" entry points (FR-10)

**Given** the operator is on `/nexus` digest feed or Intelligence Inspector  
**When** they activate **Add to investigation**  
**Then**:

| Surface | Placement |
|---------|-----------|
| `NexusDigestSignalFeed.svelte` | Secondary control on each card (icon button or link) — **must not** trigger card's primary inspector tap (`stopPropagation`) |
| `NexusInspectorDrawer.svelte` | Footer action when `digestSignalId` resolves (all modes with scored digest signal, especially `digestSignal` mode) — new footer block parallel to topic-only Track/Dismiss footer |

**And** action calls `addToInvestigationBoard` mutation  
**And** on success shows brief confirmation (toast or inline "On board" state)  
**And** if signal already on board, UI reflects idempotent outcome (no error toast)  
**And** optional: link "View board" navigates to `/nexus/investigate`

### AC6 — Sidebar navigation (FR-10, PRD §8 Q5)

**Given** `NexusSidebar.svelte` today has inert **Signals** stub button  
**When** 69-5 ships  
**Then** **Signals** navigates to `/nexus/investigate` via SvelteKit `<a href="/nexus/investigate">` or `goto`  
**And** **Intelligence** navigates to `/nexus` with active state when pathname is `/nexus` (not investigate)  
**And** active nav highlights correctly on both routes  
**And** sidebar buttons that remain unimplemented (Anomalies, Sources, etc.) stay inert stubs

### AC7 — No regressions (FR-10, FR-11)

**Given** implementation is complete  
**When** `bash scripts/verify.sh` runs from `cns-dashboard`  
**Then** all tests pass (baseline ~475+ tests — run and record count in Dev Agent Record)  
**And** Epic 66 inspector actions (Explain/Compare/Trace/Ask AI) remain functional from feed-opened signals  
**And** digest feed, merge provenance (69-1), people match (69-2), source health (69-3) unchanged except new Add button on feed cards  
**And** **no** Omnipotent.md, WriteGate, or vault mutations

### AC8 — Out of scope (explicit)

- Drag-and-drop reorder within columns; bulk resolve; export board to vault note
- Auto-create `investigationSessions` when adding to board
- Hermes `investigate-trend` webhook; Discord notifications
- Multi-user assignment; real `workspaceId` scoping
- Cancelling/superseding Epic 66 story 66-2 in sprint-status (operator/SM action after merge)

## Tasks / Subtasks

- [ ] **T1 — Validators + schema** (AC: 1)
  - [ ] T1.1 Add `investigationBoardColumnValue`, `investigationBoardItemRowValidator`, `investigationBoardListItemValidator` to `convex/validators.ts`
  - [ ] T1.2 Register `investigationBoardItems` table + indexes in `convex/schema.ts`
  - [ ] T1.3 Add `by_signal_created` index to `investigationSessions` in `schema.ts`

- [ ] **T2 — Convex board module** (AC: 2)
  - [ ] T2.1 Create `convex/investigationBoard.ts` with mutations + `listInvestigationBoard`
  - [ ] T2.2 Helper `getBoardItemWithSignal(ctx, item)` for denormalized list rows
  - [ ] T2.3 Idempotent `addToInvestigationBoard` — query `by_signal` before insert
  - [ ] T2.4 Create `tests/convex/investigation-board.test.ts` (convex-test pattern from `investigation-sessions.test.ts`)

- [ ] **T3 — Session badge query** (AC: 3)
  - [ ] T3.1 Add `getLatestInvestigationSessionForSignal` to `convex/investigationSessions.ts`
  - [ ] T3.2 Extend `investigation-sessions.test.ts` for cross-action latest lookup
  - [ ] T3.3 Create `$lib/utils/nexus-investigation-badge.ts` with `formatSessionBadge(session)` + Vitest

- [ ] **T4 — Board page + component** (AC: 4, 6)
  - [ ] T4.1 Create `src/routes/nexus/investigate/+page.svelte`
  - [ ] T4.2 Create `NexusInvestigationBoard.svelte` — desktop kanban + mobile tabs
  - [ ] T4.3 Create `NexusInvestigationBoardCard.svelte` — card UI, move menu, note affordance, session badge
  - [ ] T4.4 Add styles: `.nx-investigate-board`, `.nx-board-column`, `.nx-board-card`, mobile tabs
  - [ ] T4.5 Update `NexusSidebar.svelte` — wire Signals → `/nexus/investigate`, Intelligence → `/nexus`, `aria-current` from `$page.url.pathname`

- [ ] **T5 — Add to investigation wiring** (AC: 5)
  - [ ] T5.1 `NexusDigestSignalFeed.svelte` — per-card Add button + mutation + stopPropagation
  - [ ] T5.2 `NexusInspectorDrawer.svelte` — digest-signal footer with Add to investigation (when `digestSignalId` present)
  - [ ] T5.3 Optional shared helper `$lib/utils/nexus-board-client.ts` wrapping mutation + toast copy

- [ ] **T6 — Verify gate** (AC: 7)
  - [ ] T6.1 `bash scripts/verify.sh` from cns-dashboard
  - [ ] T6.2 Manual UJ-5 smoke: add signal from feed → appears in Triage → move columns → close browser → reopen board → state persists → run Explain from inspector → badge updates

## Dev Notes

### Prerequisite — Epic 69 layout gate (done)

| Dependency | Status |
|------------|--------|
| `NexusDigestSignalFeed` + `openInspectorForDigestSignal` | Shipped 69-4 |
| `getDigestSignalById` / list item shape | Shipped 63-6 |
| `investigationSessions` + `runInvestigation` action | Shipped 66-3, 66-1, 66-4 |
| Inspector footer pattern (topic Track/Dismiss) | Exists — extend for digest signals |

### Distinction: board vs sessions (do not conflate)

| Table | Purpose |
|-------|---------|
| `investigationSessions` | One row per **AI action invocation** (Explain, Compare, …) — streaming response storage |
| `investigationBoardItems` | One row per **signal on the kanban** — operator workflow state across days |

Board **links to** sessions via `digestSignalId`; it does **not** replace or duplicate session rows.

### UPDATE files — read before editing

**`convex/schema.ts`** — today has `investigationSessions` only; no board table. Add `investigationBoardItems`; add `by_signal_created` on sessions.

**`convex/investigationSessions.ts`** — four functions today (`createInvestigationSession`, `patchInvestigationResponse`, `getInvestigationSession`, `getLatestSessionForSignal` with **required `action`**). Add cross-action latest query; do not change existing action-scoped query (drawer restore depends on it).

**`NexusSidebar.svelte`** — all nav items are inert `<button>` elements with hardcoded `active: true` on Intelligence only. Convert Signals + Intelligence to routed links.

**`NexusDigestSignalFeed.svelte`** — card is a single `<button>` for inspector open. Add nested control with `onclick={(e) => e.stopPropagation()}`.

**`NexusInspectorDrawer.svelte`** — footer exists only for `{#if topicSlug}` (Track/Dismiss). Add digest-signal footer when `digestSignalId` is set (includes `digestSignal` mode and topic/keyword paths with resolved scored signal).

```svelte
<!-- Inspector footer today — topic only (~line 889) -->
{#if topicSlug}
  <footer class="nx-drawer-footer">...</footer>
{/if}
<!-- 69-5: add digest footer when digestSignalId && digestRunId -->
```

### Board list query — recommended shape

```typescript
// listInvestigationBoard returns:
{
  columns: Array<{
    column: 'triage' | 'investigating' | 'waiting' | 'resolved';
    items: InvestigationBoardListItem[];
  }>;
}
```

Fetch all board items via `by_column_updated` per column (4 indexed queries) OR single collect if table small — prefer **four index queries** for scalability pattern consistency.

### Idempotent add behavior (binding)

When `addToInvestigationBoard` called for signal already on board:

- **Recommended:** return existing `boardItemId` without error; optionally reset column to `triage` only if operator explicitly "re-adds" from feed — simpler v1: **leave column unchanged**, refresh `updatedAt` only if unchanged.

Document in test.

### Mobile kanban (tabbed)

Match addendum A7:

- Tabs: Triage | Investigating | Waiting | Resolved
- `role="tablist"` / `role="tabpanel"` for accessibility
- Column badge counts on tabs

### Session badge on cards

Use `useQuery` per card only if unavoidable — for MVP board sizes, acceptable to:

1. Include optional `latestSession` in `listInvestigationBoard` server-side (preferred — one subscription), **or**
2. Batch query in page component

**Preferred:** enrich `listInvestigationBoard` with `latestSession: { status, action, createdAt } | null` per item to avoid query fan-out.

### Pure utilities (required pattern from 69-1/69-4)

| File | Responsibility |
|------|----------------|
| `$lib/utils/nexus-investigation-badge.ts` | `formatSessionBadge`, `actionDisplayLabel` |
| `$lib/utils/nexus-board-columns.ts` | `BOARD_COLUMN_ORDER`, `columnDisplayLabel`, move-menu options |

Unit test badge formatter; column order may be trivial but keeps Svelte thin.

### Testing standards

- **Convex (required):** `tests/convex/investigation-board.test.ts` — CRUD, idempotent add, list order
- **Convex (required):** extend `investigation-sessions.test.ts` for `getLatestInvestigationSessionForSignal`
- **Unit (required):** `tests/lib/nexus-investigation-badge.test.ts`
- **Component:** optional smoke for tabbed mobile layout
- **Gate:** `bash scripts/verify.sh` from `cns-dashboard` repo root

### Architecture compliance

| Constraint | Value |
|------------|-------|
| Stack | SvelteKit 2 + Convex + Tailwind 4 + `convex-svelte` |
| Drawer width | 320px (ADR-E63-003) — board is full page, not drawer |
| Env vars | No `NEXUS_*` in cns-dashboard (ADR-E63-005) |
| Auth | No `ctx.auth` in v1 — single-operator MVP (ADR-E66-004) |
| Live URL | https://cns-dashboard-three.vercel.app/nexus/investigate |
| WriteGate / vault | **Not touched** |
| Omnipotent.md | **No changes** |

### Project structure (files to create/modify)

**Create:**

- `cns-dashboard/convex/investigationBoard.ts`
- `cns-dashboard/tests/convex/investigation-board.test.ts`
- `cns-dashboard/src/routes/nexus/investigate/+page.svelte`
- `cns-dashboard/src/lib/components/nexus/NexusInvestigationBoard.svelte`
- `cns-dashboard/src/lib/components/nexus/NexusInvestigationBoardCard.svelte`
- `cns-dashboard/src/lib/utils/nexus-investigation-badge.ts`
- `cns-dashboard/src/lib/utils/nexus-board-columns.ts`
- `cns-dashboard/tests/lib/nexus-investigation-badge.test.ts`

**Modify:**

- `cns-dashboard/convex/schema.ts`
- `cns-dashboard/convex/validators.ts`
- `cns-dashboard/convex/investigationSessions.ts`
- `cns-dashboard/tests/convex/investigation-sessions.test.ts`
- `cns-dashboard/src/lib/components/nexus/NexusSidebar.svelte`
- `cns-dashboard/src/lib/components/nexus/NexusDigestSignalFeed.svelte`
- `cns-dashboard/src/lib/components/nexus/NexusInspectorDrawer.svelte`
- `cns-dashboard/src/routes/nexus/nexus-theme.css`

**Do not modify:** Omnipotent.md scripts, dedup engine, scoring, Hermes skills, `investigation.node.ts` action logic (except new read query)

### Previous story intelligence

| Story | Relevant learning |
|-------|-------------------|
| **69-4** | Feed cards + `digestSignal` inspector mode — Add button targets same `digestSignalId`/`digestRunId` |
| **69-1** | Inspector section patterns below Signal Intelligence — board footer is separate chrome |
| **69-2** | Split-repo discipline — 69-5 is cns-dashboard only |
| **69-3** | `useQuery` + skip pattern; panel in right column — board is new route |
| **66-3** | `convex-test` + `seedDigestSignal` helper — reuse in board tests |
| **66-1** | `restoreLatestSession` loops actions — board badge needs **cross-action** latest instead |
| **66-2 (deferred)** | Stitch Screen 10 vision — 69-5 delivers MVP kanban without multi-panel orchestration canvas |

### Git intelligence (cns-dashboard)

```
cf6296d feat(epic-69): 69-3 source health panel + getDigestSourceHealth query
6ed6101 feat(epic-69): 69-2 people match chip in inspector + validator extension
addf62c feat(epic-69): 69-1 inspector merge provenance section
eae57d6 feat(epic-69): 69-4 digest signal feed + disposition hierarchy layout gate
```

69-5 is the **capstone** Epic 69 story — completes operator journey UJ-5 from PRD. Prior stories added feed + inspector enrichments; board consumes their data shapes unchanged.

### Latest tech notes

- Svelte 5 runes — match `NexusDigestSignalFeed` / drawer patterns (`$state`, `$derived`, `$props`)
- `convex-svelte` `useMutation(api.investigationBoard.addToInvestigationBoard)` for Add actions
- SvelteKit file route `nexus/investigate/+page.svelte` inherits `nexus/+layout.svelte` shell (sidebar, drawer, context)
- `getContext` / `getNexusContext()` available on investigate page for inspector open
- No new npm packages
- Convex public mutations acceptable for v1 (matches `investigationSessions` pattern from 66-3)

### References

- PRD FR-9–FR-11: `_bmad-output/planning-artifacts/prds/prd-epic-69-2026-06-11/prd.md` §4.5, §6.2, UJ-5
- Addendum A5 (schema): `./addendum.md` in same PRD folder
- Epic 66 deferral + sessions foundation: `_bmad-output/planning-artifacts/prds/prd-epic-66-2026-06-09/prd.md` §4.3
- Epic 66 architecture: `_bmad-output/planning-artifacts/architecture-epic-66-nexus-agent-orchestration.md` (ADR-E66-004 workspaceId)
- Story 69-4 (layout gate): `_bmad-output/implementation-artifacts/69-4-digest-signal-feed-disposition-hierarchy.md`
- Story 66-3 (sessions gate): `_bmad-output/implementation-artifacts/66-3-investigation-sessions-schema-crud-gate.md`
- Schema today: `cns-dashboard/convex/schema.ts`
- Sessions API: `cns-dashboard/convex/investigationSessions.ts`
- Sidebar stub: `cns-dashboard/src/lib/components/nexus/NexusSidebar.svelte`
- Digest feed cards: `cns-dashboard/src/lib/components/nexus/NexusDigestSignalFeed.svelte`
- Epic 63 cockpit ADR: `cns-dashboard/_bmad-output/planning-artifacts/architecture-epic-63-nexus-cockpit.md`

## Dev Agent Record

### Agent Model Used

_(filled by dev agent)_

### Debug Log References

### Completion Notes List

### File List

## Change Log
