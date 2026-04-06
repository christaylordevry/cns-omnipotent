---
pake_id: 70dab0da-cb64-4957-bb07-631c524fa80b
pake_type: SourceNote
title: "CNS Operator Guide"
created: 2026-04-05
modified: 2026-04-05
status: stable
confidence_score: 1.0
verification_status: verified
creation_method: ai
tags:
  - cns
  - operator-guide
  - reference
  - living-document
---

# CNS Operator Guide

## 1. Overview

The Central Nervous System (CNS) is a unified control plane that orchestrates all AI agents, LLMs, CLIs, and IDEs from a single Obsidian vault. It has two layers:

| Layer | System | Responsibility |
|-------|--------|----------------|
| Control | CNS | Agent routing, context loading, security gates, input surfaces, orchestration |
| Knowledge | PAKE | Note schemas, frontmatter standards, confidence scoring, ingestion, retrieval |

CNS controls behavior. PAKE controls knowledge operations. Agents follow CNS rules for routing and security, PAKE schemas for note creation and validation.

Three access paths exist for interacting with the vault:

| Path | Governance | Use case |
|------|-----------|----------|
| **Vault IO MCP** | Full: WriteGate, PAKE validation, secret scan, audit log | IDE sessions (Cursor, Claude Code) |
| **Nexus (Discord bridge)** | Trusted bypass: no WriteGate, no PAKE validation, no audit | Mobile/Discord capture via Claude Code in tmux |
| **Bases panels** | Read-only: no MCP, no WriteGate, no audit | Obsidian visibility (inbox triage, project status, research tracker) |

> [!note] This document is agent-maintained. It updates automatically at the end of stories that change user-facing behavior.

---

## 2. Starting a Session

### Grounding flow

| Surface | Shim file | What loads |
|---------|-----------|------------|
| Claude Code | `CLAUDE.md` at vault root | References `AI-Context/AGENTS.md` via `@` include |
| Cursor | `.cursorrules` or `.cursor/rules/agents.mdc` | References `AI-Context/AGENTS.md` |

On both surfaces, opening the workspace at the vault root causes the shim to load `AGENTS.md` (the constitution). The constitution contains the vault map, routing rules, formatting standards, security boundaries, active modules, and current focus.

### What auto-loads vs. what does not

| Loads automatically | Requires explicit load |
|--------------------|-----------------------|
| `AGENTS.md` (constitution) | `AI-Context/modules/vault-io.md` |
| Current focus (Section 8 of AGENTS.md) | `AI-Context/modules/security.md` |
| Routing rules, formatting standards | `AI-Context/modules/notebooklm-workflow.md` |

Modules load on demand when the task falls within a module's domain. The constitution is the map; modules are the territory.

> [!tip] Time-to-grounded target: under 30 seconds on a fresh session.

---

## 3. Vault IO Tools

| Tool | What it does | Key constraints |
|------|-------------|-----------------|
| `vault_read` | Read full note by vault-relative path | Returns `VAULT_BOUNDARY` if path resolves outside vault; `NOT_FOUND` for missing files |
| `vault_read_frontmatter` | Read parsed YAML frontmatter only (single or batch) | Token-efficient; same boundary check as `vault_read` |
| `vault_list` | List directory contents with metadata summaries | Supports `filter_by_type` and `filter_by_status`; does not return full bodies |
| `vault_search` | Full-text search with directory scope | Max 50 results per call; requires explicit scope if `CNS_VAULT_DEFAULT_SEARCH_SCOPE` unset; excludes `_meta/logs/` unless explicitly scoped |
| `vault_create_note` | Create a new note with PAKE-compliant frontmatter | Auto-generates `pake_id`, timestamps; routes by `pake_type`; validates PAKE outside Inbox; atomic write (temp + rename) |
| `vault_update_frontmatter` | Merge updates into existing frontmatter | Preserves unspecified fields; re-validates after merge; auto-bumps `modified` |
| `vault_append_daily` | Append content to today's daily note | Creates `DailyNotes/YYYY-MM-DD.md` if missing; targets optional section header |
| `vault_move` | Move or rename a note, preserving backlinks | Prefers Obsidian CLI (`CNS_OBSIDIAN_CLI`) when available; falls back to filesystem move + wikilink rewrite |
| `vault_log_action` | Write an entry to the agent action log | For operator-significant events; mutating tools already log on success |

> [!warning] `vault_create_note` outside `00-Inbox` requires valid PAKE frontmatter or the write fails with `SCHEMA_INVALID`.

---

## 4. Bases Panels

| Panel | File | What it shows | Sort/group |
|-------|------|--------------|------------|
| Inbox Triage | `_meta/bases/inbox-triage.base` | All files under `00-Inbox/`: title, pake_type, status, created | Sort by `created` descending |
| Project Status | `_meta/bases/project-status.base` | All files under `01-Projects/`: title, status, modified (file.mtime) | Grouped by `file.folder` ascending |
| Research Tracker | `_meta/bases/research-tracker.base` | InsightNote and SourceNote files under `03-Resources/`: title, pake_type, source_uri, tags | No default sort; filtered by pake_type |

> [!note] Panels are read-only by policy (Epic D Phase 1). Inline Bases editing bypasses WriteGate and audit.

See [[_meta/bases/_README.md]] for panel YAML syntax, read-only policy rationale, and instructions for adding new panels.

---

## 5. Nexus (Discord Bridge)

Nexus is the Discord + Claude Code in tmux stack. It operates as a **trusted** write surface **outside** the Vault IO MCP path.

**What Nexus bypasses:**

- WriteGate (boundary, protected paths, PAKE validation)
- Secret scanning (MCP-layer only)
- Audit log (`_meta/logs/agent-log.md` append)

**What Nexus keeps:**

- `AGENTS.md` behavioral rules (launcher uses vault as cwd, `CLAUDE.md` points to constitution)
- Formatting standards (no em dashes, wikilinks, YAML frontmatter)
- Vault directory structure awareness

> [!warning] Nexus-created notes may lack PAKE frontmatter. Treat as `00-Inbox` captures until triaged.

**Operator references:**

- [[Nexus-Discord-Obsidian-Bridge-Operator-Guide]] for daily operation, troubleshooting, and recovery
- [[Nexus-Discord-Obsidian-Bridge-Full-Guide]] for full setup, secrets, and verification playbook

---

## 6. NotebookLM Workflow

The NotebookLM integration follows a six-step pipeline:

1. **Query:** Read [[NotebookLM-Project-Map]] to identify the target notebook, then use `notebook_query` or `cross_notebook_query` via the NotebookLM MCP.
2. **Parse citations:** Extract citations from the JSON response (each has a title and optional URL).
3. **Create InsightNote:** Use `vault_create_note` with `pake_type: InsightNote` in `03-Resources/<project-name>/`. Convert citation titles to `[[Source-Title]]` wikilinks where vault notes exist.
4. **Add sources:** Use `source_add` (types: url, text, drive, file) to feed new material into NotebookLM notebooks. Never use the browser for this.
5. **Perplexity fallback:** When `research_start` misses key sources, use Perplexity Deep Research to collect citation links, then feed them to NotebookLM via `source_add(source_type="url", url=...)`.
6. **Cross-notebook:** Use `cross_notebook_query` for research that spans multiple projects. Route resulting InsightNotes to the correct project folder based on citation source.

**Export script:** `scripts/export-vault-for-notebooklm.sh` compiles `03-Resources/` and `01-Projects/` markdown into a single file at `scripts/output/vault-export-for-notebooklm.md`. Excludes `_meta/`, `AI-Context/`, `00-Inbox/`, `04-Archives/`, `DailyNotes/`, and `_README` files.

See [[NotebookLM-Project-Map]] for notebook-to-project mappings.

> [!tip] Run the export script before adding vault content as a source. Check file size against NotebookLM limits.

---

## 7. PAKE Frontmatter and Routing

### Note types and default locations

| pake_type | Default location | PAKE required? |
|-----------|-----------------|----------------|
| SourceNote | `03-Resources/` | Yes |
| InsightNote | `03-Resources/` | Yes |
| SynthesisNote | `03-Resources/` | Yes |
| WorkflowNote | `01-Projects/` (with project context) or `02-Areas/` (fallback) | Yes |
| ValidationNote | `03-Resources/` | Yes |
| (Inbox capture) | `00-Inbox/` | No |

### Required fields for governed writes

All notes outside `00-Inbox/` must include:

| Field | Type | Values |
|-------|------|--------|
| `pake_id` | UUID v4 | Auto-generated |
| `pake_type` | enum | SourceNote, InsightNote, SynthesisNote, WorkflowNote, ValidationNote |
| `title` | string | Human-readable title |
| `created` | date | YYYY-MM-DD |
| `modified` | date | YYYY-MM-DD |
| `status` | enum | draft, in-progress, reviewed, archived |
| `confidence_score` | float | 0.0 to 1.0 |
| `verification_status` | enum | pending, verified, disputed |
| `creation_method` | enum | human, ai, hybrid |
| `tags` | list | Relevant tags |

Optional fields: `source_uri`, `cross_references`, `ai_summary`.

---

## 8. WriteGate and Protected Paths

### What agents can never write to

| Protected path | Reason |
|---------------|--------|
| `AI-Context/**` | Constitution and modules; operator-only |
| `_meta/schemas/**` | PAKE frontmatter definitions; operator-only |
| `_meta/logs/**` | Audit trail; append-only via audit logger, no direct writes |
| `_meta/` (structural mutations) | Infrastructure directory; no new subdirectories or files via MCP |

### What agents can write to

| Path | Via | Notes |
|------|-----|-------|
| `03-Resources/` | `vault_create_note` | SourceNote, InsightNote, SynthesisNote, ValidationNote |
| `01-Projects/` | `vault_create_note` | WorkflowNote with project context |
| `02-Areas/` | `vault_create_note` | WorkflowNote fallback when project context is missing |
| `00-Inbox/` | `vault_create_note` | No PAKE required |
| `DailyNotes/` | `vault_append_daily` | Creates if missing; appends under section header |
| `scripts/` | Direct filesystem | Implementation repo, not vault-governed |

### Error codes

| Code | Meaning |
|------|---------|
| `VAULT_BOUNDARY` | Path resolves outside the configured vault root |
| `PROTECTED_PATH` | Path is in a human-only or structurally protected directory |
| `SCHEMA_INVALID` | PAKE frontmatter fails validation (outside Inbox) |
| `SECRET_PATTERN` | Content matches a credential pattern (key, token, password) |
| `NOT_FOUND` | Target file or directory does not exist (including dangling symlinks) |
| `IO_ERROR` | Unexpected filesystem error |
| `UNSUPPORTED` | Operation not available in Phase 1 (bulk, delete, etc.) |

> [!warning] If you see `PROTECTED_PATH`, the content must be operator-applied manually. Do not retry with a different path.

---

## 9. Audit Trail

### Log location

`_meta/logs/agent-log.md` (append-only, one line per successful governed mutation).

### Line format

```
[ISO8601 UTC] | action | tool | surface | target_path | payload_summary
```

- `action`: short verb (create, update_frontmatter, append_daily, move, or custom)
- `tool`: MCP tool name (vault_create_note, vault_move, vault_log_action, etc.)
- `surface`: caller context (mcp, unknown)
- `target_path`: vault-relative path with `/` separators
- `payload_summary`: truncated metadata only (max 120 chars, never full note body)

### What is NOT logged

| Activity | Why not logged |
|----------|---------------|
| Nexus filesystem writes | Nexus bypasses MCP; no WriteGate or audit pipeline |
| Bases panel reads | Obsidian reads disk directly; no MCP involved |
| `vault_read`, `vault_list`, `vault_search` | Read-only operations do not mutate |

### How to archive

Agents cannot rewrite or truncate the log. Archive and trim are **human-only** operations:

1. Copy `agent-log.md` to a dated archive (e.g., `_meta/logs/archive/agent-log-2026-Q1.md`).
2. Truncate or rotate the live file after backup.
3. New mutations continue appending as before.

See [[AUDIT-PLAYBOOK]] for the full investigation workflow, correlation walkthrough, and WSL command cookbook.

> [!note] Audit log is append-only. Agents cannot rewrite history. Human archive is documented in the playbook.

---

## 10. verify.sh

### When to run

Run `bash scripts/verify.sh` before claiming any story done. It is the completion gate for every story in the project.

### What it checks

| Check | Details |
|-------|---------|
| Lint | ESLint across `src/` |
| Typecheck | TypeScript compiler (`tsc --noEmit`) |
| Tests | Vitest: 171 tests covering boundary, secrets, audit, PAKE, search, WriteGate |
| Constitution mirror parity | Node script verifying specs mirror matches vault copy |

> [!tip] Run from the repo root: `bash scripts/verify.sh`. Exit 0 = safe to commit.

---

## 11. Common Workflows

### a. Capture to governed note

1. Drop raw content into `00-Inbox/` (via Nexus, manual, or `vault_create_note` without PAKE).
2. Open the **Inbox Triage** panel (`_meta/bases/inbox-triage.base`) to review captures.
3. Determine the correct `pake_type` and destination folder.
4. Create the governed note via `vault_create_note` with full PAKE frontmatter in the target directory.
5. Confirm the audit log entry in `_meta/logs/agent-log.md`.
6. Delete or archive the original inbox capture.

### b. Research cycle

1. Query a NotebookLM notebook using `notebook_query` (read [[NotebookLM-Project-Map]] first).
2. Parse citations from the JSON response.
3. Create an InsightNote in `03-Resources/<project-name>/` via `vault_create_note` with wikilink citations.
4. Verify the note appears in the **Research Tracker** panel (`_meta/bases/research-tracker.base`).
5. Optionally run `scripts/export-vault-for-notebooklm.sh` and add the export as a NotebookLM source.

### c. Daily agent log

1. Use `vault_append_daily` targeting section `## Agent Log`.
2. The tool creates `DailyNotes/YYYY-MM-DD.md` if it does not exist, using the daily note template.
3. Content appends under the `## Agent Log` header.
4. The append is audited in `_meta/logs/agent-log.md`.

---

## 12. Maintenance and Updates

This guide is updated by dev agents at the end of stories that change user-facing behavior via `vault_create_note` (full overwrite) or `vault_update_frontmatter`.

To manually update: edit this file and run `bash scripts/verify.sh`.

### Version History

| Date | Version | What changed | Story |
|------|---------|-------------|-------|
| 2026-04-05 | 1.0.0 | Initial operator guide covering all Phase 1 and Phase 2 deliverables | N/A (standalone) |
