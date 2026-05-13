# Claude Code shim (Obsidian vault root)

Deploy: copy this file to `Knowledge-Vault-ACTIVE/CLAUDE.md` at the **vault root** (not the CNS implementation repository root).

Per `CNS-Phase-1-Spec.md` Deliverable 2, Claude Code loads the constitution via a file reference to `AI-Context/AGENTS.md`. Use the following line so sessions pull the live constitution without pasting it into chat:

@AI-Context/AGENTS.md

If your Claude Code build uses a different attachment or include syntax for project files, substitute it while keeping the vault-relative path `AI-Context/AGENTS.md`.

## Vault IO MCP tool count (implementation repo)

The CNS Vault IO MCP server currently exposes **9** tools: `vault_read`, `vault_read_frontmatter`, `vault_list`, `vault_search`, `vault_create_note`, `vault_update_frontmatter`, `vault_append_daily`, `vault_move`, and `vault_log_action`. Story **29-8** adds **`vault_request_disambiguation`**, which will bring the set to **10**; refresh this paragraph after that story ships.

Normative parameters and behaviour: `../../specs/cns-vault-contract/CNS-Phase-1-Spec.md` (path relative from `AI-Context/` when the vault lives next to the Omnipotent.md clone per the constitution header; adjust if your directory layout differs).

## Epic 29 (Phase 6, knowledge quality and agent memory)

Epic 29 is the active Phase 6 track: bounded cold-start files (**USER.md**, **MEMORY.md**), vault lint rules and Hermes **`/vault-lint`**, dedup guard on governed ingest, then MCP disambiguation (**29-8**), fast-scan index plus session-close integration (**29-9**), and Hermes thinking commands (**29-10**). Authoritative backlog wording lives in **Section 8** of `AI-Context/AGENTS.md`; prefer that section over this blurb when they disagree.

## Vault lint module (normative)

Four-rule **`/vault-lint`** contract: repo path **`specs/cns-vault-contract/modules/vault-lint.md`**. From this file’s location in the spec tree: [`../modules/vault-lint.md`](../modules/vault-lint.md).
