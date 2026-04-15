# Story 12.6: Retrieval query API (read-only)

Status: done

<!-- Sprint tracker: epic-12 / 12-6-retrieval-query-api-read-only. Add a read-only retrieval query interface over the operator-built Brain index artifacts. No vault writes, no new MCP tools. Explicit trust/provenance model. -->

## Story

As an **agent** or **operator**,
I want **a read-only retrieval query interface with an explicit trust model**,
so that **semantic recall is available without bypassing governed read paths or mutating the vault**.

## Acceptance Criteria

1. **Read-only query surface over existing artifacts**
   **Given** an index built by Story 12.4 (`brain-index.json`) and described by Story 12.5 (`brain-index-manifest.json`)
   **When** a consumer issues a retrieval query
   **Then** results are returned without writing to the vault, without creating/modifying any vault-resident files, and without changing the existing Vault IO MCP tool surface.

2. **Defined API shape (stable, testable, offline)**
   **Given** a query input and an index artifact path
   **When** a query runs
   **Then** the query API supports:
   - `indexPath` (absolute path to `brain-index.json`, outside the vault boundary)
   - `query` (string)
   - `topK` (default 10, cap 50)
   - `minScore` (optional)
   - `includeScores` (default true)
   - `includeEmbedderMetadata` (default true)
   **And** output includes:
   - `embedder` metadata from the index artifact
   - an ordered `results[]` list of `{ path, score }` (score optional if `includeScores` false)
   - `warnings[]` (optional) for trust/provenance flags (see AC #4)
   **And** it is implementable and verifiable offline in tests using the existing `Embedder` abstraction (no live network calls required in tests).

3. **Deterministic behavior and stable ranking**
   **Given** the same index artifact and the same query text
   **When** the query API is invoked
   **Then** it produces deterministic ranking and stable output ordering for ties (lexical by `path`)
   **And** it uses a clearly defined similarity metric (cosine similarity over embeddings) documented in the module and story dev notes.

4. **Explicit trust & provenance model (no silent bypass)**
   **Given** Brain retrieval answers from an index artifact and not from live vault reads
   **When** results are returned
   **Then** the query API reports and documents provenance limits:
   - results’ `path` values are **vault-relative POSIX paths** captured at index time and may become stale after `vault_move`
   - retrieval does **not** guarantee the current vault file still exists at that path (operators should consult manifest freshness/drift signals from Story 12.5)
   - retrieval is **read-only** and does not mutate the vault; any vault mutation remains governed by existing Vault IO tools unless a future story adds a governed Brain write path
   **And** the query API emits a warning when the manifest indicates a non-success outcome or suspected staleness if a sibling manifest is present and can be loaded.

5. **Safety and “no echo” guarantees**
   **Given** indexing-time secret exclusion exists (Story 12.3) and manifest safety rules (Story 12.5)
   **When** query runs and outputs results or errors
   **Then** the output never includes note bodies, frontmatter dumps, matched-secret substrings, or absolute vault root paths
   **And** errors are sanitized and bounded (no stack traces by default in CLI output; module can expose structured errors for callers).

6. **Verification gate**
   **Given** the repo verify gate
   **When** `bash scripts/verify.sh` runs
   **Then** it passes with new focused tests covering query ranking, determinism, trust/provenance warnings, and “no echo” output constraints.

## Tasks / Subtasks

- [x] **AC #2–#3:** Implement `src/brain/retrieval/query-index.ts` (or equivalent) exporting a pure async function (e.g. `queryBrainIndex(params)`) that:
  - loads and validates `brain-index.json` shape (schema version, embedder metadata, records)
  - embeds the query via an `Embedder` instance or adapter consistent with Story 12.4 patterns
  - computes cosine similarity and returns topK paths
  - enforces caps (`topK <= 50`) and stable tie-breaking
- [x] **AC #2:** Add a small CLI entrypoint `src/brain/query-index-cli.ts` (or extend `build-index-cli.ts` with a `brain:query` script) that prints JSON to stdout using the stable output shape.
- [x] **AC #4:** If a sibling manifest exists next to the index artifact, load it best-effort and add provenance warnings:
  - if `outcome !== "success"`, add a warning and continue (query still runs against index if present)
  - if `freshness.estimated_stale_count > 0`, add a warning referencing staleness
  - never fail hard solely due to missing manifest
- [x] **AC #5:** Ensure no vault reads are required for query results; the query surface must not attempt to open vault note bodies to generate snippets in this story. (If snippets are desired later, require a separate story with explicit trust rules and gating.)
- [x] **AC #6:** Add tests under `tests/brain/`:
  - deterministic ordering and tie-break rules
  - cosine similarity math sanity checks
  - topK cap enforcement
  - “no echo”: output/error strings contain no absolute vault paths and no note body fragments from fixtures
  - manifest-warning behavior using a temp directory holding `brain-index.json` + `brain-index-manifest.json`
- [x] Run `bash scripts/verify.sh` and record results in Dev Agent Record.
- [x] **Standing task — Operator guide:** Because this story adds a new operator-visible “query the index” workflow, update `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` to document:
  - how to run the query command (inputs, `topK`, where the index path comes from)
  - what the trust warnings mean (stale paths, vault moves, manifest drift)
  - bump `modified` and add a Version History row in the Brain section used by 12.2–12.5.

## Dev Notes

### Epic and program context

Epic 12’s first executable slice already exists:

- **12.4** produces `brain-index.json` outside the vault boundary with `{ embedder, records: [{ path, embedding }], exclusions }`.
- **12.5** produces `brain-index-manifest.json` alongside the index artifact and provides drift/freshness signals.

Story 12.6 adds a **read-only retrieval surface** on top of those artifacts. It must not:

- register new MCP tools
- write anything into `Knowledge-Vault-ACTIVE/`
- introduce a vault mutation path

### Technical requirements (guardrails)

- **Reuse the index artifact format:** load `brain-index.json` produced by `serializeBuildIndexArtifact` ([Source: `src/brain/build-index.ts`]) rather than inventing a parallel format.
- **Similarity metric:** use cosine similarity:
  - \( \text{cosine}(a,b) = \frac{a \cdot b}{\|a\| \|b\|} \)
  - Treat empty/zero vectors as ineligible and surface a warning or exclusion.
- **Determinism:** stable sort for equal scores: lexical by `path` (same locale as build-index sorts: `"en"`).
- **Provenance warnings:** prefer reading the sibling manifest (same directory) to surface drift/staleness; never read vault contents to “validate” existence in this story (avoid a silent trust boundary expansion).
- **No echo:** do not include note body, frontmatter, or absolute vault paths in outputs.

### Architecture compliance

- TypeScript / Node, Vitest tests.
- Keep code under `src/brain/` and tests under `tests/brain/`, following existing patterns from Stories 12.3–12.5.
- No changes to `src/register-vault-io-tools.ts` and no changes to Phase 1 `specs/cns-vault-contract/` normative contracts.

### File structure requirements

| Area | Expected touch |
|------|----------------|
| `src/brain/retrieval/query-index.ts` | New: query API implementation |
| `src/brain/query-index-cli.ts` or `src/brain/build-index-cli.ts` | New/extended: operator query entrypoint |
| `src/brain/embedder.ts` | Reuse: embedder interface for query embedding |
| `tests/brain/query-index.test.ts` | New: retrieval tests |
| `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` | Update: operator workflow + trust model |

### Testing requirements

- Tests must be fully offline: use `StubEmbedder` or a deterministic fake embedder.
- Build a minimal `brain-index.json` fixture in a temp dir (or generate via existing `writeBuildIndexArtifact`) and ensure query results are deterministic and warnings behave as specified.

### Previous story intelligence

From **12.5** ([Source: `_bmad-output/implementation-artifacts/12-5-index-manifest-and-drift-signals.md`]):

- The manifest includes `freshness.estimated_stale_count` and bounded `estimated_stale_sample`.
- There is a known deferred item: per-file index-time `mtimeMs` persistence (explicitly deferred). Do not assume it exists in the manifest; rely only on shipped aggregate drift signals.

From **12.4** ([Source: `_bmad-output/implementation-artifacts/12-4-minimal-embeddings-pipeline-operator-triggered.md`], [Source: `src/brain/build-index.ts`]):

- Index artifacts are intentionally outside the vault boundary and are stable JSON with `schema_version: 1`.
- Candidate `path` values are vault-relative POSIX strings and are the only safe identifier to return in query results at this stage.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 12, Story 12.6]
- [Source: `_bmad-output/planning-artifacts/brain-service-phase-2-1-charter.md` — “Conceptual query API and relationship to Vault IO reads” + trust boundaries]
- [Source: `_bmad-output/implementation-artifacts/12-4-minimal-embeddings-pipeline-operator-triggered.md`]
- [Source: `_bmad-output/implementation-artifacts/12-5-index-manifest-and-drift-signals.md`]
- [Source: `src/brain/build-index.ts` — `serializeBuildIndexArtifact` output shape]
- [Source: `src/brain/build-index-cli.ts` — artifact/manifest sibling placement]

## Standing tasks (every story)

### Standing task: Update operator guide

- [ ] If this story changes any user-facing behavior (new tool, new workflow, new constraint, new panel, new integration): update `03-Resources/CNS-Operator-Guide.md` via `vault_create_note` (full overwrite) or `vault_update_frontmatter` plus targeted section edit. Bump `modified` date and add a row to the Version History table in the existing Brain section used by Stories 12.2–12.5.
- [ ] If no user-facing behavior changed: note **"Operator guide: no update required"** in Dev Agent Record.

## Dev Agent Record

### Agent Model Used

GPT-5.2 (Cursor agent)

### Debug Log References

 - `bash scripts/verify.sh` — PASS (2026-04-14)

### Completion Notes List

 - Implemented read-only retrieval query API over `brain-index.json` using cosine similarity and deterministic ordering (lexical path tiebreak).
 - Added best-effort sibling manifest loading for trust/provenance warnings and included `provenance.last_build_utc` when available.
 - Added CLI entrypoint `npm run brain:query` that prints stable JSON and avoids stack traces / absolute path echoes.
 - Added focused offline tests for ranking, determinism, topK cap, manifest warnings, and “no echo” constraints.
 - Updated operator guide with the new query workflow and trust model notes.

### File List

 - `src/brain/retrieval/query-index.ts`
 - `src/brain/query-index-cli.ts`
 - `tests/brain/query-index.test.ts`
 - `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`
 - `package.json`
 - `_bmad-output/implementation-artifacts/12-6-retrieval-query-api-read-only.md`
 - `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Review Findings

- [x] [Review][Patch] D1B: topK > 50 silent clamp → clamp + TOPK_CAPPED warning [src/brain/retrieval/query-index.ts:206-211]
- [x] [Review][Patch] P1: Early return on zero-vector query skipped manifest warnings → manifest loaded before early return [src/brain/retrieval/query-index.ts:215-222]
- [x] [Review][Patch] P2: NaN/Infinity embedding components not guarded → non-finite score check added [src/brain/retrieval/query-index.ts:107-109]
- [x] [Review][Patch] P3: CLI --top-k and --min-score NaN pass-through → finite-number validation added [src/brain/query-index-cli.ts:56-65]
- [x] [Review][Patch] P4: Dimension mismatch mislabeled as zero vector → separate DIMENSION_MISMATCH code [src/brain/retrieval/query-index.ts:90-92]
- [x] [Review][Patch] P5: provenance.last_build_utc set to undefined key → conditional assignment [src/brain/retrieval/query-index.ts:162-164]
- [x] [Review][Patch] P6: Missing test for outcome=success + stale_count > 0 → test added [tests/brain/query-index.test.ts]
- [x] [Review][Patch] P7: Missing tests for zero-vector, dimension mismatch, topK boundaries → tests added [tests/brain/query-index.test.ts]
- [x] [Review][Defer] W1: CLI always uses StubEmbedder — deferred, known scope for future embedder adapter story
- [x] [Review][Defer] W2: No path normalization on result paths — deferred, trust boundary belongs to Story 12.4 indexing pipeline

### Change Log

 - 2026-04-14 — Implemented read-only retrieval query API + CLI + tests; updated operator guide; set story to `review`.
 - 2026-04-15 — Code review: 8 patches applied (D1B, P1-P7), 2 deferred, 5 dismissed. verify.sh PASS (222 tests). Status → done.
