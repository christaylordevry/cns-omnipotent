---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-02b-vision
  - step-02c-executive-summary
  - step-03-success
  - step-04-journeys
  - step-05-domain
  - step-06-innovation
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-polish
inputDocuments:
  - _bmad-output/planning-artifacts/cns-vault-contract/CNS-Phase-1-Spec.md
  - _bmad-output/planning-artifacts/cns-vault-contract/AGENTS.md
  - _bmad-output/planning-artifacts/cns-vault-contract/README.md
  - docs/prd.md
  - docs/architecture.md
workflowType: prd
documentCounts:
  briefCount: 0
  researchCount: 0
  brainstormingCount: 0
  projectDocsCount: 2
classification:
  projectType: developer_tool
  domain: ai-orchestration-control-plane
  complexity: medium
  projectContext: brownfield
---

# Product Requirements Document - CNS (Central Nervous System)

**Author:** Chris Taylor  
**Date:** 2026-04-01  
**Product:** CNS (Central Nervous System). This repository implements the CNS control plane; the repo directory name is not the product name.

## Executive Summary

CNS (Central Nervous System) turns an Obsidian vault into a tool-agnostic control plane that orchestrates AI agents. **Phase 1** first-class surfaces are **Claude Code** and **Cursor** (WSL, end-to-end). Other surfaces (e.g. **Gemini CLI**) may be named in the constitution but are **not** Phase 1 acceptance targets. The Phase 1 outcome is a vault that those supported tools can open and immediately operate within, with shared context, shared rules, and safe defaults.

The core user value is elimination of setup friction and session re-orientation. A fresh session starts grounded, already knowing the system identity, the vault map, the current mission, how to read and write correctly, and what is off-limits. This removes repeated prompting, inconsistent note behavior, and the risk of accidental vault damage. The “delight” is calm continuity and trust, not a UI.

Phase 1 deliberately builds the substrate before expanding surfaces. It delivers a stable foundation that makes Phase 2 capabilities (Discord surface, NotebookLM ingestion, Bases panels, mobile access) additive rather than compounding inconsistency.

### What Makes This Special

CNS combines three components into one operating model: a locked folder contract, a universal constitution, and a standardized vault IO layer. Most agent setups stop at prompt craft or scattered dotfiles. CNS makes correct behavior the default through enforced structure and tool-mediated operations.

The key insight is that agent consistency is a systems problem. Contract plus constitution establishes shared expectations. Vault IO converts those expectations into repeatable read and write operations with routing, schema validation, and audit logging. The result is not “better prompts,” it is a shared execution environment where governance and continuity emerge automatically at session start.

## Project Classification

- Project Type: developer_tool (with an api_backend service component, the Vault IO MCP server)
- Domain: AI orchestration/control plane
- Complexity: medium, with explicit security and auditability guardrails
- Project Context: brownfield

## Success Criteria

### User Success

- Time-to-grounded: From opening Cursor or Claude Code in the vault directory, the agent reaches productive execution-ready state in < 30 seconds, requiring only the user’s initial task prompt.
- Zero re-orientation requirements:
  - 0 manual pasting of system prompts, behavioral guidelines, or AGENTS.md constitution content
  - 0 reminders required for PAKE frontmatter schemas and note types
  - 0 manual directory mapping or routing instructions for the vault folder contract

### Business Success

- First-action correctness: > 85% of sessions achieve a correct first agent action without any human fix-up (no initial correction loop).

### Technical Success

- Safety: 100% of attempted writes outside the defined vault boundaries (and any protected directories, as defined by Phase 1 policy) are blocked.
- Schema compliance: 100% of notes created or modified outside 00-Inbox contain valid, PAKE-compliant frontmatter.
- Auditability: 100% of write, update, and move operations are recorded in _meta/logs/agent-log.md.
- Tool compatibility: 100% operational in a WSL environment for both Claude Code and Cursor (end-to-end, not theoretical compatibility).

### Measurable Outcomes

- Session startup benchmark: Median time-to-grounded < 30 seconds for Cursor and Claude Code sessions, measured across a representative set of fresh sessions.
- Operator efficiency: First-action correctness rate > 85%, measured across sessions over a defined tracking window (e.g., 2 weeks) using a consistent definition of “first action” and “fix-up.”
- Governance guarantees:
  - Write-boundary violations blocked: 100%
  - Non-Inbox PAKE compliance: 100%
  - Agent log entries for vault mutations: 100%

## Product Scope

Summary of MVP, growth, and vision. Strategic MVP philosophy, explicit Phase 1 exclusions, and risk mitigations live in **Project Scoping & Phased Development**.

### MVP - Minimum Viable Product

Phase 1 MVP is complete when the CNS foundation works end-to-end locally:

- Vault Folder Contract implemented with the locked directory structure and agent-readable manifests (_README.md contracts).
- AGENTS.md Constitution exists, is tool-loadable by default, and stays within its line budget via modularization.
- Vault IO Layer is a fully working MCP server running locally end-to-end, exposing the full Phase 1 tool surface (per CNS-Phase-1-Spec, including `vault_search` through `vault_log_action`) and enforcing:
  - vault boundary write blocking
  - PAKE frontmatter validation for non-Inbox notes
  - required audit logging to _meta/logs/agent-log.md
- Tool shims for Cursor and Claude Code so that opening the vault directory loads the constitution automatically.

### Growth Features (Post-MVP)

- Expand input surfaces beyond Cursor and Claude Code (e.g., Gemini CLI hardening and QA’d workflows).
- Higher-fidelity measurement and dashboards for first-action correctness and time-to-grounded (beyond basic logging).
- Broader policy module set (more domains beyond vault IO and security) while keeping constitution compact.

### Vision (Future)

- Discord / Nexus surface, NotebookLM ingestion, Obsidian Bases control panels, mobile access, embeddings, and multi-model routing, all built on the stable Phase 1 substrate.

## User Journeys

### Journey 1: Primary Operator, Success Path (Fresh Session to Productive Work)

Chris opens Cursor or Claude Code in the vault root. The tool immediately loads the constitution (AGENTS.md) and the vault folder contract as active system context. Chris types a minimal task prompt such as “Draft a new PRD for the billing module.” The agent reads the relevant directory contract (e.g. 01-Projects/_README.md) to route correctly, then uses vault_create_note to create a strictly PAKE-compliant note in the right location. The operation is logged automatically. Within 30 seconds, the system is executing productively with zero manual rule pasting, schema reminders, or directory mapping.

### Journey 2: Primary Operator, Edge Case (Out-of-Bounds or Protected Write Attempt)

Chris asks for a potentially destructive change such as “Clean up the old config files and rewrite the core routing logic.” The agent attempts to write directly to a protected core directory using standard file operations. The Vault IO layer intercepts the request, blocks the operation, and returns a strict boundary violation error. The agent halts, preserves session continuity, and prompts Chris for safe parameters or an alternate permitted path. The outcome is zero data corruption, with the agent learning constraints via tool feedback instead of proceeding unsafely.

### Journey 3: Admin/Ops (Evolve Contracts Without Breaking Workflow)

Chris needs to extend the system by adding a new “Meeting Note” PAKE schema and updating inbox triage rules. Chris edits _meta/schemas/ to add the schema definition and updates AI-Context/AGENTS.md to reference the change (or point to a module). The system behavior updates without requiring server restarts or recompilations. In the next fresh session, the agent immediately follows the new schema and triage routing, proving that contracts are first-class and runtime-effective.

### Journey 4: Audit/Troubleshoot (Explain and Correct a Bad Outcome)

Chris finds a poorly formatted note in the wrong project folder and needs to understand the cause. Chris inspects _meta/logs/agent-log.md and searches for the filename. The log reveals timestamp, tool used (e.g. vault_create_note), the initiating surface (Cursor vs Claude Code), and the payload passed. Chris identifies the misunderstanding (schema or routing), fixes the artifact, and updates the relevant manifest (_README.md) to prevent recurrence. The system becomes more reliable via explicit contract refinement.

### Journey Requirements Summary

- Instant context load: Cursor and Claude Code startup must reliably load constitution and contract context without manual pasting.
- Contract-driven routing: Agents must consult directory manifests (_README.md) before creating or moving notes.
- MCP-first write path: Note creation and mutation must go through Vault IO tools (not ad-hoc filesystem writes) to enforce schema, routing, and logging.
- Hard safety boundaries: Writes outside vault boundary and protected directories must be blocked with explicit errors that preserve session continuity.
- Schema enforcement: All non-Inbox notes must be PAKE-compliant on create and update.
- Audit logging fidelity: All mutations must log timestamp, tool, target, initiating surface, and enough detail to diagnose failures.
- Contract evolution loop: Updating schemas/manifests/modules must take effect immediately in subsequent sessions, supporting rapid refinement.

## Domain-Specific Requirements

### Compliance & regulatory

- **Secret-pattern blocking (formal Phase 1):** Any write that matches patterns consistent with API keys, tokens, passwords, or credentials must be **rejected at the Vault IO layer** with an explicit error. This is not optional for a control plane.
- **Log content policy (hard rule from day one):** Logs must support debugging without storing sensitive or bulky content. **Never log full payloads or raw note bodies.** Log: timestamp, tool name, target path, initiating surface, and a **truncated or hashed payload summary** only. No retention-window requirement in Phase 1 (local vault, single operator).

### Technical constraints

- **Protected directories (agent write model):**
  - `AI-Context/`: **human-edit-only**; no agent writes.
  - `_meta/schemas/`: **human-edit-only**; agents may read.
  - `_meta/logs/`: **append-only via the audit logger**; no direct agent edits or deletes.
  - `_meta/` root: **no agent-initiated structural changes** (no new subdirs, no moves initiated by agents).
- **WSL / search performance (formal):** No full-vault scans. `vault_search` must accept a **directory scope** parameter and **default to scoped search**. **Max 50 results per call.** Batch operations are **post-MVP**.

### Integration requirements

- **First-class surfaces (Phase 1):** **Cursor** and **Claude Code** are equally required: end-to-end operational in WSL, not theoretical.
- **Deferred:** **Gemini CLI** is explicitly **not** QA’d or guaranteed in Phase 1; it may be **acknowledged** in the constitution as a future/supported surface without Phase 1 acceptance criteria.

### Risk mitigations

- **Secret leakage:** Pattern-based rejection + no full-payload logging reduces vault-as-secret-store risk.
- **Audit tampering:** Append-only logs via dedicated logger; no direct agent edits to `_meta/logs/`.
- **Constitution drift:** `AI-Context/` human-only reduces accidental automated rewrites of system identity.
- **Performance on WSL:** Scoped search + result cap avoids full-vault I/O spikes.

### Implementation clarifications (architecture / technical spec follow-up)

- **Secret-pattern scoping:** Define where patterns apply (e.g. frontmatter values and note body on write), and where the pattern library lives (e.g. configurable under `_meta/schemas/` or an adjacent contract). Resolves ambiguity for implementers.
- **Log growth:** Log rotation or archival is **out of scope for Phase 1**, but the append-only rule must **not** prevent a human from manually archiving or trimming log files when needed. Prevents “append-only with no escape valve” from blocking later Phase 2 operations.
- **`vault_move` / FR27:** Architecture must match Phase 1 spec behavior: use **Obsidian CLI** for moves when Obsidian is running so **backlinks are preserved**; when the CLI is unavailable, use **filesystem move** plus **wikilink find-and-replace** (manual or automated) as the authorized fallback. FR27 restates this at requirement level; architecture locks interfaces and edge cases.
- **Vault IO implementation runtime:** The PRD does not mandate a language. **Preferred direction:** **TypeScript on Node**, aligned with the existing PAKE MCP prototype (`@anthropic/mcp-server`, `tsx`). The **architecture document must select and lock** the runtime, package shape, and how the server is invoked locally.
- **`vault_search` result cap:** **NFR-P2** adds a **maximum of 50 results per call** and a scoped default (PRD addition for WSL performance, beyond the original Phase 1 spec text). Architecture and the normative tool contract (and `CNS-Phase-1-Spec.md` if treated as source of truth) must stay aligned with this cap.

## Innovation & Novel Patterns

### Detected innovation areas

- **Vault as operational control plane:** Knowledge is not only read for context; it is governed by **enforced structure** and **mediated writes**, so agent behavior defaults to correct routing, schema, and safety without re-teaching each session.
- **Triple fusion:** Locked **folder contract**, universal **AGENTS.md** constitution with modules, and **Vault IO (MCP)** as the single path for governed mutations. Most stacks have at most one or two of these; combining all three yields continuity and auditability that prompts alone cannot.
- **Session-zero grounding:** Design target is that a new session behaves as if it has **memory and discipline** because the environment supplies them, not because the user pasted rules.

### Market context & competitive landscape

- Typical alternatives are **ad-hoc prompts**, **dotfiles**, or **README-only** vault conventions. They improve consistency locally but do not **enforce** routing, schema, or audit logs at the tool boundary. CNS is closer to **infrastructure for agents** than to a better static doc.
- Comparable mental models: **policy-as-code**, **linted writes**, **API gateway** for files. The novelty is applying that to a **personal/team Obsidian vault** with PAKE semantics and multi-tool surfaces.

### Validation approach

- **Phase 1 proof:** Live local MCP server with the full Phase 1 Vault IO tool surface, WSL + Cursor + Claude Code end-to-end; measurable **time-to-grounded** and **first-action correctness**; **100%** boundary blocks, schema compliance outside Inbox, and append-only audit logging with no full-payload logs.
- **Regression signal:** Failed runs should surface as **tool errors and log lines**, not silent vault corruption.

### Risk mitigation

- **Innovation risk:** If agents bypass Vault IO and use raw filesystem writes, governance does not apply. Mitigation: constitution + journeys that assume **MCP-first** writes; implementation should make the happy path obvious.
- **Paradigm risk:** Over-tight patterns could block legitimate content. Mitigation: **configurable** secret patterns and scoped application (per architecture follow-up).
- **Adoption risk:** If setup is heavy, “zero re-orientation” fails. Mitigation: shims and single vault root workflow.

## Developer Tool Specific Requirements

### Project-type overview

CNS Phase 1 delivers a **developer-facing tool**: a **local MCP server** (Vault IO) plus **vault contract and constitution** so agents use a **stable API surface** for reads and writes instead of ad-hoc filesystem access. **Visual design and store compliance** are out of scope per project type.

### Technical architecture considerations

- **Distribution model:** Local MCP process bound to a configured vault root; must run **end-to-end on WSL** for Phase 1 QA.
- **Surfaces:** **Cursor** and **Claude Code** are equally first-class; **Gemini CLI** is deferred from Phase 1 acceptance.
- **Governance:** Tool calls enforce boundaries, PAKE validation outside `00-Inbox/`, secret-pattern rejection, and append-only audit logging with truncated or hashed payload summaries only.

### Language matrix

| Component | Phase 1 requirement |
|-----------|------------------------|
| Vault IO (MCP server) | **Architecture locks** language and runtime. **Expected choice:** TypeScript on Node (PAKE MCP prototype: `@anthropic/mcp-server`, `tsx`). Must ship as a runnable local server with MCP tool registration. |
| Vault contract / notes | Markdown + YAML frontmatter (PAKE); LF line endings (WSL). |
| Agent surfaces | Cursor and Claude Code (tooling as defined by those products). |

### Installation methods

- **Operator installs** the Vault IO MCP server **locally** (exact package manager and command: **TBD in architecture**; expected **TypeScript/Node** per language matrix), with configuration pointing at **`Knowledge-Vault-ACTIVE/`** (or equivalent vault root).
- **Tool shims** at vault root (e.g. `CLAUDE.md`, Cursor rules) so opening the vault in the supported IDEs loads **AGENTS.md** without manual paste.
- **No** app-store or end-user installer requirement in Phase 1.

### API surface

- **MCP tools** (Phase 1): all Vault IO tools defined in the Phase 1 spec: `vault_search`, `vault_read`, `vault_read_frontmatter`, `vault_create_note`, `vault_append_daily`, `vault_update_frontmatter`, `vault_list`, `vault_move`, `vault_log_action`.
- **Search:** `vault_search` must support **scoped directory** and **max 50 results**; no full-vault scan default.
- **Errors:** Boundary violations, schema failures, and secret-pattern hits return **explicit, machine-readable errors** to the agent.

### Code examples

- **Documentation and repo examples** must show **correct** usage: e.g. creating a note via `vault_create_note` with PAKE fields, not raw file writes for governed notes.
- **Example snippets** (exact syntax **TBD** with implementation language): minimal MCP invocation patterns for “create note,” “append daily,” “update frontmatter,” and “log-only” troubleshooting flows.
- Examples must **not** encourage writing secrets into the vault.

### Migration guide

- **From:** Ad-hoc prompts, loose conventions, or unconstrained filesystem edits.
- **To:** Open vault in `Knowledge-Vault-ACTIVE/`, load **AGENTS.md** via shims, route work through **Vault IO** for mutations, align notes with **folder contract** and **PAKE** outside Inbox.
- **Brownfield:** Existing notes may need **triage** from `00-Inbox/` and manual or assisted migration; Phase 1 does not require a bulk migration tool (deferred if needed).

### Implementation considerations

- **Developer experience:** First-action correctness and time-to-grounded drive API clarity and error messages.
- **Testing:** Unit and integration tests against a **fixture vault** are expected for the MCP server (detail in architecture).
- **Bypass risk:** Constitution and docs should steer agents to **MCP-first** writes; implementation may add friction or warnings for raw writes outside the contract (architecture decision).

## Project Scoping & Phased Development

### MVP strategy & philosophy

**MVP approach:** Platform MVP. Ship the **vault folder contract**, **AGENTS.md constitution** (with modules), and **live local Vault IO MCP server** so agents are constrained by real gates, not docs alone. Validate with **time-to-grounded**, **first-action correctness**, and **100%** enforcement on boundaries, schema (outside Inbox), and audit logs.

**Resource requirements:** Small team acceptable; core skills are **MCP server implementation**, **filesystem + path safety**, **YAML/frontmatter validation**, **WSL** development and test, and **Cursor + Claude Code** wiring. No separate QA organization is required for Phase 1 if automated verification and fixture-vault tests cover the critical path.

### MVP feature set (Phase 1)

**Core user journeys supported:** Fresh-session productive work; blocked out-of-bounds writes; admin contract evolution; audit and troubleshoot via `agent-log.md`.

**Must-have capabilities:**

- Locked **Knowledge-Vault-ACTIVE** folder contract with `_README.md` manifests.
- **AGENTS.md** (and shims) so **Cursor** and **Claude Code** load the constitution **without manual paste**.
- **Vault IO MCP** running locally with the full Phase 1 tool surface, including **scoped search** with a **bounded maximum result count**, **secret-pattern rejection**, **protected-directory rules**, and **append-only** logging with **no full-payload** logging.
- **PAKE** compliance for create and update **outside `00-Inbox/`**.
- **WSL** end-to-end operation for both supported IDEs.

**Explicitly out of Phase 1:** Gemini CLI QA, batch vault operations, automated log rotation, Discord, NotebookLM, Bases, mobile, embeddings, and multi-model routing (per Phase 1 roadmap).

### Post-MVP features

**Phase 2 (growth):** Additional surfaces (for example Gemini CLI hardening), richer metrics or dashboards for first-action correctness, optional bulk migration aids, broader policy modules.

**Phase 3 (expansion):** Discord or Nexus, NotebookLM ingestion, Obsidian Bases, mobile access, embedding layer, multi-model routing, as deferred in the Phase 1 specification.

### Risk mitigation strategy

**Technical risks:** MCP correctness and bypass via raw filesystem writes. **Mitigation:** tests on a fixture vault, explicit tool errors, constitution that steers MCP-first writes; architecture may add warnings when bypass is detected. Hardest sub-problems include **path canonicalization** on WSL, **schema validation** behavior, and **false positives** on secret patterns (addressed via configurable patterns and the architecture pass).

**Market or operator risks:** Operators may still find pasting prompts faster. **Mitigation:** success metrics tied to **first-action correctness** and **zero paste**; if metrics miss, tighten shims and tool defaults before adding features.

**Resource risks:** Scope creep into Phase 2 surfaces. **Mitigation:** keep Phase 1 acceptance aligned with **CNS-Phase-1-Spec** and the project verify gate; defer anything outside the three Phase 1 deliverables.

## Functional Requirements

### Constitution and session context

- **FR1:** Operator can open each Phase 1 first-class agent surface at the vault root and have the constitution load automatically without manually pasting it.
- **FR2:** Agent can access universal behavior rules, vault map, and current mission context from the constitution and linked modules without the operator restating them.
- **FR3:** Maintainer can add or adjust bounded policy in modules while keeping the core constitution within the Phase 1 line budget.

### Vault structure and contracts

- **FR4:** Operator can rely on a locked folder contract with per-directory manifests that state purpose, schema requirements, naming expectations, and routing rules.
- **FR5:** Agent can determine correct placement for new or moved notes using directory manifests and PAKE note types.
- **FR6:** Operator can capture raw inputs in an Inbox area without PAKE on initial capture.

### Reading and discovering content

- **FR7:** Agent can run full-text search limited to an operator- or tool-specified directory scope, with a system-enforced upper bound on the number of hits returned per request.
- **FR8:** Agent can read a full note by vault-relative path when the path is allowed.
- **FR9:** Agent can read parsed frontmatter only for one or many paths when allowed.
- **FR10:** Agent can list a directory with metadata summaries (not necessarily full bodies) when allowed.
- **FR11:** System can omit designated sensitive or audit-only locations from default search unless explicitly scoped.

### Writing and mutating content

- **FR12:** Agent can create a new note with PAKE-compliant frontmatter for paths outside the Inbox when allowed.
- **FR13:** Agent can merge updates into existing frontmatter without discarding unspecified fields when allowed.
- **FR14:** Agent can append content to the current daily note under an optional section when allowed.
- **FR15:** Agent can move or rename a note through an authorized path-change workflow when allowed.
- **FR16:** System can place new notes in the contract-correct area based on note type and routing rules.

### Safety and access control

- **FR17:** System can reject any write whose resolved path lies outside the configured vault root.
- **FR18:** System can reject agent-initiated writes and structural changes in human-only and protected areas per Phase 1 policy (including constitution, schemas, logs, and `_meta` structure).
- **FR19:** System can reject writes whose content matches configured credential patterns.
- **FR20:** System can refuse operations that Phase 1 does not authorize (including disallowed destructive or bulk actions).
- **FR21:** Agent can receive explicit, actionable errors when a request violates safety, schema, or contract rules.

### Audit and diagnostics

- **FR22:** System can append an audit record for each authorized write, update, and move with timestamp, tool identity, target path, initiating surface, and a truncated or hashed summary of inputs (never a full payload or raw note body).
- **FR23:** Operator can trace prior agent activity using audit records to explain how a note came to exist or change.
- **FR24:** Maintainer can manually archive or trim audit log files without the append-only rule preventing human maintenance.

### Vault IO integration

- **FR25:** Operator can run Vault IO locally against a configured vault root for end-to-end sessions with Phase 1 first-class agent surfaces.
- **FR26:** Agent can perform Phase 1 read and write capabilities through Vault IO when following the recommended workflow.
- **FR27:** Agent can move or rename a note via `vault_move` such that when **Obsidian is running**, relocation uses **Obsidian CLI** so **backlinks stay correct**; when Obsidian CLI is **not** available, the system uses **filesystem move** plus **wikilink find-and-replace** (as specified in Phase 1) as the fallback path.

### Multi-surface parity

- **FR28:** Operator can complete the same Phase 1 grounding and governed IO journeys on each Phase 1 first-class agent surface without extra manual setup for that surface.

## Non-Functional Requirements

### Performance

- **NFR-P1:** For each Phase 1 first-class agent surface, the **median** time from opening the workspace at the vault root to the agent being able to execute the user’s first task **without** manual constitution or routing paste is **under 30 seconds**, measured over a representative set of fresh sessions.
- **NFR-P2:** Default search behavior must not perform a **full-vault** scan; search must use a **directory scope**, and each search request must return **at most 50** results. (PRD addition for WSL performance; propagate to architecture and the Vault IO tool contract.)
- **NFR-P3:** Typical single-note read and write operations through Vault IO complete within **interactive** latency on the Phase 1 target environment (WSL), as validated by automated tests on a fixture vault and spot checks on a real vault (exact p95 threshold to be set in architecture; must not block the 30-second grounding target).

### Security

- **NFR-S1:** The system must **block 100%** of writes that resolve outside the configured vault root or into Phase 1 **protected** paths (constitution, schemas, logs, disallowed `_meta` structure), with a clear error to the caller.
- **NFR-S2:** Writes that match **configured** credential patterns (scope for application defined in the architecture pass: e.g. frontmatter values and note body) must be **rejected** with a clear error.
- **NFR-S3:** Audit records must **never** store full write payloads or raw note bodies; only **truncated or hashed** summaries alongside metadata defined in domain requirements.

### Reliability and integrity

- **NFR-R1:** Authorized mutations must either **commit** with correct PAKE validation (outside Inbox) and a corresponding audit line, or **fail** with an explicit error; **no silent partial writes** that leave the vault inconsistent without a detectable signal.
- **NFR-R2:** Phase 1 completion requires the project **verification gate** (`scripts/verify.sh` or successor) to **pass**, so regressions on the critical path are caught before release.

### Integration

- **NFR-I1:** On the Phase 1 target OS environment (**WSL**), **Cursor** and **Claude Code** must each support the same grounding and Vault IO–mediated journeys without extra per-surface manual steps beyond one-time local MCP configuration.
- **NFR-I2:** **Gemini CLI** is **out of scope** for Phase 1 QA and acceptance; no NFR asserts parity for that surface in Phase 1.

