---
pake_id: cns-phase1-spec-001
pake_type: WorkflowNote
title: "CNS Phase 1 Specification: Foundation Layer"
status: active
created: 2026-04-01
modified: 2026-04-02
tags:
  - cns
  - architecture
  - phase-1
  - spec
---

# CNS Phase 1 Specification: Foundation Layer

## 1. System Overview

### What the CNS Is

The Central Nervous System (CNS) is a unified control plane that orchestrates all AI agents, LLMs, CLIs, and IDEs from a single vault-based architecture. It eliminates blank-prompt syndrome, enforces consistent behavior across tools, and turns an Obsidian vault into an active execution environment rather than a passive note store.

### How CNS and PAKE Relate

CNS is the **nervous system**. PAKE is the **memory**.

| Layer | System | Responsibility |
|-------|--------|----------------|
| Control | CNS | Agent routing, context loading, input surfaces, orchestration, security gates |
| Knowledge | PAKE | Note schemas, frontmatter standards, confidence scoring, ingestion pipelines, retrieval |

PAKE's existing work (frontmatter schemas, MCP server prototype, ingestion pipeline, confidence scoring) becomes a subsystem that the CNS orchestrates. No PAKE work is discarded. It is promoted into the CNS architecture as the knowledge management layer.

The CNS routes signals (commands, queries, task assignments) to the right agent and gives that agent the right context. When the agent needs to read or write knowledge, it calls into PAKE's schemas and tools. When new information enters the system, PAKE's ingestion pipeline processes it according to its quality rules, and the CNS makes it discoverable to all agents.

---

## 2. Phase 1 Scope

### What Phase 1 Delivers

A working vault-based control plane where any AI tool (Claude Code, Cursor, Gemini CLI) can open the vault directory and immediately know:

- Who you are and what this system is for
- How the vault is organized
- What you are currently working on
- How to read and write notes correctly
- What is off-limits

No re-explaining. No re-orienting. Every session starts grounded.

### Three Deliverables

1. **Vault Folder Contract** - locked folder structure with documented purpose, enforced naming, and agent-readable manifests
2. **AGENTS.md Constitution** - compact, always-on context file loaded by every tool
3. **Vault IO Layer** - MCP tool interface for standardized vault read/write operations

### What Is Explicitly Deferred

| Capability | Phase | Depends On |
|------------|-------|------------|
| Discord / Nexus surface | 2 | Vault IO layer |
| NotebookLM ingestion pipeline | 2 | Frontmatter schema + vault IO |
| Obsidian Bases control panels | 2 | Folder contract + schema definitions |
| Always-on daemon (OpenClaw) | 3 | Security spec + proven human-triggered loop |
| Mobile access (Blink Shell + tmux) | 2 | Tailscale + vault sync |
| pgvector / embedding layer | 3 | Stable vault content + schema compliance |
| Multi-model consensus routing | 3 | Proven single-model reliability |

---

## 3. Deliverable 1: Vault Folder Contract

### Directory Structure

```
Knowledge-Vault-ACTIVE/
├── AI-Context/                  # CNS brain: constitution, modules, personas
│   ├── AGENTS.md                # Universal constitution (always loaded)
│   ├── modules/                 # Bounded policy files (loaded on demand)
│   │   ├── vault-io.md          # Read/write protocol details
│   │   └── security.md          # Security policy, secrets handling, approval gates
│   └── personas/                # Agent personality/role configurations
│
├── 00-Inbox/                    # Unprocessed captures (mobile, web clips, quick notes)
│   └── _README.md               # Contract: no schema required, triage destination
│
├── 01-Projects/                 # Active project folders
│   ├── _README.md               # Contract: each project gets its own subfolder
│   └── <project-name>/          # Project subfolder pattern
│       ├── .claude/             # Project-specific Claude context (shims to AGENTS.md)
│       └── docs/                # Project documentation
│
├── 02-Areas/                    # Ongoing responsibilities (consulting, marketing, health)
│   └── _README.md               # Contract: persistent, not time-bound
│
├── 03-Resources/                # Reference material, research, templates
│   └── _README.md               # Contract: reusable knowledge, not project-specific
│
├── 04-Archives/                 # Completed or inactive items
│   └── _README.md               # Contract: read-only unless reactivating
│
├── DailyNotes/                  # Daily logs (YYYY-MM-DD.md)
│   └── _README.md               # Contract: append-only during the day, reviewed weekly
│
├── _meta/                       # Vault health, schemas, agent logs, sync configs
│   ├── bases/                   # Obsidian Bases (.base) control panels (Phase 2)
│   ├── schemas/                 # PAKE frontmatter definitions
│   │   ├── source-note.md       # Schema for SourceNote type
│   │   ├── insight-note.md      # Schema for InsightNote type
│   │   ├── synthesis-note.md    # Schema for SynthesisNote type
│   │   ├── workflow-note.md     # Schema for WorkflowNote type
│   │   └── validation-note.md   # Schema for ValidationNote type
│   ├── logs/                    # Agent action audit trail
│   │   └── agent-log.md         # Append-only log of all agent write operations
│   └── sync/                    # Sync configuration (Git, rsync)
│
├── CLAUDE.md                    # Claude Code shim (points to AI-Context/AGENTS.md)
└── .cursorrules                 # Cursor shim (points to AI-Context/AGENTS.md)
```

### Directory Contracts

Each `_README.md` follows this template:

```markdown
---
purpose: [one-line purpose]
schema_required: true | false
allowed_pake_types: [list or "any"]
naming_convention: [pattern]
---

# [Directory Name]

## What Goes Here
[1-2 sentences]

## What Does Not Go Here
[1-2 sentences]

## Frontmatter Requirements
[Required fields for notes in this directory]
```

### Frontmatter Schema (PAKE Standard)

All notes outside `00-Inbox/` must include:

```yaml
---
pake_id: [auto-generated UUID]
pake_type: SourceNote | InsightNote | SynthesisNote | WorkflowNote | ValidationNote
title: [human-readable title]
created: [ISO date]
modified: [ISO date]
status: draft | in-progress | reviewed | archived
confidence_score: [0.0 to 1.0]
verification_status: pending | verified | disputed
creation_method: human | ai | hybrid
tags: [list]
---
```

Optional fields (vary by pake_type):

```yaml
source_uri: [origin URL or reference]
cross_references: [list of pake_ids this note connects to]
ai_summary: [brief AI-generated summary]
```

### Inbox Exception

Notes in `00-Inbox/` have no schema requirement. They represent raw captures. The triage process (manual or agent-assisted) moves them to the correct directory and applies the required frontmatter.

---

## 4. Deliverable 2: AGENTS.md Constitution

### Design Principles

- **Maximum 500 lines.** If it grows beyond this, extract a module.
- **Progressive disclosure.** AGENTS.md is the map. Modules are the territory.
- **Tool-agnostic.** Written so Claude, Gemini, Cursor, or any future LLM can parse it.
- **Living document.** Updated regularly as the system evolves. Git history tracks the evolution.

### Location and Distribution

**Canonical source:** `Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md`

**Distribution to tools:**

| Tool | Shim Mechanism |
|------|---------------|
| Claude Code | `CLAUDE.md` at vault root containing `@AI-Context/AGENTS.md` reference |
| Cursor | `.cursorrules` or `.cursor/rules/agents.mdc` referencing AGENTS.md |
| Gemini CLI | Config pointing to AGENTS.md as context file |
| Project repos | Symlink or `rulesync`-generated copy of AGENTS.md |

### Section Outline

See the companion file `AGENTS.md` for the full initial content. The sections are:

1. System Identity (who, what, why)
2. Vault Map (compressed folder contract)
3. Formatting Standards (note structure, style rules)
4. Vault IO Protocol (how agents read and write)
5. Security Boundaries (hard limits)
6. Active Modules (pointers to loaded policy files)
7. Current Focus (what you are working on right now, updated frequently)

### Evolution Protocol

When something needs to change:

- **Universal rules** (formatting, security, vault structure) get updated in AGENTS.md directly
- **Domain-specific rules** (Discord ops, research ingestion, project-specific conventions) become modules in `AI-Context/modules/`
- AGENTS.md gets one new line pointing to the module
- Git commit message follows: `cns: [update|add-module|refine] <description>`

---

## 5. Deliverable 3: Vault IO Layer (MCP Tool Interface)

### Architecture

```
┌─────────────────────────────────────────────┐
│  Input Surfaces (Claude Code, Cursor, CLI)  │
└──────────────────┬──────────────────────────┘
                   │
         ┌─────────▼──────────┐
         │   AGENTS.md loaded  │
         │   (context + rules) │
         └─────────┬──────────┘
                   │
         ┌─────────▼──────────┐
         │   Vault IO Layer    │
         │   (MCP Tools)       │
         └─────────┬──────────┘
                   │
    ┌──────────────┼──────────────┐
    │              │              │
    ▼              ▼              ▼
Filesystem    Obsidian CLI    Agent Log
(primary)     (when open)     (_meta/logs/)
```

**Primary access:** Direct filesystem read/write (works whether Obsidian is open or closed).

**Enhanced access:** Obsidian CLI for backlink-preserving moves, Bases queries, property reads, and history inspection (when Obsidian is running).

**Fallback:** If Obsidian CLI is unavailable, all operations fall back to filesystem equivalents.

### Canonical read boundary (Story 4.9)

MCP **read** tools enforce a **canonical** vault boundary (`realpath` before read IO) so symlink escapes cannot return filesystem content outside the vault. Policy summary: `specs/cns-vault-contract/modules/security.md` (Read vs write boundary). **Normative acceptance criteria, scope, tests, and reviewer checklist** are bound to the implementation artifact `_bmad-output/implementation-artifacts/4-9-canonical-read-boundary-hardening.md`.

### Mutation audit logging and `vault_log_action` (Story 5.2)

Every mutating Vault IO tool must emit **one** append-only line to `_meta/logs/agent-log.md` per successful operation, after the mutation commits and before returning success, via the shared audit choke point (`appendRecord` + WriteGate `audit-append`). Payloads must stay metadata-only (no full note bodies, no raw daily append text, no frontmatter value blobs). **`vault_append_daily`** must not double-log when the exclusive-create path hits **`EEXIST`** and delegates to the existing-file branch.

**Normative acceptance criteria, EEXIST single-line invariant, payload rules, `vault_log_action` contract, tests, and explicit reviewer checklist** are bound to the implementation artifact `_bmad-output/implementation-artifacts/5-2-mutations-and-vault-log-action.md`. Treat that story file as spec for this slice of Phase 1; do not re-derive audit behaviour without it.

**Operator maintenance and correlation (FR23, FR24):** Human-readable procedures for interpreting log lines, example correlation from note path to log line, WSL-oriented inspection commands, and human-only log archive or trim live in `specs/cns-vault-contract/AUDIT-PLAYBOOK.md` (Story 5.3). That playbook is documentation only; it does not relax WriteGate or protected-path rules.

### Tool Definitions

#### vault_search

```
Purpose: Full-text search across the vault
Input:   query (string), scope (directory path, optional; if omitted, default scope is implementation-defined and MUST NOT be a full-vault scan), max_results (int, default 50, hard cap 50 per call)
Output:  Array of {path, matched_snippet, frontmatter_summary}
Notes:   Respects .gitignore patterns. Never searches _meta/logs/ unless explicitly requested. Scoped default and cap align with PRD NFR-P2 (WSL performance).
```

#### vault_read

```
Purpose: Read a specific note by path
Input:   path (string, relative to vault root)
Output:  Full file content (frontmatter + body)
Notes:   Returns error if path is outside vault boundary.
```

#### vault_read_frontmatter

```
Purpose: Read only YAML frontmatter of a note (token-efficient)
Input:   path (string) OR paths (array of strings)
Output:  Parsed frontmatter object(s)
Notes:   Use this for bulk queries where body content is not needed.
```

#### vault_create_note

```
Purpose: Create a new note with PAKE-compliant frontmatter
Input:   title (string), content (string), pake_type (enum), tags (array),
         confidence_score (float, default 0.5), source_uri (string, optional)
Output:  {pake_id, file_path, created_at}
Behavior:
  - Auto-generates pake_id (UUID v4)
  - Auto-sets created/modified timestamps
  - Routes to correct folder based on pake_type:
      SourceNote    -> 03-Resources/
      InsightNote   -> 03-Resources/
      SynthesisNote -> 03-Resources/
      WorkflowNote  -> 01-Projects/ (requires explicit project context) or `02-Areas/` (fallback when project context is missing)
      ValidationNote -> 03-Resources/
  - WorkflowNote disambiguation:
      - "Project context" means an explicit target project identifier. Do not infer project context.
      - If project context is missing, route to `02-Areas/<area-name>/` when the area is known, otherwise route to the `02-Areas/` root as a temporary holding location that requires triage.
      - If you are uncertain which project should own the WorkflowNote, require operator or manifest disambiguation before routing beyond `02-Areas/`.
  - Validates frontmatter against schema before writing
  - Logs action to agent-log.md
```

#### vault_append_daily

```
Purpose: Append content to today's daily note
Input:   content (string), section (string, optional, e.g. "## Agent Log")
Output:  {path, appended_at}
Behavior:
  - Creates DailyNotes/YYYY-MM-DD.md if it does not exist (using daily note template)
  - Appends under specified section header, or at end if no section given
  - Logs action to agent-log.md
```

#### vault_update_frontmatter

```
Purpose: Update specific frontmatter fields on an existing note
Input:   path (string), updates (object of key-value pairs)
Output:  {path, updated_fields, modified_at}
Behavior:
  - Merges updates into existing frontmatter (does not replace entire block)
  - Auto-updates "modified" timestamp
  - Validates result against schema
  - Logs action to agent-log.md
```

#### vault_list

```
Purpose: List contents of a vault directory
Input:   path (string, relative to vault root), recursive (bool, default false),
         filter_by_type (pake_type enum, optional), filter_by_status (string, optional)
Output:  Array of {filename, pake_type, status, modified}
Notes:   Returns frontmatter summary, not full content.
```

#### vault_move

```
Purpose: Move or rename a note, preserving backlinks
Input:   source_path (string), destination_path (string)
Output:  {old_path, new_path, backlinks_updated}
Behavior:
  - Uses Obsidian CLI "obsidian move" if available (preserves backlinks automatically)
  - Falls back to filesystem mv + manual wikilink find-and-replace if CLI unavailable
  - Updates "modified" timestamp in frontmatter
  - Logs action to agent-log.md
```

#### vault_log_action

```
Purpose: Write an entry to the agent action log
Input:   action (string), tool_used (string), target_path (string, optional),
         details (string, optional)
Output:  {logged_at}
Behavior:
  - Appends to _meta/logs/agent-log.md in format:
    [ISO timestamp] | [action] | [tool] | [target] | [details]
  - Called automatically by all write operations
  - Can also be called directly for non-write events worth logging
```

### Security Enforcement

All tools enforce these rules at the layer level (not dependent on individual agent compliance):

- **No writes outside vault boundary.** Any path that resolves outside `Knowledge-Vault-ACTIVE/` is rejected.
- **No secret storage.** If content matches patterns for API keys, tokens, passwords, or credentials, the write is rejected with a warning.
- **Destructive operations require confirmation.** Delete and bulk rename are not available in Phase 1. `vault_move` is the only path-changing operation.
- **All writes logged.** Every tool that modifies the vault calls `vault_log_action` before returning.

---

## 6. WSL Performance Strategy

### The Constraint

The vault lives on Windows at `D:\02-KNOWLEDGE\Knowledge-Vault-ACTIVE`, accessed via WSL at `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE`. Cross-filesystem I/O is slower than native ext4 for batch operations.

### Phase 1 Approach

For normal agent operations (single note reads/writes, daily note appends, search), cross-filesystem performance is acceptable. No special handling needed.

For future batch operations (full-vault indexing, embedding generation, bulk schema validation), use a native WSL cache:

```
~/vault-cache/    # ext4, fast native reads
```

Sync strategy (to be implemented when batch operations are introduced):

```bash
# Pull from Windows vault to cache
rsync -av --delete "/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/" ~/vault-cache/

# After batch processing, push results back
rsync -av ~/vault-cache/_meta/ "/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/_meta/"
```

Phase 1 does not require the cache. It is documented here for architectural awareness.

---

## 7. Acceptance Criteria: Phase 1 Complete

Phase 1 is done when all of the following are true:

- [ ] Vault folder structure matches the contract (all directories exist, all `_README.md` files present)
- [ ] `AI-Context/AGENTS.md` exists and is under 500 lines
- [ ] `CLAUDE.md` at vault root correctly references AGENTS.md
- [ ] `.cursorrules` at vault root correctly references AGENTS.md
- [ ] `_meta/schemas/` contains frontmatter definitions for all five pake_types
- [ ] At least one module exists in `AI-Context/modules/` (vault-io.md or security.md)
- [ ] Vault IO MCP server runs and exposes all eight tools
- [ ] Creating a note via `vault_create_note` produces valid PAKE-compliant frontmatter
- [ ] All write operations produce entries in `_meta/logs/agent-log.md`
- [ ] Opening Claude Code in the vault directory loads AGENTS.md context automatically
- [ ] Opening Cursor in the vault directory loads AGENTS.md context automatically
- [ ] A new session with either tool requires zero re-orientation to begin productive work

---

## 8. Phase 2 Preview

Once Phase 1 is stable:

- **Discord / Nexus surface** operates as a documented dual-path: Nexus writes directly to the vault as a trusted surface; CNS vault-io governs IDE sessions (Cursor, Claude Code). The two paths coexist without shared enforcement logic. `AGENTS.md` acknowledges Nexus as a write surface; directory `_README.md` manifests note Nexus-created content for triage. Convergence via shared core library is the documented escape hatch if multi-operator or audit requirements emerge; it is not the current plan. This model is P3 permanent for single-operator use.
- **NotebookLM ingestion** extracts cited synthesis from notebooks into vault notes via PAKE schemas
- **Obsidian Bases** provide structured control panels for agents (Inbox triage, project status, research sources)
- **Mobile access** via Blink Shell + tmux + Tailscale connects to the same vault IO layer

Each Phase 2 capability adds a module to `AI-Context/modules/` and one line to AGENTS.md. The foundation does not change.