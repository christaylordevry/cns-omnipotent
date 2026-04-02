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

**Workflow status:** Ready for development and Ralph/BMAD dev-story handoff. For next workflow steps, use the **bmad-help** skill if you want a guided “what to run next.”
