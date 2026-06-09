---
story_id: 66-1
epic: 66
title: inspector-ai-action-wiring
status: review
repo: cns-dashboard
depends_on: 66-3
gate_commit: caf4ab8
operator_brief: 2026-06-09
source: architecture-epic-66-nexus-agent-orchestration.md §4–6, prd-epic-66-2026-06-09/prd.md §4.2
baseline_tests: 432
baseline_commit: caf4ab8
---

# Story 66.1: Wire Inspector Actions with Streaming Claude Responses

Status: ready-for-dev

> **Depends on 66-3 (merged, prod deployed at `caf4ab8`).** Gate APIs live: `createInvestigationSession`, `patchInvestigationResponse`, `getInvestigationSession`, `getLatestSessionForSignal`.

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

## Story

As a **Nexus operator inspecting a digest signal in the Intelligence Inspector drawer**,
I want **Explain, Compare, Trace, and Ask AI actions to stream Anthropic responses into a persistent investigation session**,
so that **I can interrogate signal intelligence in-place with reactive streaming UX and 24h session restore without re-running the model (ADR-E66-003, ADR-E66-006)**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | 66 — Nexus Agent Orchestration |
| **Repo** | **cns-dashboard only** — Convex `'use node'` action, lib helpers, drawer UI |
| **Gate** | **66-3** merged at `caf4ab8` — `investigationSessions` table + four public APIs |
| **Normative spec** | `architecture-epic-66-nexus-agent-orchestration.md` §4–6; ADR-E66-002–007 |
| **PRD** | `prd-epic-66-2026-06-09/prd.md` §4.2 (FR-4–FR-11) |
| **Out of scope** | Screen 10 workspace (66-2); Hermes/Discord dispatch; SvelteKit `/api/nexus/investigate/*` routes; vault WriteGate; `workspaceId` on sessions |

### Operator brief (binding)

Wire the four inert `INSPECTOR_ACTIONS` buttons in `NexusInspectorDrawer.svelte`. Anthropic runs **only** in `convex/investigation.node.ts` (`'use node'`). Port patterns from `src/lib/server/trends-claude.ts` — **never import** that file into `convex/` (it uses SvelteKit `$env/static/private`).

| Action | Prompt focus | Context |
|--------|----------------|---------|
| **explain** | "Why does this signal matter right now?" | title, summary, scores, sourceType, disposition, rankScore |
| **compare** | "How has this topic changed vs last week?" | current signal + `getPriorDigestSignalsForTopic` (max 2 priors, 7-day window) |
| **trace** | "What sources contributed to this signal and with what weight?" | sourceMetadata, sourceType, normalizedEngagement |
| **ask_ai** | Operator freeform question | signal context bundle + user prompt |

**Compare prod gate (ADR-E66-007):** Compare button **disabled** when `NEXUS_COMPARE_ENABLED` unset/false in production. Convex action must reject compare if flag false. Dev builds default enabled (`import.meta.env.DEV` or explicit env).

### Problem (current state)

`NexusInspectorDrawer.svelte` lines 559–578 render a 2×2 action grid with all buttons `disabled` and tooltip `"Hermes wiring ships in Epic 64"`. No investigation flow exists. Gate persistence from 66-3 is deployed but unused.

### Critical brownfield gap (must fix in this story)

`getDigestSignalsForRun` **does not return** `digestSignalId` (`_id` is stripped in the mapper at `convex/digest.ts:150-183`). Session APIs require `Id<'digestSignals'>`. **T0** extends the query return shape with `digestSignalId` and updates client `DigestSignalRow` typing — without this, drawer wiring cannot call `createInvestigationSession` or `getLatestSessionForSignal`.

---

## Acceptance Criteria

### AC-1: Explain streams and persists

**Given** I open the inspector for a topic with a scored digest signal and valid `ANTHROPIC_API_KEY` in Convex env  
**When** I tap **Explain**  
**Then** the 2×2 grid hides and `NexusInvestigationPanel` shows with streaming response text  
**And** `useQuery(getInvestigationSession)` updates reactively as `response` grows (~250ms patch cadence)  
**And** a row exists in `investigationSessions` with `action: explain`, `status: complete`, non-empty `response`  
**And** response references signal title and at least one scored dimension when available (FR-4)

### AC-2: Back returns grid without deleting session

**Given** an investigation panel is active (streaming or complete)  
**When** I tap **Back** in the panel  
**Then** the 2×2 action grid reappears  
**And** the session row is **not** deleted from Convex

### AC-3: Auto-restore on drawer reopen (<24h)

**Given** a **complete** investigation session for this signal exists with `createdAt` within the last 24 hours  
**When** I close the drawer and reopen it for the same signal  
**Then** `NexusInvestigationPanel` auto-shows the cached response (no new Anthropic call)  
**And** re-tapping the same action starts a **fresh** session via `createInvestigationSession` (ADR-E66-006)

### AC-4: Compare disabled without smoke-test flag

**Given** `NEXUS_COMPARE_ENABLED` is unset or `false` in production  
**When** the action grid renders  
**Then** the Compare button is `disabled` with tooltip explaining smoke-test gate  
**And** the Convex action rejects compare invocations defensively

### AC-5: Ask AI input gate

**Given** I tap **Ask AI**  
**When** the panel opens  
**Then** I see a text input **before** any session is created  
**And** submitting an empty prompt is blocked client-side  
**And** a non-empty prompt creates a session with `action: ask_ai` and stored `prompt` matching input verbatim (FR-7)

### AC-6: Regression gate

**Given** implementation is complete  
**When** `npm test`, `npm run lint`, `npm run build` run in cns-dashboard  
**And** `bash scripts/verify.sh` runs from Omnipotent.md  
**Then** **432 baseline tests preserved + new tests green**

### AC-7: Convex deploy sanity

**When** `npx convex dev --once` runs  
**Then** schema/functions push succeeds with no validation errors

### AC-8: No SvelteKit env in convex/

**When** the diff is reviewed  
**Then** no `convex/**` file imports `$env/static/private` or `$env/static/public`

---

## Tasks / Subtasks

- [x] **T0: Expose `digestSignalId` on digest signal query** (AC: 1, 3 — blocking)
  - [x] T0.1 Add `digestSignalListItemValidator` in `convex/validators.ts` = `digestSignalRowValidator` fields + `digestSignalId: v.id('digestSignals')`
  - [x] T0.2 Change `getDigestSignalsForRun` `returns` to `v.array(digestSignalListItemValidator)`; map `_id` → `digestSignalId` in handler
  - [x] T0.3 Extend `DigestSignalRow` in `src/lib/utils/nexus-inspector-scoring.ts` with optional `digestSignalId?: string` (or dedicated type)
  - [x] T0.4 Update `tests/convex/digest.test.ts` to assert `digestSignalId` present on returned rows

- [x] **T1: `getPriorDigestSignalsForTopic` query** (AC: 1 compare path)
  - [x] T1.1 Add to `convex/digest.ts`:
  - [x] T1.2 Algorithm (ADR-E66-005)
  - [x] T1.3 Tests in `tests/convex/digest-prior-signals.test.ts`: two prior runs match; zero priors; 7-day cutoff excludes older runs; limit clamp

- [x] **T2: Context + prompt pure modules** (AC: 1, 5)
  - [x] T2.1 `convex/lib/investigationContext.ts`
  - [x] T2.2 `convex/lib/investigationPrompts.ts`
  - [x] T2.3 Unit tests: `tests/convex/investigation-context.test.ts`, `tests/convex/investigation-prompts.test.ts`

- [x] **T3: Convex Anthropic action** — `convex/investigation.ts` (AC: 1, 4, 5, 7, 8)
  - [x] T3.1–T3.7 Implemented `runInvestigation` with throttled streaming patches; tests in `tests/convex/investigation-action.test.ts`

- [x] **T4: Client utilities** — `src/lib/utils/nexus-investigation.ts` (AC: 2, 3, 4, 5)
  - [x] T4.1–T4.6 Tests in `tests/lib/nexus-investigation.test.ts`

- [x] **T5: `NexusInvestigationPanel.svelte`** (AC: 1, 2, 5)

- [x] **T6: Wire `NexusInspectorDrawer.svelte`** (AC: 1–5)

- [x] **T7: Verify** (AC: 6, 7)
  - [x] T7.1 `npm test` — 449 passing (432 baseline + 17 new)
  - [x] T7.2 `npm run lint && npx vite build`
  - [x] T7.3 `npx convex dev --once`
  - [x] T7.4 `bash scripts/verify.sh` from Omnipotent.md

---

## Dev Notes

### Architecture compliance

| ADR | Requirement |
|-----|-------------|
| **E66-002** | Anthropic only in `convex/investigation.node.ts`; client calls `convexClient.action` |
| **E66-003** | Stream via throttled `patchInvestigationResponse`; UI via `useQuery(getInvestigationSession)` |
| **E66-004** | Omit `workspaceId` on all session writes |
| **E66-005** | Compare: 7-day window, max 2 prior runs |
| **E66-006** | Auto-restore complete sessions &lt;24h on drawer open; re-tap creates new session |
| **E66-007** | Compare prod gate via `NEXUS_COMPARE_ENABLED` |
| **E66-008** | No Hermes wiring |

**Operator contract overrides architecture doc where they differ:**
- FK field: `digestSignalId` (not `signalId`)
- Session starts `pending` → action transitions to `streaming` (66-3 validator)
- Public mutations (not `internalMutation`) — action uses `ctx.runMutation(api.investigationSessions.*)`
- `patchInvestigationResponse` rejects patches when `status === 'complete' | 'error'` (implemented in 66-3 — finalize with last chunk + status in one patch)

### `NexusInspectorDrawer.svelte` — current state (preserve)

| Section | Lines (approx) | Must preserve |
|---------|----------------|---------------|
| Topic metadata, sparkline, WoW | 381–435 | Yes |
| Why this matters (digest brief) | 437–446 | Yes |
| Signal Intelligence scoring (65-9) | 448–490 | Yes |
| Source trace | 492–513 | Yes |
| Source weights | 515–535 | Yes |
| Related signals | 537–557 | Yes |
| **Actions grid** | 559–578 | **Replace behavior only** |
| Footer track/dismiss | 584–602 | Yes |

Existing patterns to follow:
- `useQuery(..., () => condition ? args : 'skip')` for drawer-close subscription discipline
- `useConvexClient()` for mutations/actions (see `trackTopic()` at line 322)
- `scoredDigestSignal` from `resolveScoredDigestSignal(digestSignals, digestFocusKeyword)` (65-9)

### Gate API reference (`convex/investigationSessions.ts`)

```typescript
createInvestigationSession({ digestSignalId, action, prompt }) → Id  // status: pending
patchInvestigationResponse({ sessionId, chunk, status? })          // append semantics
getInvestigationSession({ sessionId }) → row | null
getLatestSessionForSignal({ digestSignalId, action }) → row | null
```

### Anthropic port checklist (from `trends-claude.ts`)

| Constant / pattern | Value |
|--------------------|-------|
| Package | `@anthropic-ai/sdk` `^0.98.1` (already in package.json) |
| Model | `claude-sonnet-4-20250514` |
| Max tokens | `1024` |
| API key | `process.env.ANTHROPIC_API_KEY` in Convex dashboard (dev + prod) |
| Client init | Lazy singleton like `getAnthropicClient()` but using `process.env` |
| Stream API | `client.messages.stream({ model, max_tokens, system, messages })` + `.on('text', delta => ...)` |
| Abort | Optional v1 — architecture defers `cancelInvestigationSession`; partial stream + error status acceptable for MVP |

**Context7 required during dev:** Before implementing SDK calls, run `resolve-library-id` + `query-docs` for `@anthropic-ai/sdk` streaming in Node.

### Compare empty-state copy (no tokens)

When `getPriorDigestSignalsForTopic` returns `[]`, create session and set response to operator-readable static text, e.g.:

> "No prior digest signals found for this topic in the last 7 days. Run another morning digest or wait for the next cycle to enable week-over-week comparison."

Do **not** call Anthropic.

### Files to touch

| File | Action |
|------|--------|
| `convex/digest.ts` | MODIFY — `digestSignalId` on list query + `getPriorDigestSignalsForTopic` |
| `convex/validators.ts` | MODIFY — `digestSignalListItemValidator` |
| `convex/investigation.node.ts` | **NEW** — `runInvestigation` action |
| `convex/lib/investigationContext.ts` | **NEW** |
| `convex/lib/investigationPrompts.ts` | **NEW** |
| `src/lib/utils/nexus-investigation.ts` | **NEW** |
| `src/lib/utils/nexus-inspector-scoring.ts` | MODIFY — `digestSignalId` on type |
| `src/lib/components/nexus/NexusInvestigationPanel.svelte` | **NEW** |
| `src/lib/components/nexus/NexusInspectorDrawer.svelte` | MODIFY — wire actions + restore |
| `tests/convex/digest-prior-signals.test.ts` | **NEW** |
| `tests/convex/investigation-context.test.ts` | **NEW** |
| `tests/convex/investigation-prompts.test.ts` | **NEW** |
| `tests/convex/investigation-action.test.ts` | **NEW** |
| `tests/lib/nexus-investigation.test.ts` | **NEW** |
| `tests/convex/digest.test.ts` | MODIFY — assert `digestSignalId` |

### Files DO NOT touch

| File | Reason |
|------|--------|
| `src/lib/server/trends-claude.ts` | Reference only — no convex import |
| Omnipotent.md vault / WriteGate paths | Out of scope |
| `convex/schema.ts` | No schema changes beyond 66-3 |

### Testing standards

| Suite | Pattern |
|-------|---------|
| Convex | `convexTest(schema, import.meta.glob('../../convex/**/*.ts'))` — mirror `investigation-sessions.test.ts` |
| Lib utils | Vitest + `edge-runtime` — mirror `nexus-inspector.test.ts` |
| Component render states | **No `@testing-library/svelte` in repo** — test `derivePanelViewState()` in `nexus-investigation.test.ts` covering loading/streaming/complete/error/ask-input modes (mirrors `echarts-panel.test.ts` SSR contract pattern) |
| Anthropic | `vi.mock('@anthropic-ai/sdk')` in action tests — never hit live API in CI |
| Baseline | **432** tests at `caf4ab8` — must not decrease |

### Node action pattern (brownfield reference)

See `convex/trendAnalytics.ts`: `'use node'` + `internalAction` + `ctx.runQuery` / `ctx.runMutation`. This story uses **public** `action()` + `api.investigationSessions.*` (66-3 public mutations).

### Auth (FR-11)

v1 trust model: Nexus `/nexus/*` behind existing SvelteKit auth cookie. No new Convex Auth checks. Document in completion notes — same as trends Claude routes.

### Env vars summary

| Var | Where | Purpose |
|-----|-------|---------|
| `ANTHROPIC_API_KEY` | Convex dashboard | Anthropic SDK |
| `NEXUS_COMPARE_ENABLED` | Convex dashboard | Action guard for compare |
| `PUBLIC_NEXUS_COMPARE_ENABLED` | Vercel / `.env.local` (optional) | Client Compare button enable |

---

## Previous Story Intelligence (66-3)

- Gate merged `caf4ab8`; **432** tests (8 investigation-session tests added on 423 baseline)
- `patchInvestigationResponse` **appends** `existing + chunk` — never replace
- Terminal status guard: cannot patch after `complete` or `error` — batch final chunk + status in one call
- `workspaceId` omitted on inserts
- UI action `ask-ai` → storage `ask_ai` (mapper in 66-1)
- Deploy: `npx convex dev --once` avoids interactive prod prompt; prod via `npx convex deploy` / CI `CONVEX_DEPLOY_KEY`
- `getDigestSignalsForRun` already used by drawer for scoring — extending return shape is low-risk

---

## Git Intelligence

Recent commits on `cns-dashboard`:

| Commit | Relevance |
|--------|-----------|
| `caf4ab8` | 66-3 gate — investigationSessions CRUD |
| `2ee2b9d` | 65-9 scoring panel + digest signal wiring in drawer |
| `5f86e9d` | 64-1 digestSignals scoring schema |

Patterns: one epic per commit; convex-test for new queries; util extraction for Svelte-adjacent logic.

---

## Latest Tech Information

- `@anthropic-ai/sdk` **0.98.x** supports `client.messages.stream()` with event `.on('text')` — same API used in `trends-claude.ts`
- Convex `'use node'` actions can call public mutations via `ctx.runMutation(api.module.fn, args)`
- `convex-svelte` `useQuery` reactively updates when patched session row changes — no SSE/fetch stream needed

---

## Project Context Reference

- Dashboard env rule (ADR-E63-005): use `PUBLIC_*` / `CNS_*` — not `NEXUS_VAULT_DIR` etc.
- Verify gate: `bash scripts/verify.sh` from Omnipotent.md
- Epic 46 UI: dark precision instrument, teal accent (`--nx-accent-primary`)

---

## References

- [Source: `_bmad-output/planning-artifacts/architecture-epic-66-nexus-agent-orchestration.md` §4–6, ADR-E66-002–007]
- [Source: `_bmad-output/planning-artifacts/prds/prd-epic-66-2026-06-09/prd.md` §4.2 FR-4–FR-11]
- [Source: `_bmad-output/implementation-artifacts/66-3-investigation-sessions-schema-crud-gate.md`]
- [Source: `cns-dashboard/convex/investigationSessions.ts`]
- [Source: `cns-dashboard/src/lib/server/trends-claude.ts`] — port pattern, do not import
- [Source: `cns-dashboard/src/lib/components/nexus/NexusInspectorDrawer.svelte`]
- [Source: `cns-dashboard/convex/digest.ts` — `keywordsMatch`, `getDigestSignalsForRun`]

---

## Dev Agent Record

### Agent Model Used

Composer

### Completion Notes List

- **T0 PRE-FLIGHT:** `getDigestSignalsForRun` now maps `_id` → `digestSignalId` via `digestSignalListItemValidator`; deployed with `npx convex dev --once`.
- Wired Explain / Compare / Trace / Ask AI in `NexusInspectorDrawer` with `NexusInvestigationPanel`, 24h session restore, and Compare prod gate (`PUBLIC_NEXUS_COMPARE_ENABLED` / `NEXUS_COMPARE_ENABLED`).
- Added `convex/investigation.ts` (`'use node'`) `runInvestigation` action with throttled Anthropic streaming into `investigationSessions`.
- Added `getPriorDigestSignalsForTopic`, context/prompt modules, and 17 new tests (449 total; baseline 432 preserved).
- `bash scripts/verify.sh` green; prod deploy via `npx convex deploy` when merging.

### File List

- `convex/digest.ts`
- `convex/validators.ts`
- `convex/investigation.ts`
- `convex/lib/investigationContext.ts`
- `convex/lib/investigationPrompts.ts`
- `src/lib/utils/nexus-inspector-scoring.ts`
- `src/lib/utils/nexus-investigation.ts`
- `src/lib/components/nexus/NexusInvestigationPanel.svelte`
- `src/lib/components/nexus/NexusInspectorDrawer.svelte`
- `src/routes/nexus/nexus-theme.css`
- `.env.example`
- `tests/convex/digest.test.ts`
- `tests/convex/digest-prior-signals.test.ts`
- `tests/convex/investigation-action.test.ts`
- `tests/convex/investigation-context.test.ts`
- `tests/convex/investigation-prompts.test.ts`
- `tests/lib/nexus-investigation.test.ts`

### Change Log

- 2026-06-09: Story 66-1 implemented — inspector AI action wiring; status → review.
