---
story_id: 66-3
epic: 66
title: investigation-sessions-schema-crud-gate
status: review
repo: cns-dashboard
blocks: 66-1
gate: true
operator_brief: 2026-06-09
source: architecture-epic-66-nexus-agent-orchestration.md §3, prd-epic-66-2026-06-09/prd.md §4.1
baseline_tests: 423
baseline_commit: 2ee2b9d0c297355f4a45b3f168cfe17ec3026111
---

# Story 66.3: `investigationSessions` Schema + CRUD Gate

Status: review

> **GATE STORY:** Nothing in Epic 66 MVP (especially **66-1** inspector action wiring) may start until this story merges and deploys. Implements FR-1, FR-2, FR-3 only — schema + persistence, **no Anthropic, no UI**.

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a **Nexus operator (via future inspector actions in 66-1)**,
I want **durable `investigationSessions` rows in Convex with create/patch/read APIs**,
so that **Explain / Compare / Trace / Ask AI investigations can stream, persist, and restore without re-running the model (ADR-E66-006)**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | 66 — Nexus Agent Orchestration |
| **Repo** | **cns-dashboard only** — `convex/schema.ts`, `convex/validators.ts`, `convex/investigationSessions.ts`, tests |
| **Gate** | **Blocks 66-1** — drawer wiring, Anthropic action, restore UX all depend on this table |
| **Normative spec** | `architecture-epic-66-nexus-agent-orchestration.md` §3 (data architecture), ADR-E66-001, ADR-E66-004, ADR-E66-006 |
| **PRD** | `prd-epic-66-2026-06-09/prd.md` §4.1 (FR-1–FR-3) |
| **Out of scope** | Anthropic / `'use node'` action (`investigation.node.ts` → **66-1**); `NexusInspectorDrawer.svelte` changes; `getPriorDigestSignalsForTopic` (66-1); Screen 10 (66-2 deferred); `completeInvestigationSession` / `failInvestigationSession` / `cancelInvestigationSession` (66-1 may add or reuse `patchInvestigationResponse` + status transitions) |

### Operator-tightened contract (binding over architecture doc where they differ)

This story implements the **minimal v1 gate** the operator specified. Where the architecture doc uses `signalId`, extra denormalized fields, or `internalMutation`, follow **this story** instead:

| Field / API | This story (binding) | Architecture doc (deferred / 66-1) |
|-------------|---------------------|--------------------------------------|
| FK column | `digestSignalId: Id<'digestSignals'>` | `signalId` |
| Initial status | `pending` on create | `streaming` on create |
| Status enum | `pending` \| `streaming` \| `complete` \| `error` | no `pending` |
| Extra columns | none in v1 | `topicSlug`, `errorMessage`, `completedAt`, `cancelled` |
| Mutations | **public** `mutation()` | `internalMutation()` |
| Latest query | `getLatestSessionForSignal` | `getLatestInvestigationSession` |

### Problem (current state)

Post–Epic 65, `NexusInspectorDrawer.svelte` has an inert 2×2 action grid. There is **no** Convex table or API to persist investigation prompts/responses. Epic 66 streaming UX (ADR-E66-003) requires reactive session rows that 66-1 will patch during Anthropic streaming.

### Downstream consumer (66-1 preview — do not implement)

66-1 will call `createInvestigationSession` → transition to `streaming` → invoke `patchInvestigationResponse` in **tight loops** (throttled ~250ms) → set `status: complete` or `error`. Restore on drawer open uses `getLatestSessionForSignal` with sessions **&lt;24h** old (ADR-E66-006).

---

## Acceptance Criteria

### AC-1: Schema deploys

**Given** the new `investigationSessions` table is added to `convex/schema.ts` with validators in `convex/validators.ts`  
**When** `npx convex deploy` runs against the dev deployment  
**Then** deploy succeeds with no schema validation errors  
**And** indexes support lookup by `(digestSignalId, action)` ordered by `createdAt` desc

### AC-2: Create → patch → get round-trip

**Given** a valid `digestSignals` row exists in test DB  
**When** `createInvestigationSession` inserts a row with `status: pending`  
**And** `patchInvestigationResponse` appends a response chunk and updates status  
**And** `getInvestigationSession` is called with the returned session Id  
**Then** the query returns the row with accumulated `response` text and updated `status`  
**And** `workspaceId` is **omitted** on insert (ADR-E66-004)

### AC-3: Latest session per signal + action

**Given** multiple sessions exist for the same `(digestSignalId, action)` pair with different `createdAt` values  
**When** `getLatestSessionForSignal` is queried  
**Then** the row with the greatest `createdAt` is returned  
**And** when no session exists, the query returns `null`

### AC-4: Regression gate

**Given** implementation is complete  
**When** `npm test`, `npm run lint`, `npm run build` run in cns-dashboard  
**And** `bash scripts/verify.sh` runs from Omnipotent.md  
**Then** all pass — **423 baseline tests preserved + new tests for all four functions**

### AC-5: No UI changes

**Given** this story is scoped to persistence only  
**When** the diff is reviewed  
**Then** `src/lib/components/nexus/NexusInspectorDrawer.svelte` is **unchanged** (66-1 owns drawer wiring)

---

## Tasks / Subtasks

- [x] **T1: Validators** (AC: 1)
  - [x] T1.1 Add to `convex/validators.ts`:
    - `investigationActionValue`: `'explain' | 'compare' | 'trace' | 'ask_ai'`
    - `investigationStatusValue`: `'pending' | 'streaming' | 'complete' | 'error'`
    - `investigationSessionRowValidator` with fields below
  - [x] T1.2 Row shape (exact):

    ```typescript
    {
      digestSignalId: v.id('digestSignals'),
      action: investigationActionValue,
      prompt: v.string(),
      response: v.optional(v.string()),
      status: investigationStatusValue,
      createdAt: v.number(),
      // workspaceId omitted in v1 — do NOT add to validator or inserts
    }
    ```

- [x] **T2: Schema + indexes** (AC: 1)
  - [x] T2.1 Register table in `convex/schema.ts`:

    ```typescript
    investigationSessions: defineTable(investigationSessionRowValidator)
      .index('by_signal_action_created', ['digestSignalId', 'action', 'createdAt']),
    ```

  - [x] T2.2 Import validator from `./validators` (mirror `digestRuns` / `digestSignals` pattern)

- [x] **T3: CRUD module** — `convex/investigationSessions.ts` (AC: 2, 3)
  - [x] T3.1 `createInvestigationSession` — **public `mutation`**
    - Args: `{ digestSignalId, action, prompt }` (validate with Convex `v` validators)
    - Insert: `{ digestSignalId, action, prompt, status: 'pending', createdAt: Date.now() }`
    - **Omit** `response` and `workspaceId`
    - Returns: `Id<'investigationSessions'>`
  - [x] T3.2 `patchInvestigationResponse` — **public `mutation`**
    - Args: `{ sessionId, chunk: v.string(), status: v.optional(investigationStatusValue) }`
    - **Append semantics (critical for 66-1 streaming):**

      ```typescript
      const existing = session.response ?? '';
      await ctx.db.patch(sessionId, {
        response: existing + chunk,
        ...(status !== undefined ? { status } : {}),
      });
      ```

    - Throw `ConvexError` if session Id not found
    - **Do not replace** `response` with `chunk` alone — concurrent/throttled patches must not clobber prior text
  - [x] T3.3 `getInvestigationSession` — **public `query`**
    - Args: `{ sessionId: v.id('investigationSessions') }`
    - Returns: full row or `null`
  - [x] T3.4 `getLatestSessionForSignal` — **public `query`**
    - Args: `{ digestSignalId, action }`
    - Use `by_signal_action_created` index, `.order('desc')`, `.first()`
    - Returns: latest row regardless of status (66-1 filters for restore eligibility)
    - Returns `null` when absent

- [x] **T4: Tests** — `tests/convex/investigation-sessions.test.ts` (AC: 2, 3, 4)
  - [x] T4.1 Schema + validator smoke (mirror `digest.test.ts` / `notebookQueries.test.ts`)
  - [x] T4.2 **Round-trip:** seed `digestRun` + `digestSignal` → `createInvestigationSession` → two `patchInvestigationResponse` calls with different chunks → `getInvestigationSession` asserts concatenated response + final status
  - [x] T4.3 **Append idempotence:** two patches with `'hello'` + `' world'` → response `'hello world'`
  - [x] T4.4 **Latest session:** create two sessions same `(digestSignalId, action)` with staggered `createdAt` → `getLatestSessionForSignal` returns newer
  - [x] T4.5 **Null cases:** `getInvestigationSession` unknown Id; `getLatestSessionForSignal` no rows
  - [x] T4.6 Use `convexTest(schema, modules)` + `import.meta.glob('../../convex/**/*.ts')` — same harness as existing convex tests

- [x] **T5: Deploy verify** (AC: 1)
  - [x] T5.1 Run `npx convex deploy` (or document operator deploy step in completion notes)
  - [x] T5.2 Confirm generated `api.investigationSessions.*` exports in `_generated/api.d.ts`

---

## Dev Notes

### Architecture compliance

- **ADR-E66-001:** This story **is** the gate — merge before any 66-1 branch.
- **ADR-E66-004:** Never write `workspaceId`. Do not add the field to the validator.
- **ADR-E66-006:** `getLatestSessionForSignal` exists for 24h restore; filtering by `status === 'complete'` and age happens in 66-1 client/util layer.
- **Action ID mapping (storage vs UI):** UI uses `ask-ai` (kebab); stored literal is `ask_ai`. Mapper lives in 66-1 — this story only accepts storage literals.

### Patch mutation — streaming contract (flag for 66-1)

`patchInvestigationResponse` will be invoked in **tight loops** during Anthropic streaming (ADR-E66-003, throttled ~250ms). Implementation **must** read current `response`, concatenate `existing + chunk`, then patch. A blind `response: chunk` replace will lose data under concurrent patches.

Optional hardening (nice-to-have, not required): reject patches when `status === 'complete'` to prevent accidental overwrites after finalize.

### Files to touch

| File | Action |
|------|--------|
| `cns-dashboard/convex/validators.ts` | ADD investigation validators |
| `cns-dashboard/convex/schema.ts` | ADD `investigationSessions` table + index |
| `cns-dashboard/convex/investigationSessions.ts` | NEW — four exported functions |
| `cns-dashboard/tests/convex/investigation-sessions.test.ts` | NEW — unit tests |

### Files explicitly DO NOT touch

| File | Reason |
|------|--------|
| `src/lib/components/nexus/NexusInspectorDrawer.svelte` | 66-1 |
| `convex/investigation.node.ts` | 66-1 |
| `convex/digest.ts` | 66-1 (`getPriorDigestSignalsForTopic`) |
| Omnipotent.md vault paths | No WriteGate / vault IO |

### Testing standards

- **Harness:** `convex-test` + Vitest (existing pattern in `tests/convex/*.test.ts`)
- **Baseline:** **423** tests in cns-dashboard (verified 2026-06-09) — must not decrease
- **Verify gate:** `bash scripts/verify.sh` from Omnipotent.md root (runs cns-dashboard tests when sibling exists)
- **Seed data:** Create minimal `digestRun` + `digestSignal` via existing `digest:createDigestRun` / `digest:addDigestSignal` mutations before session tests

### Convex patterns (brownfield reference)

Follow `convex/notebookQueries.ts` for public mutation/query export style and `convex/digest.ts` for digest FK patterns. Use `mutation` / `query` from `./_generated/server` — **no `'use node'`** in this file.

### Project structure notes

Architecture §8 lists `completeInvestigationSession`, `failInvestigationSession`, `cancelInvestigationSession` — **out of 66-3 scope**. 66-1 can finalize via `patchInvestigationResponse({ chunk: '', status: 'complete' })` or add dedicated mutations in a follow-up if cleaner.

Architecture index name `by_signal_action_created` uses `signalId` in docs — implement with **`digestSignalId`** per operator contract; index field names must match validator field names.

---

## Previous Story Intelligence

Epic 65 (latest: **65-9**) established inspector drawer UI patterns and confirmed `digestSignals` scoring fields are projected by `getDigestSignalsForRun`. Key learnings for 66-3:

- Convex tests use `convexTest` + glob import of all `convex/**/*.ts` modules
- `workspaceId` is optional and omitted on digest rows in v1 — same pattern here
- Test count discipline: 65-9 baseline was 414; current baseline **423** — preserve or increase
- Inspector drawer subscription patterns (skip-when-closed) are 66-1 concerns — not this story

---

## References

- [Source: `_bmad-output/planning-artifacts/architecture-epic-66-nexus-agent-orchestration.md` §3.1–3.2] — schema + API (operator scope supersedes field names)
- [Source: `_bmad-output/planning-artifacts/architecture-epic-66-nexus-agent-orchestration.md` ADR-E66-001, E66-004, E66-006] — gate, workspaceId, restore
- [Source: `_bmad-output/planning-artifacts/prds/prd-epic-66-2026-06-09/prd.md` §4.1] — FR-1, FR-2, FR-3
- [Source: `cns-dashboard/convex/schema.ts`] — table registration pattern
- [Source: `cns-dashboard/convex/validators.ts`] — row validator pattern (`digestSignalRowValidator`)
- [Source: `cns-dashboard/tests/convex/digest.test.ts`] — lifecycle test pattern with seeded digest rows
- [Source: `cns-dashboard/tests/convex/notebookQueries.test.ts`] — convex-test harness reference

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

- Schema validated and pushed to dev deployment via `npx convex dev --once` (avoids 65-9 interactive prompt blocker on `npm run build` / prod `convex deploy` confirm).
- `npm run build` still prompts for prod deploy confirmation in non-interactive shells (known from 65-9); `npx vite build` passes. CI uses `CONVEX_DEPLOY_KEY`.

### Completion Notes List

- Added `investigationActionValue`, `investigationStatusValue`, and `investigationSessionRowValidator` to `convex/validators.ts` (no `workspaceId`).
- Registered `investigationSessions` table with `by_signal_action_created` index on `[digestSignalId, action, createdAt]`.
- Implemented four public Convex functions in `convex/investigationSessions.ts`: create, append-patch, get-by-id, get-latest-for-signal.
- `patchInvestigationResponse` uses read-concat-patch append semantics; throws `ConvexError` when session missing.
- Added 8 tests in `tests/convex/investigation-sessions.test.ts` covering round-trip, append, latest-by-createdAt, null cases, and not-found patch.
- Test count: **431** (423 baseline + 8 new). Lint clean. `bash scripts/verify.sh` passed.
- Dev schema deploy: `npx convex dev --once` added index `investigationSessions.by_signal_action_created`. Operator prod deploy: `npx convex deploy` when ready to merge gate story.

### File List

- `cns-dashboard/convex/validators.ts` (modified)
- `cns-dashboard/convex/schema.ts` (modified)
- `cns-dashboard/convex/investigationSessions.ts` (new)
- `cns-dashboard/tests/convex/investigation-sessions.test.ts` (new)
- `cns-dashboard/convex/_generated/api.d.ts` (regenerated by convex dev)

### Change Log

- 2026-06-09 — Story 66-3 implemented: `investigationSessions` schema + CRUD gate (review).
