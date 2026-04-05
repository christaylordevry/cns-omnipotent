# Sprint Change Proposal — Phase 2 planning (Correct Course)

**Date:** 2026-04-03
**Project:** CNS (`config.yaml`: `project_name: CNS`)
**Trigger:** Deliberate **Phase 2 scope and architecture planning** after Phase 1 foundation, with three operator-provided inputs (vision subset, Nexus integration path, deferred-work architecture inputs).
**Mode applied:** **Batch** (full proposal in one document).
**Status:** **Approved with operator revisions** (decisions recorded inline).

---

## Operator decisions (2026-04-03)

Three scope decisions were made by the operator before final approval:

1. **Epic C (ingestion):** **NotebookLM first.** Embeddings/RAG deferred to 2.1. NotebookLM is already in use; the integration is export/sync from an existing vault to an existing tool. Embeddings require vector store and indexing infrastructure that benefits from Phase 2 learnings.

2. **Nexus integration:** **P3 permanent (documented dual-path).** Nexus works, has the vault's mental model, and produces quality notes. No refactoring, no shared library extraction. Drift risk is manageable because Chris is the only operator. Mitigations:
   - Add a note to `AI-Context/AGENTS.md` acknowledging Nexus as a trusted write surface operating outside vault-io.
   - Add `_README.md` entries in directories Nexus writes to, noting that Nexus-created notes may not have full PAKE frontmatter and should be triaged.
   - **Optional enhancement:** prompt Nexus to include `pake_type` in frontmatter it generates (one-line prompt change, not a code change). Nexus already knows the frontmatter conventions from its style guide learning.

3. **Bases vs mobile:** **Bases in 2.0, mobile in 2.1.** Bases panels give vault visibility from inside Obsidian (dashboards, filtered views, status tracking). Mobile access is additive but orthogonal; Bases infrastructure supports it later.

---

## Checklist execution record

### Section 1 — Understand the trigger and context

| ID | Item | Status | Notes |
|----|------|--------|-------|
| 1.1 | Triggering story | [N/A] | Not a single implementation story; **strategic phase boundary** after Phase 1. |
| 1.2 | Core problem | [x] Done | PRD **Vision** lists six capability areas; treating Phase 2 as "ship all of them" would compound risk. **Nexus already writes to the vault** on its own path; rather than forcing convergence, Phase 2 **acknowledges** Nexus as a trusted surface and documents the dual-path model. **Deferred items** in `deferred-work.md` are classified as Phase 2 architecture inputs, not optional polish. |
| 1.3 | Evidence | [x] Done | PRD Vision (`prd.md` L114-L116); spec Phase 2 Preview (`CNS-Phase-1-Spec.md` S8); `deferred-work.md` Phase 2 backlog (wikilink O(n), PAKE enum dedup, vault root `/`); operator statement that Nexus Discord bot already has vault access and produces valued output. |

### Section 2 — Epic impact

| ID | Item | Status | Notes |
|----|------|--------|-------|
| 2.1 | Current epic | [N/A] | Phase 1 epics 1-7; change does not unwind completed Phase 1 scope. |
| 2.2 | Epic-level changes | [x] Done | **Add** a formal **Phase 2 epic set** in planning artifacts (see approved scope below). |
| 2.3 | Future epics | [x] Done | All future work ordered after the three operator decisions above. |
| 2.4 | Obsolete epics | [x] Done | None identified; spec S8 needs text update to reflect documented dual-path model for Nexus. |
| 2.5 | Resequencing | [x] Done | Order: (1) Nexus documentation + foundation hardening, (2) NotebookLM ingestion, (3) Bases panels. Mobile and embeddings deferred to 2.1. |

### Section 3 — Artifact conflicts

| ID | Item | Status | Notes |
|----|------|--------|-------|
| 3.1 | PRD | [!] Action-needed | Add **Phase 2.0 scope** section with explicit inclusions and exclusions. |
| 3.2 | Architecture | [!] Action-needed | Add **Phase 2 addendum** covering NotebookLM pipeline, Bases design, and scale assumptions. Nexus section is documentation-only (no new transport or library). |
| 3.3 | UX | [N/A] | No standalone UX spec; Bases will need its own design when that epic starts. |
| 3.4 | Other | [x] Done | `CNS-Phase-1-Spec.md` S8 updated to reflect Nexus as documented dual-path. `AGENTS.md` updated to acknowledge Nexus. |

### Section 4 — Path forward

| Option | Viable? | Notes |
|--------|---------|-------|
| 1 Direct adjustment | Partial | Insufficient alone; Phase 2 is new program work. |
| 2 Rollback | Not viable | No benefit to reverting Phase 1 foundation. |
| 3 MVP / scope review | **Viable** | **Primary:** define Phase 2.0 scope as a subset of Vision. |

**Selected approach:** **Hybrid** — Phase 2.0 MVP scope slice plus direct planning artifact updates.

### Section 5 — Proposal components

| ID | Item | Status |
|----|------|--------|
| 5.1 | Issue summary | [x] Done |
| 5.2 | Epic/artifact impact | [x] Done |
| 5.3 | Recommended path | [x] Done |
| 5.4 | MVP impact | [x] Done |
| 5.5 | Handoff | [x] Done |

### Section 6 — Final review

| ID | Item | Status |
|----|------|--------|
| 6.1 | Checklist complete | [x] Done |
| 6.2 | Proposal accuracy | [x] Done |
| 6.3 | User approval | [x] **Approved with revisions** (Nexus P3 permanent, NotebookLM first, Bases in 2.0) |
| 6.4 | `sprint-status.yaml` | [!] Defer until Phase 2 epics are named and story-mapped |
| 6.5 | Next steps | [x] Done |

---

## Section 1 — Issue summary

**Problem statement:** Phase 2 is undefined as an implementable slice. The PRD Vision names six directions (Discord/Nexus, NotebookLM, Bases, mobile, embeddings, multi-model routing). Shipping all at once would violate the Phase 1 design principle of **additive, non-compounding** expansion. `deferred-work.md` identifies scale and hygiene work (wikilink repair cost, shared PAKE schema module, meaningless vault root boundary) that must shape Phase 2 architecture and sequencing, not appear as late surprises.

**Context:** Phase 1 delivers governed Vault IO for Cursor and Claude Code. Nexus already operates on the vault successfully outside that path. Phase 2 documents the coexistence and builds the next value layer without unnecessary refactoring.

---

## Section 2 — Impact analysis

### Epic impact

- **Phase 1 (Epics 1-7):** No rollback; Epic 6/7 completion remains the Phase 1 gate.
- **Phase 2:** New epic set defined below (see S3).

### Story impact

- Future Phase 2 stories reference: Nexus as documented dual-path, NotebookLM as ingestion track, and explicit NFRs derived from wikilink O(n) and vault-root rejection behavior.

### Artifact conflicts

| Artifact | Conflict | Resolution |
|----------|----------|------------|
| `prd.md` Vision | Implies parallel tracks without priority | Add **Phase 2.0 scope** with explicit inclusions/exclusions |
| `CNS-Phase-1-Spec.md` S8 | Says "Nexus connects to Vault IO" | Amend to acknowledge **documented dual-path**: Nexus writes directly, CNS governs IDE surfaces |
| `architecture.md` | Phase 1 only | Add **Phase 2 addendum** (NotebookLM pipeline, Bases design, scale) |
| `AGENTS.md` | No mention of Nexus as write surface | Add Nexus acknowledgement in S5 (security) or S6 (modules) |
| `deferred-work.md` | Already triaged | Treat Phase 2 backlog items as **binding inputs** to Phase 2 design |

### Technical impact

- **No library extraction for Nexus.** Dual-path coexistence documented, optional `pake_type` prompt enhancement on Nexus side.
- **Shared PAKE schema module** still valuable for reducing drift within the MCP server itself (between `register-vault-io-tools` and tool modules).
- **Indexing or incremental wikilink repair** if vault scale makes full `.md` scan unacceptable.
- **Vault root `/` rejection** with tests when product agrees.

---

## Section 3 — Recommended approach (approved)

### 3.1 Phase 2.0 scope (locked)

| Vision item | Phase 2.0 | Rationale |
|-------------|-----------|-----------|
| **Discord / Nexus** | **Documentation only** (P3 dual-path + optional `pake_type` prompt) | Nexus works. Don't touch it. Document coexistence, acknowledge in AGENTS.md and _README.md manifests. |
| **NotebookLM ingestion** | **In scope** (Epic C) | Already in use; export/sync from existing vault to existing tool. Delivers immediate research value with PAKE-shaped output. |
| **Obsidian Bases** | **In scope** (Epic D) | Vault visibility from inside Obsidian: dashboards, filtered views, status tracking. Supports existing workflows. |
| **Embeddings / brain (RAG)** | **Deferred to 2.1** | Requires vector store and indexing pipeline. Benefits from Phase 2.0 learnings before design. |
| **Mobile access** | **Deferred to 2.1** | Additive but orthogonal. Bases infrastructure supports it later. |
| **Multi-model routing** | **Phase 3** per `CLAUDE.md` | No change from existing alignment. |

### 3.2 Phase 2.0 epic list (approved)

**Epic A — Nexus coexistence documentation**
Acknowledge Nexus as a trusted write surface in `AGENTS.md`. Update directory `_README.md` manifests where Nexus creates notes. Update `CNS-Phase-1-Spec.md` S8 to reflect dual-path model. Optional: prompt Nexus to include `pake_type` in generated frontmatter. **No code changes to vault-io or Nexus.**

**Epic B — Foundation hardening (deferred-work)**
- Shared PAKE schema module (deduplicate type enums from `register-vault-io-tools` and tool modules).
- Vault root at `/` rejection + tests (product decision: reject at startup with clear error).
- Wikilink repair O(n) strategy: document current limits, define NFR for acceptable vault size, or implement incremental repair if warranted by scale.

**Epic C — NotebookLM ingestion pipeline**
Export cited synthesis from NotebookLM notebooks into vault notes via PAKE schemas. Define ingestion flow: NotebookLM source material goes in, PAKE-compliant notes come out (likely SourceNote or SynthesisNote). Design the module entry in `AI-Context/modules/` for ingestion policy.

**Epic D — Obsidian Bases control panels**
Structured `.base` files in `_meta/bases/` providing filtered views into vault content: Inbox triage, project status, research source tracking. Design depends on Obsidian Bases feature set and schema conventions.

### 3.3 Nexus decision (locked: P3 permanent)

| Aspect | Decision |
|--------|----------|
| **Model** | P3: documented dual-path, permanent for single-operator vault |
| **Nexus changes** | None required. Optional: add `pake_type` to generated frontmatter (prompt-level, not code). |
| **CNS changes** | Documentation only: AGENTS.md acknowledgement, _README.md manifest notes, spec S8 amendment. |
| **Drift mitigation** | Single operator; Nexus notes triaged via Inbox conventions; optional pake_type for schema alignment. |
| **Convergence path** | Not planned. If multi-operator or audit requirements emerge, revisit P2 at that point. Explicitly: P2 is the escape hatch, not the plan. |

### 3.4 Deferred-work items as architecture inputs

| Item | Phase 2 treatment |
|------|-------------------|
| **`vault_move` wikilink repair O(n)** | Epic B: document max vault size for acceptable performance, or implement incremental repair if needed |
| **Shared PAKE schema module** | Epic B: deduplicate enums; valuable for internal MCP consistency even without Nexus convergence |
| **Vault root at `/`** | Epic B: product decision (reject at startup) + verification tests |

### 3.5 Effort, risk, timeline

- **Scope:** **Major** replan (PM + Architect for Phase 2 architecture addendum).
- **Risk:** **Low-medium.** Nexus P3 is honest about current state; drift risk accepted for single operator. NotebookLM and Bases are additive, not compounding.
- **Timeline:** Epic A is small (documentation). Epic B is medium (code hygiene + tests). Epics C and D are the heavier builds.
- **Recommended sequence:** A (unblocks everything) -> B (foundation before features) -> C (NotebookLM) -> D (Bases).

---

## Section 4 — Detailed change proposals

### 4.1 PRD (`prd.md`)

**Section:** Product Scope, after Vision.

**Add "Phase 2.0 Scope (approved 2026-04-03)":**

- Phase 2.0 delivers: Nexus coexistence documentation (P3 dual-path), foundation hardening from deferred-work (shared PAKE module, vault root policy, wikilink scale), NotebookLM ingestion pipeline, and Obsidian Bases control panels.
- Explicitly **out of Phase 2.0:** embeddings/RAG (2.1), mobile access (2.1), multi-model routing (Phase 3).
- Nexus operates as a trusted write surface outside vault-io governance. No refactoring planned. Convergence revisited only if multi-operator requirements emerge.

### 4.2 `CNS-Phase-1-Spec.md` S8 Phase 2 Preview

**Replace** "Discord / Nexus surface connects to the Vault IO layer (Nexus sends commands, vault IO executes, results return to Discord)" **with:**

"Discord / Nexus surface operates as a documented dual-path: Nexus writes directly to the vault as a trusted surface; CNS vault-io governs IDE sessions (Cursor, Claude Code). The two paths coexist without shared enforcement logic. `AGENTS.md` acknowledges Nexus as a write surface; directory manifests note Nexus-created content for triage. Convergence via shared core library (P2) is the documented escape hatch if multi-operator or audit requirements emerge."

### 4.3 Architecture (`architecture.md`)

**Add Phase 2 addendum** covering:
- **Nexus coexistence:** no architectural coupling; documentation-only integration.
- **NotebookLM pipeline:** ingestion flow, PAKE mapping, module policy.
- **Bases design:** `.base` file conventions, `_meta/bases/` structure, view types.
- **Scale:** wikilink repair NFR, vault size assumptions.

### 4.4 `AGENTS.md`

**S5 (Security Boundaries) or S6 (Active Modules):** Add acknowledgement:

"Nexus (Discord bot) is a trusted write surface that operates outside the vault-io MCP path. Nexus-created notes may lack full PAKE frontmatter; triage them like Inbox captures. This dual-path model is accepted for single-operator use."

### 4.5 `epics.md`

**Add Phase 2 epic list** (A-D as defined in S3.2 above) with placeholder FR IDs after PRD refresh.

---

## Section 5 — Implementation handoff

| Classification | **Major** |
|----------------|-----------|
| Recipients | **Product / planning:** add Phase 2.0 scope to PRD. **Architect:** Phase 2 addendum (NotebookLM, Bases, scale). **SM:** new epics in `epics.md` and `sprint-status.yaml` when story-mapped. **Dev:** no Phase 2 code until Epic A documentation and Epic B architecture inputs are done. |

**Success criteria**

- Written **Phase 2.0 scope** in PRD with explicit exclusions.
- **Nexus P3** documented in `AGENTS.md`, spec S8, and relevant `_README.md` manifests.
- **Deferred-work** three items each owned by Epic B stories.
- `sprint-status.yaml` updated after Phase 2 epic stories are mapped.
- Epic sequence: A -> B -> C -> D.

---

## Phase 2.0 exclusions (explicit)

For clarity, the following are **not in Phase 2.0**:

- **Embeddings / RAG / Brain service** — Phase 2.1. Requires vector store, indexing pipeline. Design informed by Phase 2.0 learnings.
- **Mobile access** — Phase 2.1. Blink Shell + tmux + Tailscale path is viable but orthogonal to 2.0 governance and ingestion work.
- **Multi-model routing** — Phase 3. Per `CLAUDE.md` alignment.
- **Nexus refactoring** — Not planned. P3 is the durable model for single-operator use.
- **Non-stdio MCP transport** — Not needed in 2.0 (Nexus is not being wired to MCP).

---

## Approval

**Approved** by operator on 2026-04-03 with the decisions recorded at the top of this document.

---

_Correct Course workflow complete, Chris. Proposal revised per operator decisions: NotebookLM first, P3 permanent for Nexus, Bases in 2.0, mobile in 2.1._
