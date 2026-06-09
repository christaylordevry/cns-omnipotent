---
title: Epic 66 — Nexus Agent Orchestration
status: final
created: 2026-06-09
updated: 2026-06-09
epicScope: epic-66
workflowType: prd
inputDocuments:
  - Operator brief (2026-06-09)
  - _bmad-output/planning-artifacts/sprint-change-proposal-2026-06-08.md
  - _bmad-output/planning-artifacts/sprint-change-proposal-2026-06-06.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/prd-epic-64-intelligence-scoring-engine.md
  - _bmad-output/planning-artifacts/prds/prd-epic-65-2026-06-09/prd.md
  - _bmad-output/implementation-artifacts/epic-65-retro-2026-06-09.md
  - _bmad-output/implementation-artifacts/65-9-surface-intelligence-scoring-inspector-drawer.md
  - project-context.md
relatedPrd:
  - _bmad-output/planning-artifacts/prd-epic-64-intelligence-scoring-engine.md
  - _bmad-output/planning-artifacts/prds/prd-epic-65-2026-06-09/prd.md
relatedArchitecture:
  - _bmad-output/planning-artifacts/architecture-epic-63-nexus-cockpit.md
  - _bmad-output/planning-artifacts/architecture-epic-66-nexus-agent-orchestration.md
classification:
  projectType: internal-tool
  domain: ai-orchestration-control-plane
  complexity: medium
  projectContext: brownfield
repos:
  primaryUi: cns-dashboard
  hermesSkills: Omnipotent.md
---

# PRD: Epic 66 — Nexus Agent Orchestration

**Author:** Chris Taylor  
**Date:** 2026-06-09  
**Product:** CNS Nexus Intelligence — Intelligence Inspector AI actions  
**Epic:** 66  
**Status:** Final

## 0. Document Purpose

This PRD is the normative product contract for Epic 66 story authoring (`66-1` through `66-3`, with MVP scope adjustments per operator brief). Downstream consumers: `/bmad-create-architecture`, `/bmad-create-story`, and `/bmad-dev-story`.

The document anchors vocabulary in §3 Glossary. Functional requirements use globally numbered FR IDs (`FR-1` through `FR-N`) scoped to this epic. Assumptions inferred without operator confirmation are tagged `[ASSUMPTION]` and indexed in §9.

**Primary inputs:** Operator brief (four inspector actions, `investigationSessions` persistence, drawer streaming UX, Screen 10 deferral). **Normative upstream for signal context:** Epic 64 scored `digestSignals`, Epic 65 adapter ingest, Story 65-9 Signal Intelligence panel in `NexusInspectorDrawer.svelte`. **Reference implementation:** legacy `/trends` `TrendContextDrawer` Anthropic streaming (`trends-claude.ts`).

**Gate pattern (normative):** Story **66-3 (`investigationSessions` schema)** is the **data gate** for **66-1 (inspector action wiring)** — analogous to 64-1 gating 64-2..64-5 and 65-2 gating 65-3. No action wiring story may merge without session persistence contract.

**Scope adjustment:** `sprint-change-proposal-2026-06-08.md` lists 66-2 as Screen 10. Operator brief defers Screen 10 to v2; Epic 66 MVP delivers drawer action wiring only. Story 66-2 remains in the epic registry as **deferred / v2**.

---

## 1. Vision

Epic 63 shipped the Nexus Intelligence Cockpit with a 320px Intelligence Inspector drawer: sparkline, digest brief, source trace, source weights, scored Signal Intelligence (65-9), and a polished 2×2 action grid — **UI only, no actions wired**. The operator can see *what* moved and *how it scored*, but cannot ask the system *why it matters right now*, *what changed since last week*, *which sources drove the signal*, or *pose a follow-up question* without leaving Nexus.

Epic 66 closes that gap. Each of the four inspector actions opens an **Investigation Session**: a persisted record tying a `digestSignal` to an action, prompt, and AI response. While a session runs, the drawer replaces the action grid with a streaming response surface; when complete, the result is stored in Convex so re-opening the drawer shows the last investigation for that signal and action.

This epic is the **action wiring** that makes Screen 10 (Agent Orchestration Workspace, Stitch design) possible later — not the full orchestration workspace itself. MVP keeps the operator in the inspector drawer; v2 expands to multi-signal investigation on Screen 10 using the same `investigationSessions` foundation.

Model inference uses **`claude-sonnet-4-20250514`** via the Anthropic API, reusing the proven streaming stack from `/trends` artifacts. Compare and Trace actions ground responses in Convex digest and signal data before optional AI synthesis — the operator gets evidence-backed answers, not hallucinated market motion.

---

## 2. Target User

### 2.1 Jobs To Be Done

- **Explain urgency** — Understand why a ranked signal matters *right now* in the context of watchlist, sprint, and scored dimensions — without reading raw JSON or opening five tabs.
- **Detect drift** — See how this signal differs from the prior week's digest for the same topic before committing attention.
- **Trust provenance** — Know which sources contributed and with what weights when deciding to escalate or dismiss.
- **Ask follow-ups** — Pose a freeform question scoped to the signal under inspection and get a streamed answer in-place.
- **Resume context** — Re-open the inspector and see the last investigation result without re-running the model.

### 2.2 Non-Users (v1)

- Discord-only operators (MVP is Nexus drawer; Hermes webhook investigate remains separate legacy path).
- External API consumers (no public investigation API).
- Multi-user collaboration on shared investigation canvases (Screen 10 v2).

### 2.3 Key User Journeys

**UJ-1. Chris explains a priority signal from the morning digest.**

- **Persona + context:** CNS operator; Nexus cockpit open after morning digest; a `priority` disposition signal ranks high on the anomaly feed.
- **Entry state:** Authenticated Nexus session; Intelligence Inspector closed; topic selected from feed.
- **Path:** Operator opens inspector → reviews Signal Intelligence panel (65-9) → taps **Explain** → action grid swaps to streaming panel → prose streams in → session saved.
- **Climax:** Explanation references `rankScore`, dimension scores, and digest brief — operator understands why this signal beat adjacent headlines.
- **Resolution:** Operator tracks topic or dismisses; closes drawer. Re-opens later → last Explain result visible without re-invoking model.
- **Edge case:** `ANTHROPIC_API_KEY` unset → muted error with retry; no partial session marked complete.

**UJ-2. Chris compares today's agent-framework signal to last week.**

- **Persona + context:** Operator watching recurring AI tooling themes across digest runs.
- **Entry state:** Inspector open on topic with `digestFocusKeyword` matching prior run.
- **Path:** Taps **Compare** → system loads prior-run `digestSignals` for same topic → diff narrative streams (new sources, score deltas, disposition change).
- **Climax:** Operator sees "Reddit thread new this week; `momentum` +18 vs prior run" — actionable drift, not a raw table.
- **Resolution:** Compare session persisted; operator decides whether to escalate to Hermes research externally.
- **Edge case:** No prior digest run within lookback → structured message "No prior digest for this topic in the last 7 days" (no model call).

**UJ-3. Chris traces source provenance before trusting a spike.**

- **Persona + context:** Skeptical of single-source spikes after Epic 65 added GitHub/Reddit/RSS.
- **Entry state:** Inspector showing source trace list and weights panel (existing 63-5 data).
- **Path:** Taps **Trace** → system aggregates `getSourceWeightsForTopic` + grouped `signalEvents` → streams narrative listing contributors and weights.
- **Climax:** Operator confirms GitHub stars + HN points compound — not a lone NewsAPI headline.
- **Resolution:** Trace session stored; source trace panel remains scrollable above/below session panel per layout spec.

**UJ-4. Chris asks a scoped follow-up without leaving Nexus.**

- **Persona + context:** Operator wants "How does this relate to our Epic 38 run-chain deferral?" — not covered by fixed Explain template.
- **Entry state:** Inspector open; prior Explain session may exist.
- **Path:** Taps **Ask AI** → inline prompt field → submits → streamed response → persisted with operator prompt text.
- **Climax:** Answer cites signal title, scores, and digest brief context; stays on-topic.
- **Resolution:** Session saved with `action: ask_ai` and full `prompt` for audit.

---

## 3. Glossary

| Term | Definition |
|------|------------|
| **Intelligence Inspector** | 320px `NexusInspectorDrawer` panel (Story 63-5). Hosts signal context, scoring, trace, weights, and action grid. |
| **Inspector action** | One of four operator triggers: `explain`, `compare`, `trace`, `ask_ai`. Maps 1:1 to grid buttons (labels: Explain, Compare, Trace, Ask AI). |
| **Investigation Session** | Single operator invocation of an inspector action for a specific `digestSignal`. Persisted as a row in `investigationSessions`. |
| **investigationSessions** | New Convex table (Story 66-3). Fields: `signalId`, `action`, `prompt`, `response`, `createdAt`, `workspaceId` (plus status/metadata per addendum). |
| **signalId** | Convex `Id<'digestSignals'>` for the `digestSignal` row under inspection. `[ASSUMPTION: primary key reference]` |
| **workspaceId** | String scoping sessions to a Nexus workspace (tenant/operator partition). `[ASSUMPTION: v1 may use single constant or authenticated user id]` |
| **Session-active UI** | Drawer mode where the 2×2 action grid is hidden and a streaming/result panel occupies its place until operator dismisses or starts a new action. |
| **Signal context bundle** | Aggregated Convex + digest data passed to prompt builders: topic, scored signal, brief, WoW delta, weights, trace events. See addendum A4. |
| **digestSignal** | Scored intelligence row (Epic 64): `scores`, `disposition`, `rankScore`, `sourceType`, metadata. Primary investigation anchor. |
| **Compare lookback** | Prior `digestRun` signals for same topic/keyword within configurable window (default 7 days). `[ASSUMPTION]` |
| **Screen 10** | Stitch Agent Orchestration Workspace — full investigation surface. **Out of Epic 66 MVP**; consumes `investigationSessions` in v2. |
| **trends-claude stack** | `trends-claude.ts`, `trends-claude-prompts.ts`, SvelteKit streaming routes. Reference for Nexus investigation endpoints. |

---

## 4. Features

### 4.1 Investigation Session Persistence (66-3)

**Description:** Introduce `investigationSessions` Convex table and queries so every inspector action has durable storage. Sessions record which signal was investigated, which action ran, the rendered prompt, final response text, and timestamps. Indexes support "latest session per signal+action+workspace" for drawer restore. Realizes UJ-1, UJ-4.

**Functional Requirements:**

#### FR-1: investigationSessions table

System defines `investigationSessions` in `convex/schema.ts` with at minimum: `workspaceId`, `signalId`, `action`, `prompt`, `response`, `createdAt`. Optional denormalized fields (`topicSlug`, `status`, `completedAt`, `errorMessage`) per addendum A3. Realizes UJ-1.

**Consequences (testable):**
- Convex schema deploy succeeds; `npx convex dev` / dashboard tests pass.
- Validator rejects unknown `action` literals.
- Index supports latest-session lookup by `workspaceId` + `signalId` + `action`.

**Out of Scope:**
- Screen 10 session list UI (v2).
- Cross-signal session threading.

#### FR-2: Session write API

System exposes Convex mutation(s) to create/update investigation sessions: insert on action start (`status: streaming`), patch `response` on stream complete (`status: complete`), record `errorMessage` on failure. Realizes UJ-1, UJ-4.

**Consequences (testable):**
- Mutation creates row with `createdAt` and empty or partial `response` on start.
- Final mutation sets `response` to full accumulated text and `status: complete`.
- Failed stream sets `status: error` without marking complete.

#### FR-3: Session read API

System exposes query `getLatestInvestigationSession(workspaceId, signalId, action)` returning most recent complete session or null. Realizes UJ-1 (restore on re-open).

**Consequences (testable):**
- Query returns latest by `createdAt` desc for the composite key.
- Returns null when no prior session exists.
- Drawer can subscribe reactively via `useQuery`.

**Feature-specific NFRs:**
- Session rows retained indefinitely in v1 `[ASSUMPTION]`; no TTL purge.

---

### 4.2 Inspector Action Wiring (66-1)

**Description:** Wire the four inert `INSPECTOR_ACTIONS` buttons in `NexusInspectorDrawer.svelte` to investigation flows. Each action builds a signal context bundle, renders a prompt (fixed template or operator input for Ask AI), streams model output, and persists via FR-2. Realizes UJ-1 through UJ-4.

**Functional Requirements:**

#### FR-4: Explain action

Operator tapping **Explain** starts an investigation session with `action: explain`. System builds prompt from signal context bundle and streams Anthropic response using model `claude-sonnet-4-20250514`. Realizes UJ-1.

**Consequences (testable):**
- First token appears in drawer within 3s on warm server `[ASSUMPTION: local dev]`.
- Response references signal title and at least one scored dimension when available.
- Session persisted with `action: explain` on completion.

#### FR-5: Compare to last week action

Operator tapping **Compare** starts session with `action: compare`. System loads prior digest signals for same topic within Compare lookback, computes structured diff, and streams narrative (Convex-only path acceptable when no prior run; otherwise Anthropic synthesis of diff). Realizes UJ-2.

**Consequences (testable):**
- When prior run exists, response mentions at least one delta dimension (score, disposition, or source presence).
- When no prior run, operator sees explicit empty-state copy without charged model call.
- Session persisted with compare prompt including prior-run snapshot reference.

#### FR-6: Trace sources action

Operator tapping **Trace** starts session with `action: trace`. System aggregates source weights and grouped signal events already available to drawer queries, streams provenance narrative. Realizes UJ-3.

**Consequences (testable):**
- Response names at least one `sourceType` contributor when trace data exists.
- Weights from `getSourceWeightsForTopic` reflected in output ordering.
- Session persisted on completion.

#### FR-7: Ask AI action

Operator tapping **Ask AI** reveals prompt input scoped to current signal; submission starts session with `action: ask_ai` and operator `prompt` text. System streams Anthropic response with signal context bundle as grounding. Realizes UJ-4.

**Consequences (testable):**
- Empty prompt submission blocked client-side.
- Stored `prompt` field matches operator input verbatim.
- Response does not execute tool calls or vault mutations.

#### FR-8: Drawer session-active UI

When any action is in progress or displaying a result, the 2×2 action grid is replaced by a session panel showing: action label, streaming text (or final markdown/plain), dismiss/back control to return to grid without deleting persisted session. Realizes UJ-1.

**Consequences (testable):**
- Grid not visible while session panel active.
- Dismiss returns to grid; latest complete session still loadable on next action tap or auto-restore per FR-9.
- `Escape` closes drawer (existing 63-5 behavior); does not delete session.

#### FR-9: Session restore on drawer open

When inspector opens for a signal, system loads latest complete session per action (or latest overall `[ASSUMPTION: per-action restore on re-tap only]`) so operator sees last result without re-invoking model. Realizes UJ-1.

**Consequences (testable):**
- Re-open drawer → tap Explain → shows cached response if complete session exists and operator has not requested refresh.
- Optional "Re-run" control invalidates cache by creating new session `[ASSUMPTION: architecture owns UX detail]`.

#### FR-10: Anthropic configuration guard

Investigation endpoints return 503 with `CLAUDE_NOT_CONFIGURED` when `ANTHROPIC_API_KEY` absent, matching trends API behavior. Realizes UJ-1 edge case.

**Consequences (testable):**
- No client-side key exposure.
- Drawer shows operator-readable error state.

#### FR-11: Auth guard on investigation endpoints

Server routes/actions require same auth gate as trends Claude endpoints before streaming. Realizes security constraint.

**Consequences (testable):**
- Unauthenticated request returns 401/403 per existing Nexus API policy.
- Contract test or route test covers rejected unauthenticated call.

**Notes:**
- Update stale tooltip "Hermes wiring ships in Epic 64" → "Epic 66" when enabling buttons.
- Compare/Trace may use Convex action or SvelteKit route; transport detail in addendum A1.

---

### 4.3 Agent Orchestration Workspace — Screen 10 (66-2, deferred)

**Description:** Full Stitch Screen 10 investigation workspace — multi-panel orchestration, session history sidebar, optional Hermes dispatch. **Not in Epic 66 MVP.** MVP drawer sessions populate `investigationSessions` for future Screen 10 consumption.

**Functional Requirements:**

#### FR-12: Screen 10 route (deferred)

System provides `/nexus/orchestration` (or equivalent) multi-signal workspace. **Deferred to v2.**

**Out of Scope for Epic 66 MVP:** entire FR-12 implementation.

---

## 5. Non-Goals (Explicit)

- **Screen 10 full workspace** in Epic 66 MVP — drawer wiring only; data model enables v2.
- **Hermes Discord dispatch** for Ask AI in MVP — in-drawer Anthropic only `[ASSUMPTION]`.
- **Public investigation API** — operator-authenticated Nexus only.
- **Multi-model routing** — single model `claude-sonnet-4-20250514` for v1.
- **Automatic re-investigation on new digest runs** — operator-initiated only.
- **Vault WriteGate mutations** from investigation responses — read-only intelligence context.
- **Replacing Epic 44 trend-ingest or morning-digest pipelines** — investigation consumes their outputs only.

---

## 6. MVP Scope

### 6.1 In Scope

- `investigationSessions` Convex table + validators + indexes (66-3).
- Session create/update/query mutations and reactive drawer subscription (66-3).
- Four inspector actions wired with streaming UX (66-1).
- Signal context bundle from existing drawer queries + new compare lookback query.
- Anthropic streaming via server route pattern (`trends-claude.ts` reuse).
- Session restore and session-active drawer UI (replace action grid).
- Fixture/contract tests + `verify.sh` gate for schema and critical paths.
- Stale Epic 64 tooltip fix on action buttons.

### 6.2 Out of Scope for MVP

| Item | Reason |
|------|--------|
| Screen 10 Agent Orchestration Workspace (66-2) | Operator brief: longer-term surface; sessions table is foundation |
| Hermes `investigate-trend` webhook from Nexus Ask AI | Legacy `/trends` path; MVP uses Anthropic in-drawer |
| SSE `text/event-stream` transport | Raw `text/plain` stream sufficient (addendum A1) |
| Session TTL / retention policy | v1 retain all; operator can request purge story later |
| Investigation sessions for non-digest signals (trend-only topics) | MVP anchors on `digestSignal` rows from inspector context |
| Loading skeleton for scoring panel (65-9 defer) | Pre-existing defer; not Epic 66 scope |

---

## 7. Success Metrics

**Primary**

- **SM-1:** 100% of four inspector actions produce a persisted `investigationSessions` row on successful completion. Validates FR-2, FR-4–FR-7.
- **SM-2:** Re-opening inspector and re-tapping an action shows prior complete `response` without new Anthropic call (until operator re-runs). Validates FR-3, FR-9.
- **SM-3:** Explain and Ask AI responses stream first visible token within 3s p95 on dev hardware with key configured. Validates FR-4, FR-7, FR-8.

**Secondary**

- **SM-4:** Compare action returns structured empty-state (no model charge) when no prior digest run exists. Validates FR-5.
- **SM-5:** Trace action names ≥1 source contributor when `getSourceWeightsForTopic` returns non-empty weights. Validates FR-6.

**Counter-metrics (do not optimize)**

- **SM-C1:** Total Anthropic token volume per operator session — cap via `MAX_TOKENS` (1024) and context trimming; do not optimize for longer prose.
- **SM-C2:** Investigation count per signal — re-running Explain repeatedly should not be gamified; restore UX reduces waste.

---

## 8. Open Questions

1. **workspaceId resolution** — constant `default` vs authenticated Convex user id vs Nexus workspace selector? Architecture must pick one for v1.
2. **Compare lookback window** — 7 days default assumed; confirm operator preference.
3. **Session restore UX** — auto-show last Explain on drawer open vs only on action re-tap? PRD assumes re-tap restore `[ASSUMPTION]`.
4. **Prior digest query** — new `getPriorDigestSignalsForTopic` vs extend `getDigestSignalsForRun` — architecture owns API shape.
5. **Live digest validation** — Epic 65 retro recommends smoke test before heavy Compare reliance on new sources; gate production demo on P1 retro action?

---

## 9. Assumptions Index

- `signalId` references `digestSignals._id` — §3 Glossary.
- `workspaceId` single-tenant v1 constant or user id — §3, §8 Q1.
- Compare lookback 7 days — §3, FR-5.
- Ask AI uses Anthropic only; Hermes dispatch deferred — §5, addendum A7.
- Streaming via SvelteKit `text/plain` route (not Convex action) for v1 — addendum A1.
- Session restore on action re-tap, not auto on drawer open — FR-9.
- `investigationSessions` indefinite retention — FR-1 NFR.
- Explain/Ask require scored digest signal when available; degrade gracefully when signal row missing — FR-4, FR-7 `[ASSUMPTION]`.

---

## 10. Cross-Cutting NFRs

| Attribute | Requirement |
|-----------|-------------|
| **Performance** | Stream start ≤3s p95 dev; context bundle build ≤500ms before model call. |
| **Security** | `ANTHROPIC_API_KEY` server-only; auth gate on all investigation routes; no prompt injection to vault writes. |
| **Reliability** | Abort in-flight stream on drawer close or new action tap; partial response not marked `complete`. |
| **Accessibility** | Session panel focus trap compatible with existing drawer focus restore (63-5); streaming region `aria-live="polite"`. |
| **Observability** | Log investigation `action`, `signalId`, `workspaceId`, duration, token estimate; no full prompt/response in production logs `[ASSUMPTION]`. |

---

## 11. Integration and Dependencies

| Dependency | Relationship |
|------------|--------------|
| **Epic 64** | Scored `digestSignals` (`scores`, `disposition`, `rankScore`) feed Signal Intelligence panel and AI context. |
| **Epic 65** | New `sourceType` values (github, reddit, rss) appear in Trace narratives. |
| **Story 65-9** | Inspector drawer already subscribes `getDigestSignalsForRun`; investigation anchors on matched signal row. |
| **Story 63-5** | Drawer shell, `INSPECTOR_ACTIONS`, skip-when-closed query pattern. |
| **`trends-claude.ts`** | Model, streaming, abort handling reuse. |
| **Epic 65 retro P1** | Live digest smoke test recommended before demoing Compare on production data. |

---

## 12. Constraints and Guardrails

- **Cost:** `MAX_TOKENS = 1024` per investigation unless architecture raises with operator approval.
- **Privacy:** Investigation prompts may include watchlist keywords; no export to third parties beyond Anthropic API call.
- **WriteGate:** Investigation flows are read-only relative to vault; no `AI-Context/` mutations.
- **Verify gate:** `bash scripts/verify.sh` must pass before epic stories marked done.

---

## 13. Story Map (implementation order)

| Story | Title | Repo | Gate | Notes |
|-------|-------|------|------|-------|
| **66-3** | `investigationSessions` Convex table + read/write API | cns-dashboard | **Gate** — blocks 66-1 | FR-1, FR-2, FR-3 |
| **66-1** | Inspector AI action wiring (Explain / Compare / Trace / Ask) | cns-dashboard | Requires 66-3 | FR-4–FR-11; optional Omnipotent.md if Hermes skill needed later |
| **66-2** | Agent Orchestration Workspace (Screen 10) | cns-dashboard | Deferred v2 | FR-12; not MVP |

**Sequencing:** 66-3 → 66-1. 66-2 starts only after MVP validated or parallel planning with `/bmad-create-architecture`.

**Renumbering note:** Sprint proposal listed 66-3 as table-only after 66-1 Hermes wiring. Operator brief + data-gate discipline **inverts implementation order**: schema first, then actions. Story IDs preserved; execution order clarified.

---

## 14. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Compare built before live digest validation | Empty or misleading diffs | Complete Epic 65 retro P1 smoke test before production demo |
| Context bundle exceeds model window | Truncated/wrong answers | Trim trace to top-N; addendum A4 budget rules |
| Stale "Epic 64" tooltips | Operator confusion | FR-11 note: update on wire-up |
| Hermes vs Anthropic scope creep | Split transport, delayed MVP | PRD locks Anthropic in-drawer for v1 (addendum A7) |
| Passive parse patterns in new Hermes skills | Orchestration fragility (65 retro) | If Hermes added in v2, imperative threading + contract tests mandatory |

---

## 15. Why Now

Epic 64 delivered scoring; Epic 65 broadened ingest; 65-9 surfaced scores in the inspector. The drawer is information-rich but **action-poor** — the highest-value operator questions remain one click away yet unwired. Epic 66 is the minimal wiring layer that unlocks Screen 10 without building the full workspace prematurely. Validating investigation sessions in the drawer de-risks the larger orchestration surface.
