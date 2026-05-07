# Story 28.2: Register NotebookLM MCP server in Hermes config (uvx)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

Epic: **28** (Hermes operator closure and NotebookLM freshness)  
Tracked in sprint-status as: **`28-2-register-notebooklm-mcp-server-in-hermes-config`**

## Context

- **Handoff (authoritative):** “Story 28.2: Register NotebookLM MCP server (notebooklm-mcp-cli via uvx) in `~/.hermes/config.yaml` so `/session-close` skill can call `source_add` and `notebook_query` directly without Claude Desktop as middleman. Last vault export source ID: `641fd98f-428e-4624-8469-6bc48c58b937`.”
- **28.1** introduced `/session-close` and expects NotebookLM automation as part of the close workflow. This story is strictly the **infrastructure wiring** needed so Hermes can call NotebookLM MCP tools directly. [Source: `_bmad-output/implementation-artifacts/28-1-automate-agents-md-section-8-via-hermes-session-close.md`]

## Story

As an **operator**,  
I want **Hermes to have the NotebookLM MCP server registered in `~/.hermes/config.yaml` using `uvx` (notebooklm-mcp-cli)**,  
so that **the `/session-close` skill can call `source_add` and `notebook_query` directly without relying on Claude Desktop**.

## Acceptance Criteria

1. **Hermes MCP registration (AC: config)**  
   **Given** Hermes reads MCP server configuration from `~/.hermes/config.yaml`  
   **When** this story is implemented  
   **Then** a new MCP server entry exists for **NotebookLM** that runs **`notebooklm-mcp-cli` via `uvx`**  
   **And** it is named consistently (e.g. `notebooklm`) so the `/session-close` skill can target it deterministically  
   **And** the config change is minimal and does not break existing MCP servers.

2. **Command correctness (AC: uvx)**  
   **When** Hermes launches the NotebookLM MCP server  
   **Then** the command uses `uvx` (not system Python assumptions)  
   **And** the server starts successfully under the same runtime assumptions as other Hermes MCP servers (stdio transport, no GUI dependencies).

3. **Tool availability (AC: tools)**  
   **Given** the NotebookLM MCP server is running  
   **When** Hermes invokes NotebookLM operations from a skill  
   **Then** the following tools are callable end-to-end:
   - `source_add`
   - `notebook_query`
   **And** failures are surfaced as explicit Hermes-visible errors (no silent skip).

4. **Session-close integration check (AC: session-close)**  
   **When** `/session-close` runs in “real” mode (not dry-run)  
   **Then** it can call `source_add` directly via the registered MCP server  
   **And** (if implemented in 28.1) it can call `notebook_query` directly via the same MCP server  
   **And** the operator-visible output includes a one-line confirmation that NotebookLM MCP is available (or a clear error if not).

5. **Source ID continuity (AC: source-id)**  
   **Given** the last known vault export source ID is `641fd98f-428e-4624-8469-6bc48c58b937`  
   **When** the `/session-close` skill updates NotebookLM sources  
   **Then** the workflow uses the correct source identifier semantics for the NotebookLM MCP server (existing source update vs add-new behavior)  
   **And** if the MCP API does not support “update existing source by ID”, the skill must document the fallback behavior (e.g., add a new source per run) without implying in-place updates that don’t exist.

6. **Evidence (AC: proof)**  
   **When** implementation is complete  
   **Then** the Dev Agent Record includes:
   - The exact `~/.hermes/config.yaml` snippet added (redacting secrets/tokens)
   - A short transcript excerpt showing a successful `source_add` call from Hermes context
   - Any required environment variables / auth prerequisites noted explicitly

## Tasks / Subtasks

- [x] Identify the existing MCP server config structure in `~/.hermes/config.yaml` and add a new server entry for NotebookLM using `uvx` (AC: config, uvx)
- [x] Ensure Hermes can reach the server and that the server exposes `source_add` + `notebook_query` (AC: tools)
- [x] Validate `/session-close` calls the NotebookLM MCP directly (AC: session-close)
- [x] Record the source-ID behavior decision and evidence (AC: source-id, proof)

## Dev Notes

- **Hard scope boundary:** do **not** change Vault IO WriteGate policy, audit policies, or constitution protections in this story. This is config wiring only.
- **Auth expectations:** the NotebookLM MCP server may require auth/env configuration; document required env vars and where Hermes obtains them (env passthrough vs config file) but do not embed secrets in repo files.
- **Where to change:** this story likely touches operator-local config (`~/.hermes/config.yaml`) and potentially an example/snippet under the repo if you maintain Hermes config templates. If you add repo fixtures, keep them clearly labeled as examples vs live config.

### References

- `_bmad-output/implementation-artifacts/28-1-automate-agents-md-section-8-via-hermes-session-close.md`
- `~/.hermes/config.yaml` (target)
- NotebookLM MCP CLI entrypoint: `notebooklm-mcp-cli` (via `uvx`)
- Source ID: `641fd98f-428e-4624-8469-6bc48c58b937`

## Standing tasks (every story)

### Standing task: Update operator guide
- [x] If operator workflow changes (new dependency or setup step): update `03-Resources/CNS-Operator-Guide.md` with the NotebookLM MCP registration step and troubleshooting.

## Dev Agent Record

### Agent Model Used

GPT-5 (Cursor)

### Debug Log References

- Hermes MCP registration updated: `~/.hermes/config.yaml` (`mcp_servers.notebooklm` via `uvx --from notebooklm-mcp-cli notebooklm-mcp`)
- Hermes MCP health check: `hermes mcp test notebooklm` succeeded; tools discovered include `source_add` + `notebook_query`
- `/session-close --dry-run` CLI simulation (non-Discord): Hermes chat session `20260507_025049_b8e2f3` (preview output)
- Proof of end-to-end `source_add` from Hermes context: Hermes chat session `20260507_025743_f9d6c1`

### Completion Notes List

- Registered NotebookLM MCP server in Hermes under `mcp_servers.notebooklm` using `uvx` with explicit executable resolution (`--from notebooklm-mcp-cli notebooklm-mcp`).
- Patched `session-close` skill prompt to call NotebookLM via the registered server tool name `mcp__notebooklm__source_add` (and preflight check for `notebooklm:` in config) instead of assuming Claude Desktop.
- Verified Hermes can connect to NotebookLM MCP and sees tool surface including `source_add` and `notebook_query`.
- Evidence (safe excerpt): `mcp__notebooklm__source_add` succeeded for notebook **"CNS Vault Architecture"** (`notebook_id: 981466f0-de1c-4551-93a9-f3bc2a24b184`) with export file `scripts/output/vault-export-for-notebooklm.md` (returned `source_id: a240180f-c2fd-4d49-aab9-0c33d3893d27`).

**Source ID continuity note (AC: source-id):** NotebookLM MCP `source_add` returns a new `source_id`. This workflow does not assume in-place updates of an existing source by ID; if “update existing source” is required in future, it must use a supported MCP tool (if one exists) or fall back to “add new source per run.”

### File List

- /home/christ/.hermes/config.yaml
- /home/christ/.hermes/skills/cns/session-close/SKILL.md
- /home/christ/.hermes/skills/cns/session-close/references/task-prompt.md
- Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md
- _bmad-output/implementation-artifacts/sprint-status.yaml
- _bmad-output/implementation-artifacts/28-2-register-notebooklm-mcp-server-in-hermes-config.md

