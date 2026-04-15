# Epic 15 Retrospective: Multi-Model Routing

**Date:** 2026-04-15
**Epic:** 15 (Multi-model routing)
**Stories:** 15-1 through 15-6

## What was built

A six-story epic delivering the complete CNS model routing layer: policy schema and JSON Schema validation (15-1), model alias registry with provider-agnostic stable aliases (15-1), a pure routing decision engine with deny-wins precedence and operator override (15-2), three surface adapters translating decisions to Cursor, Claude Code, and Gemini CLI config formats (15-3, 15-4), a two-tier fallback orchestrator with silent/visible tier classification (15-5), a version compatibility guard enforcing major-version parity between policy and registry (15-6), an append-only vault audit trail for routing decisions (15-6), and governance documentation covering operator override rules (15-6). The AGENTS.md constitution was updated to acknowledge routing as a shipped module.

## Deferred items

- **ChatGPT adapter:** Not implemented. No ChatGPT surface exists in the current operator stack. A stub can be added following the adapter pattern in `_README.md`.
- **Perplexity:** Treated as an ingestion source, not a routing surface. No adapter needed.
- **Obsidian Base panel for routing decisions:** Deferred to Phase 4. A `.base` file under `_meta/bases/` could surface routing audit entries in a table view.
- **OpenClaw daemon:** Phase 3+ parking lot item. Routing is a library, not a daemon; OpenClaw would consume it.

## Known acceptable gaps

- **Per-adapter atomic write helpers** share similar (not identical) patterns across the three adapters. A shared write utility could reduce duplication, but the current patterns are readable and tested independently.
- **Minor version mismatch warning** goes to `console.warn`, not to an operator UI. Acceptable for Phase 3; a future dashboard could surface these.
- **No retry loop or polling** for model availability. The fallback orchestrator is invoked once per failure event; callers are responsible for retry policy.
- **Audit write is fire-and-forget.** `createAuditingCallback` uses `void writeAuditEntry(...)` so audit failures do not break the routing flow. If audit visibility matters, the caller can inspect the `AuditWriteResult`.

## Recommended first follow-on story

**Routing decisions Base panel (Phase 4).** Create `_meta/bases/routing-decisions.base` to surface `AI-Context/agent-log.md` routing entries in a filterable table view. This gives the operator a visual audit trail without leaving Obsidian.
