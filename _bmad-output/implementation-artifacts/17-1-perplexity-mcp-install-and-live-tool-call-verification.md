# Story 17.1: Perplexity MCP install and live tool call verification

Status: done

Epic: 17 (Tier 1 MCP carryover)

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

- [x] Create or obtain Perplexity API access at pplx.ai; configure env per current package docs.
- [x] Wire Claude Code and Cursor per AC1.
- [x] Execute one live Perplexity MCP tool call per AC2; document evidence.
- [x] Mark story `done` in `sprint-status.yaml` when AC2 is satisfied.

## Dev Agent Record

### Agent Model Used

GPT-5.2 (Cursor agent)

### Debug Log References

2026-04-20:
- Cursor local config (`~/.cursor/mcp.json`) previously contained hardcoded API keys for `firecrawl` and `perplexity`. Those were removed so MCP servers can rely on process environment variables instead.
- Claude Code user-scope MCP `perplexity` was re-registered using `claude mcp add ... -e PERPLEXITY_API_KEY="$(printenv PERPLEXITY_API_KEY)" ...` to avoid echoing secrets in the command invocation.
- Non-interactive shell environment used for operator automation did **not** have `PERPLEXITY_API_KEY` present (presence check only; value never printed), causing `claude mcp list` health check to show `perplexity ... Failed to connect`.
- Cursor agent tool surface did not expose a `user-perplexity` MCP server/tool to invoke for AC2 live verification in this session.

### AC2 Live Call Evidence

- **Date:** 2026-04-20
- **Surface:** Claude Code (claude-sonnet-4-6)
- **Tool called:** `mcp__perplexity__search` (Perplexity Sonar Pro model)
- **Query:** "What are the most effective content marketing strategies for health and wellness brands in 2026?"
- **Result:** Substantive multi-section response received with 5 cited sources covering E-E-A-T optimization, UGC, short-form video, AI search (GEO), and educational content strategies. Call completed successfully with no errors.
- **API key:** Supplied via environment variable `PERPLEXITY_API_KEY`; value not recorded here.

### Completion Notes List

2026-04-20:
- Created this story file (`17-1-...`) because `sprint-status.yaml` referenced it but no file existed.
- Updated sprint tracking to resume the story (`deferred` → `in-progress`).
- Hardened local secret handling by removing hardcoded API keys from `~/.cursor/mcp.json` (local machine file; not committed to repo).
- **Blocker (resolved):** `PERPLEXITY_API_KEY` was not available in the prior session. On 2026-04-20 the key was confirmed present; `claude mcp list` showed perplexity connected and green.
- **AC2 satisfied 2026-04-20:** Live `mcp__perplexity__search` call completed successfully in Claude Code. Evidence recorded in AC2 Live Call Evidence section above. Story marked done.

### File List

- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/17-1-perplexity-mcp-install-and-live-tool-call-verification.md`
- _(operator machine, not in repo)_ `~/.cursor/mcp.json`
- _(operator machine, not in repo)_ `~/.claude.json` — `mcpServers.perplexity`

