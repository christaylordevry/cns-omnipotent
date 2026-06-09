---
title: Epic 66 — Nexus Agent Orchestration Architecture
status: complete
created: 2026-06-09
updated: 2026-06-09
epicScope: epic-66
workflowType: architecture
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
completedAt: 2026-06-09
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-epic-66-2026-06-09/prd.md
  - _bmad-output/planning-artifacts/prds/prd-epic-66-2026-06-09/addendum.md
  - _bmad-output/planning-artifacts/prds/prd-epic-66-2026-06-09/.decision-log.md
  - _bmad-output/planning-artifacts/architecture-epic-64-scoring-engine.md
  - _bmad-output/planning-artifacts/architecture-epic-65-native-source-adapters.md
  - _bmad-output/implementation-artifacts/epic-65-retro-2026-06-09.md
  - _bmad-output/implementation-artifacts/65-9-surface-intelligence-scoring-inspector-drawer.md
  - project-context.md
  - cns-dashboard/convex/schema.ts
  - cns-dashboard/convex/digest.ts
  - cns-dashboard/convex/validators.ts
  - cns-dashboard/src/lib/components/nexus/NexusInspectorDrawer.svelte
  - cns-dashboard/src/lib/server/trends-claude.ts
  - cns-dashboard/src/lib/utils/trends-claude-client.ts
relatedPrd:
  - _bmad-output/planning-artifacts/prds/prd-epic-66-2026-06-09/prd.md
relatedArchitecture:
  - _bmad-output/planning-artifacts/architecture-epic-64-scoring-engine.md
  - _bmad-output/planning-artifacts/architecture-epic-65-native-source-adapters.md
repos:
  primaryUi: cns-dashboard
---

# Architecture: Epic 66 — Nexus Agent Orchestration

**Author:** Chris Taylor (architecture workflow)  
**Date:** 2026-06-09  
**Status:** Complete — normative for stories 66-3 and 66-1 (66-2 deferred v2)

## 0. Document Purpose

This architecture is the **normative technical contract** for Epic 66 story authoring and implementation. It owns:

- ADR-E66-001 through ADR-E66-008
- `investigationSessions` schema, indexes, and CRUD API (Story 66-3)
- `getPriorDigestSignalsForTopic` query contract (Compare grounding)
- Convex `'use node'` Anthropic action + reactive streaming pattern (Story 66-1)
- Drawer session-active UI, restore rules, and action-id mapping
- Operator-locked answers to PRD §8 open questions
- Story-to-section traceability for `/bmad-create-story` and `/bmad-dev-story`

**Primary inputs:** `prd-epic-66-2026-06-09/prd.md`, operator scope confirmation (2026-06-09).

**Downstream consumers:** Stories 66-3 (gate) → 66-1; Screen 10 (66-2) deferred.

**PRD override (normative):** Addendum A1 recommended SvelteKit `/api/nexus/investigate/*` routes. **This architecture supersedes A1** — Anthropic calls run in a Convex `'use node'` action; the SvelteKit client never holds or forwards the API key.

---

## 1. System Context

### 1.1 Current state (post–Epic 65, Story 65-9)

| Component | Location | Today |
|-----------|----------|-------|
| Inspector shell | `NexusInspectorDrawer.svelte` | 320px drawer; scoring panel (65-9); **inert** 2×2 action grid |
| Action labels | `INSPECTOR_ACTIONS` | `explain`, `compare`, `trace`, `ask-ai` (UI id uses hyphen) |
| Digest reads | `convex/digest.ts` | `getDigestSignalsForRun`, `getLatestDigestBrief`; `keywordsMatch()` for focus |
| Trace / weights | `convex/trendIntelligence.ts` | `getSourceWeightsForTopic`, `getSignalEventsForTopicRange` |
| Legacy AI pattern | `trends-claude.ts` + `/api/trends/explain` | SvelteKit route + `streamClaudeText()`; `text/plain` fetch client |
| Session persistence | — | **Does not exist** |
| Screen 10 | Stitch design | Deferred |

### 1.2 Target state (Epic 66 MVP)

```
Operator taps inspector action (NexusInspectorDrawer)
    → resolve digestSignal._id for current topic + latest run
    → optional: auto-restore complete session (<24h) on drawer open
    → convexClient.action(runInvestigation)     # 'use node'; Anthropic server-side
        → internalMutation: create session (status: streaming)
        → build signal context bundle (Convex queries)
        → stream Anthropic claude-sonnet-4-20250514
        → internalMutation: patch session.response (throttled)
        → internalMutation: finalize (status: complete | error)
    → useQuery(getInvestigationSession)         # reactive streaming UI
    → session panel replaces action grid
```

**Out of MVP path:** Hermes `investigate-trend` webhook, Screen 10 workspace, SvelteKit investigation routes.

### 1.3 Repo boundary

| Layer | Repo | Responsibility |
|-------|------|----------------|
| Schema + persistence | cns-dashboard | `investigationSessions` table, queries, internal mutations |
| AI transport | cns-dashboard | `convex/investigation.node.ts` — Anthropic via env `ANTHROPIC_API_KEY` |
| Prompt builders | cns-dashboard | `convex/lib/investigationPrompts.ts` (ported from trends patterns) |
| Compare query | cns-dashboard | `getPriorDigestSignalsForTopic` in `convex/digest.ts` |
| Drawer UX | cns-dashboard | `NexusInspectorDrawer.svelte` + `NexusInvestigationPanel.svelte` |
| Hermes skills | Omnipotent.md | **Not in Epic 66 MVP** |

---

## 2. Architecture Decision Records

### ADR-E66-001 — Story 66-3 gates 66-1 (data before actions)

**Status:** Accepted  
**Context:** PRD gate pattern matches 64-1 → 64-2 and 65-2 → 65-3.  
**Decision:** No inspector action wiring merges until `investigationSessions` schema, validators, indexes, and read/write API are deployed and tested.  
**Consequences:** Story order **66-3 → 66-1**. 66-1 may import types from generated `api` only after 66-3 lands.

---

### ADR-E66-002 — Anthropic calls run in Convex `'use node'` action (not SvelteKit routes)

**Status:** Accepted — **supersedes PRD addendum A1**  
**Context:** Operator requires API key off the browser and colocation with session persistence. `trends-claude.ts` logic is the reference implementation to port, not the transport layer to copy.  
**Decision:**
- Add `convex/investigation.node.ts` with `'use node'` directive.
- Public action `runInvestigation` calls `@anthropic-ai/sdk` using `process.env.ANTHROPIC_API_KEY` (Convex dashboard env).
- Port `streamClaudeText` semantics from `src/lib/server/trends-claude.ts` into `convex/lib/investigationClaude.node.ts`.
- **Do not** add `/api/nexus/investigate/*` SvelteKit routes for MVP.
- Client invokes `convexClient.action(api.investigation.runInvestigation, args)` only.

**Consequences:**
- `ANTHROPIC_API_KEY` configured in Convex deployment env (not only SvelteKit `$env/static/private`).
- Existing trends SvelteKit routes remain unchanged.
- Story 66-1 tests mock Convex action + session mutations, not `fetch('/api/...')`.

---

### ADR-E66-003 — Streaming UX via reactive session patches (not HTTP text/plain)

**Status:** Accepted  
**Context:** Convex actions do not expose a first-class browser byte stream like SvelteKit `ReadableStream` responses. `investigationSessions` already needs live `response` accumulation.  
**Decision:**
- Action streams Anthropic deltas server-side.
- Throttled `internal.investigationSessions.patchResponse` mutations update `response` field (default: every **250ms** or **≥80 chars**, whichever comes first; flush on complete).
- Drawer subscribes with `useQuery(api.investigationSessions.getSession, { sessionId })` — Convex reactivity drives UI updates.
- Session panel uses `aria-live="polite"` on the streaming region.

**Consequences:**
- Slightly higher mutation write volume during stream; acceptable for single-operator MVP.
- Abort: client calls `cancelInvestigation` mutation → action checks cancellation flag between chunks.

---

### ADR-E66-004 — `workspaceId` omitted in v1 (null pattern)

**Status:** Accepted — **resolves PRD §8 Q1**  
**Context:** Operator: "Hardcode null — same pattern as all other tables." `digestRuns` / `digestSignals` use `workspaceId: v.optional(v.string())` and omit the field in v1.  
**Decision:**
- `investigationSessions.workspaceId` is `v.optional(v.string())`.
- All writes **omit** `workspaceId` (stored as undefined).
- Queries use `workspaceId: undefined` in index equality (or dedicated `by_signal_action` index without workspace — see §3.1).
- **Do not** resolve tenant/user workspace in Epic 66.

**Consequences:** Screen 10 v2 may introduce real `workspaceId` scoping with a migration story.

---

### ADR-E66-005 — Compare lookback: 7 days, max 2 prior digest runs

**Status:** Accepted — **resolves PRD §8 Q2**  
**Decision:**
- Lookback window: **7 days** from current `digestRun.ranAt`.
- Max prior runs considered: **2** (keeps diff readable).
- New query `getPriorDigestSignalsForTopic` (§4.2) returns matched signals from those runs only.
- When zero prior matches: return structured empty-state copy; **no Anthropic call** (FR-5 / SM-4).

---

### ADR-E66-006 — Session restore: auto on drawer open if &lt;24h; re-tap refreshes

**Status:** Accepted — **resolves PRD §8 Q3** (overrides PRD FR-9 re-tap-only assumption)  
**Decision:**
- On drawer open for a signal: for each action, load latest **complete** session.
- If `completedAt` (or `createdAt` when `completedAt` absent) is within **24 hours**, auto-enter session-active UI showing cached `response` (no new action call).
- **Re-tap** the same action button while session panel visible (or explicit "Re-run" control): starts **new** `runInvestigation` → new session row.
- Sessions older than 24h: show action grid; restore only on action tap.

**Consequences:** FR-9 testable via timestamp fixtures; drawer `open` transition triggers restore query bundle.

---

### ADR-E66-007 — Compare production demo gated on live digest smoke test

**Status:** Accepted — **resolves PRD §8 Q5**  
**Context:** Epic 65 retro P1 — live morning digest with GitHub + Reddit + RSS not yet validated in production.  
**Decision:**
- **66-3** and **Explain / Trace / Ask** may ship without smoke test.
- **Compare** action wiring in **66-1** must include `COMPARE_REQUIRES_SMOKE_TEST` feature flag (env `NEXUS_COMPARE_ENABLED`, default `false` in production until operator sets `true` after smoke test).
- When flag false: Compare button shows tooltip "Enable after live digest smoke test"; no action invocation.
- Dev/local: flag defaults `true` when `NODE_ENV !== 'production'` or explicit env override.

**Consequences:** Story 66-1 documents smoke test checklist in DoD; operator closes Epic 65 P1 before enabling Compare in prod.

---

### ADR-E66-008 — Hermes out of MVP; Anthropic in-drawer only

**Status:** Accepted  
**Decision:** No Hermes webhook, Discord dispatch, or `investigate-trend` skill wiring for Nexus Ask AI in Epic 66. Ask AI uses same Convex action path as Explain.

---

## 3. Data Architecture

### 3.1 `investigationSessions` schema (normative)

Add to `convex/schema.ts`:

```typescript
investigationSessions: defineTable(investigationSessionRowValidator)
  .index('by_signal_action_created', ['signalId', 'action', 'createdAt'])
  .index('by_signal_action_status', ['signalId', 'action', 'status']),
```

**Validator** (`convex/validators.ts`):

```typescript
export const investigationActionValue = v.union(
  v.literal('explain'),
  v.literal('compare'),
  v.literal('trace'),
  v.literal('ask_ai'),
);

export const investigationStatusValue = v.union(
  v.literal('streaming'),
  v.literal('complete'),
  v.literal('error'),
);

export const investigationSessionRowValidator = v.object({
  workspaceId: v.optional(v.string()),       // omitted in v1 (ADR-E66-004)
  signalId: v.id('digestSignals'),
  topicSlug: v.optional(v.string()),          // denormalized from drawer context
  action: investigationActionValue,
  prompt: v.string(),                       // rendered prompt or compare/trace JSON input
  response: v.string(),
  status: investigationStatusValue,
  errorMessage: v.optional(v.string()),
  createdAt: v.number(),
  completedAt: v.optional(v.number()),
  cancelled: v.optional(v.boolean()),
});
```

**Index usage:**
- Latest complete session per signal+action: `by_signal_action_created`, filter `status === 'complete'`, order `createdAt` desc.
- Active stream: `by_signal_action_status`, `status === 'streaming'`.

### 3.2 Session write API (Story 66-3)

| Function | Type | Purpose |
|----------|------|---------|
| `createInvestigationSession` | `internalMutation` | Insert row; `status: streaming`, `response: ''` |
| `patchInvestigationResponse` | `internalMutation` | Append/replace `response` during stream |
| `completeInvestigationSession` | `internalMutation` | `status: complete`, `completedAt: Date.now()` |
| `failInvestigationSession` | `internalMutation` | `status: error`, `errorMessage` |
| `cancelInvestigationSession` | `mutation` | Set `cancelled: true` on streaming row (client abort) |
| `getLatestInvestigationSession` | `query` | Latest **complete** for `(signalId, action)` |
| `getInvestigationSession` | `query` | By `_id` (streaming subscription) |
| `listRecentSessionsForSignal` | `query` | Optional; max 4 rows for debug — not required MVP |

**FR mapping:** FR-1 (schema), FR-2 (writes), FR-3 (reads).

### 3.3 Action ID mapping (UI ↔ storage)

| UI `INSPECTOR_ACTIONS.id` | Stored `action` |
|---------------------------|-----------------|
| `explain` | `explain` |
| `compare` | `compare` |
| `trace` | `trace` |
| `ask-ai` | `ask_ai` |

Single mapper: `toInvestigationAction(uiId: string): InvestigationAction`.

---

## 4. Query & Context Architecture

### 4.1 `getPriorDigestSignalsForTopic` (normative — resolves PRD §8 Q4)

**Location:** `convex/digest.ts`  
**Signature:**

```typescript
export const getPriorDigestSignalsForTopic = query({
  args: {
    topic: v.string(),                    // topicSlug or focus keyword
    beforeRunId: v.id('digestRuns'),      // current run — search strictly older runs
    limit: v.optional(v.number()),        // default 2, max 2 (clamp)
  },
  returns: v.array(v.object({
    digestRunId: v.id('digestRuns'),
    ranAt: v.number(),
    signal: digestSignalRowValidator,     // matched row from that run (best match)
  })),
  // ...
});
```

**Algorithm:**
1. Load `beforeRun` by `beforeRunId`; `cutoffMs = beforeRun.ranAt - 7 * 24 * 60 * 60 * 1000`.
2. Query `digestRuns` via `by_ranAt` desc where `ranAt < beforeRun.ranAt` and `ranAt >= cutoffMs`.
3. For each run (stop at `limit` default **2**): find best `digestSignals` row where `keywordsMatch(topic, signal.title)` OR `keywordsMatch(topic, run.focusKeyword)` OR `keywordsMatch(topic, run.topTrend)` — reuse existing `keywordsMatch` / `normalizeDigestKeyword` from `digest.ts`.
4. Return array ordered newest prior first.

**Compare action uses this** before building diff payload. Cap at 2 runs keeps prompt size bounded (A4 budget).

### 4.2 Signal context bundle

**Module:** `convex/lib/investigationContext.ts` (pure TS, importable from node action)

| Field | Source |
|-------|--------|
| Topic metadata | `getTopicBySlug` |
| Current `digestSignal` | `signalId` lookup |
| Digest brief | `getLatestDigestBrief(focusKeyword)` |
| WoW delta | `getTopicWeekOverWeekDelta` |
| Source weights | `getSourceWeightsForTopic` |
| Trace events (72h) | `getSignalEventsForTopicRange` — **top 8** by weight |
| Compare priors | `getPriorDigestSignalsForTopic` |

**Context trim rules:** `MAX_TOKENS = 1024` response; prompt budget ~6k tokens input; trace capped at 8 events; compare at most 2 prior signals.

### 4.3 Prompt builders

**Module:** `convex/lib/investigationPrompts.ts`

| Action | Builder | Notes |
|--------|---------|-------|
| `explain` | `buildExplainMessages(bundle)` | Fixed template; `[ASSUMPTION]` tag in system prompt |
| `compare` | `buildCompareMessages(bundle, priors)` | Skipped when priors empty |
| `trace` | `buildTraceMessages(bundle)` | Weights + grouped events narrative |
| `ask_ai` | `buildAskMessages(bundle, operatorPrompt)` | Operator text required; block empty |

Port tone/structure from `trends-claude-prompts.ts`; enrich with `scores`, `disposition`, `rankScore` from Epic 64.

---

## 5. AI Action Architecture (Story 66-1)

### 5.1 `runInvestigation` action

**File:** `convex/investigation.node.ts` (`'use node'`)

```typescript
export const runInvestigation = action({
  args: {
    signalId: v.id('digestSignals'),
    action: investigationActionValue,
    topicSlug: v.optional(v.string()),
    operatorPrompt: v.optional(v.string()),  // required when action === 'ask_ai'
  },
  returns: v.id('investigationSessions'),
  handler: async (ctx, args) => {
    // 1. Guard ANTHROPIC_API_KEY → throw ConvexError CLAUDE_NOT_CONFIGURED
    // 2. Validate ask_ai prompt non-empty
    // 3. Compare: if !NEXUS_COMPARE_ENABLED → throw
    // 4. Build context via ctx.runQuery
    // 5. Compare: if priors.length === 0 → create session + fail with EMPTY_PRIOR message (no API call)
    // 6. createInvestigationSession (internal)
    // 7. streamClaude → throttled patchResponse
    // 8. completeInvestigationSession
  },
});
```

**Model:** `claude-sonnet-4-20250514` (match `DEFAULT_CLAUDE_MODEL` in trends-claude.ts).  
**Max tokens:** 1024.

### 5.2 Configuration guards (FR-10)

| Condition | Behavior |
|-----------|----------|
| `ANTHROPIC_API_KEY` missing/empty | Action throws; client shows muted error + retry |
| Compare disabled (smoke gate) | Button disabled; action rejects if called |
| Empty Ask AI prompt | Client blocks submit; action double-checks |

Error code strings (match trends): `CLAUDE_NOT_CONFIGURED`, `INVESTIGATION_ABORTED`, `COMPARE_PRIOR_NOT_FOUND`.

### 5.3 Auth (FR-11)

**v1 pattern:** Nexus SvelteKit layout requires authenticated session cookie before rendering `/nexus/*`. Convex investigation functions are **not** public-API hardened — same trust model as existing dashboard mutations.

**Requirements for 66-1:**
- Document in story: operator-only deployment; Convex URL not exposed publicly.
- Client calls action only from authenticated Nexus pages.
- **Deferred:** Convex Auth `ctx.auth.getUserIdentity()` — add when multi-tenant (Screen 10 v2).

### 5.4 Abort & reliability

- Client `AbortController` on drawer close or new action → `cancelInvestigationSession(sessionId)`.
- Action polls cancellation between chunks; partial response stays `status: error` or `cancelled`, never `complete`.
- New action tap aborts prior in-flight stream for same signal.

---

## 6. Frontend Architecture

### 6.1 Components

| File | Responsibility |
|------|----------------|
| `NexusInspectorDrawer.svelte` | Wire `INSPECTOR_ACTIONS`; restore logic; swap grid ↔ panel |
| `NexusInvestigationPanel.svelte` | **New** — action label, streaming text, dismiss, Ask AI input, Re-run |
| `nexus-investigation.ts` | `toInvestigationAction`, restore eligibility (`<24h`), error copy |

### 6.2 Session-active UI (FR-8)

- When `activeSessionId` set OR auto-restore fired: hide `.nx-inspector-action-grid`; show `NexusInvestigationPanel`.
- Dismiss: clear `activeSessionId`, return to grid; persisted session remains.
- `Escape`: existing close drawer (63-5); does not delete session.
- Update tooltip: `"Hermes wiring ships in Epic 64"` → remove `disabled`; enable buttons per ADR-E66-007 Compare flag.

### 6.3 Restore flow (ADR-E66-006)

```typescript
const RESTORE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function isRestoreEligible(session: Session): boolean {
  if (session.status !== 'complete') return false;
  const doneAt = session.completedAt ?? session.createdAt;
  return Date.now() - doneAt < RESTORE_MAX_AGE_MS;
}
```

On drawer open (`open` true + `signalId` resolved): query `getLatestInvestigationSession` for each action; pick most recent eligible across actions **or** per-action restore on first tap — **MVP: restore most recent eligible session for any action** when drawer opens (operator sees last investigation). Re-tap specific action starts fresh run for that action.

### 6.4 Client invocation (no fetch stream)

```typescript
const sessionId = await convexClient.action(api.investigation.runInvestigation, {
  signalId,
  action: 'explain',
  topicSlug,
});
// Subscribe:
const sessionQuery = useQuery(api.investigationSessions.getInvestigationSession, () =>
  sessionId ? { sessionId } : 'skip'
);
```

---

## 7. Implementation Patterns & Consistency Rules

### 7.1 Naming

| Layer | Convention | Example |
|-------|------------|---------|
| Convex tables | camelCase plural | `investigationSessions` |
| Convex files | domain noun | `investigationSessions.ts`, `investigation.node.ts` |
| Action literals | snake_case | `ask_ai` |
| UI action ids | kebab-case | `ask-ai` |
| Env vars | SCREAMING_SNAKE | `ANTHROPIC_API_KEY`, `NEXUS_COMPARE_ENABLED` |

### 7.2 File placement

- **Queries/mutations:** `convex/investigationSessions.ts` (no `'use node'`)
- **Node action + Claude:** `convex/investigation.node.ts`, `convex/lib/investigationClaude.node.ts`
- **Pure helpers:** `convex/lib/investigationContext.ts`, `convex/lib/investigationPrompts.ts`
- **Tests:** `tests/convex/investigation-sessions.test.ts`, `tests/convex/investigation-action.test.ts`, `tests/convex/digest-prior-signals.test.ts`

### 7.3 Process patterns

- **Gate:** 66-3 merges first; 66-1 branch rebases on it.
- **Verify:** `bash scripts/verify.sh` from Omnipotent.md (includes cns-dashboard tests).
- **Logging:** Log `action`, `signalId`, duration, estimated tokens — **not** full prompt/response in production.
- **Read-only:** No vault WriteGate paths; investigation does not mutate `AI-Context/`.

### 7.4 Anti-patterns

| Anti-pattern | Correct approach |
|--------------|-------------------|
| SvelteKit `/api/nexus/investigate/*` routes | Convex `runInvestigation` action |
| Client-side Anthropic key | Convex env only |
| `fetch` + `text/plain` stream for Nexus | Reactive `useQuery` on session row |
| Compare without prior digest data | Empty-state message; zero tokens |
| Resolving `workspaceId` in v1 | Omit field |
| Hermes webhook for Ask AI | Direct Anthropic in action |

---

## 8. Project Structure (cns-dashboard delta)

```
cns-dashboard/
├── convex/
│   ├── schema.ts                          # + investigationSessions table
│   ├── validators.ts                      # + investigation validators
│   ├── investigationSessions.ts           # queries + internal mutations (66-3)
│   ├── investigation.node.ts              # runInvestigation action (66-1)
│   ├── digest.ts                          # + getPriorDigestSignalsForTopic
│   └── lib/
│       ├── investigationContext.ts
│       ├── investigationPrompts.ts
│       └── investigationClaude.node.ts    # port of trends-claude stream
├── src/lib/components/nexus/
│   ├── NexusInspectorDrawer.svelte        # wire actions + restore
│   └── NexusInvestigationPanel.svelte     # new
├── src/lib/utils/
│   └── nexus-investigation.ts             # id mapping, restore helpers
└── tests/convex/
    ├── investigation-sessions.test.ts
    ├── investigation-action.test.ts
    └── digest-prior-signals.test.ts
```

### Requirements → structure mapping

| Story | FRs | Primary files |
|-------|-----|---------------|
| **66-3** | FR-1–3 | `schema.ts`, `validators.ts`, `investigationSessions.ts`, tests |
| **66-1** | FR-4–11 | `investigation.node.ts`, `lib/*`, drawer components, `digest.ts` query extension |
| **66-2** (deferred) | FR-12 | — |

---

## 9. Story Handoff

### 9.1 Story 66-3 — `investigationSessions` gate

**DoD:**
- Schema deploys; indexes queryable
- create/patch/complete/fail/cancel paths tested
- `getLatestInvestigationSession` returns null when absent
- `workspaceId` omitted on insert

### 9.2 Story 66-1 — Inspector AI action wiring

**Depends on:** 66-3 merged  
**DoD:**
- All four actions invoke `runInvestigation`
- Reactive streaming via session query
- Auto-restore &lt;24h on drawer open
- Compare respects `NEXUS_COMPARE_ENABLED` smoke gate
- Ask AI blocks empty prompt
- Tooltip fix on action buttons
- Contract tests for prior-digest query + action guards

### 9.3 Smoke test gate (operator, pre-Compare prod)

From Epic 65 retro P1:
- Run live morning digest
- Confirm `github`, `reddit`, `rss` `sourceType` values in Convex `digestSignals` (or graceful unavailable)
- Set `NEXUS_COMPARE_ENABLED=true` in production Convex env

---

## 10. Architecture Validation

### 10.1 Coherence

- Convex action + session patch streaming aligns with reactive drawer (`useQuery`).
- Compare query reuses `keywordsMatch` — consistent with `getLatestDigestBrief`.
- `workspaceId` omission matches digest tables.
- Anthropic port from `trends-claude.ts` reduces behavioral drift.

### 10.2 Requirements coverage

| FR | Architectural support |
|----|----------------------|
| FR-1–3 | §3 investigationSessions |
| FR-4–7 | §5 runInvestigation + §4 prompts |
| FR-8–9 | §6 drawer UI + ADR-E66-006 |
| FR-10–11 | §5.2–5.3 guards |
| FR-12 | Deferred (66-2) |

### 10.3 Open questions — resolved

| # | PRD question | Architecture answer |
|---|--------------|---------------------|
| 1 | workspaceId | Omit / null — ADR-E66-004 |
| 2 | Compare lookback | 7 days, max 2 runs — ADR-E66-005 |
| 3 | Restore UX | Auto &lt;24h on open; re-tap refreshes — ADR-E66-006 |
| 4 | Prior digest API | `getPriorDigestSignalsForTopic(topic, beforeRunId, limit: 2)` — §4.1 |
| 5 | Smoke test gate | Compare disabled until P1 complete — ADR-E66-007 |

### 10.4 Readiness

**Overall status:** READY FOR IMPLEMENTATION  
**Confidence:** High for 66-3; High for 66-1 given brownfield Claude port  
**First implementation priority:** `/bmad-create-story` for **66-3**

### 10.5 Checklist

**Requirements analysis**
- [x] Project context analyzed
- [x] Scale/complexity assessed (medium brownfield)
- [x] Constraints identified (Convex env, smoke gate)
- [x] Cross-cutting concerns mapped (auth, streaming, scoring context)

**Architectural decisions**
- [x] Critical ADRs documented (E66-001–008)
- [x] Stack specified (Convex + SvelteKit UI)
- [x] Integration patterns defined
- [x] Performance addressed (throttled patches, context caps)

**Implementation patterns**
- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified (reactive queries)
- [x] Process patterns documented

**Project structure**
- [x] Directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] FR → file mapping complete

---

## 11. AI Agent Guidelines

1. Implement **66-3 before 66-1** — no exceptions.
2. Anthropic **only** in `convex/investigation.node.ts` — never SvelteKit routes or client.
3. Use `toInvestigationAction()` for UI id → storage literal mapping.
4. Omit `workspaceId` on all session writes.
5. Compare: clamp prior runs to **2**; **7-day** window; no model call without priors.
6. Do not enable Compare in production without smoke test flag.
7. Port `trends-claude.ts` behavior; do not fork model constants.
8. Run `bash scripts/verify.sh` before story done.

**Next workflow:** `/bmad-create-story` for story **66-3**.
