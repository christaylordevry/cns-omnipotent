---
title: "NotebookLM Workflow (CNS)"
date: 2026-04-06
tags:
  - notebooklm
  - workflow
  - vault-io
status: active
source: Cursor
---

# NotebookLM Workflow

## Required first read

Before any NotebookLM step, read `03-Resources/notebooklm-project-map.md`
(or `vault_read` on that path). Resolve **project name → notebook title** and
**primary use** (research queries, source collection, vault export). If the
project is unmapped, stop and ask the operator or create a notebook and update
the map.

---

## Active Notebook Registry

As of 2026-04-06 the following notebooks are live and configured:

| Notebook                                              | ID                                   | Project                   | Primary Use                                               |
| ----------------------------------------------------- | ------------------------------------ | ------------------------- | --------------------------------------------------------- |
| The Architectural Blueprint for AI Factory Deployment | (existing)                           | AI-Native-Infrastructure  | Research queries, source collection                       |
| CNS Vault Architecture                                | 981466f0-de1c-4551-93a9-f3bc2a24b184 | Brain-CNS-Build           | Research queries against AGENTS.md and planning artifacts |
| LinkedIn Strategy 2026                                | 73350365-2873-4a85-8448-5551a0dbafb1 | LinkedIn-Profile-Builder  | Content review, positioning checks, post drafts           |
| The Directory Monetization Playbook                   | (existing)                           | Lead-Gen-Directory-Sydney | Research queries (parked — not active)                    |
| Nexus Discord Bridge                                  | f037c741-f7e1-4a90-880f-d2d38986767b | PROJECT-NEXUS             | Architecture queries, operational diagnostics             |

When new notebooks are created, update this table AND
`03-Resources/notebooklm-project-map.md` in the same operation.

---

## Notebook Chat Configuration

Each notebook has a configured system instruction. Do not overwrite these
without operator approval. Summaries:

**CNS Vault Architecture** — Technical architect advisor. Answers grounded in
AGENTS.md, tool signatures, PAKE standards, and planning artifacts. Cites
specific sections. Flags conflicts between documents.

**LinkedIn Strategy 2026** — LinkedIn growth strategist grounded in
Christopher Taylor's actual documents. Knows positioning (Fractional CMO &
Growth Operator), target audience (founders with ops problems, marketing
directors wanting AI integration), and the 30-day content calendar. Reviews
copy for algorithm compatibility and positioning consistency.

**Nexus Discord Bridge** — Operational guide for PROJECT NEXUS. Answers
grounded in architecture docs and operator guides. Distinguishes built/live
from planned/deferred. Diagnoses failures from documented architecture.

---

## Tooling Surface (`notebooklm-mcp-cli`, 39 tools)

The NotebookLM MCP is the `notebooklm-mcp-cli` package (`uvx --from notebooklm-mcp-cli notebooklm-mcp`), registered and synchronized across all four surfaces (Claude Code, Cursor, Claude Desktop, Hermes) over one shared auth. Beyond the core query/source tools, the full surface is available:

- **Query:** `notebook_query`, `cross_notebook_query`, `notebook_query_start` / `notebook_query_status` (async)
- **Source management:** `source_add`, `source_list_drive`, `source_get_content`, `source_delete`, `source_rename`, `source_sync_drive`
- **Notebook lifecycle:** `notebook_create`, `notebook_delete`, `notebook_list`, `notebook_get`, `notebook_rename`, `notebook_describe`, `notebook_share_public` / `notebook_share_invite`
- **Studio artifacts:** `studio_create` (audio | video | slide_deck | infographic | report | flashcards | quiz | data_table | mind_map), `studio_status` (poll to completion), `studio_revise`, `download_artifact`
- **Research automation:** `research_start` / `research_status` / `research_import` (web + Drive discovery before `source_add`)
- **Batch / ops:** `batch`, `pipeline`, `tag`, `note`, `label`, `refresh_auth`, `server_info`

Auth is a shared browser cookie (`~/.notebooklm-mcp-cli/auth.json`) that expires roughly every 2 to 4 weeks; one `nlm login` refreshes every surface at once. If a call returns an auth error, run `nlm login`, or check `server_info` (`auth_status`: configured | stale | not_configured).

---

## Workflow Entry Points

### Entry Point A — Discord / Nexus capture

```
Discord message → Nexus bot → 00-Inbox/ raw note
  → Triage in Cursor: vault_read the note
  → Check project map: does a relevant notebook exist?
    → YES: notebook_query → parse response → vault_create_note(InsightNote)
    → NO: research_start (web) → import sources → new notebook → query → InsightNote
```

### Entry Point B — Obsidian Inbox brainstorm

```
Free-write in 00-Inbox/ (no PAKE required)
  → In Cursor: vault_read the seed note
  → notebook_query against relevant notebook
    → NotebookLM finds connections across existing sources
  → vault_create_note(pake_type: InsightNote) in 03-Resources/<project>/
  → Archive inbox seed
```

### Entry Point C — IDE-initiated research

```
Working in Cursor on a project → need external context
  → Check project map → identify notebook
  → notebook_query with specific question
  → Parse JSON response, extract answer + citations
  → vault_create_note(InsightNote) with wikilinked citations
  → Continue implementation with grounded context
```

### Entry Point D — Cross-notebook synthesis

```
Research Tracker base panel shows cluster of related InsightNotes
  → cross_notebook_query across 2+ relevant notebooks
  → Synthesise into vault_create_note(pake_type: SynthesisNote)
  → SynthesisNote may surface new project → bmad-product-brief
```

### Entry Point E — Studio artifact generation

```
Notebook with good sources → want a consumable artifact (podcast / deck / infographic)
  → studio_create(notebook_id, artifact_type=audio|slide_deck|infographic|…, confirm=true)
  → poll studio_status(notebook_id) until the artifact status is completed with a URL
  → download_artifact(notebook_id, artifact_type, output_path) to save locally
  → optionally land a pointer or InsightNote in the vault
```

Audio deep-dives take several minutes; `studio_create` returns immediately and generation is async, so poll `studio_status` rather than blocking.

---

## 1. Querying a Notebook

1. Load the project map. Pick the notebook title and ID for this task.
2. Use the NotebookLM MCP:
   - **`notebook_query`:** one notebook, one question. Pass notebook ID exactly
     as in the registry above.
   - **`cross_notebook_query`:** one question spanning several notebooks. Use
     when comparing projects or themes across notebooks.
3. Treat the tool response as **JSON**. Parse with a real JSON parser — do not
   guess structure. Extract the model answer text and any citations list.
4. Keep a short note of the raw keys on first success so the pattern is
   repeatable.

---

## 2. Landing Cited Answers as InsightNotes

1. Choose folder: project-scoped research goes under `03-Resources/<project-name>/`.
2. Build PAKE frontmatter:
   - `pake_type: InsightNote`
   - `source_uri` pointing at the notebook,
     e.g. `notebooklm://CNS Vault Architecture`
3. Body structure:
   - **Question** you asked.
   - **Answer** summarised from the parsed JSON (no invented sources).
   - **Citations:** convert each citation title to `[[Matching Vault Note Title]]`
     when a vault note exists. If no match, keep the citation label in backticks.
4. Create the file with **`vault_create_note`** (governed write, PAKE
   validation, audit line). Do not paste full tool payloads into the vault.

---

## 3. Adding Sources Without a Browser

Use **`source_add`** on the target notebook. For vault-wide exports, use the live file-upload shape: `notebook_id` when available, `source_name: "My Knowledge Base"`, `source_type: "file"`, and an absolute `file_path` to the export file.

For vault-wide exports:

```bash
bash scripts/export-vault-for-notebooklm.sh
# Output: scripts/output/vault-export-for-notebooklm.md
```

Upload as source named "My Knowledge Base" to enable cross-reference queries.

For single vault files: `vault_read` the file, pass content directly to `source_add`.

For repo files not in the vault: read directly from the filesystem path
(e.g. `/home/christ/ai-factory/projects/Omnipotent.md/`) and pass content
to `source_add`.

---

## 4. The Feedback Loop

```
Vault accumulates InsightNotes in 03-Resources/
  → export-vault-for-notebooklm.sh compiles them
  → source_add to relevant notebooks
  → Notebooks get smarter about your thinking
  → Next query surfaces connections previous queries missed
  → New InsightNotes flow back into vault
  → Recursive intelligence amplification
```

Run a vault export and source refresh at the start of each new project phase.

---

## Related Paths

- Project map: `03-Resources/notebooklm-project-map.md`
- Workflow map: `03-Resources/CNS-Workflow-Map.md`
- Constitution: `AI-Context/AGENTS.md`
- Governed writes: `AI-Context/modules/vault-io.md`
  and `AI-Context/modules/security.md`
