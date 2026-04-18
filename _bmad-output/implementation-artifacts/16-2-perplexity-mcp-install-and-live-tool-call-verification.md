# Story 16.2: Perplexity MCP install and live tool call verification

Status: ready-for-dev

Epic: 16 (Phase 4 Tier 1 MCP and ingest)

## Story

As an **operator**,  
I want **Perplexity MCP installed with a valid API key on Claude Code and Cursor**,  
so that **agents can run real-time search and synthesis for market and competitor questions with proof the integration works**.

## References

- Install pattern: `claude mcp add --scope user perplexity -- npx -y perplexity-mcp`
- API key from [pplx.ai](https://pplx.ai). Pro subscription does **not** automatically include API access; billing is separate pay-per-use where applicable.
- Routing: `AI-Context/AGENTS.md` Section 9 (when to use Perplexity vs vault and Context7).

## Acceptance Criteria

1. **Install and config (AC: install)**  
   **Given** a valid `PERPLEXITY_API_KEY` (or the env name required by the current `perplexity-mcp` package)  
   **When** the operator registers the MCP server  
   **Then** Claude Code has the server at user scope, for example:  
   `claude mcp add --scope user perplexity -- npx -y perplexity-mcp`  
   **And** the API key is supplied via environment or MCP `env` block (not committed to the vault).  
   **And** Cursor includes an equivalent `npx -y perplexity-mcp` entry with the same credential wiring.

2. **Live tool call (AC: live-call)**  
   **Given** the MCP server is running in at least one of Claude Code or Cursor  
   **When** the operator invokes **any** Perplexity MCP tool that performs a real remote query (for example search or chat against the Perplexity API)  
   **Then** the call completes **successfully** with a substantive response.  
   **And** the operator records **which tool was called**, **which surface**, and **date**, with **no secrets**.

3. **Not sufficient (AC: negative)**  
   **Given** `claude mcp list` shows the server as registered  
   **When** no successful live tool call has been executed  
   **Then** this story is **not** done.

## Tasks / Subtasks

- [ ] Create or obtain Perplexity API access at pplx.ai; configure env per current package docs.
- [ ] Wire Claude Code and Cursor per AC1.
- [ ] Execute one live Perplexity MCP tool call per AC2; document evidence.
- [ ] Mark story `done` in `sprint-status.yaml` when AC2 is satisfied.

## Dev Agent Record

### Agent Model Used

_TBD_

### Debug Log References

_TBD_

### Completion Notes List

_TBD_

### File List

_TBD_
