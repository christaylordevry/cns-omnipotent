# Story 12.1: Brain service scope charter (Phase 2.1)

Status: done

<!-- Sprint tracker: epic-12 / 12-1-brain-service-scope-charter-phase-21. Planning-only: publish charter under planning artifacts. No vector store, indexer, or new MCP tools in this story. -->

## Story

As a **maintainer**,
I want **a single Phase 2.1 “Brain” charter in planning artifacts that freezes scope before any indexer code**,
so that **retrieval, embeddings, and the vault stay aligned with WriteGate, PAKE, audit policy, and the documented Nexus dual-path**.

## Acceptance Criteria

1. **Publication location**
   **Given** Phase 2.0 NotebookLM workflow and Bases visibility exist and Phase 1 Vault IO behavior must remain unchanged in implementation code for this story
   **When** the charter is finished
   **Then** it is published as a **new** markdown file under `_bmad-output/planning-artifacts/` **or** as an explicitly titled addendum section in `prd.md` and/or `architecture.md` with a pointer from the other artifact so operators can find it in one hop
   **And** the file (or addendum) name makes “Phase 2.1 Brain charter” obvious (for example `brain-service-phase-2-1-charter.md`).

2. **Inclusions (what Phase 2.1 Brain may cover)**
   **Given** the epic goal is semantic retrieval on top of PAKE
   **When** the charter is read
   **Then** it states **candidate corpora**: which vault subtrees and/or `pake_type` sets may be embedded (be explicit about `00-Inbox/`, `AI-Context/**`, `_meta/`, Nexus-origin notes)
   **And** it states **indexing trigger model**: operator-triggered vs scheduled reindex (design level; no cron product)
   **And** it describes a **conceptual** read-only query API (how a future Brain read path relates to Vault IO reads: separate service, shared vault root, no silent bypass of governed paths).

3. **Exclusions (hard boundaries)**
   **Given** Vault mutations today are governed through Vault IO for IDE agents
   **When** the charter is read
   **Then** it states that **vault mutation** remains only through existing Vault IO tools unless a **future** story adds a governed mutation path for Brain
   **And** it states **no silent bypass** of `AI-Context/**` or `_meta/` protections for any automated indexer (same spirit as WriteGate: if something ingests the vault, it must respect the same path classes or explicitly exclude them with rationale)
   **And** it states the **NotebookLM vs Brain** relationship as exactly one of: *replace*, *complement*, or *orthogonal*, with one paragraph of reasoning (see `AI-Context/modules/notebooklm-workflow.md` and Story 10-1 pattern when citing ingestion).

4. **Security**
   **Given** secrets must not enter the vault and some notes may be incomplete (Nexus path)
   **When** the charter is read
   **Then** it covers **secret-bearing notes**: exclusion rules, redaction, or “never embed” policy
   **And** **protected paths** and incomplete PAKE notes (Nexus-created files in governed folders) and how they are excluded or down-ranked in an index
   **And** it references constitution and security module for trust boundaries: [Source: `specs/cns-vault-contract/modules/security.md`], [Source: `specs/cns-vault-contract/AGENTS.md` Section 4–6].

5. **Observability and operations (design level)**
   **Given** operators must trust index freshness
   **When** the charter is read
   **Then** it describes how operators would **detect** index drift, stale vectors, or failed embed jobs (signals, logs, metrics placeholders; not a shipped UI)
   **And** it does not require implementing those signals in this story.

6. **Follow-on story candidates**
   **Given** this story only freezes scope
   **When** the charter is read
   **Then** it ends with a **bulleted list** of explicit follow-on story candidates for a future SM pass (each bullet is a potential story title + one line intent)
   **And** none of those bullets are implemented in this story.

7. **Implementation boundary (non-negotiable)**
   **Given** Epic 12 opens with planning-only work
   **When** the PR is ready
   **Then** **no** production vector store, embedding pipeline, or Brain MCP tool is added under `src/` or new normative contracts under `specs/cns-vault-contract/` for Brain-specific tools
   **And** `bash scripts/verify.sh` behavior is unchanged: the gate runs `npm test`, `lint`, and `typecheck` only; markdown under `_bmad-output/planning-artifacts/` does not alter the gate unless someone adds a new check (do not add one in this story).

## Tasks / Subtasks

- [x] **AC #1:** Choose charter filename vs prd/architecture addendum; create the artifact under `_bmad-output/planning-artifacts/` (or edit prd/architecture with clear section headers and cross-links).
- [x] **AC #2:** Write the **Inclusions** section with corpora, triggers, and conceptual query/read path vs Vault IO.
- [x] **AC #3:** Write the **Exclusions** section including NotebookLM relationship (pick one: replace / complement / orthogonal) and mutation path rules.
- [x] **AC #4:** Write the **Security** section (secrets, protected paths, Nexus incomplete PAKE) with pointers to `security.md` and `AGENTS.md`.
- [x] **AC #5:** Write **Observability / ops** at design level only.
- [x] **AC #6:** Add **Follow-on story candidates** (≥5 bullets recommended; all out of scope for 12.1).
- [x] **AC #7:** Confirm no `src/` or Brain MCP spec changes; run `bash scripts/verify.sh` and record result in Dev Agent Record.
- [x] **Standing task — Operator guide:** If the charter implies a future operator-facing tool or workflow, note in Dev Agent Record whether `03-Resources/CNS-Operator-Guide.md` (vault) needs a future update; for this doc-only story, default is **“Operator guide: no update required”** unless you explicitly document a new operator procedure.

### Review Findings

- [x] [Review][Decision] `04-Archives/` absent from corpus classification — added to default-exclude with rationale (stale, dilutes relevance)
- [x] [Review][Decision] Brain index storage location unspecified — added "Index artifact placement" subsection: outside vault boundary by default
- [x] [Review][Decision] DailyNotes `## Agent Log` sections leak audit-adjacent content — added exclusion/strip requirement to DailyNotes entry
- [x] [Review][Decision] Phase alignment with Phase 1 deferral table — added reconciliation note in Purpose citing sprint-change-proposal
- [x] [Review][Decision] Filesystem-direct indexing path needs default-safe posture — added `realpath` hard default in design constraints
- [x] [Review][Patch] NotebookLM reasoning missing citations to `notebooklm-workflow.md` and Story 10-1 (AC #3) — added inline citations and Sources entries
- [x] [Review][Patch] Trust boundary references use bullet format instead of `[Source: ...]` convention (AC #4) — reformatted, added 5.2 inline ref
- [x] [Review][Patch] Corpus paths not anchored to vault root — added "relative to `CNS_VAULT_ROOT`" to corpora definition
- [x] [Review][Defer] Nexus-origin note detection mechanism undefined — no reliable signal to identify Nexus-created notes at indexing time; follow-on story
- [x] [Review][Defer] Non-markdown/binary files in candidate subtrees — file type scope for embedding; implementation detail
- [x] [Review][Defer] `_README.md` contract manifests in included subtrees — could be embedded as knowledge; implementation exclusion
- [x] [Review][Defer] No consistency model for concurrent mutation during index build — implementation concern for pipeline story
- [x] [Review][Defer] Embedding model version not in index manifest — model change invalidates vectors; add to manifest spec
- [x] [Review][Defer] `pake_type` filter behavior for unknown/missing types — schema evolution edge case
- [x] [Review][Defer] Query result provenance staleness after vault_move — path stability for query API story
- [x] [Review][Defer] Operator allowlist placement vs. protected path exclusion — circular bootstrapping; solve in allowlist story

## Dev Notes

### Epic and program context

Epic 12 is the **PAKE knowledge layer** augmented by **semantic retrieval**. Phase 2.0 deferred embeddings/RAG to 2.1 per approved correct-course proposal: [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-04-03.md` §3.1, §3.3, Phase 2.0 exclusions]. This story **only** produces the charter; later stories may add specs and code when the operator explicitly expands scope.

### Technical requirements (guardrails)

- **Phase 1 scope boundary** in the implementation repo still applies: do not implement Phase 2 Brain in `src/` here. [Source: `CLAUDE.md` — “Brain service (RAG + vector index) — Phase 2”].
- **Audit alignment:** Any future mutator that touches the vault through Vault IO must remain consistent with Story 5.2 binding spec: [Source: `_bmad-output/implementation-artifacts/5-2-mutations-and-vault-log-action.md`]. The charter should mention that Brain-side **writes** (if ever added) are not Vault IO audited unless they go through Vault IO; **reads** from an index are a new trust surface and need their own threat model.
- **Read vs write boundary:** Canonical read boundary for Vault IO is normative for Phase 1 tools; Brain indexing is **out of band** unless specified otherwise. The charter should say whether the indexer uses only public APIs (hypothetical `vault_list`/`vault_read` style) or direct filesystem access on the host, and the security implications of each.

### Architecture compliance

- Treat `_bmad-output/planning-artifacts/prd.md` and `architecture.md` as living documents: prefer a **standalone** `brain-service-phase-2-1-charter.md` if the charter would bloat PRD/architecture, or a tight addendum if the team wants a single scroll.
- Do not contradict Phase 1 spec mirrors without a separate approved spec change story. [Source: `specs/cns-vault-contract/CNS-Phase-1-Spec.md`].

### Library and framework requirements

**None for this story.** Do not add npm dependencies for embeddings or vector stores. A short “Technology options (uncommitted)” subsection inside the charter is allowed as **research notes only** with no version pins required.

### File structure requirements

| Area | Action |
|------|--------|
| `_bmad-output/planning-artifacts/` | Primary location for new charter markdown |
| `prd.md` / `architecture.md` | Optional addendum + cross-links only |
| `src/`, `specs/cns-vault-contract/` | **No** Brain implementation or new tool definitions in 12.1 |

### Testing requirements

- Run `bash scripts/verify.sh` after any repo touch (for example if fixing a typo in a tracked file outside `_bmad-output/`). Markdown-only changes under `_bmad-output/planning-artifacts/` should still pass; if verify fails, fix unrelated breakage only if introduced by this branch.

### Previous story intelligence

Story **11.1** (Obsidian Bases) established the pattern for **Phase 2 doc/vault artifacts**: WriteGate on `_meta/`, operator manual apply where needed, verify as sanity gate. Story **10.1** (NotebookLM) established **ingestion workflow documentation** and export scripting boundaries. For **12.1**, deliverable is **planning markdown only**; no vault `_meta/` file creation is required unless you explicitly decide to add a vault-side pointer (not required by AC).

### Git intelligence summary

Recent commits are documentation- and retro-heavy (`0769b49`, `5c1bef5`, `a36a660`, `3ca61d3`, `ed560e6`). No new embedding code paths landed; charter work continues that documentation-first Phase 2.1 pattern.

### Latest technical information

No runtime stack selection is in scope. If the charter mentions embedding APIs or vector databases, phrase them as **candidates under evaluation** and defer pinning to follow-on stories. Optional: cite public docs URLs in the charter’s Sources section only, not in implementation code.

### Project context reference

No `project-context.md` found in repo. Use `CLAUDE.md`, `specs/cns-vault-contract/AGENTS.md`, and this story as the agent context bundle.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Phase 2.1 Epic 12, Story 12.1]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-04-03.md`]
- [Source: `specs/cns-vault-contract/modules/security.md`]
- [Source: `specs/cns-vault-contract/AGENTS.md` — Sections 4–6, Nexus dual-path]
- [Source: `_bmad-output/implementation-artifacts/5-2-mutations-and-vault-log-action.md`]
- [Source: `_bmad-output/implementation-artifacts/11-1-obsidian-bases-panels.md` — doc-only / WriteGate patterns]
- [Source: `scripts/verify.sh` — gate steps]

## Standing tasks (every story)

### Standing task: Update operator guide

- [ ] If this story changes any user-facing behavior (new tool, new workflow, new constraint, new panel, new integration): update `03-Resources/CNS-Operator-Guide.md` via `vault_create_note` (full overwrite) or `vault_update_frontmatter` plus targeted section edit. Bump `modified` date and add a row to the Version History table in Section 12.
- [x] If no user-facing behavior changed: note **“Operator guide: no update required”** in Dev Agent Record (expected default for 12.1).

## Dev Agent Record

### Agent Model Used

GPT-5.2 (Cursor coding agent)

### Debug Log References

2026-04-13: `bash scripts/verify.sh` (PASS)

### Completion Notes List

- Published Phase 2.1 Brain charter at `_bmad-output/planning-artifacts/brain-service-phase-2-1-charter.md` and added a one-hop pointer in `_bmad-output/planning-artifacts/prd.md`.
- Charter content includes: corpora allowlist candidates, trigger model, conceptual read-only query surface, exclusions, NotebookLM relationship (complement), security posture, observability placeholders, and follow-on story candidates.
- Operator guide: no update required.
- Verify gate: `bash scripts/verify.sh` PASS (171 tests, lint, typecheck, build).

### File List

- `_bmad-output/planning-artifacts/brain-service-phase-2-1-charter.md` (new)
- `_bmad-output/planning-artifacts/prd.md` (updated, pointer)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (updated, story status)
- `_bmad-output/implementation-artifacts/12-1-brain-service-scope-charter-phase-21.md` (updated, status and record)

### Change Log

- 2026-04-13: Published Phase 2.1 Brain charter, added PRD pointer, marked story ready for review.
