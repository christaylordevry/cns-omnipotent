# Story 73.6: Dashboard Entity Intelligence Modules

Status: ready-for-dev

**Epic:** 73 — Nexus Entity Intelligence  
**Repo boundary:** **cns-dashboard only** (SvelteKit + Convex reactive read). No Omnipotent.md script changes in this story.  
**Normative spec:** `_bmad-output/specs/spec-nexus-entity-intelligence/architecture.md` §6.1, §5  
**UX contract (wins on conflict):** `_bmad-output/planning-artifacts/ux-designs/ux-CNS-2026-06-21/EXPERIENCE.md` + `DESIGN.md`  
**Visual mock:** `_bmad-output/planning-artifacts/ux-designs/ux-CNS-2026-06-21/mockups/key-nexus-entities.html`

<!-- Validation: optional `/bmad-create-story` checklist before `/bmad-dev-story`. -->

## Story

As a CNS operator monitoring Nexus entity intelligence,
I want two read-only dashboard modules on `/nexus/entities` — Tracked Entities in Motion and Emerging Entities to Review — with evidence cards, inspect/save actions, and lane-differentiated affordances,
so that I can see who is accelerating and who is emerging worth reviewing without reading logs or mutating watchlist YAML.

## Acceptance Criteria

### AC1 — Route, navigation, and layout (CAP-1, CAP-7)

**Given** the Nexus cockpit shell is loaded  
**When** the operator navigates to `/nexus/entities`  
**Then** the page renders inside `nexus/+layout.svelte` (sidebar + top nav + inspector drawer)  
**And** `NexusSidebar.svelte` exposes an enabled **Entities** nav item linking to `/nexus/entities` (replaces the disabled `new-intelligence` stub; `isActive()` when `pathname === '/nexus/entities'`)  
**And** the page body is a **single center column** with two stacked modules (no right rail): **Tracked Entities in Motion** on top, **Emerging Entities to Review** below  
**And** lanes are structurally separate panels — never merged into one feed (CAP-1)

### AC2 — Reactive data subscription (ADR-E73-006, ASSUMPTION A1)

**Given** story **73-5** shipped `getEntityIntelligence` and optional `getEntityIntelligenceHealth`  
**When** `/nexus/entities` mounts  
**Then** the page subscribes via `useQuery(api.entityIntelligence.getEntityIntelligence, () => ({ now: Date.now() }))` — **`now` passed from client**, never `Date.now()` inside the Convex query handler  
**And** the UI **does not re-rank** — it renders `trackedInMotion[]` and `emergingToReview[]` in server order (already sliced to `ENTITY_LANE_MAX_ITEMS`)  
**And** optional health footnote subscribes to `getEntityIntelligenceHealth` for copy like `Entity stage ran {time} · {n} snapshots · {t} tracked / {e} emerging`

### AC3 — EntityModulePanel + EntityCard rendering (FR4, CAP-4)

**Given** lane items are returned  
**When** each module renders  
**Then** panel chrome matches existing Nexus panels (`.nx-panel`, `.nx-panel-header`, `.nx-panel-title` uppercase mono, count badge, run-date meta)  
**And** each `EntityLaneItem` card shows: `EntityTypeBadge` + `displayName`, momentum line (`momentumSummary`), `ReasonChipRow` (first 4 chips + `+N` overflow button), collapsed `EvidenceTraceList` (up to 5 `evidence[]` rows), and lane-aware footer actions  
**And** reason chips map codes to labels with `aria-label` = full `reason.detail` (not colour-only — WCAG 1.4.1)  
**And** momentum line colour follows server reasons: contains `acceleration` → teal; `cold_start` → amber; else muted — **never computed client-side beyond reading reason codes**

### AC4 — Card DOM and keyboard (a11y, review-a11y.md)

**Given** an entity card is rendered  
**When** inspected in the DOM  
**Then** structure is `article.nx-entity-card > button.nx-entity-card-main + footer.nx-entity-footer` — **footer MUST NOT be nested inside the main button** (mirror `NexusDigestSignalFeed.svelte`)  
**And** Enter/Space on card main opens Inspect; footer buttons are in tab order after main  
**And** loading uses skeleton cards + `role="status"` "Loading entities…"; lane empty states use lane-specific copy from EXPERIENCE.md; errors use `role="alert"`

### AC5 — Lane-differentiated actions (FR5, CAP-5, D4)

**Given** a card in the **tracked** lane  
**When** footer actions render  
**Then** actions are **Inspect** + **Save top signal** only — no Manually track, no Approve, no Compare  

**Given** a card in the **emerging** lane  
**When** footer actions render  
**Then** actions are **Inspect** + **Save top signal** + **Manually track** (when gated)  

**Manually track gating:** shown only when `entityType` is `person` or `account`; **hidden for `org`** (nexus-people.yaml is people-only v1). Link is read-only anchor with tooltip: `Opens where the people watchlist lives — no automatic changes`. No YAML mutation.

**Save top signal:** label exactly **Save top signal** (not "Save entity"). Targets `item.evidence[0]` via existing investigation-board client. After save, call `updateBoardItemNote` so board note/metadata includes entity `displayName`. Mirror `NexusDigestSignalFeed.addToBoard` pending → `Adding…` → flash `Saved` → optional `View board` link.

### AC6 — Inspector extension (ASSUMPTION A2)

**Given** the operator clicks Inspect (card main or footer)  
**When** the drawer opens  
**Then** `NexusInspectorDrawer` opens in **`mode: 'entity'`** with the in-hand `EntityLaneItem` — **no secondary Convex fetch**  
**And** drawer sections: **Why it's here** (reasons), **Momentum**, **Source traces** (full evidence), **Co-mentioned tracked entities** when present  
**And** footer is lane-aware: tracked → Save + Dismiss; emerging → Save + Manually track + Dismiss  
**And** existing `topic` / `keyword` / `digestSignal` modes are unchanged (regression guard)

### AC7 — Read-only law and regressions (CAP-5, FR5)

**Given** this story is complete  
**When** `bash scripts/verify.sh` runs from repo root (includes cns-dashboard when sibling exists)  
**Then** all tests pass  
**And** `/nexus` main cockpit (hero, digest feed, anomaly feed, weights, source health) is unchanged  
**And** `/nexus/investigate` board behavior unchanged  
**And** no Approve/Compare buttons exist anywhere on entity surfaces  
**And** Vitest covers view-model helpers in `tests/lib/nexus-entity-intelligence.test.ts` (reason chip labels, momentum tone, lane action gating, empty copy)

## Tasks / Subtasks

### Prerequisite gate — confirm 73-5 landed

- [ ] **T0 — Dependency check** (AC: 2)
  - [ ] T0.1 Verify `cns-dashboard/convex/entityIntelligence.ts` exports `getEntityIntelligence` (+ optional `getEntityIntelligenceHealth`)
  - [ ] T0.2 Verify validators: `entityLaneItemValidator`, `entityReasonValidator`, `entityIntelligenceResultValidator`
  - [ ] T0.3 If missing, implement **73-5 first** — this story cannot ship without the query

### cns-dashboard — view-model utilities

- [ ] **T1 — Pure utils** (AC: 3, 5)
  - [ ] T1.1 Create `src/lib/utils/nexus-entity-intelligence.ts`:
    - `EntityLaneViewModel`, `EntityReasonChipViewModel`
    - `momentumToneFromReasons(reasons)` → `'accel' | 'review' | 'flat'`
    - `reasonCodeToChipLabel(code)` — e.g. `acceleration` → `ACCEL`, `cold_start` → `COLD START`
    - `shouldShowManuallyTrack(entityType)` → true for `person`/`account` only
    - `formatEntityEmptyCopy(lane, health?)` — lane-specific + early-days copy
  - [ ] T1.2 Reuse `DIGEST_SOURCE_BADGE` from `nexus-digest-feed.ts` for evidence source badges
  - [ ] T1.3 Add `tests/lib/nexus-entity-intelligence.test.ts`

### cns-dashboard — components

- [ ] **T2 — EntityModulePanel.svelte** (AC: 1, 3, 4)
  - [ ] T2.1 Props: `title`, `lane: 'tracked' | 'emerging'`, `items`, `runDate`, `state`
  - [ ] T2.2 Lane accent: 2px top-border tint (tracked teal / emerging blue-amber per DESIGN.md)
  - [ ] T2.3 Loading skeleton, empty, error states per EXPERIENCE.md State Patterns

- [ ] **T3 — EntityCard.svelte + subcomponents** (AC: 3, 4, 5)
  - [ ] T3.1 `EntityTypeBadge.svelte` — dot + mono badge (`PE`/`AC`/`OG`)
  - [ ] T3.2 `MomentumLine.svelte`, `ReasonChipRow.svelte`, `EvidenceTraceList.svelte`, `EntityLaneActions.svelte`
  - [ ] T3.3 Card main click → `openInspectorForEntity(item, lane)`
  - [ ] T3.4 Save flow: `addSignalToInvestigationBoard(client, evidence[0].digestSignalId, digestRunId)` then `updateBoardItemNote` with entity displayName

- [ ] **T4 — EntityHealthFootnote.svelte** (AC: 2)
  - [ ] T4.1 Muted one-liner under lower module (`.nx-source-health-disclaimer` pattern)

### cns-dashboard — route + shell integration

- [ ] **T5 — Route** (AC: 1)
  - [ ] T5.1 Create `src/routes/nexus/entities/+page.svelte` — two `EntityModulePanel`s + footnote
  - [ ] T5.2 Add `.nx-entity-*` styles to `nexus-theme.css` (alias `--nx-*` only; no new base palette)

- [ ] **T6 — Sidebar + context + inspector** (AC: 1, 6)
  - [ ] T6.1 Update `NexusSidebar.svelte` — enable Entities nav
  - [ ] T6.2 Extend `nexus-context.ts`: `openInspectorForEntity`, `drawerPayload` union `{ mode: 'entity'; item: EntityLaneItem; lane: 'tracked' | 'emerging' }`
  - [ ] T6.3 Extend `NexusInspectorDrawer.svelte` — entity mode body + lane-aware footer (reuse `.nx-inspector-why-block`, `.nx-inspector-trace-list`)

### Verify

- [ ] **T7 — Verify gate** (AC: 7)
  - [ ] T7.1 `bash scripts/verify.sh` from Omnipotent.md (or `CNS_DASHBOARD_ROOT`)
  - [ ] T7.2 Manual smoke: `/nexus/entities` — both lanes, Save top signal → board note has displayName, org card has no Manually track

## Dev Notes

### Prerequisite stories (hard gate)

| Story | Delivers | Status at authoring |
|-------|----------|---------------------|
| **73-1** | `entityMentions` schema + `recordEntityMentions` | Not in repo — required upstream |
| **73-5** | `getEntityIntelligence` + `constants.ts` thresholds | **Not in repo** — **blocks 73-6** |
| **73-4** | Post-push snapshots (populates table) | Not in repo — empty lanes until live runs |

**Do not stub a fake query.** If 73-5 is incomplete, finish 73-5 first or implement both in one dev session with 73-5 merged first.

### Architecture compliance

- **ADR-E73-007:** Lane logic lives in Convex query only; UI is a thin renderer.
- **ADR-E73-006:** `ENTITY_LANE_MAX_ITEMS` (default 10) enforced server-side; UI trusts slice.
- **CAP-5 / FR5:** Read-only — Manually track is `<a href>` to watchlist location, not a mutation.
- **No WriteGate / vault_log_action** in this story.

### Files to READ before editing (mandatory)

| File | Current state | Preserve |
|------|---------------|----------|
| `cns-dashboard/src/lib/components/nexus/NexusDigestSignalFeed.svelte` | Card list + `addToBoard()` pattern | DOM structure, save flash timing (`BOARD_ADD_CONFIRMATION_MS`) |
| `cns-dashboard/src/lib/components/nexus/NexusSourceHealthPanel.svelte` | Derived query panel + disclaimer | Panel state machine, mobile breakpoint |
| `cns-dashboard/src/lib/utils/nexus-board-client.ts` | `addSignalToInvestigationBoard()` | API signature |
| `cns-dashboard/convex/investigationBoard.ts` | `addToInvestigationBoard`, `updateBoardItemNote` | Idempotent add semantics |
| `cns-dashboard/src/lib/context/nexus-context.ts` | Inspector open helpers | Existing modes |
| `cns-dashboard/src/lib/components/nexus/NexusInspectorDrawer.svelte` | topic/keyword/digestSignal modes | Focus trap, Esc, inert |
| `cns-dashboard/src/routes/nexus/nexus-theme.css` | All `--nx-*` tokens | Base palette ownership |

### New files (expected)

```
cns-dashboard/src/routes/nexus/entities/+page.svelte
cns-dashboard/src/lib/components/nexus/NexusEntityModulePanel.svelte
cns-dashboard/src/lib/components/nexus/NexusEntityCard.svelte
cns-dashboard/src/lib/components/nexus/EntityTypeBadge.svelte
cns-dashboard/src/lib/components/nexus/MomentumLine.svelte
cns-dashboard/src/lib/components/nexus/ReasonChipRow.svelte
cns-dashboard/src/lib/components/nexus/EvidenceTraceList.svelte
cns-dashboard/src/lib/components/nexus/EntityLaneActions.svelte
cns-dashboard/src/lib/components/nexus/EntityHealthFootnote.svelte
cns-dashboard/src/lib/utils/nexus-entity-intelligence.ts
cns-dashboard/tests/lib/nexus-entity-intelligence.test.ts
```

### Testing requirements

- **Unit:** view-model utils (chip labels, gating, empty copy, momentum tone)
- **Component:** optional smoke if project pattern supports; not required if utils cover logic
- **Convex:** owned by 73-5 — do not duplicate lane math tests here
- **Verify:** `bash scripts/verify.sh` must pass before marking done

### UX copy (locked)

| Context | Copy |
|---------|------|
| Module 1 title | `TRACKED ENTITIES IN MOTION` |
| Module 2 title | `EMERGING ENTITIES TO REVIEW` |
| Tracked empty | `No tracked entities are accelerating right now.` |
| Emerging empty | `No new entities crossed the review threshold this window.` |
| Early days | `Baselines are still accruing — emerging candidates will appear first.` |
| Save label | `Save top signal` |

### Anti-patterns (do NOT)

- Nest footer buttons inside card main `<button>`
- Add Approve or Compare actions
- Re-rank lanes client-side
- Auto-write `nexus-people.yaml`
- Introduce new base colours outside `--nx-*` aliases
- Call `Date.now()` inside Convex query handlers

### References

- [Source: `_bmad-output/specs/spec-nexus-entity-intelligence/architecture.md` §6.1, §5]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-CNS-2026-06-21/EXPERIENCE.md`]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-CNS-2026-06-21/DESIGN.md`]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-CNS-2026-06-21/review-a11y.md`]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-CNS-2026-06-21/.decision-log.md` D4, D5, A1–A3]
- [Pattern: `_bmad-output/implementation-artifacts/69-3-source-health-panel.md`]
- [Pattern: `_bmad-output/implementation-artifacts/69-4-digest-signal-feed-disposition-hierarchy.md`]
- [Dashboard UX: `cns-dashboard/_bmad-output/planning-artifacts/epic-46-ui-spec.md` §2 tokens via nexus-theme.css]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
