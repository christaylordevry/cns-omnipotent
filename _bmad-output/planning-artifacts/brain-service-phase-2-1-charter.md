# Phase 2.1 Brain charter (semantic retrieval scope freeze)

**Status:** draft (planning charter, no implementation in this story)  
**Date:** 2026-04-13  
**Owner:** Maintainers (CNS)

## Purpose

Phase 2.1 introduces a "Brain" capability as a semantic retrieval layer on top of the PAKE knowledge layer. This charter freezes the **allowed scope** for Phase 2.1 before any indexing, embeddings, or vector store code is written, so later work stays aligned with:

- WriteGate and protected paths
- PAKE note semantics and quality signals
- audit and trust boundaries
- the documented Nexus dual-path (trusted but unguided filesystem writes)

This charter is intentionally design-level. It does not add any new tools, servers, or code.

**Phase alignment note:** `CNS-Phase-1-Spec.md` Section 2 defers "pgvector / embedding layer" to Phase 3 with dependency "Stable vault content + schema compliance." That deferral reflects the original pre-Phase-2.0 sequencing. The approved correct-course proposal (`sprint-change-proposal-2026-04-03.md` Section 3.1) repositioned semantic retrieval design into Phase 2.1 after confirming vault content density and schema compliance milestones from Phase 1. This charter operates under the updated sequencing; the Phase 1 spec deferral table should be treated as superseded on this item.

## Non goals (explicit exclusions for Phase 2.1)

- No production vector store selection, deployment, or operations in Phase 2.1
- No embedding pipeline implementation (batching, retries, backpressure, schedulers)
- No new MCP tools, no new "Brain read" API surface shipped in `src/`
- No vault mutation path for Brain, all mutations remain governed by existing Vault IO tools
- No changes to the normative Phase 1 Vault IO contract under `specs/cns-vault-contract/`

## Inclusions (what Phase 2.1 may cover)

### Candidate corpora (what may be embedded)

Phase 2.1 may design and later implement embedding and retrieval over an explicit allowlist of vault content. Candidate corpora are defined as **vault subtrees** (relative to `CNS_VAULT_ROOT`) and optional **`pake_type` filters**.

**Default include candidates (allowlist targets):**

- `03-Resources/**`  
  Primary reference corpus, typically the highest density of stable knowledge.
- `01-Projects/**`  
  Active project artifacts, constraints, decisions, and plans.
- `02-Areas/**`  
  Long-running responsibility context.
- `DailyNotes/**`  
  Optional, down-ranked by default due to high noise. Included only if operators want retrieval over logs. If included, `## Agent Log` sections must be excluded or stripped before embedding: they contain agent operation traces subject to the same leakage and prompt injection risks as `_meta/logs/agent-log.md`.

**Explicitly handle (do not silently ingest):**

- `00-Inbox/**`  
  Allowed only as an explicit opt-in corpus, and expected to be down-ranked or filtered because it is unstructured and may contain incomplete captures.
- Nexus-origin notes (filesystem writes outside Vault IO governance)  
  Treat as potentially incomplete PAKE. Include only if they meet minimum quality gates, otherwise exclude or down-rank. See Security section.

**Default exclude candidates (protected, governance-critical, or inactive):**

- `AI-Context/**`  
  Constitution and policy modules are human-edited control-plane content. Do not embed by default.
- `_meta/**`  
  Vault infrastructure, schemas, Bases, and audit logs. Do not embed by default, and never embed raw audit logs.
- `04-Archives/**`  
  Completed or inactive content. Excluded by default because archived notes are stale by definition and would dilute retrieval relevance. May be opted in as a separate corpus if operators want historical recall, subject to the same explicit allowlist rules as other excluded paths.

If a future story decides to embed content from `AI-Context/**` or `_meta/**`, it must be an explicit charter amendment with a rationale, plus an operator-visible allowlist and documented risk analysis. There is no silent bypass for protected paths.

### Indexing trigger model (design level)

Phase 2.1 may specify an indexing trigger model, but should not ship a scheduling product.

Allowed trigger models:

- **Operator-triggered indexing:** explicit command or tool invocation that builds or refreshes the index.
- **Scheduled reindex (optional design):** a documented plan for periodic refresh, but no cron or daemon product is shipped in Phase 2.1. Operators remain in control.

### Conceptual query API and relationship to Vault IO reads

Phase 2.1 may define a conceptual, read-only query interface for semantic retrieval. The key constraint is that this interface does not silently bypass governed read and write paths.

Design constraints:

- **Read-only query surface:** Brain answers questions by reading from an index derived from the vault. It does not write to the vault.
- **No silent bypass of governed paths:** The Brain indexer must either:
  - build its corpus via the same conceptual rules as Vault IO reads (path boundary enforced, explicit excludes respected), or
  - explicitly declare that it reads the filesystem directly on the host, and document the additional trust and threat model implications.
- **Default-safe posture for filesystem reads:** Regardless of whether the indexer uses Vault IO APIs or direct filesystem access, it must apply `realpath` (or equivalent canonical resolution) before reading any file. This prevents symlinks inside included subtrees from traversing outside the vault boundary. This is the same policy enforced by Phase 1 Vault IO read and write tools.
- **Shared vault root:** Any future Brain indexing must treat `CNS_VAULT_ROOT` as the authority for the vault root boundary, consistent with Phase 1 policy.

The intent is to keep Vault IO as the governed mutator surface, while allowing a future Brain read path to exist as a distinct service or module that still respects the vault boundary and protected path classes.

### Index artifact placement (design level)

Brain index artifacts (vector store data, manifest files, intermediate embeddings) live **outside the vault boundary** by default. Placing them inside `Knowledge-Vault-ACTIVE/` would subject them to WriteGate governance, risk recursive indexing, and conflate knowledge content with infrastructure. If a future story requires index artifacts inside the vault (for example, an operator-visible manifest under `_meta/brain/`), it must go through Vault IO, respect WriteGate, and be explicitly excluded from the embedding corpus.

## Exclusions and hard boundaries (non negotiable)

### Vault mutation remains governed

Any vault mutation remains only through existing Vault IO tools unless a future story adds a governed mutation path for Brain. Phase 2.1 does not add such a path.

Implication:

- Brain may compute results, rankings, or summaries, but it does not write them into the vault as notes, frontmatter, or append-only logs.
- If a future Brain workflow proposes writes (for example, auto-generated summaries), it must go through Vault IO, inherit WriteGate, PAKE validation, secret scanning, and audit logging requirements, or it is out of scope.

### Protected paths must be respected

The indexer must not silently ingest protected or governance-critical areas. If it ingests them, it must be a deliberate, explicit, operator-visible allowlist decision with a documented rationale and risk analysis.

### NotebookLM vs Brain relationship

**Relationship:** **complement**

Reasoning:

- NotebookLM is a source-centric research and synthesis workflow. It optimizes for curated collections, citations, and interactive exploration [Source: `AI-Context/modules/notebooklm-workflow.md`].
- Brain is a vault-wide, operator-controlled retrieval layer designed to answer questions across the corpus and reduce search friction inside day-to-day agent work.
- They overlap at the surface level (both support retrieval), but they differ in governance and integration points. NotebookLM is a workflow and export path (Story 10-1 established the ingestion and export scripting boundaries); Brain is intended to become an infrastructure capability for semantic recall. Keeping them complementary avoids forcing a premature replacement decision.

## Security and trust boundaries

### Secret-bearing notes

Hard rule: secrets must not enter the vault. In practice, the vault may contain accidental secret material. Brain indexing must not amplify that risk.

Policy options for Phase 2.1 (design, no implementation commitment in this story):

- **Never embed policy:** exclude any note that matches secret patterns (apply to frontmatter string values and body).
- **Redaction policy:** if a future story implements safe redaction, embed only redacted content. This is higher risk and requires dedicated acceptance criteria and tests.

At minimum, Phase 2.1 design should assume a "never embed on match" posture, aligned with the security module hard rule: no secrets in vault.

### Protected paths and governance critical content

- `AI-Context/**` and `_meta/**` are excluded by default for the same reason they are protected in governed mutation paths. They are control-plane content and vault infrastructure.
- Audit logs under `_meta/logs/**` are never embedded. Even if technically possible, it is an unnecessary risk surface for leakage and prompt injection style contamination.

### Nexus dual-path and incomplete PAKE notes

Nexus-created notes may be present outside Inbox without full PAKE frontmatter. For Brain indexing, treat these as lower trust unless validated.

Phase 2.1 allowable handling strategies:

- **Exclude:** do not embed notes that fail minimum PAKE requirements outside Inbox.
- **Down-rank:** embed, but reduce retrieval rank unless the note passes quality and schema checks.
- **Quarantine corpus:** allow a separate opt-in corpus for Nexus-origin or incomplete notes, clearly labeled for operators.

Any of these must be explicit and operator-visible. There is no silent promotion of incomplete notes into the primary retrieval corpus.

### References for trust boundaries

- [Source: `specs/cns-vault-contract/AGENTS.md` Sections 4-6] (Vault IO protocol, Nexus dual-path, security boundaries)
- [Source: `specs/cns-vault-contract/modules/security.md`] (hard rules, secrets policy, boundary model)
- [Source: `_bmad-output/implementation-artifacts/5-2-mutations-and-vault-log-action.md`] (mutation audit binding; any future Brain write path must remain consistent with this spec)

## Observability and operations (design level only)

Phase 2.1 may specify how operators would detect index freshness and failure modes, without implementing them.

Design-level signals:

- **Index manifest:** a machine-readable summary of the last successful index build, including:
  - corpus allowlist (subtrees, optional `pake_type` filters)
  - build timestamp (UTC)
  - counts: files considered, embedded, excluded, failed
  - exclusion reasons breakdown (protected path, secret pattern, schema invalid, unsupported file)
- **Failure reporting:** a bounded error report (no raw secrets, no full note bodies) suitable for operator debugging.
- **Drift detection:** compare vault file modification timestamps against last index build, estimate stale coverage.
- **Health checks:** placeholder concept for "index ready" vs "degraded" states.

This story does not ship these signals, it only defines them as expectations for later work.

## Follow on story candidates (out of scope for 12.1)

- **Story: Brain corpus allowlist contract**  
  Define an operator-editable allowlist file and validation rules for corpora selection.
- **Story: Secret scan enforcement for indexing**  
  Implement never-embed exclusion on secret pattern matches with test coverage and non-leaking errors.
- **Story: Minimal embeddings pipeline (operator-triggered)**  
  Build an on-demand index build command with bounded scope and deterministic outputs.
- **Story: Index manifest and drift signals**  
  Write an index manifest file and expose freshness signals for operators.
- **Story: Retrieval query API (read-only)**  
  Define and implement a read-only query interface, with explicit trust model and no bypass of protected paths.
- **Story: PAKE quality weighting for retrieval**  
  Use `pake_type`, `status`, `confidence_score`, and verification fields to down-rank low quality notes.
- **Story: Nexus quarantine corpus**  
  Add an optional separate corpus for incomplete or Nexus-origin notes, with operator-visible labeling.

## Sources

1. `_bmad-output/implementation-artifacts/12-1-brain-service-scope-charter-phase-21.md`
2. `specs/cns-vault-contract/AGENTS.md` (Sections 4 to 6, and Nexus dual-path)
3. `specs/cns-vault-contract/modules/security.md`
4. `_bmad-output/implementation-artifacts/5-2-mutations-and-vault-log-action.md`
5. `_bmad-output/planning-artifacts/sprint-change-proposal-2026-04-03.md`
6. `AI-Context/modules/notebooklm-workflow.md` (NotebookLM workflow definition, complement relationship)
7. `_bmad-output/implementation-artifacts/10-1-notebooklm-vault-integration.md` (Story 10-1, ingestion and export scripting boundaries)
