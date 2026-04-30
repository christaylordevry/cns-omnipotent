# Module: Vault IO

> **Path note:** Links to `../../../specs/` point at the CNS implementation repository (three levels up from this `modules/` folder when the vault is `…/Omnipotent.md/Knowledge-Vault-ACTIVE/`).

Load this file when you plan or execute vault reads, writes, search, or moves beyond quick browsing. It extends `AGENTS.md` Sections 2 (routing) and 3 (formatting). If anything here conflicts with `AGENTS.md`, the constitution wins.

## Reading Notes

1. **Prefer frontmatter-only reads** when you need metadata (type, status, tags, confidence) without full body content. This saves tokens.
2. **Full reads** when you need the actual content of a note.
3. **Search before creating.** Always check if a similar note exists before making a new one.
4. **Respect scope.** If working on a specific project, search within `01-Projects/<project>/` first, then broaden.

## Writing Notes

1. **Always generate a pake_id** (UUID v4) for new notes.
2. **Always set timestamps.** `created` on new notes. `modified` on any update.
3. **Always validate frontmatter** against the schema for the chosen pake_type before writing (outside `00-Inbox/`).
4. **Always log the action.** Through Vault IO MCP, successful mutations append one line to `_meta/logs/agent-log.md` with: ISO8601 UTC timestamp, action, tool, surface, target path, and a truncated **`payload_summary`** (six pipe-separated fields; never a full note body). Use **`vault_log_action`** only for extra operator-significant lines; do not duplicate mutator audit lines.
5. **Always append to the daily note.** When performing significant operations, add a brief entry under the `## Agent Log` section of today's daily note.
6. **Route correctly.** Use the routing table in `AGENTS.md` Section 2 to place notes in the right directory.
   - `WorkflowNote` disambiguation: "project context" means the request includes an explicit target project identifier. Do not infer project context.
   - If the request includes project context, route to `01-Projects/<project-name>/`.
   - If project context is missing, route to `02-Areas/<area-name>/` when the area is known.
   - If project context is missing and the area is ambiguous, route to the `02-Areas/` root as a temporary holding location that requires triage.
   - If you are uncertain which project should own the WorkflowNote, require operator or manifest disambiguation before routing beyond `02-Areas/`.

## Moving and Renaming

- Use Obsidian CLI (`obsidian move`) when Obsidian is running. This preserves backlinks automatically.
- If Obsidian is not running, use filesystem operations and manually update any wikilinks that reference the old path.
- Update the `modified` timestamp after any move.

## What You Must Never Do

- Write files outside the vault boundary (`Knowledge-Vault-ACTIVE/`).
- Store API keys, tokens, passwords, or credentials anywhere in the vault.
- Delete notes without explicit human approval.
- Perform bulk operations (rename, restructure, mass-update) without presenting a plan first.
- Modify `AI-Context/AGENTS.md` without explicit human approval.
- Overwrite an existing note without reading it first.

## Operator runbook (MCP env, rotation, smoke)

If you are wiring MCP servers, rotating keys, or running live tool-call smoke, load:

- `AI-Context/modules/mcp-operator-runbook.md`

## Mediated access (Vault IO MCP)

When the Vault IO MCP server is configured for your session, prefer its tools for scoped search, reads, governed writes, moves, and explicit audit lines instead of ad hoc raw filesystem edits. **Phase 1 tool names:** `vault_read`, `vault_read_frontmatter`, `vault_list`, `vault_search`, `vault_create_note`, `vault_update_frontmatter`, `vault_append_daily`, `vault_move`, `vault_log_action`. Normative parameters and behaviour: `../../../specs/cns-vault-contract/CNS-Phase-1-Spec.md`. If MCP is not available, follow the sections above using normal vault-relative paths and human-approved tools.
