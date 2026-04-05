# `_meta/bases/`: Obsidian Bases panels

## Purpose

This directory holds Obsidian Bases (`.base`) files that provide read-only visibility panels for inbox triage, project health, and research coverage. They read PAKE frontmatter and file metadata already stored in the vault.

## Requirements

- Obsidian with the core **Bases** feature (table views ship with Obsidian 1.9+ per Obsidian Help).
- These panels are **not** Vault IO: Obsidian reads the vault on disk directly. Opening a panel does **not** call MCP, WriteGate, or `vault_log_action`.

## Panels

| File | What it shows |
|------|----------------|
| `inbox-triage.base` | All files under `00-Inbox/`, columns `title`, `pake_type`, `status`, `created`, sorted by `created` descending (see YAML; UI sort may be used if needed). |
| `project-status.base` | All files under `01-Projects/`, columns `title`, `status`, `Modified` (`file.mtime`), grouped by `file.folder`. `_README.md` manifests appear like any other file and remain identifiable by `title` (or by `file.name`). |
| `research-tracker.base` | Files under `03-Resources/` whose `pake_type` is `InsightNote` or `SourceNote`, columns `title`, `pake_type`, `source_uri`, `tags`. |

## Read-only policy (Epic D Phase 1)

Panels are for **visibility and triage**, not as the primary mutation path.

- Bases can edit frontmatter inline. Those edits hit the filesystem **outside** Vault IO, so they **bypass** WriteGate, PAKE validation, and the append-only mutation audit trail. For Epic D Phase 1 we **do not** treat inline Bases editing as supported: prefer the note editor or vault-io tools when changes must be gated and audited.
- **Deferred:** A future story would need a deliberate design (for example vault-io-backed writes or read-only column flags in Bases) before inline editing is endorsed here.

## Adding a new panel (future story)

1. Add a new `*.base` file under `_meta/bases/` (or another contract-approved location).
2. Define global `filters`, optional `properties` (display names), and `views` (for example `type: table`, `order`, optional `groupBy` or sort as supported by your Obsidian build).
3. Update this README with the new panel name, scope, and any policy (read-only vs editable).
4. If the path remains agent-protected, capture the full file content in the story completion record for operator apply (same pattern as Story 11.1).

## Agent access

Do not use `vault_create_note` or other vault-io mutations for `_meta/bases/` paths from agents; they are WriteGate-protected. Operators add and edit files here manually.

## Story 11.1 apply reminder

Copy the four files from the implementation artifact `11-1-obsidian-bases-panels.md` (Dev Agent Record) into the vault paths listed there. Paths are relative to the vault root: `_meta/bases/inbox-triage.base`, `_meta/bases/project-status.base`, `_meta/bases/research-tracker.base`, `_meta/bases/_README.md`.
