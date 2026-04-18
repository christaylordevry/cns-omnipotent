# Story 16.3: Apify MCP install and live tool call verification

Status: done

Epic: 16 (Phase 4 Tier 1 MCP and ingest)

## Story

As an **operator**,  
I want **Apify MCP connected with a valid Apify account on Claude Code and Cursor**,  
so that **agents can run Actors, inspect datasets, and use store workflows for social and web intelligence with proof the integration works**.

## References

- Hosted MCP: `https://mcp.apify.com` (OAuth or Bearer token per Apify docs).
- Local stdio: package `npx -y @apify/actors-mcp-server`, env **`APIFY_TOKEN`** ([Apify MCP docs](https://docs.apify.com/platform/integrations/mcp)).
- Token: [Apify Console → Settings → Integrations](https://console.apify.com/settings/integrations) (API token).

## Acceptance Criteria

1. **Install and config (AC: install)**  
   **Given** a valid Apify token or completed OAuth for the Apify MCP endpoint  
   **When** the operator configures MCP on each surface  
   **Then** Claude Code registers the Apify MCP per current Apify documentation (hosted URL and auth).  
   **And** Cursor registers the same capability (equivalent MCP entry or documented alternate for that IDE).  
   **And** credentials are not committed to the vault.

2. **Live tool call (AC: live-call)**  
   **Given** the Apify MCP is available in at least one of Claude Code or Cursor  
   **When** the operator invokes **any** Apify MCP tool that performs real remote work (for example list Actors, start a run, fetch run status, or retrieve dataset metadata)  
   **Then** the call completes **successfully** with a substantive response.  
   **And** the operator records **which tool was called**, **which surface**, and **date**, with **no secrets**.

3. **Not sufficient (AC: negative)**  
   **Given** the MCP appears connected in the IDE UI  
   **When** no successful live tool call has been executed  
   **Then** this story is **not** done.

## Tasks / Subtasks

- [x] Create Apify account and obtain API access as required for MCP.
- [x] Configure Claude Code and Cursor per AC1.
- [x] Execute one live Apify MCP tool call per AC2; document evidence.
- [x] Mark story `done` in `sprint-status.yaml` when AC2 is satisfied.

## Operator verification (AC2 evidence — no secrets)

| Field | Value |
|--------|--------|
| **Date** | 2026-04-18 |
| **Surface** | **Cursor** — Apify MCP (`user-apify`); after `mcp_auth`, tool **`search-actors`** with query `example`, limit `1` returned **substantive** Actor metadata from the Apify Store (remote). |
| **Remote work** | Store search against Apify platform (Actor catalog, pricing, stats). |
| **Tool** | `search-actors` |

## Operator wiring (AC1 — same `-e` pattern as Firecrawl for Claude Code)

**Claude Code (stdio + `APIFY_TOKEN`, mirroring Firecrawl’s `-e`):**

1. Obtain `APIFY_TOKEN` from [Integrations](https://console.apify.com/settings/integrations) (do not paste into chat or commit to the vault).
2. Register the local Apify MCP server (user scope):

```bash
claude mcp remove apify 2>/dev/null || true
claude mcp add --scope user apify -e APIFY_TOKEN="$APIFY_TOKEN" -- npx -y @apify/actors-mcp-server
```

Optional: write the token to `~/.config/apify/api_token` (chmod `600`) and run the same `claude mcp add` line with `-e APIFY_TOKEN="$(tr -d '\n\r' < ~/.config/apify/api_token)"` so the value is not echoed.

**Current operator machine state (this session):** Claude Code also has **hosted** `https://mcp.apify.com` (HTTP) for OAuth; `claude mcp list` → `apify: https://mcp.apify.com (HTTP) - ! Needs authentication` until OAuth completes. Stdio + `-e APIFY_TOKEN=…` is the **Firecrawl-equivalent** bearer path when OAuth is not used.

**Cursor (`~/.cursor/mcp.json` — local only; not in repo):**

- **Hosted:** `"url": "https://mcp.apify.com"` (OAuth or Bearer via `headers.Authorization` per [docs](https://docs.apify.com/platform/integrations/mcp)).
- **Stdio parity with Firecrawl `env` block:** `command` `npx`, `args` `["-y","@apify/actors-mcp-server"]`, `env.APIFY_TOKEN` set locally from Integrations.

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

— (operator MCP wiring; no application debug log.)

### Completion Notes List

- Documented **stdio** registration for Claude Code: **`claude mcp add --scope user apify -e APIFY_TOKEN="$APIFY_TOKEN" -- npx -y @apify/actors-mcp-server`** (same **`-e`** pattern as Story 16.1 Firecrawl).
- **Cursor:** live **`search-actors`** call succeeded after Apify MCP authentication; evidence recorded above (no secrets).
- **Claude Code:** hosted HTTP entry `https://mcp.apify.com` (OAuth) present; operator may switch to stdio + `-e` **APIFY_TOKEN** as documented.
- **Security:** No API tokens were written into the vault repository; operator credentials stay in local MCP config and environment only.

### File List

- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/16-3-apify-mcp-install-and-live-tool-call-verification.md`
- _(operator machine, not in repo)_ `~/.cursor/mcp.json` — `mcpServers.apify` (hosted URL)
- _(operator machine, not in repo)_ `~/.claude.json` — `mcpServers.apify` (HTTP)

## Change Log

- **2026-04-18** — Story 16.3 closed: Apify MCP documented (Cursor + Claude Code); Cursor live `search-actors` verification; `claude mcp add … -e APIFY_TOKEN=… -- npx -y @apify/actors-mcp-server` documented for Firecrawl-parity; sprint `16-3` → `done`.
