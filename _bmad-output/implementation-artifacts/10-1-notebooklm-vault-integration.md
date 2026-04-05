# Story 10.1: NotebookLM vault integration (Epic C — Phase 2.0)

Status: in-progress

<!-- Sprint tracker: epic-10 / 10-1-notebooklm-vault-integration. Phase 2 Epic C: NotebookLM ingestion pipeline. Workflow, documentation, and scripting only. No vault-io code changes. -->

## Story

As an **operator and agent**,
I want **a documented, repeatable workflow for querying NotebookLM notebooks from the terminal, converting cited answers into PAKE-compliant InsightNotes with wikilinks, and exporting vault content back to NotebookLM as sources**,
so that **NotebookLM becomes a seamless bidirectional research layer on top of the vault without requiring a browser for any step**.

## Acceptance Criteria

1. **Notebook-to-project mapping note**
   **Given** the vault has active projects (AI-Native-Infrastructure, Brain-CNS-Build, CNS-Phase-1, LinkedIn-Profile-Builder, Lead-Gen-Directory-Sydney, PROJECT-NEXUS) with some mapped to existing NotebookLM notebooks
   **When** an agent or operator creates `03-Resources/NotebookLM-Project-Map.md` via `vault_create_note`
   **Then** the note is a `SourceNote` with full PAKE frontmatter (`pake_id`, `pake_type: SourceNote`, `title`, `created`, `modified`, `status: in-progress`, `confidence_score`, `verification_status`, `creation_method: hybrid`, `tags`)
   **And** the body contains a table mapping: project name, NotebookLM notebook name, primary use (research queries / source collection / vault export)
   **And** agents can read this mapping before any NotebookLM operation to know which notebook to target
   **And** the file passes PAKE validation and the audit log records the create.

2. **Workflow module documentation**
   **Given** `AI-Context/modules/` is WriteGate-protected (`PROTECTED_PATH` in `src/write-gate.ts`)
   **When** an agent drafts `AI-Context/modules/notebooklm-workflow.md` content
   **Then** the **operator manually copies** the drafted content into the vault at `Knowledge-Vault-ACTIVE/AI-Context/modules/notebooklm-workflow.md`
   **And** the module documents all six workflow areas: (a) how agents query NotebookLM (read project map, identify notebook, use `notebook_query` or `cross_notebook_query`, parse citations from JSON), (b) how cited answers land as InsightNotes in `03-Resources/<project-name>/` via `vault_create_note` with `pake_type: InsightNote` and citations converted to `[[Source-Title]]` wikilinks, (c) how to add sources via `source_add` (YouTube URLs, PDF paths, web URLs; never use browser), (d) the Perplexity fallback (use Perplexity Deep Research to collect citation links when `research_start` misses key sources, then feed them via `source_add`), (e) audio overview generation (`download_artifact` with type audio, output to `03-Resources/<project-name>/audio/`, synced via Obsidian Sync; nice-to-have), (f) cross-notebook queries with `cross_notebook_query` for multi-project research
   **And** the module includes a pointer to `03-Resources/NotebookLM-Project-Map.md` as the required first read
   **And** `AGENTS.md` Section 7 (Active Modules) gains a new row for this module after the operator applies it
   **And** the story completion record documents the exact file the operator needs to copy.

3. **Vault export script**
   **Given** `scripts/` is agent-writable and not under WriteGate protection
   **When** `scripts/export-vault-for-notebooklm.sh` is created
   **Then** the script compiles all markdown files from `03-Resources/` and `01-Projects/` into a single output at `scripts/output/vault-export-for-notebooklm.md`
   **And** it excludes: `_meta/`, `AI-Context/`, `00-Inbox/`, `04-Archives/`, `DailyNotes/`, any file starting with `_README`
   **And** output includes a header with export date and file count
   **And** output includes file size so the operator can check against NotebookLM source limits
   **And** the script is executable (`chmod +x`), uses `#!/usr/bin/env bash`, and works on WSL
   **And** `scripts/output/` is `.gitignore`d or the script handles a missing output directory
   **And** `bash scripts/verify.sh` still passes after the script is added.

4. **End-to-end smoke test (documented, not automated)**
   **Given** the NotebookLM MCP connector is live with tools including `notebook_query`, `source_add`, `cross_notebook_query`
   **When** a complete research cycle runs against the "The Architectural Blueprint for AI Factory Deployment" notebook (mapped to AI-Native-Infrastructure)
   **Then** the cycle covers: (a) query the notebook with a research question using `notebook_query`, (b) parse the JSON response and extract citations, (c) create one InsightNote in `03-Resources/AI-Native-Infrastructure/` via `vault_create_note` with correct PAKE frontmatter, citations as `[[Source-Title]]` wikilinks, and `source_uri` pointing to the notebook name, (d) verify the note appears in the vault and the audit log has an entry
   **And** the exact prompts, tool calls, and JSON shapes used are documented in the story completion record so the pattern is repeatable
   **And** the InsightNote passes PAKE validation.

## Tasks / Subtasks

### Deliverable 1: Notebook-to-project mapping note

- [x] Read existing project folders under `Knowledge-Vault-ACTIVE/01-Projects/` to confirm active project names (AC: #1) — only `_README.md` present; project list taken from story AC and operator notebook table
- [x] Draft `03-Resources/NotebookLM-Project-Map.md` content with PAKE frontmatter and project-to-notebook mapping table (AC: #1)
- [ ] Create the note via `vault_create_note` (agent-writable path under `03-Resources/`) (AC: #1) — **deferred:** file written to vault path in repo via filesystem for content delivery; Vault IO MCP was not available in this Cursor session. Operator should run `vault_create_note` with the same body if a governed create and audit line are required, or accept the existing file and confirm audit on the next mutation.
- [ ] Verify PAKE validation passes and audit log records the create (AC: #1) — pending Vault IO MCP / operator confirmation

### Deliverable 2: Workflow module (draft for operator)

- [x] Draft full `notebooklm-workflow.md` content covering all six workflow areas (AC: #2)
  - [x] Section: querying NotebookLM (project map lookup, notebook_query, cross_notebook_query, JSON parsing)
  - [x] Section: InsightNote creation (PAKE frontmatter, wikilink citations, vault_create_note)
  - [x] Section: adding sources (source_add tool, source types: url, text, drive, file)
  - [x] Section: Perplexity fallback (when research_start misses sources)
  - [x] Section: audio overview generation (download_artifact, audio output path, nice-to-have)
  - [x] Section: cross-notebook queries (multi-project research)
- [x] Output the draft content in the story completion record with exact copy instructions for the operator (AC: #2)
- [x] Draft the `AGENTS.md` Section 7 module table row the operator should add (AC: #2) — **note:** specs mirror uses **Section 6. Active Modules** for the module table; apply the row there (and in the live vault `AI-Context/AGENTS.md` when synced)

### Deliverable 3: Vault export script

- [x] Create `scripts/output/` directory or handle it in the script (AC: #3)
- [x] Write `scripts/export-vault-for-notebooklm.sh` with bash, header, exclusions, file count, size output (AC: #3)
- [x] Make the script executable (AC: #3)
- [x] Add `scripts/output/` to `.gitignore` if not already excluded (AC: #3)
- [x] Run `bash scripts/verify.sh` to confirm no regressions (AC: #3)

### Deliverable 4: Smoke test

- [x] Pick a research question relevant to AI-Native-Infrastructure (AC: #4)
- [ ] Query "The Architectural Blueprint for AI Factory Deployment" using `notebook_query` via the NotebookLM MCP (AC: #4) — **blocked in session:** NotebookLM MCP tools were not exposed to this agent session (only `cursor-ide-browser` tools registered). Operator reruns with `user-notebooklm` connected.
- [ ] Parse JSON response and extract citation data (AC: #4) — pending live `notebook_query` response
- [ ] Create one InsightNote in `03-Resources/AI-Native-Infrastructure/` via `vault_create_note` with PAKE frontmatter, wikilink citations, source_uri (AC: #4) — **paused per user:** proposed note body is in Dev Agent Record → Deliverable 4 (awaiting format approval before any `vault_create_note`)
- [ ] Verify note in vault and audit log entry (AC: #4)
- [x] Document exact prompts, tool calls, JSON shapes, and the created note path in completion record (AC: #4) — see Dev Agent Record (expected shapes documented; live JSON pending)

## Dev Notes

### WriteGate and path constraints

- `AI-Context/**` is WriteGate-protected (`PROTECTED_PATH`). Deliverable 2 (workflow module) **cannot be created by agents via vault_create_note or any MCP tool**. The agent drafts the content; the **operator manually copies** it to `Knowledge-Vault-ACTIVE/AI-Context/modules/notebooklm-workflow.md`. The story completion record must include the exact file content and copy instructions.
- `03-Resources/` is agent-writable via `vault_create_note` with `pake_type: SourceNote` or `InsightNote`. Deliverable 1 (project map) and Deliverable 4 (smoke test InsightNote) go through this path.
- `scripts/` is in the implementation repo, not under WriteGate. Deliverable 3 (export script) is created directly by the agent.
- [Source: `src/write-gate.ts` — `isUnderAiContext` function, protected path list]

### NotebookLM MCP tools available

The `user-notebooklm` MCP server exposes these consolidated tools (per server instructions):

| Tool | Purpose | Key params |
|------|---------|------------|
| `notebook_query` | Query a specific notebook | notebook name/ID, query text |
| `cross_notebook_query` | Query across multiple notebooks | query text (spans projects) |
| `source_add` | Add source material to a notebook | `source_type` (url/text/drive/file), content params |
| `research_start` | Start a research session | topic/query |
| `download_artifact` | Download generated artifacts (audio/video) | `artifact_type` (audio/video/etc.) |
| `studio_create` | Create audio/video/infographic/slides | `artifact_type` |
| `studio_status` | Poll artifact creation status | |
| `note_create` / `note_list` / `note_update` / `note_delete` | Manage notes within notebooks | |
| `pipeline` | Run multi-step research pipelines | |
| `notebook_create` | Create new notebooks | |

Auth: if authentication errors occur, run `nlm login` via terminal. Confirmation: tools with `confirm` param require user approval before setting `confirm=True`.

### Vault IO MCP tools used in this story

| Tool | Usage |
|------|-------|
| `vault_create_note` | Create project map (SourceNote) and smoke test InsightNote |
| `vault_read` | Verify created notes exist |
| `vault_list` | Confirm directory contents after creates |
| `vault_search` | Optional: search for existing content before creating |
| `vault_read_frontmatter` | Verify PAKE frontmatter on created notes |
| `vault_log_action` | Optional: log the smoke test as an operator-significant event |

### PAKE frontmatter for InsightNote

Per `AGENTS.md` Section 3 and `_meta/schemas/`:

```yaml
---
pake_id: [UUID v4]
pake_type: InsightNote
title: "[Descriptive title derived from research question]"
created: 2026-04-05
modified: 2026-04-05
status: draft
confidence_score: 0.7
verification_status: pending
creation_method: ai
source_uri: "notebooklm://The Architectural Blueprint for AI Factory Deployment"
tags:
  - notebooklm
  - research
  - ai-native-infrastructure
---
```

Citations in the body use wikilinks: `[[Source-Title]]` format, matching vault note titles where the source material has been ingested. When the source title does not match an existing vault note, use the raw citation text with a note that it could be linked after ingestion.

### PAKE frontmatter for SourceNote (project map)

```yaml
---
pake_id: [UUID v4]
pake_type: SourceNote
title: "NotebookLM Project Map"
created: 2026-04-05
modified: 2026-04-05
status: in-progress
confidence_score: 0.9
verification_status: verified
creation_method: hybrid
tags:
  - notebooklm
  - project-map
  - agent-reference
---
```

### Routing rules

Per `AGENTS.md` Section 2 and `03-Resources/_README.md`:
- SourceNote and InsightNote route to `03-Resources/`.
- Project-scoped InsightNotes from smoke test route to `03-Resources/AI-Native-Infrastructure/` (subdirectory under Resources, scoped by project name).
- The project map is a cross-cutting reference, so it lives at `03-Resources/NotebookLM-Project-Map.md` (top level of Resources).

### Export script technical requirements

- Must work on WSL (bash, standard coreutils).
- Use `find` with exclusion patterns, not globbing, for robustness.
- Output path: `scripts/output/vault-export-for-notebooklm.md`.
- Header format: export date (`date -u`), file count, total size.
- Each file in the export is separated by a markdown heading with the source path.
- File size output uses `du -h` or `wc -c` for human-readable size and byte count.
- NotebookLM source limit reference: sources up to ~500K words or ~200MB per source (verify current limits at runtime).

### Perplexity fallback context

From `_bmad-output/implementation-artifacts/deferred-work.md` and operator input: when `research_start` via NotebookLM MCP does not surface key sources, use Perplexity Deep Research as a secondary collection path. Perplexity returns citation URLs that can then be fed into NotebookLM via `source_add(source_type="url", url=...)`. This is a manual operator workflow, not an automated pipeline.

### Cross-notebook query pattern

`cross_notebook_query` searches across all accessible notebooks. Use when research spans multiple projects (e.g., "How does the CNS vault-io model compare to the AI-Native Infrastructure deployment architecture?"). Results may reference sources from any notebook; the agent must identify which notebook each citation came from and route the InsightNote to the correct project folder.

### No vault-io code changes

This story is **workflow and documentation only**. No changes under `src/`, no new MCP tools, no WriteGate modifications, no test changes to vault-io. The only code artifact is the bash export script in `scripts/`.

### Project Structure Notes

- `scripts/export-vault-for-notebooklm.sh` follows the existing `scripts/` convention (alongside `verify.sh`, `assert-verify-failure-modes.mjs`, `bmad_to_ralph.py`).
- `scripts/output/` is a new directory for generated artifacts; add to `.gitignore`.
- `03-Resources/NotebookLM-Project-Map.md` is a new vault note; follows existing `03-Resources/` manifest and naming conventions.
- `AI-Context/modules/notebooklm-workflow.md` is a new module; operator must also update `AGENTS.md` Section 7 module table.

### Existing notebooks (operator-provided)

| Notebook name | Mapped project | Source count | Primary use |
|---------------|---------------|-------------|-------------|
| The Architectural Blueprint for AI Factory Deployment | AI-Native-Infrastructure | 39 | Research queries |
| The Directory Monetization Playbook | Lead-Gen-Directory-Sydney (parked) | Unknown | Source collection |

Remaining active projects (Brain-CNS-Build, CNS-Phase-1, LinkedIn-Profile-Builder, PROJECT-NEXUS) do not yet have mapped notebooks. The project map note should list these as "unmapped" so agents know to create notebooks when needed.

### References

- `_bmad-output/planning-artifacts/sprint-change-proposal-2026-04-03.md` (Epic C scope, operator decisions)
- `docs/architecture.md` (P3 dual-path model, Phase 2 context)
- `specs/cns-vault-contract/AGENTS.md` (constitution: Section 2 routing, Section 3 frontmatter, Section 4 Vault IO, Section 7 modules)
- `_bmad-output/implementation-artifacts/deferred-work.md` (Perplexity fallback note)
- `Knowledge-Vault-ACTIVE/03-Resources/_README.md` (allowed pake_types, naming conventions)
- `Knowledge-Vault-ACTIVE/01-Projects/_README.md` (project subfolder conventions)
- `src/write-gate.ts` (PROTECTED_PATH for AI-Context)
- `_bmad-output/implementation-artifacts/8-1-nexus-coexistence-documentation.md` (previous Phase 2 story pattern: human-only edits for constitution-adjacent files)

## Previous Story Intelligence

### From Story 8.1 (Epic A, Nexus coexistence)

- **Human-only pattern for protected paths:** Story 8.1 established the precedent that `AI-Context/**` files require the operator to manually apply agent-drafted content. This story follows the same pattern for Deliverable 2 (workflow module). The completion record must include the exact file content and copy instructions.
- **Manifest update pattern:** Story 8.1 updated `_README.md` manifests in 00-Inbox/, 01-Projects/, 02-Areas/, 03-Resources/ with Nexus/dual-path notes while preserving Story 2.1 structure. This story does not modify manifests.
- **Prose style:** No em dashes. Use commas, semicolons, colons, or full stops.

### From Story 9.1 (Epic B, shared PAKE module)

- PAKE type literals are now centralized in `src/pake/schemas.ts` as `PAKE_TYPE_VALUES` and `PakeType`. The vault_create_note tool uses these for validation. InsightNote and SourceNote are valid `pake_type` values.

### From Epics 4-5 (governed writes and audit)

- `vault_create_note` writes atomically (temp + rename), validates PAKE frontmatter, scans for secrets, and appends an audit line on success.
- Audit line format: `[ISO8601 UTC] | action | tool | surface | target_path | payload_summary`.
- The smoke test (Deliverable 4) should verify the audit log entry after creating the InsightNote.

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

- NotebookLM `notebook_query` MCP call returned no tool registration in this session (available MCP tools list contained only `cursor-ide-browser-*`).
- `Knowledge-Vault-ACTIVE/01-Projects/` contains only `_README.md` (no project subfolders yet); project names follow story AC and operator-provided notebook table.

### Completion Notes List

- **Deliverable 1:** `Knowledge-Vault-ACTIVE/03-Resources/NotebookLM-Project-Map.md` created with `SourceNote` PAKE frontmatter and mapping table. Governed create + audit line: confirm with Vault IO MCP when connected.
- **Deliverable 2:** Full `notebooklm-workflow.md` draft and `AGENTS.md` module row are in the chat response below this file update (operator copies into `Knowledge-Vault-ACTIVE/AI-Context/modules/notebooklm-workflow.md` and updates the Active Modules table in `AGENTS.md`).
- **Deliverable 3:** `scripts/export-vault-for-notebooklm.sh` writes `scripts/output/vault-export-for-notebooklm.md`; `scripts/output/` is gitignored; `bash scripts/verify.sh` passed.
- **Deliverable 4 (partial):** Research question chosen: *What are the main architectural pillars or layers of an AI factory deployment, and how do governance and operations connect?* Expected tool pattern: `notebook_query` with notebook identifier matching the project map title and the query string above. **InsightNote draft for approval (do not call `vault_create_note` until the operator approves the format):**

**Proposed path:** `03-Resources/AI-Native-Infrastructure/insightnote-2026-04-04-ai-factory-pillars.md`

```markdown
---
pake_id: 5617bc31-af3d-4889-94fd-807d269f875c
pake_type: InsightNote
title: "AI factory deployment pillars (NotebookLM synthesis)"
created: 2026-04-04
modified: 2026-04-04
status: draft
confidence_score: 0.7
verification_status: pending
creation_method: ai
source_uri: "notebooklm://The Architectural Blueprint for AI Factory Deployment"
tags:
  - notebooklm
  - research
  - ai-native-infrastructure
---

# AI factory deployment pillars (NotebookLM synthesis)

## Question

What are the main architectural pillars or layers of an AI factory deployment, and how do governance and operations connect?

## Answer (from notebook)

Replace this paragraph with the natural-language answer returned by `notebook_query`. Keep NotebookLM’s nuance; do not invent sources.

## Citations (wikilinks)

Map each citation title from the JSON response to vault notes where titles match; use `[[Exact Note Title]]`. If no vault note exists yet, use the citation label verbatim in backticks and add a short line: `Candidate vault title for future link: ...`

Example placeholders (delete after real run):

- [[The Architectural Blueprint for AI Factory Deployment]] — *remove if this is the notebook, not a vault note; otherwise replace with real source titles from JSON*
- `Primary source A from JSON`
- `Primary source B from JSON`

## Raw tool metadata (operator fills after live run)

- notebook_query notebook: The Architectural Blueprint for AI Factory Deployment
- Response shape: store the top-level JSON keys here after one successful call (e.g. `answer`, `citations`, `sources` — exact schema depends on MCP implementation).

```

**Expected JSON handling (repeatable pattern):** After `notebook_query` returns JSON, parse with a strict JSON parser, extract the assistant-visible answer string and the citations array (each item typically has a title or name and optional URL). Build the Citations section from that array using `[[title]]` when `vault_search` shows a matching note title.

### File List

- `Knowledge-Vault-ACTIVE/03-Resources/NotebookLM-Project-Map.md` (new)
- `scripts/export-vault-for-notebooklm.sh` (new, executable)
- `.gitignore` (add `scripts/output/`)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (10-1 → in-progress)
- `_bmad-output/implementation-artifacts/10-1-notebooklm-vault-integration.md` (this file: status, tasks, Dev Agent Record)

---

**Story completion status:** Partial. Deliverables 2 (draft only) and 3 are done in-repo; Deliverable 1 file exists but governed `vault_create_note` + audit verification and Deliverable 4 InsightNote write are **blocked or paused** pending Vault IO / NotebookLM MCP and operator approval of the InsightNote format above.
