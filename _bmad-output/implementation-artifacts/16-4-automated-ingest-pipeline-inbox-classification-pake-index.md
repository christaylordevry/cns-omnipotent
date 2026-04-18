# Story 16.4: Automated ingest pipeline (00-Inbox, classification, PAKE, master index)

Status: backlog

Epic: 16 (Phase 4 Tier 1 MCP and ingest)

## Story

As a **maintainer**,  
I want **an automated ingest pipeline that processes `00-Inbox/` (and aligned triggers) into governed vault notes**,  
so that **URLs, PDFs, and raw text are classified, validated against PAKE, filed to the correct location, and reflected in the master index with an audit trail**.

## References

- Normative spec: `specs/cns-vault-contract/CNS-Phase-4-Automated-Ingest-Pipeline-Spec.md`
- Constitution: `AI-Context/AGENTS.md` Sections 2 (routing), 4 (Vault IO, audit)
- Prerequisite: stories **16-1** through **16-3** done (Tier 1 MCP verified with live calls).

## Acceptance Criteria

1. **Source detection (AC: detect)**  
   **Given** inputs land in `00-Inbox/` or an equivalent staging path defined in the spec  
   **When** the pipeline runs  
   **Then** it distinguishes **URL**, **PDF**, and **raw text** (or documents explicit handling for unknown types).

2. **PAKE classification (AC: classify)**  
   **Given** detected content types  
   **When** routing decisions are applied  
   **Then** outputs map to appropriate `pake_type` (for example SourceNote for raw captures, InsightNote for single-source analysis, SynthesisNote when specified by the spec) per `AGENTS.md` and `_meta/schemas/`.

3. **Validation and write path (AC: validate)**  
   **Given** normalized note bodies and frontmatter candidates  
   **When** writes leave Inbox for governed locations  
   **Then** PAKE frontmatter is validated before commit (Vault IO or equivalent WriteGate path per implementation).  
   **And** failed validation surfaces explicit errors without partial orphan files in governed folders.

4. **Master index (AC: index)**  
   **Given** a successful ingest  
   **When** the pipeline completes  
   **Then** the **master index** (path and format per spec) is updated so new material is discoverable.

5. **Audit (AC: audit)**  
   **Given** governed mutations through Vault IO  
   **When** tools append audit lines  
   **Then** behaviour matches `CNS-Phase-1-Spec` and `AGENTS.md` Section 4 for Vault IO (append-only agent log semantics).

6. **Wiki-ingest mapping (AC: wiki-ingest)**  
   **Given** the LLM Wikid `/wiki-ingest` pattern as a conceptual reference  
   **When** this story is implemented  
   **Then** the spec or implementation notes include an explicit **field mapping** from that pattern into **PAKE** shapes (not a flat-only dump).

## Tasks / Subtasks

- [ ] Finalize `CNS-Phase-4-Automated-Ingest-Pipeline-Spec.md` open questions (trigger model, dedup keys, default types) where required for implementation.
- [ ] Implement pipeline in the CNS repo or agreed automation host; add tests per project conventions.
- [ ] Verify end-to-end: sample URL or file through to governed note + index line + audit expectation.

## Dev Agent Record

### Agent Model Used

_TBD_

### Debug Log References

_TBD_

### Completion Notes List

_TBD_

### File List

_TBD_
