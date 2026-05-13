# Story 29.0: Token audit + MCP always-on cleanup

Status: complete

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

Epic: **29** (Knowledge Quality + Agent Memory)  
Tracked in sprint-status as: **`29-0-token-audit-and-mcp-always-on-cleanup`**

## Context

- Epic 29 treats **token efficiency** as a **hard acceptance criterion**: always-on context must be aggressively minimized, and on-demand skills/tools must be **zero always-on overhead**. [Source: `_bmad-output/planning-artifacts/epic-29-knowledge-quality-agent-memory-brief-and-story-cards.md` §Token efficiency principle]
- This is **pre-work ops** to establish a baseline before 29-1+ (USER/MEMORY wiring, lint, dedup, disambiguation, fast-scan index). It must **not** change production behavior to “clean up while auditing.” [Source: Epic 29 story card 29-0]
- The story card explicitly points at read-only inspection of:
  - Hermes config (`~/.hermes/config.yaml`) for cold-start ordering and char limits
  - Cursor / Claude Code MCP configuration used for CNS work (local config, not repo)
  - `src/agents/operator-context.ts` (`DEFAULT_OPERATOR_CONTEXT`) for “always-on” context in this repo. [Source: Epic 29 story card 29-0 technical notes]
- Hygiene reminder: remove `~/.hermes/SOUL.md` after any Hermes restart used during this audit. [Source: Epic 29 risks + 29-0 AC]

## Story

As an **operator**,  
I want a **baseline token audit and MCP always-on configuration cleanup plan**,  
so that **Epic 29 implementation does not inherit hidden context bloat or redundant MCP load**.

## Scope boundaries (non-negotiable)

- This story is **read-only / documentation-first**: capture current state, measure, recommend, and propose a split between always-on and session-enabled MCP connections.
- This story must **not**:
  - write to the Obsidian vault (no Vault IO writes; no filesystem writes into `Knowledge-Vault-ACTIVE/**`)
  - change Hermes skills or prompts under `~/.hermes/skills/**`
  - mutate MCP server code, tool signatures, or audit logging in this repo (`src/**`, `specs/**`)
  - silently “fix” configs during audit (no behavior changes; recommendations only)

## Acceptance Criteria

1. **Cold-start baseline (AC: cold-start)**
   - **Given** the current Hermes CNS setup
   - **When** the audit is performed
   - **Then** the audit note documents:
     - current cold-start ordering (where AGENTS/MEMORY/USER appear today, and in what order)
     - current Hermes caps for operator identity slices (char limits such as `memory_char_limit` / `user_char_limit`, as configured)
     - where these values are defined (file path(s) + key names)

2. **Token audit run (AC: token-audit)**
   - **Given** the “CNS Claude Code setup” used day-to-day (Cursor + MCP + default context + any always-on files)
   - **When** the token audit is run using the existing audit script / mechanism available in this repo/tooling
   - **Then** the audit note includes:
     - the exact command(s) used
     - the measurement method (what is being counted: tokens vs chars/bytes; model/tokenizer if applicable)
     - results for the major always-on components (at minimum: operator context builder inputs and any always-on config-injected text)
     - a short “largest contributors” list and immediate candidate reductions (recommendations only)
   - **And** if no token-audit script exists in this repo, the audit note records the discovery outcome and the chosen fallback measurement method (still read-only; no new tooling required in 29-0).

3. **MCP inventory (AC: inventory)**
   - **When** the audit is performed
   - **Then** the audit note inventories the MCP servers used for CNS work across:
     - Cursor / Claude Code MCP configuration (local machine config used by the IDE)
     - Hermes MCP configuration where relevant (e.g., NotebookLM MCP, Vault IO MCP)
   - **And** for each MCP server, records:
     - server name
     - transport (npm/uvx/local binary/path, if visible)
     - why it’s needed for CNS operation
     - whether it should be always-on or session-enabled (recommended classification)

4. **Always-on vs session-enabled split plan (AC: split)**
   - **Given** the inventory
   - **When** classification is complete
   - **Then** the audit note proposes a concrete split into two groups:
     - **Always-on**: minimal set required for safe baseline operation (no “nice-to-have” tools)
     - **Session-enabled**: everything else, enabled only when the task demands it
   - **And** the note includes a “how to enact” section describing the exact config surfaces to edit (paths + keys) to realize the split, without actually performing the edits in 29-0.

5. **SOUL.md hygiene (AC: soul)**
   - **If** Hermes is restarted during audit for any reason
   - **Then** the audit note confirms `~/.hermes/SOUL.md` is absent after the restart step completes (or records that no restart occurred).

6. **Audit artifact produced (AC: artifact)**
   - **Then** a short audit note exists at:
     - `_bmad-output/implementation-artifacts/29-0-token-audit-and-mcp-always-on-cleanup.audit.md`
   - **And** it contains the findings and recommended cleanup actions (recommendations only), sufficient for operator sign-off and for 29-1+ implementers to use as baseline constraints.

## Tasks / Subtasks

- [x] **Identify current cold-start ordering + caps** (AC: cold-start)
  - [x] Inspect `~/.hermes/config.yaml` for `memory_char_limit`, `user_char_limit`, and any ordering/position configuration.
  - [x] Identify where AGENTS/MEMORY/USER are assembled today (Hermes layer vs repo `src/agents/operator-context.ts`) and document ordering.

- [x] **Run baseline token audit** (AC: token-audit)
  - [x] Locate and run the token audit script/mechanism currently used in this repo/tooling (record command + output summary).
  - [x] If no script exists, use a documented fallback (e.g., char/byte counts + conservative token estimate) and record method + limitations.

- [x] **Inventory MCP servers for CNS Claude Code** (AC: inventory)
  - [x] Locate Cursor/Claude Code MCP config used by this workstation (record path; do not edit).
  - [x] Extract MCP server list and note which are currently enabled by default vs only enabled by explicit use.
  - [x] Cross-check Hermes side MCP usage where it materially affects operator workflows (NotebookLM, Vault IO).

- [x] **Classify always-on vs session-enabled candidates** (AC: split)
  - [x] Propose minimal always-on set (target: smallest set that avoids constant “tool unavailable” friction for routine CNS work).
  - [x] Propose session-enabled set, grouped by task category (research, ingestion, maintenance, diagnostics).
  - [x] Document proposed config changes required to implement the split later (paths + keys; no edits in 29-0).

- [x] **Confirm SOUL.md hygiene** (AC: soul)
  - [x] If any Hermes restart occurred, confirm `~/.hermes/SOUL.md` was removed after restart and document the check.

- [x] **Write audit note artifact** (AC: artifact)
  - [x] Create `_bmad-output/implementation-artifacts/29-0-token-audit-and-mcp-always-on-cleanup.audit.md` summarizing findings and recommendations.

## Dev Notes

### Developer guardrails

- Treat this as **ops reconnaissance**. The only output is documentation inside the repo (`_bmad-output/**`). No config edits, no vault writes, no skill changes.
- Be explicit about **which surfaces are Cursor-local vs repo-tracked**. This story must not accidentally commit local secrets/config.
- Prefer measurements that are **repeatable** and **cheap**. If token counting requires external dependencies, document and defer; do not expand scope.

### References

- Epic 29 planning artifact (Story card 29-0): `_bmad-output/planning-artifacts/epic-29-knowledge-quality-agent-memory-brief-and-story-cards.md`
- Operator context code pointer: `src/agents/operator-context.ts` (`DEFAULT_OPERATOR_CONTEXT`)

## Dev Agent Record

### Agent Model Used

GPT-5.2 (Cursor)

### Debug Log References

- Token audit command(s) + output:
  - `wc -w -c /home/christ/ai-factory/projects/Omnipotent.md/CLAUDE.md`
  - `wc -c /home/christ/.hermes/.skills_prompt_snapshot.json`
  - Python extraction/measurement of `DEFAULT_OPERATOR_CONTEXT` from `src/agents/operator-context.ts` (chars and chars/4 token estimate)
- Cold-start ordering evidence:
  - Recorded from prior confirmed readout of `~/.hermes/hermes-agent/run_agent.py` and `~/.hermes/hermes-agent/prompt_builder.py` (documented in the audit artifact under “Cold-Start Load Order”).
- MCP inventory evidence (sanitized):
  - `/home/christ/.cursor/mcp.json`
  - `/home/christ/.claude/settings.json`
  - `/home/christ/.hermes/config.yaml` (`mcp_servers:` keys)

### Completion Notes List

- Completed audit artifact updates only (no `src/`, `specs/`, `dist/`, Hermes skills, or vault changes).
- No Hermes restart was performed as part of this patch; SOUL.md “post-restart deletion” check is therefore recorded as **not applicable** for this run.
- Added confirmed Hermes cold-start load order to the audit record (required dependency for 29-1/29-3).
- Added explicit token measurement methodology, including commands, the “chars ÷ 4” approximation formula, and per-source measurements/upper bounds.
- Added “how to enact” split-plan section with exact config surfaces + keys for Hermes, Claude Code, and Cursor.

### File List

- `_bmad-output/implementation-artifacts/29-0-token-audit-and-mcp-always-on-cleanup.md`
- `_bmad-output/implementation-artifacts/29-0-token-audit-and-mcp-always-on-cleanup.audit.md`

### Completion date

2026-05-13

