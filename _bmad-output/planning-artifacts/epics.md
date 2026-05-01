---
stepsCompleted:
  - step-01-requirements-extraction
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/cns-vault-contract/CNS-Phase-1-Spec.md
  - _bmad-output/planning-artifacts/cns-vault-contract/AGENTS.md
---

# CNS - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for CNS, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

```
FR1: Operator can open each Phase 1 first-class agent surface at the vault root and have the constitution load automatically without manually pasting it.
FR2: Agent can access universal behavior rules, vault map, and current mission context from the constitution and linked modules without the operator restating them.
FR3: Maintainer can add or adjust bounded policy in modules while keeping the core constitution within the Phase 1 line budget.
FR4: Operator can rely on a locked folder contract with per-directory manifests that state purpose, schema requirements, naming expectations, and routing rules.
FR5: Agent can determine correct placement for new or moved notes using directory manifests and PAKE note types.
FR6: Operator can capture raw inputs in an Inbox area without PAKE on initial capture.
FR7: Agent can run full-text search limited to an operator- or tool-specified directory scope, with a system-enforced upper bound on the number of hits returned per request.
FR8: Agent can read a full note by vault-relative path when the path is allowed.
FR9: Agent can read parsed frontmatter only for one or many paths when allowed.
FR10: Agent can list a directory with metadata summaries (not necessarily full bodies) when allowed.
FR11: System can omit designated sensitive or audit-only locations from default search unless explicitly scoped.
FR12: Agent can create a new note with PAKE-compliant frontmatter for paths outside the Inbox when allowed.
FR13: Agent can merge updates into existing frontmatter without discarding unspecified fields when allowed.
FR14: Agent can append content to the current daily note under an optional section when allowed.
FR15: Agent can move or rename a note through an authorized path-change workflow when allowed.
FR16: System can place new notes in the contract-correct area based on note type and routing rules.
FR17: System can reject any write whose resolved path lies outside the configured vault root.
FR18: System can reject agent-initiated writes and structural changes in human-only and protected areas per Phase 1 policy (including constitution, schemas, logs, and `_meta` structure).
FR19: System can reject writes whose content matches configured credential patterns.
FR20: System can refuse operations that Phase 1 does not authorize (including disallowed destructive or bulk actions).
FR21: Agent can receive explicit, actionable errors when a request violates safety, schema, or contract rules.
FR22: System can append an audit record for each authorized write, update, and move with timestamp, tool identity, target path, initiating surface, and a truncated or hashed summary of inputs (never a full payload or raw note body).
FR23: Operator can trace prior agent activity using audit records to explain how a note came to exist or change.
FR24: Maintainer can manually archive or trim audit log files without the append-only rule preventing human maintenance.
FR25: Operator can run Vault IO locally against a configured vault root for end-to-end sessions with Phase 1 first-class agent surfaces.
FR26: Agent can perform Phase 1 read and write capabilities through Vault IO when following the recommended workflow.
FR27: Agent can move or rename a note via `vault_move` such that when Obsidian is running, relocation uses Obsidian CLI so backlinks stay correct; when Obsidian CLI is not available, the system uses filesystem move plus wikilink find-and-replace as the fallback path.
FR28: Operator can complete the same Phase 1 grounding and governed IO journeys on each Phase 1 first-class agent surface without extra manual setup for that surface.
```

### NonFunctional Requirements

```
NFR-P1: For each Phase 1 first-class agent surface, the median time from opening the workspace at the vault root to the agent being able to execute the user's first task without manual constitution or routing paste is under 30 seconds, measured over a representative set of fresh sessions.
NFR-P2: Default search behavior must not perform a full-vault scan; search must use a directory scope, and each search request must return at most 50 results.
NFR-P3: Typical single-note read and write operations through Vault IO complete within interactive latency on the Phase 1 target environment (WSL), as validated by automated tests on a fixture vault and spot checks on a real vault (architecture targets p95 under 2 seconds for single-note read/write/move on fixture vault).
NFR-S1: The system must block 100% of writes that resolve outside the configured vault root or into Phase 1 protected paths, with a clear error to the caller.
NFR-S2: Writes that match configured credential patterns (scope defined in architecture: full note body + all frontmatter string values on create/update/append) must be rejected with a clear error.
NFR-S3: Audit records must never store full write payloads or raw note bodies; only truncated or hashed summaries alongside defined metadata.
NFR-R1: Authorized mutations must either commit with correct PAKE validation (outside Inbox) and a corresponding audit line, or fail with an explicit error; no silent partial writes that leave the vault inconsistent without a detectable signal.
NFR-R2: Phase 1 completion requires the project verification gate (`scripts/verify.sh` or successor) to pass.
NFR-I1: On WSL, Cursor and Claude Code must each support the same grounding and Vault IO–mediated journeys without extra per-surface manual steps beyond one-time local MCP configuration.
NFR-I2: Gemini CLI is out of scope for Phase 1 QA and acceptance; no NFR asserts parity for that surface in Phase 1.
```

### Additional Requirements

```
- **Starter template (Epic 1 / first implementation story):** TypeScript MCP package on Node — `npm init`, `@modelcontextprotocol/sdk`, `zod`, dev deps `typescript`, `tsx`, `@types/node`, `vitest`; ESM (`"type": "module"`); stdio MCP only for Phase 1.
- **Runtime pins:** Node >=20 (22.x LTS preferred); MCP SDK ^1.29.0; Zod ^3; TypeScript ^5.8; Vitest ^3 (exact minors pinned in lockfile during implementation).
- **Configuration:** `CNS_VAULT_ROOT` required at server start; optional `vaultRoot` in MCP config with env override precedence per architecture; `CNS_VAULT_DEFAULT_SEARCH_SCOPE` optional — if unset, `vault_search` requires explicit `scope` (no default full-vault scan); optional `CNS_OBSIDIAN_CLI` for `vault_move`.
- **Path model:** Resolve with `path.resolve` + `path.normalize`; reject `..` escape and paths outside vault root; process cwd ignored for vault resolution.
- **Protected paths:** Deny agent writes to `AI-Context/**`, `_meta/schemas/**`, direct writes to `_meta/logs/**` except append via `AuditLogger`; deny `_meta/` structural mutations; append-only `agent-log.md` only through audit module. Archives policy per architecture policy table (read + move-in cautiously; default deny blind bulk cleanup as product choice).
- **PAKE:** Parse with `gray-matter` or equivalent; normative validation from repo (`specs/cns-vault-contract/` schemas / Zod) so tests do not depend on live vault drive; applies to creates/updates outside `00-Inbox/`.
- **Secret patterns:** Repo `config/secret-patterns.json`; optional vault override merge on top; on match return `SECRET_PATTERN` without echoing matched substring.
- **vault_search:** `ripgrep` when available, else scoped Node line scan; parameters `query`, `scope` (required if no env default), `maxResults` default 50, hard cap 50; respect `.gitignore`; exclude `_meta/logs/` unless scope under logs.
- **vault_move:** Try Obsidian CLI when configured; on failure or missing CLI, filesystem move + simple `[[wikilink]]` rewrite with documented limitations.
- **Audit logging:** Target `{vaultRoot}/_meta/logs/agent-log.md`; line format `[ISO8601] | action | tool | surface | target_path | payload_summary`; payload summary SHA-256 hex of canonical JSON args truncated to 16 chars or first 120 chars of string args — never full note body.
- **MCP errors:** Stable codes `VAULT_BOUNDARY | PROTECTED_PATH | SCHEMA_INVALID | SECRET_PATTERN | NOT_FOUND | IO_ERROR | UNSUPPORTED` with message and optional details.
- **WriteGate:** Single policy choke point combining boundary, protected paths, secret scan, and PAKE — no raw `fs.writeFile` in tools that bypasses it.
- **Repository layout:** Implement under `src/` per architecture (`index.ts`, `config.ts`, `paths.ts`, `write-gate.ts`, `audit/`, `pake/`, `search/`, `obsidian/`, `tools/*`); fixture vault `tests/fixtures/minimal-vault/`; integration tests `tests/integration/`.
- **Implementation sequence (architecture):** (1) package scaffold + config + path guard, (2) audit logger + protected paths, (3) frontmatter + PAKE, (4) read tools, (5) write tools, (6) `vault_move`, (7) `vault_log_action` wired on mutators, (8) fixture integration tests + `verify.sh` green.
- **Tooling:** One tool per file under `src/tools/` recommended; naming conventions per architecture (kebab-case files, exact MCP tool names from spec).
- **Verification:** `npm test` covers boundary, secret, audit; `bash scripts/verify.sh` mandatory before claiming Phase 1 complete.
```

### UX Design Requirements

_No standalone UX design document exists for Phase 1. The PRD classifies CNS Phase 1 as a developer tool (local MCP + vault contract); visual design and store compliance are explicitly out of scope. Constitution and folder-contract UX are covered by FR1–FR6 and vault-side `AGENTS.md` / manifests, not by a separate UX spec._

```
UX-DR1: (N/A — defer UI component work until a future phase with an explicit UX specification.)
```

### FR Coverage Map

FR1: Epic 1 — Constitution loads automatically via IDE shims at vault root.  
FR2: Epic 1 — Agents read universal rules, vault map, and mission from constitution and modules.  
FR3: Epic 1 — Maintainer extends policy via modules while core constitution stays within line budget.  
FR4: Epic 2 — Locked folder contract with per-directory `_README.md` manifests.  
FR5: Epic 2 — Agents derive placement from manifests and PAKE note types.  
FR6: Epic 2 — Raw capture in Inbox without PAKE on initial create.  
FR16: Epic 2 — Routing rules place new notes in contract-correct areas by type (enforced in implementation Epic 4).  
FR7: Epic 3 — Scoped full-text search with enforced result cap.  
FR8: Epic 3 — Read full note by allowed vault-relative path.  
FR9: Epic 3 — Read parsed frontmatter for one or many paths.  
FR10: Epic 3 — List directory with metadata summaries.  
FR11: Epic 3 — Sensitive / audit paths omitted from default search unless explicitly scoped.  
FR12: Epic 4 — Create note with PAKE-compliant frontmatter outside Inbox.  
FR13: Epic 4 — Merge frontmatter updates without dropping unspecified fields.  
FR14: Epic 4 — Append to current daily note under optional section.  
FR15: Epic 4 — Authorized move/rename workflow.  
FR17: Epic 4 — Reject writes outside vault root.  
FR18: Epic 4 — Reject writes to human-only and protected paths and forbidden `_meta` structure.  
FR19: Epic 4 — Reject content matching credential patterns.  
FR20: Epic 4 — Refuse unsupported or disallowed operations (e.g. bulk) with explicit errors.  
FR21: Epic 4 — Actionable MCP errors for safety, schema, and contract violations.  
FR27: Epic 4 — `vault_move` prefers Obsidian CLI when available; else filesystem + wikilink rewrite.  
FR22: Epic 5 — Append audit record for each authorized write, update, and move with safe payload summary.  
FR23: Epic 5 — Operator can trace activity via audit file.  
FR24: Epic 5 — Human may archive or trim logs without system blocking maintenance.  
FR25: Epics 3 & 6 — Operator runs Vault IO locally (bootstrapped in Epic 3, complete with full tool surface in Epic 6).  
FR26: Epic 6 — All Phase 1 read/write capabilities exposed through Vault IO tools.  
FR28: Epic 1 — Parity of grounding journey on Cursor and Claude Code without extra per-surface paste steps.

**NFR mapping (representative):**  
NFR-P1, NFR-I1 → Epic 1 (grounding + parity docs/checklist).  
NFR-P2 → Epic 3 (`vault_search`).  
NFR-S1, NFR-S2, NFR-R1 → Epic 4 (WriteGate, PAKE, secrets, atomic writes).  
NFR-S3, NFR-R1 (audit half) → Epic 5.  
NFR-P3, NFR-R2 → Epic 6 (fixture performance tests, `verify.sh`).  
NFR-I2 → Out of scope for Phase 1 stories (documented exclusion).

## Epic List

### Epic 1: Grounded sessions without manual paste

Operators and agents start every session with constitution and mission context already loaded on Cursor and Claude Code—no copy-paste of rules or vault maps.

**FRs covered:** FR1, FR2, FR3, FR28  
**NFRs addressed:** NFR-P1 (measurement hook / checklist), NFR-I1 (parity documentation)

### Epic 2: Trustworthy vault map and routing

The vault exposes a locked folder contract, inbox behavior, and clear routing so agents place work correctly without ad-hoc paths.

**FRs covered:** FR4, FR5, FR6, FR16

### Epic 3: Scoped discovery and reading

Agents search, read, and list vault content through Vault IO with directory scope, hit caps, and sensible exclusions for sensitive areas.

**FRs covered:** FR7, FR8, FR9, FR10, FR11  
**NFRs addressed:** NFR-P2

### Epic 4: Governed creation, update, and relocation

Agents create and change notes through a single gated write path: PAKE validation, secret scanning, protected paths, and explicit errors—plus `vault_move` with Obsidian-aware fallback.

**FRs covered:** FR12, FR13, FR14, FR15, FR17, FR18, FR19, FR20, FR21, FR27  
**NFRs addressed:** NFR-S1, NFR-S2, NFR-R1

### Epic 5: Audit trail operators trust

Every mutation leaves a tamper-evident-friendly audit line without leaking full payloads; operators can inspect history and maintain log files manually.

**FRs covered:** FR22, FR23, FR24  
**NFRs addressed:** NFR-S3, NFR-R1 (audit side)

### Epic 6: Shippable Vault IO on WSL

The full Phase 1 MCP tool surface is registered, integration-tested on a fixture vault, and gated by `scripts/verify.sh`.

**FRs covered:** FR25, FR26  
**NFRs addressed:** NFR-R2, NFR-P3, NFR-I1 (MCP configuration documented alongside Epic 1)

### Epic B (Phase 2.0) — Foundation hardening from deferred-work

Harden the vault-io foundation after Phase 1: one module for PAKE type literals, reject meaningless vault roots, and document wikilink-repair scale.

**Source:** `_bmad-output/implementation-artifacts/deferred-work.md`, `_bmad-output/planning-artifacts/sprint-change-proposal-2026-04-03.md` §3.2–3.4.  
**Tracked in sprint-status as:** `epic-9` (stories `9-1` … `9-3`).

---

## Epic 1: Grounded sessions without manual paste

Operators and agents start every session with constitution and mission context already loaded on Cursor and Claude Code—no copy-paste of rules or vault maps.

### Story 1.1: Constitution core and modular policy

As a **maintainer**,  
I want **a core `AGENTS.md` constitution with bounded modules for extra policy**,  
So that **agents get universal rules and I can extend behavior without blowing the line budget**.

**Acceptance Criteria:**

**Given** the active vault’s `AI-Context/` tree exists per folder contract  
**When** a maintainer adds or edits a linked module file referenced from the core constitution  
**Then** the next agent session loads updated guidance without pasting into the chat  
**And** the core constitution file stays within the Phase 1 line budget and points to modules for depth (FR2, FR3).

### Story 1.2: IDE shims load the constitution

As an **operator**,  
I want **Cursor and Claude Code to load `AGENTS.md` automatically when I open the vault root**,  
So that **I never manually paste the constitution at session start**.

**Acceptance Criteria:**

**Given** vault root contains the agreed shim files (e.g. `CLAUDE.md`, Cursor rules) pointing at `AI-Context/AGENTS.md`  
**When** the operator opens the vault as the workspace in Cursor and in Claude Code on WSL  
**Then** each surface loads the constitution as default context without user paste  
**And** documented paths match the Phase 1 spec (FR1, FR28).

### Story 1.3: Grounding parity checklist

As an **operator**,  
I want **a short checklist documenting one-time MCP and IDE setup for both first-class surfaces**,  
So that **grounding and Vault IO journeys match on Cursor and Claude Code beyond the first open**.

**Acceptance Criteria:**

**Given** README or operator doc in repo or vault  
**When** the operator follows the checklist on WSL for Cursor and for Claude Code  
**Then** both surfaces reach task-ready state without extra per-surface manual constitution steps (beyond one-time MCP config)  
**And** the doc defines how to observe time-to-grounded for NFR-P1 spot checks (NFR-I1, NFR-P1).

---

## Epic 2: Trustworthy vault map and routing

The vault exposes a locked folder contract, inbox behavior, and clear routing so agents place work correctly without ad-hoc paths.

### Story 2.1: Per-directory manifests for the folder contract

As an **operator**,  
I want **`_README.md` manifests in contract directories that state purpose, schemas, naming, and routing**,  
So that **humans and agents share one map of the vault**.

**Acceptance Criteria:**

**Given** the Phase 1 folder contract from `CNS-Phase-1-Spec.md`  
**When** manifests are authored for each governed directory  
**Then** each manifest states purpose, allowed note types, naming expectations, and routing rules in agent-readable form  
**And** gaps are tracked against the spec (FR4).

### Story 2.2: Inbox capture semantics

As an **operator**,  
I want **`00-Inbox/` to accept raw capture without PAKE enforcement on initial create**,  
So that **I can dump inputs quickly and triage later**.

**Acceptance Criteria:**

**Given** a note created under `00-Inbox/` via Vault IO  
**When** frontmatter is minimal or absent per policy  
**Then** create succeeds without PAKE validation failure  
**And** behavior matches PRD and spec for Inbox vs governed areas (FR6).

### Story 2.3: Note-type routing table

As an **agent**,  
I want **a documented mapping from PAKE note types to default vault destinations**,  
So that **`vault_create_note` and operators agree on “correct” placement**.

**Acceptance Criteria:**

**Given** manifests and PAKE types from spec  
**When** routing rules are published (doc + implementer reference)  
**Then** each supported type maps to a contract-correct folder  
**And** ambiguous cases specify required operator or manifest disambiguation (FR5, FR16).

---

## Epic 3: Scoped discovery and reading

Agents search, read, and list vault content through Vault IO with directory scope, hit caps, and sensible exclusions for sensitive areas.

### Story 3.1: MCP package scaffold and vault root configuration

As an **operator**,  
I want **a local TypeScript MCP server that starts with a validated vault root**,  
So that **I can attach Vault IO to my IDE with predictable path behavior**.

**Acceptance Criteria:**

**Given** architecture stack (Node, TS, MCP SDK, Zod, Vitest, ESM)  
**When** the process starts with `CNS_VAULT_ROOT` set to an existing directory (and optional MCP config per architecture)  
**Then** the server initializes stdio MCP and rejects invalid or missing vault root with an actionable error  
**And** path resolution uses `path.resolve` / `normalize` and rejects traversal outside root (FR25 partial, architecture path model).

### Story 3.2: `vault_read`

As an **agent**,  
I want **to read a full note by vault-relative path**,  
So that **I can reason over file contents inside allowed areas**.

**Acceptance Criteria:**

**Given** a path inside the vault root and not blocked by read policy  
**When** I call `vault_read`  
**Then** I receive the file contents or a `NOT_FOUND` / `IO_ERROR` with stable error shape  
**And** paths outside the vault are rejected with `VAULT_BOUNDARY` (FR8, FR17 for attempted misuse).

### Story 3.3: `vault_read_frontmatter`

As an **agent**,  
I want **parsed frontmatter for one or many paths**,  
So that **I can scan metadata without loading entire bodies**.

**Acceptance Criteria:**

**Given** valid markdown files with optional YAML frontmatter  
**When** I call `vault_read_frontmatter` with allowed paths  
**Then** I receive structured frontmatter fields per path  
**And** errors follow the MCP error contract for boundary and IO failures (FR9).

### Story 3.4: `vault_list`

As an **agent**,  
I want **directory listings with metadata summaries**,  
So that **I can navigate the vault without reading every body**.

**Acceptance Criteria:**

**Given** a directory path under the vault root  
**When** I call `vault_list`  
**Then** I receive entries with metadata summaries (e.g. name, type, modified time) not necessarily full note bodies  
**And** boundary and IO errors are explicit (FR10).

### Story 3.5: `vault_search`

As an **agent**,  
I want **scoped full-text search with a hard result cap**,  
So that **I can find content without full-vault scans on WSL**.

**Acceptance Criteria:**

**Given** `query` and `scope` (required when `CNS_VAULT_DEFAULT_SEARCH_SCOPE` is unset)  
**When** I call `vault_search`  
**Then** results are limited to at most 50 hits and search never defaults to whole-vault without explicit scope configuration  
**And** `_meta/logs/` is excluded unless the scope is under logs; `.gitignore` is respected per architecture (FR7, FR11, NFR-P2).

---

## Epic 4: Governed creation, update, and relocation

Agents create and change notes through a single gated write path: PAKE validation, secret scanning, protected paths, and explicit errors—plus `vault_move` with Obsidian-aware fallback.

### Story 4.1: WriteGate — boundary and protected paths

As an **agent**,  
I want **all writes to pass a single gate that enforces vault boundary and protected directories**,  
So that **I cannot corrupt human-only or structural areas by mistake**.

**Acceptance Criteria:**

**Given** WriteGate centralizes policy per architecture (AI-Context, schemas, `_meta` rules, audit path exception)  
**When** a tool attempts a write outside root or to a denied path  
**Then** the operation fails with `VAULT_BOUNDARY` or `PROTECTED_PATH` and no partial file is committed  
**And** behavior matches FR17, FR18, NFR-S1.

### Story 4.2: PAKE validation for non-Inbox writes

As an **agent**,  
I want **frontmatter validated against repo-shipped PAKE rules outside `00-Inbox/`**,  
So that **created and updated notes stay schema-compliant**.

**Acceptance Criteria:**

**Given** Zod or JSON Schema derived from `specs/cns-vault-contract/`  
**When** I create or update a note outside Inbox with invalid PAKE fields  
**Then** the write fails with `SCHEMA_INVALID` and no inconsistent file remains (NFR-R1)  
**And** Inbox creates remain exempt per policy (FR12, FR16, FR21).

### Story 4.3: Secret pattern scanning

As an **agent**,  
I want **writes rejected when content matches configured credential patterns**,  
So that **the vault does not become a secret store**.

**Acceptance Criteria:**

**Given** `config/secret-patterns.json` and optional vault override merge  
**When** body or frontmatter string values match a pattern on create/update/append  
**Then** the write fails with `SECRET_PATTERN` and the error does not echo the matched secret  
**And** application scope matches architecture (full body + frontmatter strings) (FR19, NFR-S2, FR21).

### Story 4.4: `vault_create_note`

As an **agent**,  
I want **to create new notes in routed, contract-correct locations**,  
So that **knowledge lands in the right folder with valid PAKE when required**.

**Acceptance Criteria:**

**Given** WriteGate, PAKE validation, and secret scan  
**When** I create a note with a resolved path under the vault  
**Then** the file is written atomically (temp + rename where practical) and respects routing for note type  
**And** failures produce explicit errors without silent partial state (FR12, FR16, NFR-R1).

### Story 4.5: `vault_update_frontmatter`

As an **agent**,  
I want **to merge frontmatter updates without dropping unspecified fields**,  
So that **I can patch metadata safely**.

**Acceptance Criteria:**

**Given** an existing note outside Inbox with valid PAKE  
**When** I merge new frontmatter keys/values  
**Then** unspecified keys remain unchanged and validation re-runs on the result  
**And** failures use `SCHEMA_INVALID` or other appropriate codes (FR13, NFR-R1).

### Story 4.6: `vault_append_daily`

As an **agent**,  
I want **to append to today’s daily note under an optional section**,  
So that **I can log progress without hand-editing dailies**.

**Acceptance Criteria:**

**Given** the daily note path resolution rules from spec  
**When** I append content  
**Then** content is appended in the correct section and secret scanning applies to new content  
**And** IO and validation errors are explicit (FR14, NFR-R1).

### Story 4.7: `vault_move`

As an **agent**,  
I want **to move or rename notes preserving backlinks when Obsidian CLI is available**,  
So that **wiki links stay coherent**.

**Acceptance Criteria:**

**Given** optional `CNS_OBSIDIAN_CLI`  
**When** Obsidian CLI move succeeds  
**Then** the note is relocated per CLI behavior and backlinks remain correct  
**When** CLI is missing or fails  
**Then** filesystem move plus simple `[[wikilink]]` rewrite runs with documented limitations (FR15, FR27, FR21).

### Story 4.8: Unsupported operations surface as errors

As an **agent**,  
I want **disallowed bulk or Phase-1-out-of-scope operations to fail clearly**,  
So that **I do not assume silent success**.

**Acceptance Criteria:**

**Given** no batch write API in Phase 1  
**When** I invoke an unsupported or disallowed operation shape  
**Then** I receive `UNSUPPORTED` or equivalent with a clear message  
**And** this behavior is covered by tests where applicable (FR20, FR21).

### Story 4.9: Canonical read boundary hardening

As an **agent**,  
I want **`vault_read`, `vault_list`, and `vault_search` to reject paths whose canonical target lies outside the vault**,  
So that **symlinks cannot leak non-vault filesystem content through MCP reads** (closing the read/write asymmetry noted for Phase 1).

**Acceptance Criteria:**

**Given** a vault-relative path that is lexically under the vault but resolves through a symlink whose **canonical** target is outside the vault  
**When** a read, list, or search runs on that path  
**Then** the tool fails with `VAULT_BOUNDARY` and returns no outside content  
**And** normal paths and existing domain errors (`NOT_FOUND`, `PROTECTED_PATH`, etc.) behave as today  
**And** when canonical resolution fails with a missing path (including a **dangling symlink** / missing symlink target), the tool fails with `NOT_FOUND`, not `IO_ERROR`, except for genuinely unexpected filesystem errors (FR17 parity on the read surface; NFR-S1).

---

## Epic 5: Audit trail operators trust

Every mutation leaves a tamper-evident-friendly audit line without leaking full payloads; operators can inspect history and maintain log files manually.

### Story 5.1: AuditLogger append-only format

As a **system**,  
I want **append-only structured lines in `_meta/logs/agent-log.md`**,  
So that **operators can trust a single audit sink**.

**Acceptance Criteria:**

**Given** audit line format from architecture  
**When** AuditLogger appends a record  
**Then** the line includes ISO8601 timestamp, action, tool, surface, target path, and payload summary (hash or truncated, never full body)  
**And** direct agent writes to the log file remain forbidden (FR22, NFR-S3).

### Story 5.2: Mutations and `vault_log_action`

As an **operator**,  
I want **every authorized write, update, and move to emit an audit record**,  
So that **I can reconstruct what happened**.

**Acceptance Criteria:**

**Given** all mutating tools from Phase 1 spec  
**When** a mutation succeeds  
**Then** an audit line is appended via AuditLogger before reporting success  
**And** `vault_log_action` is implemented for explicit diagnostic logging per spec (FR22).

### Story 5.3: Operator audit playbook

As an **maintainer**,  
I want **documentation for reading and manually archiving audit logs**,  
So that **long-running vaults stay maintainable**.

**Acceptance Criteria:**

**Given** append-only logging rules  
**When** an operator trims or archives `agent-log.md` manually  
**Then** no code path blocks human maintenance  
**And** the doc explains how to correlate log lines with notes for troubleshooting (FR23, FR24).

---

## Epic 6: Shippable Vault IO on WSL

The full Phase 1 MCP tool surface is registered, integration-tested on a fixture vault, and gated by `scripts/verify.sh`.

### Story 6.1: Register full Phase 1 tool surface

As an **agent**,  
I want **all Phase 1 Vault IO tools available on the MCP server**,  
So that **I can complete read/write journeys without raw filesystem workarounds**.

**Acceptance Criteria:**

**Given** tools from `CNS-Phase-1-Spec.md` §5  
**When** the server advertises capabilities  
**Then** `vault_search`, `vault_read`, `vault_read_frontmatter`, `vault_create_note`, `vault_append_daily`, `vault_update_frontmatter`, `vault_list`, `vault_move`, `vault_log_action` are registered with Zod-validated inputs  
**And** tool names and shapes match the normative spec (FR26).

### Story 6.2: Fixture vault integration tests

As a **maintainer**,  
I want **integration tests against `tests/fixtures/minimal-vault/`**,  
So that **regressions on boundaries, secrets, audit, and search cap are caught in CI**.

**Acceptance Criteria:**

**Given** a minimal vault fixture per architecture  
**When** tests run read/write/move flows  
**Then** boundary violations, secret hits, and audit omissions fail tests explicitly  
**And** single-note operations meet the architecture p95 guidance on the fixture where measured (NFR-P3, NFR-R1).

### Story 6.3: Verification gate

As a **maintainer**,  
I want **`bash scripts/verify.sh` to run lint, typecheck, and tests**,  
So that **Phase 1 completion is objectively gated**.

**Acceptance Criteria:**

**Given** `package.json` scripts wired as documented in architecture  
**When** `scripts/verify.sh` runs in a clean checkout  
**Then** it exits zero only if lint, typecheck, and tests pass  
**And** README states that verify must pass before claiming Phase 1 done (NFR-R2).

---

## Phase 2 — Epic B: Foundation hardening (deferred-work)

### Story B.1: Shared PAKE type module for MCP and validation

As a **maintainer**,  
I want **a single source of truth for PAKE `pake_type` literals used by Zod schemas and MCP tool registration**,  
So that **`vault_create_note`, `vault_list` filters, and PAKE Standard validation never drift**.

**Acceptance Criteria:**

**Given** `src/pake/schemas.ts` defines the normative PAKE Standard types  
**When** MCP tools register enums and list filters  
**Then** they import the same schema or exported `PAKE_TYPE_VALUES` / `PakeType` — no duplicate string lists in `register-vault-io-tools.ts` or `vault-list.ts`  
**And** `VaultCreatePakeType` remains a stable alias for tool consumers  
**And** `bash scripts/verify.sh` passes.

### Story B.2: Reject filesystem root as `CNS_VAULT_ROOT`

As an **operator**,  
I want **the server to refuse startup when the vault root is the OS filesystem root**,  
So that **path boundary checks remain meaningful**.

**Acceptance Criteria:**

**Given** `CNS_VAULT_ROOT` resolves to the platform filesystem root (e.g. `/` on POSIX)  
**When** `loadRuntimeConfig` runs  
**Then** it fails with `IO_ERROR` and a clear message directing the operator to set a real vault directory  
**And** a unit test asserts this behavior  
**And** `bash scripts/verify.sh` passes.

### Story B.3: Wikilink repair scale and NFR documentation

As a **maintainer**,  
I want **architecture documentation that states the O(n) cost of fallback wikilink repair and practical scale guidance**,  
So that **operators choose Obsidian CLI when needed and we avoid surprise latency**.

**Acceptance Criteria:**

**Given** `docs/architecture.md`  
**When** Epic B documentation is complete  
**Then** it describes full-vault `.md` scan on fallback `vault_move`, O(n) in file count, low-thousands operational assumption, and preference for `CNS_OBSIDIAN_CLI`  
**And** the prior “Epic B territory” convergence note is updated to reflect the shared module that now exists  
**And** `bash scripts/verify.sh` passes.

---

## Final validation (Step 4)

### FR coverage

All FR1–FR28 are mapped in the FR Coverage Map and addressed by at least one story acceptance criterion. NFR-P1–P3, S1–S3, R1–R2, and I1 are mapped; NFR-I2 is explicitly out of scope for Phase 1.

### Architecture / starter template

Architecture selects a **TypeScript MCP package** scaffold. Per **user-value epic ordering**, the **npm/MCP scaffold is Epic 3 Story 3.1**, not Epic 1 Story 1, so that Epic 1 stays operator-facing (constitution + shims). Implementation still follows the architecture sequence after 3.1 (path guard, then reads, then WriteGate/PAKE/writes per Epics 4–6).

### Story quality and dependencies

- Stories use Given/When/Then and cite FRs/NFRs where relevant.
- Within each epic, later stories assume only earlier stories in that epic (e.g. 4.2 assumes 4.1).
- Cross-epic: Epic 3 delivers a runnable MCP server; Epics 4–6 extend that codebase—implement in dependency order (1 → 2 → 3 → 4 → 5 → 6) for a single integrated Vault IO package.

### Epic independence (notes)

Epic 1 and Epic 2 are documentation- and vault-artifact–centric and do not require Vault IO code. Epic 3+ assume the TypeScript project exists (3.1). Epic 4–6 are code increments on the same server.

**Workflow status:** Phase 1 (Epics 1–7) and Phase 2.0 (Epics 8–11) are tracked as **done** in `sprint-status.yaml` (2026-04-12). Epic **12** has Story **12.1** done and **12.2–12.8** in backlog for implementation after the Phase 2.1 Brain charter; Epics **13–14** remain planning-first slices. For the next workflow step, use **`/bmad:create-story`** for the next backlog slug under `epic-12` (see `sprint-status.yaml`), or **bmad-help** for a guided choice.

---

## Phase 2 — Epic D: Obsidian Bases panels (visibility layer)

Read-only Bases panels inside the vault give the operator at-a-glance visibility into inbox state, project status, and research coverage. Panels derive their data from PAKE frontmatter already present in vault notes and require no vault-io API calls at read time.

**Source:** `_bmad-output/planning-artifacts/sprint-change-proposal-2026-04-03.md` §Epic D.
**Tracked in sprint-status as:** `epic-11` (story `11-1`).

### Story D.1: Three read-only Bases panels

As an **operator**,
I want **`inbox-triage.base`, `project-status.base`, and `research-tracker.base` under `_meta/bases/`**,
so that **I have persistent, filter-driven visibility into inbox, project, and research state directly inside Obsidian**.

**Acceptance Criteria (summary):**

**Given** PAKE frontmatter exists on notes in `00-Inbox/`, `01-Projects/`, and `03-Resources/`
**When** the operator opens each `.base` file in Obsidian
**Then** each panel renders the correct filtered, sorted table view for its domain
**And** inline editing is not enabled (deferred to a future Epic D story)
**And** `_meta/bases/_README.md` documents panel purpose, read-only policy, and the write-capability deferral rationale
**And** `bash scripts/verify.sh` passes (no vault-io code changes in this story).

---

## Phase 2.1 — Epic 12: Brain service (embeddings, index, retrieval)

**Source:** `_bmad-output/planning-artifacts/sprint-change-proposal-2026-04-03.md` §3.1 and §3.3 (embeddings / RAG / brain deferred past Phase 2.0); implementation repo `CLAUDE.md` scope boundary (“Brain service (RAG + vector index) — Phase 2”).

This epic covers the **PAKE knowledge layer** when augmented by **semantic retrieval**: what may be indexed, how indexes stay consistent with the vault contract, how queries relate to **Vault IO** (governed read/write) versus a future **Brain** read path, and which risks (secrets, protected paths, dual-path Nexus notes) are explicitly in or out of scope. **Epic 12 begins with planning-only stories**; no vector database, indexer, or new MCP tools until a later story explicitly adds them under an updated spec.

**Tracked in sprint-status as:** `epic-12`.

### Story 12.1: Brain service scope charter for Phase 2.1

As a **maintainer**,  
I want **a single Phase 2.1 “Brain” charter in planning artifacts that freezes scope before any indexer code**,  
So that **retrieval, embeddings, and the vault stay aligned with WriteGate, PAKE, and audit policy**.

**Acceptance Criteria:**

**Given** Phase 2.0 NotebookLM workflow and Bases visibility exist and Phase 1 Vault IO behavior is unchanged in code  
**When** the charter is published under `_bmad-output/planning-artifacts/` (new file or an agreed addendum to `prd.md` / `architecture.md`)  
**Then** it names **inclusions** for Phase 2.1 Brain work (e.g., candidate corpora: which vault subtrees or note types may be embedded; operator-triggered vs scheduled reindex; read-only query API shape at a conceptual level)  
**And** it names **exclusions** (e.g., mutating the vault only through existing Vault IO tools unless a future story adds a governed mutation path; no silent bypass of `AI-Context/**` or `_meta/` protections; relationship of Brain reads to NotebookLM ingestion stated as “replace / complement / orthogonal”)  
**And** it documents **security**: how secret-bearing notes, protected paths, and incomplete PAKE notes (e.g., Nexus path) are handled or excluded from the index  
**And** it states **observability and ops**: how operators detect index drift, stale vectors, or failed embed jobs (design level, not product UI)  
**And** it lists **explicit follow-on story candidates** (bulleted) for a future SM pass, none of which are implemented in this story  
**And** **no** production vector store, embedding pipeline, or Brain MCP tool is added to `src/` or `specs/cns-vault-contract/` as part of this story; `bash scripts/verify.sh` behavior is unchanged except for optional markdown-only edits if the verify gate includes them.

### Story 12.2: Brain corpus allowlist contract

As a **maintainer**,  
I want **an operator-editable allowlist file and validation rules for corpora selection**,  
So that **indexing stays within explicit subtree and optional `pake_type` boundaries and never silently ingests protected classes**.

**Acceptance Criteria:**

**Given** the Phase 2.1 Brain charter default include/exclude corpus classes (relative to `CNS_VAULT_ROOT`)  
**When** the allowlist contract is authored and validated  
**Then** operators can express permitted subtrees and filters in one place with clear invalid-configuration handling  
**And** embedding protected paths (for example `AI-Context/**`, `_meta/**`) requires an explicit, documented opt-in path consistent with the charter’s “no silent bypass” rule  
**And** `bash scripts/verify.sh` passes for any code or schema added under this story.

### Story 12.3: Secret scan enforcement for indexing

As a **maintainer**,  
I want **never-embed exclusion when secret patterns match, with tests and non-leaking errors**,  
So that **Brain indexing does not amplify accidental secret material in the vault**.

**Acceptance Criteria:**

**Given** the same conceptual scope as WriteGate secret scanning (frontmatter string values and body) aligned with `config/secret-patterns.json` / vault override policy  
**When** the indexer considers a file for embedding  
**Then** notes matching secret patterns are excluded from the embed set and the reason is classifiable without echoing matched material  
**And** automated tests cover match, non-match, and boundary cases  
**And** `bash scripts/verify.sh` passes.

### Story 12.4: Minimal embeddings pipeline (operator-triggered)

As an **operator**,  
I want **an on-demand index build with bounded scope and deterministic outputs**,  
So that **I can refresh semantic retrieval without a shipped scheduler or daemon**.

**Acceptance Criteria:**

**Given** corpora rules from the allowlist contract and secret exclusion behavior  
**When** the operator runs the documented trigger (for example CLI or single-shot job)  
**Then** the pipeline produces bounded, reproducible artifacts for a defined corpus slice (no cron product; operator-triggered only for this story)  
**And** canonical path resolution (`realpath` or equivalent) is applied before reads per the charter’s default-safe posture  
**And** `bash scripts/verify.sh` passes.

### Story 12.5: Index manifest and drift signals

As an **operator**,  
I want **an index manifest and freshness signals**,  
So that **I can detect stale vectors, failed embeds, and drift against the vault without a shipped UI**.

**Acceptance Criteria:**

**Given** charter design expectations for manifest contents (corpus allowlist snapshot, build timestamp, counts of considered / embedded / excluded / failed, exclusion reason breakdown)  
**When** an index build completes or fails  
**Then** a machine-readable manifest (or equivalent artifact outside the default embed corpus) is written or updated for operator inspection  
**And** drift or staleness can be estimated (for example by comparing vault mtimes to last successful build) at the fidelity defined in acceptance criteria for this story  
**And** failure reporting omits raw secrets and full note bodies  
**And** `bash scripts/verify.sh` passes.

### Story 12.6: Retrieval query API (read-only)

As an **agent** or **operator**,  
I want **a read-only retrieval query interface with an explicit trust model**,  
So that **semantic recall is available without bypassing governed read paths or mutating the vault**.

**Acceptance Criteria:**

**Given** an index built under the same boundary and exclusion rules as the charter  
**When** a consumer issues a read-only query  
**Then** results are returned through the defined API shape with documented provenance limits (for example path stability after `vault_move`)  
**And** the trust model states how this path relates to Vault IO reads and that vault mutation remains only via existing Vault IO tools unless a separate story adds a governed Brain write path  
**And** `bash scripts/verify.sh` passes.

### Story 12.7: PAKE quality weighting for retrieval

As a **maintainer**,  
I want **retrieval ranking informed by PAKE metadata**,  
So that **low-quality or incomplete notes surface less often in primary results**.

**Acceptance Criteria:**

**Given** notes with `pake_type`, `status`, `confidence_score`, and related verification fields where present  
**When** query results are ranked  
**Then** documented weighting or down-ranking rules use those fields without silently promoting incomplete Nexus-origin content into the primary corpus unless explicitly allowed by policy  
**And** behavior is covered by tests on representative fixtures  
**And** `bash scripts/verify.sh` passes.

### Story 12.8: Nexus quarantine corpus

As an **operator**,  
I want **an optional separate corpus for incomplete or Nexus-origin notes with visible labeling**,  
So that **dual-path content is retrievable only when I explicitly opt in**.

**Acceptance Criteria:**

**Given** the charter’s strategies for incomplete PAKE / Nexus-origin notes (exclude, down-rank, or quarantine corpus)  
**When** the quarantine corpus is enabled in configuration  
**Then** those notes are indexed only in that corpus, labeled for operators, and excluded from the primary retrieval corpus by default  
**And** disabling the quarantine corpus returns to charter-default exclusion or down-rank behavior as specified  
**And** `bash scripts/verify.sh` passes.

---

## Phase 2.1 — Epic 13: Mobile vault access

**Source:** `_bmad-output/planning-artifacts/sprint-change-proposal-2026-04-03.md` §3.1 and §3.3 (mobile deferred to 2.1); implementation repo `CLAUDE.md` (“Mobile access — Phase 2”).

Mobile is **additive**: operators may read, search, or lightly triage from a phone or tablet without redefining Phase 1’s **first-class surfaces** (Cursor, Claude Code, Vault IO on WSL). This epic defines **who may do what, on which stack**, and how mobile sits beside **Nexus** and **Obsidian Sync** without implying a new ungoverned write hose.

**Tracked in sprint-status as:** `epic-13`.

### Story 13.1: Mobile vault access journey and governance posture

As an **operator**,  
I want **a documented mobile journey with explicit read vs write posture and links into the constitution**,  
So that **I do not accidentally treat a mobile client as a substitute for Vault IO or confuse it with the Nexus dual-path**.

**Acceptance Criteria:**

**Given** dual-path documentation for Nexus and governed Vault IO already exists in the vault or specs  
**When** the journey is published (planning artifact and/or vault module under a path that follows the folder contract, with any `AI-Context/**` edits applied by the operator if WriteGate requires it)  
**Then** it describes at least one **supported read path** (e.g., Obsidian Mobile with Sync, or SSH + terminal reader) and states required **authentication** (device, vault host, Tailscale or equivalent if used)  
**And** it states **write posture**: which mutations, if any, are allowed from mobile (default assumption: **no** direct mobile writes that bypass Vault IO unless explicitly designed and called out as operator-only risk)  
**And** it explains how mobile **coexists with Nexus** (read-only awareness, triage back to Inbox, no requirement that Nexus run on the phone)  
**And** it includes a **decision table** or bullet list: surface → allowed operations → audit expectation (e.g., “Obsidian Mobile edit on disk: not Vault IO audited”)  
**And** it adds a **constitution pointer**: exact sentence or table row the operator should add to `AGENTS.md` (or an `AI-Context/modules/` file) so agents load mobile rules without expanding Phase 1 MCP tool count  
**And** no new Vault IO tools or WriteGate changes are required for this story; verification remains documentation-led.

---

## Phase 3 — Epic 14: Multi-model routing (control plane preview)

**Source:** `_bmad-output/planning-artifacts/sprint-change-proposal-2026-04-03.md` §3.1 (multi-model routing — Phase 3); implementation repo `CLAUDE.md` (“Multi-model routing — Phase 3”).

Phase 3 routing is **CNS control-plane** work: how sessions choose models, how credentials and quotas are handled, and how policy stays consistent across IDEs and CLIs. This epic starts with a **pre-architecture readout** so later stories do not bake in one vendor’s API shape.

**Tracked in sprint-status as:** `epic-14`.

### Story 14.1: Multi-model routing pre-architecture readout

As a **maintainer**,  
I want **a readout that maps surfaces, policies, and configuration boundaries for model selection**,  
So that **Phase 3 stories can be sliced without retrofitting security or secrets handling**.

**Acceptance Criteria:**

**Given** Phase 1 and Phase 2.0 completion assumptions (Vault IO and vault contract stable)  
**When** the readout is published under `_bmad-output/planning-artifacts/` (standalone or architecture addendum)  
**Then** it lists **in-scope surfaces** (e.g., Cursor, Claude Code, future CLI or daemon mentioned only as placeholders) and, for each, whether routing is **per-session**, **per-task**, or **per-tool**  
**And** it classifies **secrets**: where API keys and org policies live (env, vault-stored config, host keychain) and what must **never** be logged or echoed  
**And** it defines **policy dimensions** at design level: default model, fallback on rate limit or outage, allowed model list, operator override rules  
**And** it calls out **dependencies** on Brain or mobile epics if routing must know about retrieval context or device class (explicit “none / soft / hard” dependency statement)  
**And** it ends with a **recommended epic breakdown** (ordered list of candidate Phase 3 epics or stories) without implementing code, daemons, or new MCP transports  
**And** no OpenClaw, always-on daemon, or router implementation ships in this story; repo code may remain untouched.

---

## Implementation track — Epic 25: Chain vault footprint control

**Goal:** Stop treating every chain scrape as a durable vault note by default, and ensure finished chain artifacts (synthesis, hooks, weapons-check) land only under governed **`03-Resources/`** with **no** stale **`00-Inbox`** drafts.

**Tracked in sprint-status as:** `epic-25`.

### Story 25.1: Stop writing SourceNotes to vault by default

As an **operator**,

I want **`scripts/run-chain.ts` to default to not persisting acquisition-tier notes** (`--save-sources` opt-in),

So that **vault hygiene stays intact while synthesis, hooks, and weapons-check still receive full research context**.

**Acceptance criteria:** See `_bmad-output/implementation-artifacts/25-1-stop-writing-sourcenotes-by-default.md` (default run: exactly three `03-Resources` outputs, zero SourceNotes, zero `00-Inbox` artifacts; `verify.sh` passes).
