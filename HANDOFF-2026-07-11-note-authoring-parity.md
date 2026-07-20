# HANDOFF 2026-07-11 — Note-authoring parity: extend the Hermes win to Claude Desktop + Cursor

## Objective for the fresh session
Hermes url-ingest now produces **Nexus-grade governed notes**. Claude Desktop and Cursor do **not** yet — they create governed notes via the `cns_vault_io` MCP but lack the rich-authoring + synthesis guidance Hermes got. **Goal: bring Desktop + Cursor to the same behavior.** The shared lever is almost certainly the note-style-guide (they inherit it), not per-tool prompt hacks.

## The core insight (PROVEN this session — do not re-derive)
The Hermes-vs-Nexus quality gap was **NOT the model** (all surfaces run Sonnet 4.6) and **NOT a missing skill**. It was two things:
1. **Template rigidity** — a fixed 5-section capture skeleton caps richness. Fix = relax to freeform Obsidian depth.
2. **Capture-mode prompting** — a bare URL drop = thin capture; a conversational synthesis ask ("size this up to our system, where do we land") = rich synthesis.
Proof note: `03-Resources/loop-engineering-for-quant-trading-rohonchain.md` (CNS gap-analysis table + verdict + 3 callouts + inline links).

## What shipped this session (context — do NOT redo)
- **Vault lint:** Errors 13→0. Vault repo baseline `227b490`; remediation `fc1d26e`; note-style mirror resyncs `2924cc4`, `b9304d5`.
- **88-1** (note-style-guide clarification — DONE): status rule (governed-enriched notes enter `draft`, never auto-`reviewed`; Nexus-shaped sparse notes exempt), no-dangling rule, aggressive-inline before/after example. SSOT `specs/cns-vault-contract/modules/note-style-guide.md`, `@`-imported into `CLAUDE.md`, mirrored to vault `AI-Context/modules/`. Repo commits `3b919b9` + `d5ecbfe`.
- **88-2** (Hermes url-ingest hardening — DONE): edited `scripts/hermes-skill-examples/hermes-url-ingest-vault/references/ingest-prompt-block.md` — (a) enumerate→batch-verify link check (kills fabricated links, cost-bounded), (b) removed rigid 5-section template → rich freeform depth (multi-callouts, embeds, block-IDs, aggressive inline linking). Installed via `scripts/install-hermes-skill-url-ingest-vault.sh` (repo↔live byte-identical). Repo commits `85170c9`, `20485a0`, `dd52eb9`, `abf4ef7`. Branch `hermes-consolidation` (ahead 6, **NOT pushed**).

## Per-surface state
- **Hermes:** DONE. Rich via `ingest-prompt-block.md` + conversational prompting. `sonnet-4.6` via OpenRouter. Loads `~/.hermes/skills/` only — **cannot** see `~/.claude/skills/`.
- **Claude Desktop:** `vault-io` MCP → canonical + gated (`%APPDATA%\Claude\claude_desktop_config.json`). Loads `CLAUDE.md` `@`-import (incl. note-style-guide) when in the Omnipotent.md project. The global `obsidian-markdown` skill exists but **does NOT auto-fire** on a governed create (88-2 fire-check). Result today: enriched frontmatter, thin body unless guided.
- **Cursor:** `cns_vault_io` in `~/.cursor/mcp.json` → canonical. Has `.cursor/rules/note-style-guide.mdc` (linking/structure conventions only; status rule lives in the full module). Primary model `sonnet-4.6`. CONFIRM how it actually picks up the guide at create time.

## Recommended direction (design with breathing room)
The shared lever for Desktop + Cursor is the **note-style-guide** (Desktop inherits via `@`-import; Cursor via `.cursor` rule). Likely a combination:
- **(A) Extend note-style-guide** with the rich-authoring + synthesis conventions we proved in Hermes's prompt block: author richly (freeform depth, not a thin outline), multi-callouts/embeds/block-IDs, aggressive inline first-mention linking, enumerate→batch-verify (no fabrication). Then Desktop/Cursor inherit it. **Caveat:** 88-1 owns the guide — deliberate specs-first SSOT edit + vault byte-sync (do **NOT** `npm run sync-vault-modules`; it is vault→specs and clobbers a specs edit). Two-commit pattern (repo SSOT + vault mirror), matching `2924cc4`/`b9304d5`; `verify.sh` `vault-modules-parity` gate.
- **(B) Resolve 88-3** — force-load/configure `obsidian-markdown` so Claude Code + Desktop fire the rich skill on governed create (fire-check found it does NOT auto-fire).
- **(C) Operator habit** — prompt Desktop/Cursor for *synthesis* ("size this up to our system"), same as Hermes/Nexus.

## Backlog (sprint-status)
- **88-3-confirm-obsidian-markdown-fires-governed-create** (backlog): confirm/force skill firing across Claude Code + Desktop; tighten inline-link density to full Nexus level.

## Standing constraints (carry these — from memory)
- **Cursor = builder, Claude Code = verifier.** Hand build work to Cursor as **paste-ready prompts** (lead with repo/branch/dir). **Do NOT `spawn_task` chips** — they launch Claude Code *worktree* agents (wrong tool) + land in stale worktrees (bit us this session).
- Verify committed diffs empirically (byte-identity, scope, `verify.sh`), don't trust summaries.
- Git/push in WSL as `christaylordevry`; commits stay local unless operator says push.
- WSL exec from Windows: write a `.sh` to `\\wsl…\home\christ`, run via `tr -d '\r' | bash` (inline quotes to `wsl.exe` mangle under zsh).
