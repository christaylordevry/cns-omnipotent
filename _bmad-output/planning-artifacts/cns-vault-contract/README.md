# CNS Vault Contract Specification

This directory contains the authoritative specification for CNS Phase 1: Foundation Layer.

## Files

| File | Purpose |
|------|---------|
| `CNS-Phase-1-Spec.md` | Complete Phase 1 specification: folder contract, AGENTS.md design, Vault IO MCP tool definitions, acceptance criteria |
| `AGENTS.md` | Draft of the vault constitution that will be deployed to `Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md` |

## Relationship to BMAD

These specs are the **input** for BMAD planning. The PRD should be generated from `CNS-Phase-1-Spec.md` and scoped to Phase 1 deliverables only.

## Phase 1 Deliverables

1. **Vault Folder Contract** — directory structure with agent-readable `_README.md` manifests
2. **AGENTS.md Constitution** — universal context file, under 500 lines, loaded by all tools
3. **Vault IO Layer** — MCP server exposing eight tools: vault_search, vault_read, vault_read_frontmatter, vault_create_note, vault_append_daily, vault_update_frontmatter, vault_list, vault_move, vault_log_action