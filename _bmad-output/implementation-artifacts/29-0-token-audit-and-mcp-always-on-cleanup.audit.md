# Story 29-0 — Token audit + MCP always-on cleanup (AUDIT)
Date: 2026-05-12  
Scope: **read-only ops audit** (no vault writes, no Hermes skill edits, no MCP/server mutations)

## Executive summary
- `CLAUDE.md` is **374 words** (PASS; under 900-word threshold).
- **MCP is currently “always-on” in multiple places** (Cursor, Claude Code, Hermes). The aggregate tool-schema context is the dominant always-on token risk.
- **No `UserPromptSubmit` hook config was found** in the active Claude Code settings; prompt-level hook overhead appears **absent** (based on config inspection).
- Hermes CNS skills installed for routing are a small set (5), but Hermes’ global skills catalog is large; it appears to use a **cached skills manifest** (`~/.hermes/.skills_prompt_snapshot.json`) rather than re-indexing on every message.
- **Token baseline cannot be precisely measured from repo-only artifacts** (tool schema injection happens at runtime). This audit provides a conservative estimate + a concrete “how to measure” plan for 29-1.

---

## Cold-Start Load Order (confirmed; Hermes)

This section records the **confirmed Hermes cold-start context load order** (evidence required by 29-1 and 29-3). Order below is **as implemented by Hermes** (from prior readout of `~/.hermes/hermes-agent/run_agent.py` and `~/.hermes/hermes-agent/prompt_builder.py`):

1. `SOUL.md`
2. help guidance
3. tool-aware guidance
4. Nous subscription prompt
5. tool-use enforcement
6. caller `system_message`
7. `MEMORY.md` snapshot
8. `USER.md` snapshot
9. external memory provider
10. skills system prompt / skills index
11. project context files (`.hermes.md` / `AGENTS.md` / `CLAUDE.md`)
12. conversation timestamp/session/model
13. platform formatting hint

## Evidence (paths inspected)
- Repo rules / operator context:
  - `/home/christ/ai-factory/projects/Omnipotent.md/CLAUDE.md`
  - `/home/christ/ai-factory/projects/Omnipotent.md/src/agents/operator-context.ts`
- Claude Code local config:
  - `/home/christ/.claude/settings.json`
  - `/home/christ/ai-factory/projects/Omnipotent.md/.claude/settings.local.json` (repo-local permissions allowlist; not a runtime prompt hook config)
- Cursor MCP config:
  - `/home/christ/.cursor/mcp.json`
- Hermes config + cached skill index snapshot:
  - `/home/christ/.hermes/config.yaml`
  - `/home/christ/.hermes/.skills_prompt_snapshot.json`
  - `/home/christ/.hermes/skills/cns/*`
  - `/home/christ/.hermes/SOUL.md` (presence check only; no restart performed)

---

## 1) `CLAUDE.md` word count (threshold: 900)
- **Result**: **374 words** (PASS)
- **Method**: `wc -w /home/christ/ai-factory/projects/Omnipotent.md/CLAUDE.md`

Notes:
- While word-count is compliant, `CLAUDE.md` still contributes always-on tokens whenever loaded as project rules/context by the IDE/agent runtime.

---

## 1.1) Token audit methodology (29-0 manual approximation; no script found)

### Script discovery outcome
- **Token-counting script found?** **No** (none located/used for 29-0).
- **Fallback method used**: manual approximation using:
  - **rough_tokens ≈ chars ÷ 4**
  - plus explicit **counts** where available (word/char counts, tool counts).

### Measurement commands used
- File size / char count:
  - `wc -c <path>`
  - `wc -w -c <path>` (word count + bytes)
- Extracting + measuring `DEFAULT_OPERATOR_CONTEXT` (from `src/agents/operator-context.ts`):
  - `python -c` script to extract the object literal and print `len(chars)` and `chars/4`

### Always-on context sources (measured / bounded)

- **`CLAUDE.md`**
  - **Path**: `/home/christ/ai-factory/projects/Omnipotent.md/CLAUDE.md`
  - **Method**: `wc -w -c`
  - **Result**: **374 words**, **3017 chars**
  - **Token estimate**: \(3017 ÷ 4\) ≈ **754 tokens**

- **`MEMORY.md` snapshot (Hermes)**
  - **Path**: *not found as a stable file under* `/home/christ/.hermes/**` during this audit (only docs reference at `~/.hermes/hermes-agent/website/docs/user-guide/features/memory.md`)
  - **Method**: **upper bound from config** (`memory.memory_char_limit`)
  - **Result**: max **2200 chars** (from `~/.hermes/config.yaml`)
  - **Token estimate** (upper bound): \(2200 ÷ 4\) ≈ **550 tokens**
  - **Audit note**: Hermes still loads a “`MEMORY.md` snapshot” in cold-start ordering (see confirmed load order above), but the on-disk snapshot path was not observed in 29-0.

- **`USER.md` snapshot (Hermes)**
  - **Path**: *not found as a stable file under* `/home/christ/.hermes/**` during this audit
  - **Method**: **upper bound from config** (`memory.user_char_limit`)
  - **Result**: max **1375 chars** (from `~/.hermes/config.yaml`)
  - **Token estimate** (upper bound): \(1375 ÷ 4\) ≈ **344 tokens**
  - **Audit note**: Hermes still loads a “`USER.md` snapshot” in cold-start ordering (see confirmed load order above), but the on-disk snapshot path was not observed in 29-0.

- **Hermes skills index / cached manifest**
  - **Path**: `/home/christ/.hermes/.skills_prompt_snapshot.json`
  - **Method**: `wc -c`
  - **Result**: **51385 chars**
  - **Token estimate**: \(51385 ÷ 4\) ≈ **12846 tokens**
  - **Interpretation caveat**: This is the size of the cached manifest file. It is strong evidence that Hermes *can* load a large skills index, but 29-0 did **not** capture a runtime prompt dump proving the entire manifest is injected into every prompt turn.

- **`DEFAULT_OPERATOR_CONTEXT`**
  - **Path**: `/home/christ/ai-factory/projects/Omnipotent.md/src/agents/operator-context.ts`
  - **Method**: extracted object literal chars via Python; tokens ≈ chars/4
  - **Object (exact; pasted for measurement)**:

```ts
{
  name: "Chris Taylor",
  location: "Sydney, Australia",
  positioning: "Creative Technologist",
  tracks: [
    { name: "Escape Job", status: "active", priority: "primary" },
    { name: "Build Agency", status: "active", priority: "primary" },
  ],
  constraints: ["solo operator", "building in public"],
};
```

  - **Result**: **310 chars**
  - **Token estimate**: \(310 ÷ 4\) ≈ **78 tokens**

- **MCP tool schema injection (per-server estimate)**
  - **Method required for 29-0**: **tool_schema_tokens ≈ tool_count × avg_tokens_per_tool_def**
  - **Avg tokens per tool definition**: **250 tokens/tool** (manual planning constant; adjust in 29-1 using real assembled prompt/tokenizer)
  - **Tool counts used**:
    - For MCPs represented by local tool descriptors: count `mcps/<server>/tools/*.json`
    - For Vault IO: count `src/tools/*.ts` (10 tool implementations)
    - For NotebookLM: known toolset in this project is 2 tools (from repo rules table) → **2 tools**

  - **Per-server estimates (planning)**
    - **Cursor always-on MCPs** (from `/home/christ/.cursor/mcp.json`):
      - `context7`: **2 tools** → \(2 × 250\) ≈ **500 tokens**
      - `firecrawl`: **15 tools** → \(15 × 250\) ≈ **3750 tokens**
      - `perplexity`: **3 tools** → \(3 × 250\) ≈ **750 tokens**
      - `apify`: **1 tool** → \(1 × 250\) ≈ **250 tokens**
    - **Claude Code always-on MCPs** (from `/home/christ/.claude/settings.json`):
      - `vault-io`: **10 tools** → \(10 × 250\) ≈ **2500 tokens**
    - **Hermes always-on MCPs** (from `~/.hermes/config.yaml` → `mcp_servers:`):
      - `cns_vault_io`: **10 tools** (same server as `vault-io`) → **2500 tokens**
      - `notebooklm`: **2 tools** → \(2 × 250\) ≈ **500 tokens**
    - **(Optional) Discord MCP** (present in this Cursor environment; not part of the “always-on MCP cleanup” but part of the tool-schema footprint):
      - `discord`: **5 tools** → \(5 × 250\) ≈ **1250 tokens**

  - **Aggregate planning estimate (MCP tool schemas only)**
    - Cursor (context7+firecrawl+perplexity+apify): **~5250 tokens**
    - Claude Code (vault-io): **~2500 tokens**
    - Hermes (cns_vault_io+notebooklm): **~3000 tokens**
    - **Total (MCP schemas)**: **~10750 tokens** (before other always-on text, and before any runtime-specific wrappers)

## 2) MCP connections inventory (Claude Code setup)

### A. Claude Code (`~/.claude/settings.json`)
Config surface: `/home/christ/.claude/settings.json`

Configured MCP servers:
1. **`vault-io`**
   - **command/transport**: `node /home/christ/ai-factory/projects/Omnipotent.md/dist/index.js`
   - **env**: `CNS_VAULT_ROOT=/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE`
   - **current posture**: **always-on** (loaded by default via settings)
   - **why needed**: CNS Vault IO read/write/search tools (governed by WriteGate)
   - **recommended classification**: **session-enabled by default** (enable only when actually doing vault operations), *except* if you rely on Vault IO in nearly every session.

### B. Cursor (`~/.cursor/mcp.json`)
Config surface: `/home/christ/.cursor/mcp.json`

Configured MCP servers:
1. **`context7`**
   - **command/transport**: `npx -y @upstash/context7-mcp`
   - **current posture**: **always-on** (Cursor MCP config)
   - **why needed**: documentation lookups (mandatory protocol in this repo)
   - **recommended classification**: **session-enabled**, but “easy to enable” (frequent use; large ROI).
2. **`firecrawl`**
   - **command/transport**: `npx -y firecrawl-mcp`
   - **env**: `FIRECRAWL_API_KEY=...` (present in file)
   - **current posture**: **always-on**
   - **why needed**: web scraping/research (often used, but not every coding session)
   - **recommended classification**: **session-enabled** (research-only).
3. **`perplexity`**
   - **command/transport**: `npx -y perplexity-mcp`
   - **env**: `PERPLEXITY_API_KEY=${PERPLEXITY_API_KEY}`
   - **current posture**: **always-on**
   - **why needed**: web search / deep research (research-only)
   - **recommended classification**: **session-enabled** (research-only).
4. **`apify`**
   - **transport**: remote MCP URL (`https://mcp.apify.com`)
   - **current posture**: **always-on**
   - **why needed**: targeted web automations/scrapes (occasionally)
   - **recommended classification**: **session-enabled** (rare/optional).

### C. Hermes (`~/.hermes/config.yaml`)
Config surface: `/home/christ/.hermes/config.yaml` → `mcp_servers:`

Configured MCP servers:
1. **`cns_vault_io`**
   - **command/transport**: `node /home/christ/ai-factory/projects/Omnipotent.md/dist/index.js`
   - **env**: `CNS_VAULT_ROOT=/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE`
   - **current posture**: **always-on while Hermes gateway is running**
   - **why needed**: Hermes skills execute governed vault workflows
   - **recommended classification**: **always-on (Hermes-only)**, but consider **delayed connect** if Hermes supports “connect MCP on first tool use”.
2. **`notebooklm`**
   - **command/transport**: `uvx --from notebooklm-mcp-cli notebooklm-mcp`
   - **current posture**: **always-on while Hermes gateway is running**
   - **why needed**: fan-out exports to NotebookLM during `/session-close`
   - **recommended classification**: **session-enabled within Hermes** (only for `/session-close` flows) if Hermes supports on-demand MCP connection.

---

## 3) Prompt-submit hooks (`UserPromptSubmit`) audit
Target: `~/.claude/settings.json` (and adjacent config surfaces under `~/.claude/`)

### Findings
- **Active Claude Code settings (`/home/christ/.claude/settings.json`) contains no `hooks` section** and no `UserPromptSubmit` entries.
- Repo-local `.claude/settings.local.json` is a **permissions allowlist**, not a hooks config surface.

### Risk / follow-up
- Even without explicit `UserPromptSubmit`, other hook events (e.g. `PreToolUse`, plugin hooks) could still exist in other config locations; none were found in the inspected surfaces above.

---

## 4) Hermes skills index overhead

### Installed CNS Hermes skills (task-relevant set)
From `/home/christ/.hermes/config.yaml` (`discord.channel_skill_bindings`) and directory listing `/home/christ/.hermes/skills/cns/`:
- `hermes-url-ingest-vault`
- `triage`
- `session-close`
- `hermes-url-auto-capture-inbox`
- `hermes-cns-verify-gate-summary`

### Global Hermes skills catalog
- Hermes also has many non-CNS skills under `/home/christ/.hermes/skills/**` (multiple categories).
- A cached snapshot exists at `/home/christ/.hermes/.skills_prompt_snapshot.json` containing a **manifest** of skill files (path → [mtime?, size]) which strongly suggests **indexing is cached** (startup/refresh) rather than rebuilt on every message.

### “Loads on every message” vs “only on trigger”
- **Likely**: Hermes uses the cached skill manifest to support routing, and loads the *selected* skill content only when a message triggers routing (e.g., slash commands / bindings).
- **Unknown / needs measurement**: whether Hermes injects any global “skills hub” summary into every prompt turn. This can be verified in 29-1 by capturing the exact assembled system/context prompt for a no-op message (no skill triggered).

---

## 5) Cold-start ordering + caps (AGENTS / MEMORY / USER)

### Char limits (Hermes)
From `/home/christ/.hermes/config.yaml`:
- `memory.memory_char_limit`: **2200**
- `memory.user_char_limit`: **1375**

### Where ordering is defined
- **Repo layer**: operator defaults exist in `src/agents/operator-context.ts` (`DEFAULT_OPERATOR_CONTEXT`) but this is not the same as Hermes “MEMORY/USER” injection.
- **Hermes layer**: the ordering of injected blocks (AGENTS vs MEMORY vs USER vs channel prompts) is not explicitly declared in `config.yaml` in a simple “order” array; it is implied by Hermes’ internal prompt assembly pipeline.

### Current ordering (audit conclusion)
- **Confirmed Hermes cold-start load order is recorded above** under “Cold-Start Load Order (confirmed; Hermes)”.
- **Not directly observable from config files alone** how Hermes’ *runtime* prompt assembles channel prompts vs project context vs skills summary vs tool schemas (beyond the known cold-start ordering) without capturing Hermes’ assembled prompt or a gateway debug dump.
- Recommended for 29-1: add a **read-only prompt assembly capture** (or enable a Hermes debug mode that prints the final prompt sections + byte sizes) and record the *runtime* ordering and section sizes explicitly.

---

## 6) Baseline token overhead estimate (always-on context sources)

### Components that are definitely always-on (observed)
- `CLAUDE.md`: **374 words**  
  - conservative estimate: **~450–650 tokens** (depends on tokenizer/model).
- Cursor MCP servers (4 configured): `context7`, `firecrawl`, `perplexity`, `apify`
- Claude Code MCP servers (1 configured): `vault-io`
- Hermes MCP servers (2 configured when gateway runs): `cns_vault_io`, `notebooklm`

### Components that are “likely dominant” but not directly measurable from files
- **MCP tool schema injection**: each enabled MCP server contributes tool names + JSON schemas into the model context.
  - conservative planning estimate: **~1k–4k tokens per MCP server**, depending on number/size of tools.
  - with 5–7 “always-on” servers across environments, baseline overhead can plausibly land in the **~8k–20k tokens** range before any user content.

### Why this matters for Epic 29
- Even if text files are small, **tool schema payload** can dwarf everything else and silently erode usable context.

---

## Recommended actions (do not implement in 29-0)

### A) Always-on vs session-enabled split (concrete proposal)
- **Always-on (minimal)**:
  - **Cursor**: keep **none** always-on if feasible; otherwise keep only `context7` as “near-always” (docs protocol).
  - **Claude Code**: keep `vault-io` **session-enabled** by default (enable only when vault ops are needed).
  - **Hermes** (gateway runtime): keep `cns_vault_io` always-on only if Hermes cannot lazy-connect MCPs; otherwise make it lazy/on-demand.
- **Session-enabled (on-demand)**:
  - Cursor: `firecrawl`, `perplexity`, `apify`
  - Hermes: `notebooklm` (only for `/session-close`)

### B) Token measurement (make it real in 29-1)
- Add a **repeatable measurement method** that captures:
  - (1) baseline prompt without any tool calls,
  - (2) baseline prompt after MCP tool lists are injected,
  - (3) delta per MCP server when enabled.
- Suggested approach: runtime capture of the exact assembled messages (or a Hermes gateway debug export) + tokenizer-based counting. Keep it read-only; no behavior changes during measurement.

### B.1) Split plan — how to enact (exact config surfaces + keys)

This section addresses AC: split by naming the exact config surfaces and keys. **No edits were performed in 29-0.**

#### Hermes (gateway)
- **Config surface**: `/home/christ/.hermes/config.yaml`
- **Key**: top-level `mcp_servers:`
  - **Current keys present** (confirmed): `mcp_servers.cns_vault_io`, `mcp_servers.notebooklm`
- **Always-on vs session-enable-only plan**
  - **Always-on (Hermes)**: keep `mcp_servers.cns_vault_io` if Hermes cannot lazy-connect MCPs.
  - **Session-enable-only (Hermes)**: move `mcp_servers.notebooklm` to “connect only for `/session-close`” if Hermes supports on-demand MCP connection.
- **How (later; not in 29-0)**:
  - Edit the Hermes config at `/home/christ/.hermes/config.yaml` under `mcp_servers:`
  - Either remove/comment the `notebooklm` entry (forcing explicit enable elsewhere), or implement a Hermes-supported on-demand connect pattern keyed to the `/session-close` skill execution path (requires Hermes capability confirmation in 29-1).

#### Claude Code (CLI)
- **Config surface**: user-level Claude Code settings at `/home/christ/.claude/settings.json`
- **Key**: top-level `mcpServers`
  - **Current key present** (confirmed): `mcpServers.vault-io`
- **Always-on vs session-enable-only plan**
  - **Session-enable-only (Claude Code)**: set `mcpServers.vault-io` to disabled between sessions (exact mechanism depends on Claude Code’s supported config; 29-0 documents the surface and key only).
- **How (later; not in 29-0)**:
  - Edit `/home/christ/.claude/settings.json` → `mcpServers` entries (toggle/remove) to control default MCP load for Claude Code sessions.

#### Cursor (IDE)
- **Config surface**: user-level Cursor MCP config at `/home/christ/.cursor/mcp.json`
- **Key**: top-level `mcpServers`
  - **Current keys present** (confirmed): `mcpServers.context7`, `mcpServers.firecrawl`, `mcpServers.perplexity`, `mcpServers.apify`
- **Always-on vs session-enable-only plan**
  - **Always-on / near-always**: `context7` (protocol-mandated docs lookup).
  - **Session-enable-only**: `firecrawl`, `perplexity`, `apify`
- **How (later; not in 29-0)**:
  - Edit `/home/christ/.cursor/mcp.json` → `mcpServers` entries to remove/disable “session-enable-only” servers by default and re-enable only when needed (via Cursor MCP settings UI or by restoring the entries).

### C) Hook hygiene guardrail
- Confirm there are **no `UserPromptSubmit` hooks** in any additional Claude Code config surfaces you actually use (e.g. IDE-specific settings directories under `~/.claude/ide/` if present).
- If any prompt-submit hooks are added later, require they be **conditional** (not every prompt) unless they are mission-critical.

### D) Hermes `SOUL.md` hygiene
- `~/.hermes/SOUL.md` is currently present. If Hermes is restarted during 29-1/29-2 work, enforce “delete after restart” and record the check in the story artifact.

---

## Appendix: extracted snippets (high-signal)

### Hermes MCP servers
- `~/.hermes/config.yaml` → `mcp_servers.cns_vault_io` and `mcp_servers.notebooklm`

### Claude Code MCP servers
- `~/.claude/settings.json` → `mcpServers.vault-io`

### Cursor MCP servers
- `~/.cursor/mcp.json` → `mcpServers.context7|firecrawl|perplexity|apify`

