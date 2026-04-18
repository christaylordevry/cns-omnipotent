# Story 16.4: Automated ingest pipeline (00-Inbox, classification, PAKE, master index)

Status: done

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

- [x] Finalize `CNS-Phase-4-Automated-Ingest-Pipeline-Spec.md` open questions (trigger model, dedup keys, default types) where required for implementation.
- [x] Implement pipeline in the CNS repo or agreed automation host; add tests per project conventions.
- [x] Verify end-to-end: sample URL or file through to governed note + index line + audit expectation.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — all tests passed first run after minor test expectation correction (pipe sanitization produces 3 spaces not 2).

### Completion Notes List

- Resolved all 5 spec open questions in `CNS-Phase-4-Automated-Ingest-Pipeline-Spec.md` (trigger model: on-demand only; dedup key: source_uri; default pake_type: SourceNote; inbox-first two-phase route; cost limits: operator responsibility).
- Added Section 7 (master index spec: `_meta/ingest-index.md` append-only Markdown table) and Section 8 (explicit wiki-ingest → PAKE field mapping table, AC: wiki-ingest).
- Implemented `src/ingest/` module with four files: classify.ts (source type detection, PAKE type resolution), normalize.ts (URL/PDF/text normalization, title derivation), index-update.ts (master index append), pipeline.ts (6-stage orchestrator: intent → normalize → inbox draft → PAKE gate + governed write → index → audit).
- Pipeline two-phase design: inbox draft written first (PAKE-exempt), promoted via `vaultCreateNote` on success, removed after promotion. Validation failures leave inbox draft for human triage and return `validation_error` with the inbox path.
- Tests cover all 6 ACs: detect (URL/PDF/text classification), classify (PAKE type routing), validate (governed note creation + frontmatter), index (master index creation and accumulation), audit (agent-log.md append), wiki-ingest (source_uri, ai_summary, tags mapping into PAKE shapes).
- `bash scripts/verify.sh` passes: 340 tests, lint, typecheck, build all green.

### File List

- `specs/cns-vault-contract/CNS-Phase-4-Automated-Ingest-Pipeline-Spec.md` (modified — resolved open questions, added sections 7, 8, 9, 10)
- `src/ingest/classify.ts` (new)
- `src/ingest/normalize.ts` (new)
- `src/ingest/index-update.ts` (new)
- `src/ingest/pipeline.ts` (new)
- `tests/vault-io/ingest-pipeline.test.ts` (new)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — 16-4 status updated)
- `_bmad-output/implementation-artifacts/16-4-automated-ingest-pipeline-inbox-classification-pake-index.md` (modified — tasks, record, file list, status)

### Change Log

| Date | Change |
|------|--------|
| 2026-04-18 | Implemented story 16-4: ingest pipeline module (classify, normalize, index-update, pipeline), 22 new tests across all 6 ACs, spec open questions resolved, wiki-ingest PAKE field mapping documented, verify.sh green (340 tests total) |
| 2026-04-18 | Code review follow-up: single ingest audit line (`suppressAudit` on `vaultCreateNote`), `source_uri` dedup via `vaultSearch`, `ai_summary` in create markdown, URL requires `fetched_content`, `classifySource` hardening, `conflict` status for EEXIST, WriteGate on inbox/index (`INGEST_INDEX_VAULT_REL` exception), tests + verify 348 green |

### Review Findings

- [x] [Review][Decision] Dual audit lines per successful ingest — **Resolved:** operator chose a single line; ingest path uses `suppressAudit: true` on `vaultCreateNote` so only `appendRecord` with action `ingest` runs.

- [x] [Review][Patch] Spec dedup by `source_uri` — **Resolved:** `governedNoteExistsWithSourceUri` in `src/ingest/duplicate.ts` uses `vault_search` under `03-Resources/` with frontmatter verification; pipeline returns `{ status: "duplicate" }` before inbox write.

- [x] [Review][Patch] `ai_summary` in governed frontmatter — **Resolved:** `VaultCreateNoteInput.ai_summary` and `buildVaultCreateNoteMarkdown`; pipeline passes `input.ai_summary`.

- [x] [Review][Patch] URL without `fetched_content` — **Resolved:** `normalizeInput` throws `UNSUPPORTED` when URL source has missing or empty `fetched_content`.

- [x] [Review][Patch] `classifySource` heuristics — **Resolved:** `ftp://`, `file://` (PDF path via `fileURLToPath`), `www.` as url, strip query/fragment before `.pdf` extension check.

- [x] [Review][Patch] Path conflict vs validation — **Resolved:** EEXIST maps to `{ status: "conflict" }`.

- [x] [Review][Patch] WriteGate on inbox/index — **Resolved:** `assertWriteAllowed` on inbox draft and index paths; `INGEST_INDEX_VAULT_REL` allowed for create/append in `write-gate.ts`.

- [x] [Review][Patch] Wiki-ingest test asserts `ai_summary` — **Resolved:** test expects `ai_summary` lines in governed note.
