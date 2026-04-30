# Story 22.1: Perplexity Formal MCP (replace direct HTTP slot)

Status: done

Epic: 22 (Perplexity Formal MCP)

## Story

As a **research automation system**,
I want **Perplexity queries to route through the Perplexity MCP server (not direct HTTP fetch inside Node)**,
so that **research runs use the same Tier 1 tool wiring as Firecrawl and Apify, and operator config is centralized in MCP rather than ad hoc HTTP slots**.

## Context / Baseline (read this before coding)

- Current production Perplexity integration is a direct HTTP slot:
  - `src/agents/perplexity-slot.ts` does `fetch("https://api.perplexity.ai/chat/completions", ...)` using `PERPLEXITY_API_KEY`.
  - `src/agents/research-agent.ts` defaults to `createPerplexitySlot()` when no adapter is supplied.
  - `scripts/run-chain.ts` optionally builds a direct Perplexity slot when `PERPLEXITY_API_KEY` is present.
- MCP adapter precedent exists in this repo:
  - `src/adapters/scrapling-adapter.ts` starts a local stdio MCP server and calls a tool via `@modelcontextprotocol/sdk` (`Client`, `StdioClientTransport`, `callTool`).
- Operator Perplexity MCP evidence and naming precedent:
  - Live verified tool call in prior work: `mcp__perplexity__search` (host prefixed name on Claude Code). See: `_bmad-output/implementation-artifacts/17-1-perplexity-mcp-install-and-live-tool-call-verification.md`.
- Local operator configuration location (NOT committed to repo):
  - Cursor: `~/.cursor/mcp.json` contains MCP server registrations. This story requires Perplexity MCP to be registered there.

## Hard Constraints / Guardrails

- **No secrets in repo files.** Never add API keys to any tracked file.
- **No live network calls in unit tests.** All tests must be deterministic and must not require Perplexity connectivity.
- **Do not break graceful degradation.** If Perplexity MCP is not available or the tool call fails, the research agent must continue and set `perplexity_skipped` accordingly (same semantics as today).
- **Prefer existing patterns.** Model the new integration on `src/adapters/scrapling-adapter.ts` rather than inventing a new MCP client layer.
- **Avoid global process spawning churn.** If you spawn a stdio MCP server per query, ensure it is closed reliably (use `finally` and `client.close()` like Scrapling).

## Requirements

### PerplexitySlot implementation

- Replace the direct HTTP implementation of `createPerplexitySlot()` with an MCP-backed implementation.
- The slot must still satisfy the existing public contract used by the Research Agent:
  - Exported types remain usable: `PerplexityResult`, `PerplexitySlot`.
  - `PerplexitySlot.available: boolean` indicates whether Perplexity capability is configured and should be attempted.
  - `search(query: string)` returns `{ answer: string; citations: string[] }`.

### MCP transport and tool contract

- Use `@modelcontextprotocol/sdk` with stdio transport, consistent with `src/adapters/scrapling-adapter.ts`.
- The MCP server command should be configurable, but must have a safe default that matches the operator install pattern:
  - Default command: `npx`
  - Default args: `["-y", "perplexity-mcp"]`
- Tool invoked should align with the Perplexity MCP server’s tool surface.
  - In hosts (Claude/Cursor), the tool is exposed as `mcp__perplexity__search`. In the raw MCP protocol, the tool name will typically be `search`.
  - The adapter must call the MCP tool by its protocol name (likely `"search"`), and must allow overriding the tool name via options for forward compatibility.

### Availability semantics

- `available` must be **true only when**:
  - the MCP server is expected to be runnable in this environment, and
  - the Perplexity credential is present (still via `PERPLEXITY_API_KEY` unless the MCP package documents a different env var), and
  - the required command is discoverable (similar to how `scripts/run-chain.ts` gates Scrapling via `commandAvailable`).
- If `available` is false and `search()` is called, throw `CnsError("UNSUPPORTED", ...)` with a clear configuration message (exact text can change, but keep it operator-actionable).

### Research Agent wiring

- The Research Agent must still:
  - probe Perplexity once per sweep (`perplexityProbe`) and set `perplexity_skipped` correctly.
  - file Perplexity answers into the vault when the slot succeeds (existing behavior in `filePerplexityAnswers`).
- If Perplexity fails, it must be treated as a recoverable service issue (do not fail the sweep).

### Operator config touch points

- Update Cursor’s Perplexity MCP registration in `~/.cursor/mcp.json` (operator machine file, not committed):
  - Ensure there is a `perplexity` server entry that runs the Perplexity MCP server (for example `npx -y perplexity-mcp`).
  - Ensure credential wiring uses environment variables, not literal keys in JSON.
- Update the CNS constitution tool roster to reflect Perplexity MCP usage and naming, without adding secrets:
  - `specs/cns-vault-contract/AGENTS.md`
  - And the canonical vault copy: `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md`
  - These two files must remain identical after edits (repo rule).

## Acceptance Criteria

### AC1. Perplexity slot uses MCP tool, not direct HTTP

- **Given** the current `PerplexitySlot` implementation uses direct HTTP fetch
- **When** the story is implemented
- **Then** Perplexity calls are made via an MCP tool invocation (Perplexity MCP server), not via direct `fetch("https://api.perplexity.ai/...")` inside `src/agents/perplexity-slot.ts`.

### AC2. Chain still runs green

- **Given** the repo baseline
- **When** `bash scripts/verify.sh` is run
- **Then** it passes.

### AC3. Research Agent semantics preserved

- **Given** Perplexity is not configured or fails at runtime
- **When** `runResearchAgent(...)` executes
- **Then** it does not throw, `perplexity_skipped === true`, and the sweep continues.

- **Given** Perplexity MCP succeeds for at least one query
- **When** `runResearchAgent(...)` executes
- **Then** `perplexity_skipped === false`, `perplexity_answers_filed >= 1`, and a created note with `source: "perplexity"` exists in `notes_created`.

### AC4. Operator config updated (Cursor)

- **Given** Cursor uses `~/.cursor/mcp.json` for MCP server registration
- **When** the operator applies the story’s config instructions
- **Then** the Perplexity MCP server is registered and usable in Cursor without committing any secrets.

### AC5. Constitution tool roster updated (and synced)

- **Given** Perplexity is a Tier 1 MCP tool in the constitution
- **When** the story is completed
- **Then** the Perplexity roster text reflects the formal MCP usage and tool naming (host-prefixed `mcp__perplexity__search`), and both constitution copies are identical:
  - `specs/cns-vault-contract/AGENTS.md`
  - `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md`

## Tasks / Subtasks

- [x] Implement MCP-backed Perplexity adapter (AC: 1, 3)
  - [x] Add `src/adapters/perplexity-mcp-adapter.ts` (or equivalent) that:
    - starts a stdio MCP server (`npx -y perplexity-mcp` by default),
    - calls the Perplexity tool (likely `"search"`) via MCP `Client.callTool`,
    - parses tool output into `{ answer, citations }` for the existing `PerplexityResult` type,
    - redacts secrets from any surfaced errors (follow `compactFailure` patterns in `src/adapters/scrapling-adapter.ts`).
  - [x] Update `src/agents/perplexity-slot.ts` so `createPerplexitySlot()` uses the MCP adapter rather than direct HTTP.

- [x] Update chain wiring to prefer the formal MCP path (AC: 1, 2)
  - [x] Update `scripts/run-chain.ts` to use the MCP-backed slot for Perplexity (remove the direct HTTP `buildPerplexitySlot` override path).

- [x] Tests and verification (AC: 2, 3)
  - [x] Update or replace `tests/vault-io/perplexity-slot.test.ts` to cover MCP slot behavior without live calls.
  - [x] Ensure `tests/vault-io/research-agent.test.ts` still passes and still asserts graceful degradation semantics.
  - [x] Run `bash scripts/verify.sh`.

- [x] Operator config and constitution sync (AC: 4, 5)
  - [x] Update operator machine `~/.cursor/mcp.json` Perplexity entry (document what to change, do not commit secrets).
  - [x] Update `specs/cns-vault-contract/AGENTS.md` Perplexity tool roster text (and sync canonical vault copy identically).

### Review Findings

- [x] [Review][Patch] Remove remaining direct Perplexity HTTP runner (`scripts/run-research-agent.ts`) — story intent is “formal MCP, not ad hoc fetch” [`scripts/run-research-agent.ts:55`]
- [x] [Review][Patch] Harden `PERPLEXITY_MCP_COMMAND` / `PERPLEXITY_MCP_ARGS` parsing to avoid surprising splits and reduce env-driven command execution risk (prefer JSON-array args only; reject commands containing whitespace) [`src/agents/perplexity-slot.ts:17`]
- [x] [Review][Patch] Add timeouts/abort strategy around MCP `connect` / `callTool` / `close` to prevent hangs during research sweeps [`src/adapters/perplexity-mcp-adapter.ts:131`]
- [x] [Review][Patch] Reduce double-wrapped error prefixes so operators get one clean actionable message (adapter vs slot) [`src/adapters/perplexity-mcp-adapter.ts:152`]
- [x] [Review][Patch] Strengthen unit tests: avoid exact-string brittleness, add coverage for “command missing on PATH” UNSUPPORTED branch (and `available=false`) [`tests/vault-io/perplexity-slot.test.ts:54`]
- [x] [Review][Defer] `perplexityProbe()` attempts only `brief.queries[0]` then marks `perplexity_skipped=true` on first failure — deferred, pre-existing [`src/agents/research-agent.ts:451`] — deferred, pre-existing

## Dev Notes / Implementation Guidance (prevent common mistakes)

- **Tool naming pitfall:** `mcp__perplexity__search` is the *host-prefixed* name in Claude/Cursor. In raw MCP calls from `@modelcontextprotocol/sdk`, you typically call the underlying tool name (`"search"`). Verify by introspecting `client.listTools()` during development if needed.
- **Result parsing pitfall:** MCP tool results may return content blocks (`result.content[]`) or `structuredContent`. Reuse the robust parsing pattern from `src/adapters/scrapling-adapter.ts` rather than assuming a single JSON shape.
- **Process lifecycle pitfall:** Always close the MCP client transport in a `finally` block, even on error, to avoid leaked child processes.
- **Do not reintroduce hardcoded keys** into `~/.cursor/mcp.json` or any repo files. Use env variables only.

### References

- Current direct slot: `src/agents/perplexity-slot.ts`
- Research Agent uses slot by default: `src/agents/research-agent.ts`
- Live chain wiring: `scripts/run-chain.ts`
- MCP adapter pattern: `src/adapters/scrapling-adapter.ts`
- Prior Perplexity MCP evidence: `_bmad-output/implementation-artifacts/17-1-perplexity-mcp-install-and-live-tool-call-verification.md`

## Standing tasks (every story)

### Standing task: Update operator guide
- [x] If this story changes any user-facing behavior (new tool, new workflow, new constraint, new panel, new integration): update `03-Resources/CNS-Operator-Guide.md` via `vault_create_note` (full overwrite) or `vault_update_frontmatter` plus targeted section edit. Bump `modified` date and add a row to the Version History table in Section 12.
- [x] If no user-facing behavior changed: note "Operator guide: no update required" in Dev Agent Record. (N/A, operator guide updated.)

## Dev Agent Record

### Agent Model Used

GPT-5.2

### Debug Log References

- `PERPLEXITY_API_KEY="" bash scripts/verify.sh` (PASS)

### Completion Notes List

- Perplexity slot no longer performs direct HTTP fetches, it invokes Perplexity via MCP stdio (`npx -y perplexity-mcp`) and tool call (`search`).
- Graceful degradation preserved, missing Perplexity config still yields `UNSUPPORTED` and the research sweep continues with `perplexity_skipped=true`.
- Cursor operator documentation updated with the required `~/.cursor/mcp.json` Perplexity registration shape (env-based, no secrets).
- Constitution Perplexity Tier 1 tool naming made explicit (`mcp__perplexity__search`) and both constitution copies are byte-identical.

### File List

- `src/adapters/perplexity-mcp-adapter.ts`
- `src/agents/perplexity-slot.ts`
- `scripts/run-chain.ts`
- `tests/vault-io/perplexity-slot.test.ts`
- `specs/cns-vault-contract/AGENTS.md`
- `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`
- `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md`

### Change Log

- 2026-04-29: Replaced Perplexity HTTP slot with MCP stdio adapter wiring, removed live-chain HTTP override, updated tests and operator documentation.

