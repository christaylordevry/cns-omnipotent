# Addendum — Epic 66 Nexus Agent Orchestration

Technical mechanism and transport decisions that belong outside the normative PRD narrative.

---

## A1. Streaming transport options

| Option | Pros | Cons | PRD recommendation |
|--------|------|------|-------------------|
| **SvelteKit API route** (`/api/nexus/investigate/*`) + `streamClaudeText()` | Proven in `/api/trends/explain`; abort via `request.signal`; no Convex action timeout | API key stays server-side; separate from reactive session table | **v1 default** |
| **Convex action** streaming | Unified auth; colocated with `investigationSessions` mutation | Convex action streaming ergonomics; cold-start latency | v2 if architecture standardizes on Convex-only AI |
| **SSE (`text/event-stream`)** | Standard browser EventSource | Existing trends stack uses raw `text/plain` chunks; extra client parser | Optional polish; not required for MVP |

**Decision (draft):** Mirror `trends-claude.ts` — `text/plain; charset=utf-8` progressive read in drawer. Persist final `response` to `investigationSessions` on stream complete via Convex mutation.

---

## A2. Reuse map from legacy `/trends` drawer

| Nexus action | Primary reuse target |
|--------------|---------------------|
| Explain | `trends-claude-prompts.ts` explain builder + `/api/trends/explain` pattern; context enriched with `digestSignals.scores`, `disposition`, `rankScore` |
| Compare | `trends-compare.ts` + new digest-run diff query (`getPriorDigestSignalsForTopic`) |
| Trace | Existing `getSourceWeightsForTopic` + `getSignalEventsForTopicRange`; optional Claude synthesis of trace narrative |
| Ask AI | New freeform prompt builder scoped to signal snapshot (not `hermes-trend-dispatch` webhook in v1) |

---

## A3. Proposed `investigationSessions` schema (for architecture doc)

```typescript
investigationSessions: defineTable({
  workspaceId: v.string(),           // Nexus workspace scope
  signalId: v.id('digestSignals'),   // signal under inspection
  topicSlug: v.optional(v.string()), // denormalized for index/query without join
  action: v.union(
    v.literal('explain'),
    v.literal('compare'),
    v.literal('trace'),
    v.literal('ask_ai'),
  ),
  prompt: v.string(),                // rendered prompt sent to model (or structured compare/trace input JSON)
  response: v.string(),              // final persisted text (stream accumulator)
  status: v.union(
    v.literal('streaming'),
    v.literal('complete'),
    v.literal('error'),
  ),
  errorMessage: v.optional(v.string()),
  createdAt: v.number(),
  completedAt: v.optional(v.number()),
})
  .index('by_workspace_signal_action', ['workspaceId', 'signalId', 'action'])
  .index('by_workspace_created', ['workspaceId', 'createdAt']),
```

**Latest-session lookup:** query `by_workspace_signal_action`, order `createdAt` desc, `first()`.

---

## A4. Context payload for AI actions (non-normative)

Signal context bundle passed to prompt builders:

- Topic metadata (`getTopicBySlug`)
- Matched `digestSignal` row (scores, disposition, rankScore, sourceType, title, url)
- `digestRuns.deepSignalSummary` ("Why this matters")
- WoW delta + sparkline summary stats
- Source weights + 72h trace grouped events
- For Compare: prior-run signal rows for same keyword/topic

Max context budget: follow `MAX_TOKENS = 1024` response cap; trim trace events to top-N by weight.

---

## A5. Screen 10 (Agent Orchestration Workspace) — v2 surface

Stitch project `1178802411726576244`, Screen 10. Epic 63 PRD deferred this to Epic 64+ (now 66).

**v2 capabilities (not MVP):** multi-signal investigation canvas, session history sidebar, Hermes task dispatch, cross-topic orchestration. MVP drawer sessions are the data foundation (`investigationSessions` rows become Screen 10 history).

---

## A6. Auth and configuration

- Reuse `checkTrendsApiAuth` or Nexus-equivalent server guard before streaming endpoints.
- `ANTHROPIC_API_KEY` required; 503 `CLAUDE_NOT_CONFIGURED` when absent (match trends behavior).
- No API keys in client bundle.

---

## A7. Hermes involvement (clarification)

Original sprint proposal titled 66-1 "Hermes wiring." Operator brief specifies **Anthropic API direct** for drawer actions. Hermes skills (`investigate-trend`) remain available for Discord/async deep research but are **not** the MVP transport for Nexus inspector Ask AI. Architecture may add optional "Send to Hermes" from Screen 10 v2.
