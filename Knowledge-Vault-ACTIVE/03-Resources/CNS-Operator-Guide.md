---
pake_id: 70dab0da-cb64-4957-bb07-631c524fa80b
pake_type: SourceNote
title: "CNS Operator Guide"
created: 2026-04-05
modified: 2026-04-29
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
| | `AI-Context/modules/routing.md` |

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
| Tests | Vitest: automated suite covering boundary, secrets, audit, PAKE, search, WriteGate, Brain allowlist |
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

### c. CNS research chain synthesis

The end-to-end research chain creates operator-ready SynthesisNotes from source notes. Synthesis output must use the PAKE++ body contract: abstract callout, What We Know, Signal vs Noise with Contradiction Ledger, Gap Map, Blind Spots, Where Chris Has Leverage, Highest-Leverage Move, Connected Vault Notes, Decisions Needed, Open Questions, and Version / Run Metadata.

The synthesis agent is personalized to Chris Taylor in Sydney as a Creative Technologist. Its leverage section must reference active tracks such as Escape Job and Build Agency when those tracks are in the operator context. Vault context is pulled from `03-Resources/Operator-Profile.md` plus topic-relevant `03-Resources/` notes; if the operator profile is missing, the synthesis must warn that it is grounded in external research only.

For live evidence runs, use `scripts/run-chain.ts`. The brief topic can be selected with `CNS_BRIEF_TOPIC`; if unset, the fallback topic is freelance consulting day rate calculation methodology. Operators can also pass a strict ResearchBrief JSON with `--brief-file`, or use `--topic`, repeated `--query`, and `--depth`. The harness cleans stale AI-generated chain notes for the selected topic before starting a live run, then writes compact evidence with brief topic, query count, generated vault paths, and an explicit `PAKE++ validation: PASS` or `PAKE++ validation: FAIL` line based on read-back validation of the persisted InsightNote.

Before the chain begins, the harness also performs **pre-run hygiene**:
- **Output-note cleanup:** deletes stale `03-Resources/synthesis-*.md`, `03-Resources/hooks-*.md`, and `03-Resources/weapons-check-*.md` files (non-recursive) so each run starts with a clean slate.
- **Fail-fast env validation:** requires `FIRECRAWL_API_KEY`, `APIFY_API_TOKEN`, and `ANTHROPIC_API_KEY` to be present; if any are missing, it fails with a single aggregated message listing all missing keys. (Perplexity remains optional; when `PERPLEXITY_API_KEY` is absent, Perplexity is treated as unavailable and the sweep continues without filing Perplexity answers.)

### d. Daily agent log

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
| 2026-04-13 | 1.1.0 | Added Brain corpus allowlist pointer (Phase 2.1 contract path, vault schema location, verify gate wording) | 12-2-brain-corpus-allowlist-contract |
| 2026-04-13 | 1.2.0 | Documented Brain secret-pattern exclusion from embeddings (same merged patterns as WriteGate) | 12-3-secret-scan-enforcement-for-indexing |
| 2026-04-14 | 1.3.0 | Documented one-shot Brain index build (`npm run brain:index`), output directory outside the vault, and artifact file name | 12-4-minimal-embeddings-pipeline-operator-triggered |
| 2026-04-14 | 1.4.0 | Added index manifest (`brain-index-manifest.json`) with counts, exclusions, and drift/freshness signals | 12-5-index-manifest-and-drift-signals |
| 2026-04-14 | 1.5.0 | Added read-only index query command (`npm run brain:query`) and documented provenance warnings + stale-path trust model | 12-6-retrieval-query-api-read-only |
| 2026-04-14 | 1.6.0 | Documented PAKE quality-weighted retrieval ranking and `--no-quality-weighting` opt-out | 12-7-pake-quality-weighting-for-retrieval |
| 2026-04-15 | 1.7.0 | Added model routing section: overview, operator override rules, version guard, audit trail | 15-6-operator-override-governance-controls |
| 2026-04-22 | 1.8.0 | Documented PAKE++ synthesis output contract, operator personalization, and missing-profile warning behavior | 18-9-synthesis-quality-redesign |
| 2026-04-29 | 1.9.0 | Documented runtime-selectable live-chain briefs, stale generated note cleanup, and persisted PAKE++ evidence validation | 21-1-live-chain-real-brief-epic-20-stack-pake-quality-evidence |
| 2026-04-29 | 1.10.0 | Documented live-chain pre-run hygiene: prefix-based output cleanup + aggregated env-key validation | 21-2-pre-run-hygiene-automation |

---

## 13. Brain corpus allowlist (Phase 2.1)

Operators configure **which vault subtrees** feed the Brain embed pipeline using the live JSON file at **`_meta/schemas/brain-corpus-allowlist.json`** (same schema as the implementation-repo example). This file is **not** edited via Vault IO tools; use normal vault editing hygiene.

| Item | Location |
|------|----------|
| Human contract | Implementation repo: `_bmad-output/planning-artifacts/brain-corpus-allowlist-contract.md` |
| Example JSON | Implementation repo: `config/brain-corpus-allowlist.example.json` |
| Live allowlist | Vault: `_meta/schemas/brain-corpus-allowlist.json` (create deliberately—never paste secrets) |

### One-shot index build (Story 12.4)

From the **CNS implementation repository** (not inside the vault), with `CNS_VAULT_ROOT` pointing at this vault’s root directory:

1. Choose an **absolute output directory outside the vault** (for example under your home directory or a build artifacts folder).
2. Run: `npm run brain:index -- --output-dir <absolute-path>`
3. The run writes **`brain-index.json`** into that directory (deterministic ordering, vault-relative paths, stub embedder metadata in this slice). No scheduler, daemon, or MCP tool is involved.
4. The run also writes **`brain-index-manifest.json`** into the same directory.

If `--output-dir` resolves **inside** the vault boundary, the command **fails** by design so index artifacts do not land under `Knowledge-Vault-ACTIVE/` by default.

Pipeline validation code lives under `src/brain/` (allowlist loader, index build, secret gate). Notes whose **full serialized text** matches the **same merged** secret patterns as WriteGate (`config/secret-patterns.json` plus optional `_meta/schemas/secret-patterns.json`) are **excluded from the embed set** (no write error). The indexing gate returns only a stable reason code and `patternId`—never matched substrings or bodies (`src/brain/indexing-secret-gate.ts`).

### Inspecting freshness / drift (Story 12.5)

The manifest file is **machine-readable** and safe for operator sharing (no note bodies, no frontmatter dumps, no secret substrings). Key fields:

- **Build outcome**: `outcome` is `success` or `failed`.
- **Counts**: `counts.candidates_discovered`, `counts.embedded`, `counts.excluded`, `counts.failed`.
- **Why notes were skipped**: `exclusion_reason_breakdown` is keyed by stable reason codes (including the secret-pattern exclusion reason code).
- **Per-file failures (bounded)**: `failures` includes only vault-relative paths + reason codes + sanitized detail (no bodies, no absolute paths).
- **Staleness estimate**:
  - `freshness.last_build_utc` is the build time.
  - `vault_snapshot.max_mtime_utc` is the newest file mtime among discovered candidates at build time.
  - `freshness.estimated_stale_count` estimates how many discovered candidates had `mtime > build_timestamp` at build time.
  - `freshness.estimated_stale_sample` lists up to 20 newest vault-relative paths (paths only).

### Querying the index (read-only retrieval) (Story 12.6)

You can issue a **read-only retrieval query** against an existing `brain-index.json` artifact **without reading live vault files at query time**.

From the CNS implementation repository root:

1. Ensure you have an index output directory from `npm run brain:index`.
2. Run:
   - `npm run brain:query -- --index-path <absolute-path-to-brain-index.json> --query "your text" --top-k 10`
3. The command prints **JSON** to stdout with:
   - `results[]`: ordered list of `{ path, score }` where `path` is vault-relative POSIX and `score` is cosine similarity
   - `embedder`: embedder metadata from the index artifact (not from live provider calls)
   - `warnings[]` (optional): provenance / staleness flags if a sibling manifest is present
   - `provenance.last_build_utc` (optional): populated from `brain-index-manifest.json` when available

### Quality-weighted ranking (Story 12.7)

By default, the query API applies **PAKE quality weighting** as a multiplier on top of cosine similarity:

```
final_score = cosine_similarity * quality_multiplier
```

Where:

- **`quality_multiplier`** is computed from PAKE frontmatter fields captured at **index time**:
  - `status` weight: `reviewed` → 1.0, `in-progress` → 0.85, `draft` → 0.65, `archived` → 0.4, missing/unknown → 0.5
  - `confidence_score` weight: if present and in [0, 1], use it; if missing/invalid → 0.5
  - `verification_status` weight: `verified` → 1.0, `pending` → 0.8, `disputed` → 0.5, missing/unknown → 0.6
  - If a record has **no quality metadata at all** (no `quality` field in the index record), it receives a flat multiplier of **0.25**.

This is a **safe default posture**: notes created via ungoverned surfaces (e.g. Nexus captures lacking PAKE quality signals) are down-ranked and never silently promoted into top results.

**Opt out (pure cosine ranking):**

- Add `--no-quality-weighting` to the query command:
  - `npm run brain:query -- --index-path <abs> --query "q" --top-k 10 --no-quality-weighting`

When disabled, ranking falls back to **pure cosine similarity** with deterministic tie-break by `path`.

**Trust model (important):**

- Returned `path` values were captured at **index time** and can become **stale** after a `vault_move` or manual rename. Query does not validate file existence.
- Query reads only the index artifact (and best-effort sibling `brain-index-manifest.json`) and **never reads vault note bodies** to generate snippets in this story.

---

## 14. Model routing (Epic 15)

The CNS routing layer selects model aliases per surface and task category. Config lives in `config/model-routing/` (implementation repo). The module pointer is at `AI-Context/modules/routing.md`.

### Surfaces covered

Cursor, Claude Code, Gemini CLI, plus internal surfaces (vault-io, unknown).

### Operator override

Pass `operatorOverride: true` in the `RoutingContext` to bypass deny rules. Override cannot bypass registry existence (the alias must exist in `model-alias-registry.json`). Override decisions use the `OPERATOR_OVERRIDE` reason code and are always logged at "visible" tier. Full documentation: `config/model-routing/_README.md` (Operator override rules section).

### Version guard

Policy and registry versions must share the same major version (e.g., 1.x.x + 1.x.x). A major mismatch produces `VERSION_MISMATCH` and halts routing. Minor/patch mismatches produce a console warning but do not fail.

### Audit trail

Routing fallback events append to `AI-Context/agent-log.md` in the format:

```
- [{timestamp}] ROUTING {tier} {reason_code} {surface}/{taskCategory}: {originalAlias} → {selectedAlias}
```

The file must pre-exist (the routing layer does not create it). Silent-tier events are still written to the audit log.
