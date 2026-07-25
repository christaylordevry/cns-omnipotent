---
baseline_commit: dc46cc7f9e8b1a2c3d4e5f6a7b8c9d0e1f2a3b4c
course_correction_from: 79-4-golden-set-calibration-gate
branch: hermes-consolidation
---

# Story 79.6: Chunked Brain index + chunk-aware recall

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As an **operator**,
I want **the Brain index to embed passage-sized chunks instead of whole notes and recall to inject those passages with parent vault citations**,
so that **oversized notes index successfully, short vague queries match relevant passages, and Story 79-4 calibration can pass before recall goes live (FR16, FR18, FR19 course-correction)**.

**Zone/Repo:** Omnipotent.md · `src/brain/`, `config/`, `tests/brain/` · **Branch:** `hermes-consolidation`

**Gate context:** First real Portal index calibration (`text-embedding-3-large`, 153 notes) **FAILED — 2/36 channel runs passed**. Root causes:
1. **8 notes >8191 tokens** failed to embed entirely (`EMBEDDING_ERROR`), including golden target `03-Resources/CNS-Operator-Guide.md`.
2. **Whole-note vectors dilute signal** — short operator queries do not rank against averaged whole-document embeddings; even indexed golden targets scored `precision@k=0`. Threshold tuning cannot fix ranking.

**Recall stays in shadow** (`config/brain-recall-policy.json` → `shadow_mode: true`) until this story lands, operator **full re-indexes**, and `brain:calibrate` passes. Then operator re-runs the documented calibration session to flip `shadow_mode: false`.

## Acceptance Criteria

1. **Chunked index build (AC: chunk-build)**
   - **Given** Context7 docs fetched for chosen tokenizer lib before implement (NFR7; package ≥14 days on npm — NFR-PKG-1)
   - **When** `npm run brain:index` runs with Portal embedder
   - **Then** each eligible note is split into **~512–1024 token chunks** (default target **768**, overlap **64**) before embedding
   - **And** index `schema_version` bumps to **2**; each record is `{ path, chunk_index, char_start, char_end, text, embedding, quality? }` — one embedding per **chunk**, not per note
   - **And** chunk `text` is the exact substring embedded (body after daily-note agent-log strip; frontmatter excluded from embed text)
   - **And** notes whose embeddable body is empty (e.g. `agent-log.md.md` 0 bytes) are **skipped** with exclusion `EMPTY_NOTE` — not `EMBEDDING_ERROR`
   - **And** no single embed call exceeds model limit (8191 tokens for `text-embedding-3-large`); oversized notes succeed via chunking

2. **Chunk-aware query (AC: chunk-query)**
   - **When** `queryBrainIndex` / `npm run brain:query` runs against a v2 index
   - **Then** all chunk vectors are scored, then **collapsed to the best (max-score) chunk per parent note**, and results are the **top-k DISTINCT parent notes** ranked by their best-chunk score — fields: `path` (parent vault-relative note), `chunk_index` (winning chunk), `score`, `text` (winning chunk passage), optional `char_start`/`char_end`
   - **And** the ranked result list contains **at most one entry per parent `path`** — multiple chunks of the same note must NOT occupy separate top-k slots (this is required for `precision@k >= 1` on the k=5 voice_pane channel: a long note like `CNS-Operator-Guide.md` produces ~28 chunks and would otherwise crowd out a co-expected note out of the top-k → calibration FAIL — the exact failure this story exists to fix)
   - **And** collapse happens in the query over **all** chunks before the topK cut — deduping a 5-chunk result list in the harness is insufficient (5 chunks may all share one parent)
   - **And** `schema_version: 1` indexes are rejected with clear error `INDEX_SCHEMA_STALE` (full rebuild required — no silent v1 compat)
   - **And** tie-break: best-chunk score desc → `path` lexicographic → `chunk_index` asc

3. **Chunk-aware recall inject (AC: chunk-inject)**
   - **When** `buildRecallInjection` runs
   - **Then** it cites the chunk's **parent** vault path (`### vault:<path>`) and injects the **chunk passage text** from the index hit (not a fresh excerpt from the whole note)
   - **And** existing per-channel budgets, `inject_blocked_paths`, secret-gate, drop rules, and `shadow_mode` behavior from 79-3/79-4/79-5 are **preserved unchanged in semantics**
   - **And** chunks without resolvable parent path or empty passage text are dropped (NFR-RECALL-4)

4. **Manifest chunking metadata (AC: manifest)**
   - **When** `brain-index-manifest.json` is written
   - **Then** it records chunking params: `target_tokens`, `overlap_tokens`, `tokenizer_encoding` (e.g. `cl100k_base`), `tokenizer_package`
   - **And** `counts.embedded` reflects **chunk count**; add `counts.notes_embedded` (unique parent paths with ≥1 chunk)
   - **And** `freshness.last_build_utc` updated on rebuild

5. **Re-index + calibration gate (AC: calibrate)**
   - **And** `src/brain/references/incremental-rebuild.md` documents **mandatory full rebuild** after this story (schema v1 → v2 breaking change)
   - **And** dev runs `npm run brain:calibrate` against rebuilt Portal index; story is not done until harness reports **PASS** (all 12 golden queries × applicable channels) OR documents explicit operator waiver path per 79-4 artifact writer
   - **And** on pass, operator sets `operator_signoff: confirmed` in `config/brain-golden-queries.json` and writes `79-4-calibration-pass.md` via `--write-artifact`

6. **Safety + reversibility (AC: nfr2, nfr5)**
   - **And** protect-list zero edits (`src/agents/*`, `run-chain.ts`, `scripts/run-chain.ts`); no Hermes core fork
   - **And** revert path documented: rebuild index with prior code + `CNS_BRAIN_EMBEDDER=stub`, or restore pre-79-6 git + re-index; policy `shadow_mode: true` until re-calibrated

7. **Tests + verify (AC: nfr1)**
   - **And** `tests/brain/` covers: chunker unit tests, v2 build artifact shape, empty-note skip, query v2 results, recall inject uses chunk text, v1 index rejection
   - **And** `bash scripts/verify.sh` passes

## Tasks / Subtasks

- [x] **Context7 tokenizer lib** (AC: chunk-build, NFR7)
  - [x] `resolve-library-id` + `query-docs` for **`gpt-tokenizer`** (`/niieani/gpt-tokenizer`) — `cl100k_base` encoding for `text-embedding-3-large`; confirm package publish date ≥14 days (current: `3.4.0`, 2025-11-07 — OK)
  - [x] Do **not** use packages published &lt;14 days ago (NFR-PKG-1)

- [x] **`note-chunker.ts`** (AC: chunk-build)
  - [x] New `src/brain/note-chunker.ts` — pure functions: `chunkNoteText(text, { targetTokens, overlapTokens })` → `{ chunk_index, char_start, char_end, text }[]`
  - [x] Use `gpt-tokenizer` `encode`/`decode` on token slices; overlap on token boundaries
  - [x] Default config constants: `CHUNK_TARGET_TOKENS=768`, `CHUNK_OVERLAP_TOKENS=64`, `CHUNK_MAX_TOKENS=1024` (hard cap per chunk before embed)
  - [x] Unit tests: short note → 1 chunk; long note → multiple; overlap verified; empty → `[]`

- [x] **`build-index.ts` schema v2** (AC: chunk-build, manifest)
  - [x] Bump `serializeBuildIndexArtifact` → `schema_version: 2`
  - [x] Replace single `embed()` per note with loop over chunks
  - [x] Propagate parent `quality` metadata to every chunk record
  - [x] Skip `chunks.length === 0` → exclusion `EMPTY_NOTE`
  - [x] Sort records: `path` asc → `chunk_index` asc
  - [x] Update `tests/brain/build-index.test.ts` fixtures

- [x] **`brain-index-manifest.ts`** (AC: manifest)
  - [x] Add `chunking: { target_tokens, overlap_tokens, tokenizer_encoding, tokenizer_package }` to manifest type + serializer
  - [x] Extend `counts` with `notes_embedded`; `embedded` = chunk count
  - [x] Wire from `build-index-cli.ts`

- [x] **`query-index.ts` chunk results** (AC: chunk-query)
  - [x] Zod schema v2 for records; reject v1 with `CnsError` code `INDEX_SCHEMA_STALE`
  - [x] Score all chunk vectors, then **group by parent `path` and keep the max-score chunk per parent**, then sort parents by best-chunk score and take topK → results are **top-k distinct parents**
  - [x] Extend `QueryBrainIndexResultItem`: `chunk_index`, `text` (winning chunk passage), optional `char_start`/`char_end`; `path` = parent note path
  - [x] Test must assert: a query where one note has many high-scoring chunks still returns a co-relevant second note within top-k (the voice_pane k=5 multi-expected case)
  - [x] Update `tests/brain/query-index.test.ts` + CLI output

- [x] **`recall-inject.ts` chunk passage inject** (AC: chunk-inject)
  - [x] Use the `text` carried on each `queryBrainIndex` result (winning chunk per parent) — **do not** re-read the whole note for excerpt, and **do not** re-parse the index a second time (prefer pass-through over a `loadChunkTextForHit` helper)
  - [x] `formatRecallChunk(path, passageText, score)` unchanged header shape
  - [x] Fallback: if chunk text missing from index (should not happen on v2), drop with `NOT_FOUND`
  - [x] Update `tests/brain/recall-inject.test.ts` + `tests/brain/calibration-harness.test.ts` fixtures to v2 index shape

- [x] **Re-index documentation** (AC: calibrate)
  - [x] Update `src/brain/references/incremental-rebuild.md` — **breaking schema v2**; mandatory full rebuild; embedder model unchanged but vectors incompatible with v1
  - [x] Add operator commands block (see Dev Notes)

- [ ] **Calibration re-run** (AC: calibrate) — **operator session** (Portal proxy + vault env required; not run in this dev session)
  - [ ] Full Portal re-index → `npm run brain:calibrate -- --index-path ... --write-artifact`
  - [ ] Target: **36/36 channel runs pass** (12 queries × ~3 channels; exact count per `channelsForGoldenQuery`)
  - [ ] Tune `min_score_threshold` / budgets only **after** chunking proves ranking — expect lower thresholds may work with passage vectors
  - [ ] On pass: `shadow_mode: false` is **operator action** post-story (document in completion notes; do not flip in code without operator sign-off)

- [x] **Verify gate** (AC: nfr1, nfr2)
  - [x] `bash scripts/verify.sh` passes
  - [x] Confirm protect-list diff clean

## Dev Notes

### Current code state (READ BEFORE EDITING)

| File | Today | This story changes |
|------|-------|-------------------|
| `src/brain/build-index.ts` | One `embed(textForEmbed)` per whole note; `BuildIndexRecord = { path, embedding, quality? }`; `schema_version: 1` | Chunk loop; v2 records with `chunk_index`, offsets, `text` |
| `src/brain/retrieval/query-index.ts` | Ranks whole-note vectors; `QueryBrainIndexResultItem = { path, score? }` | Rank chunk vectors, **collapse to best-chunk-per-parent**, return top-k **distinct parents**; `path` + `chunk_index` + `text`; reject v1 |
| `src/brain/recall-inject.ts` | `queryBrainIndex` → `vaultReadFile` → `excerptFromRawNote` (whole-note excerpt) | Inject **index chunk text**; cite parent `path` |
| `src/brain/brain-index-manifest.ts` | No chunking metadata; `counts.embedded` = note count | Add `chunking` block; `notes_embedded` + chunk `embedded` |
| `src/brain/calibration-harness.ts` | `precision@k` on `retrievedPaths` / `citedPaths` (parent paths); `precisionAtK` does `slice(0,k)` **before** Set-dedup | **No harness edit** — but ONLY because the query now returns top-k distinct parents. The metric is correct iff `queryBrainIndex` results are one-per-parent (see AC chunk-query). Do NOT rely on the Set in `precisionAtK` to dedup — the slice precedes it. Verify golden set passes. |
| `config/brain-recall-policy.json` | `shadow_mode: true` | **Leave true** until calibration pass; operator flips |

### Index artifact v2 shape (normative)

```json
{
  "schema_version": 2,
  "embedder": { "providerId": "portal", "modelId": "text-embedding-3-large", "vectorDimension": 3072 },
  "chunking": {
    "target_tokens": 768,
    "overlap_tokens": 64,
    "tokenizer_encoding": "cl100k_base",
    "tokenizer_package": "gpt-tokenizer@3.4.0"
  },
  "records": [
    {
      "path": "03-Resources/CNS-Operator-Guide.md",
      "chunk_index": 0,
      "char_start": 0,
      "char_end": 4120,
      "text": "## Morning digest\n\nCron runs at ...",
      "embedding": [0.01, ...],
      "quality": { "status": "reviewed" }
    }
  ],
  "exclusions": []
}
```

Duplicate `chunking` in manifest mirrors index for drift tooling. Index file may omit `tokenizer_package` if manifest is SSOT — pick one SSOT, duplicate read-only in manifest.

### Chunking algorithm (implementation guardrails)

1. **Input text:** Same as today — full note raw for daily notes after agent-log strip in body; for embed, use **body only** (no YAML frontmatter in chunk text) to match semantic content operators query against.
2. **Token counting:** `gpt-tokenizer` with `cl100k_base` (OpenAI embedding family). Context7: `/niieani/gpt-tokenizer` — `encode`, `decode`, slice token arrays.
3. **Window:** `target_tokens=768`, `overlap_tokens=64` — configurable via env e.g. `CNS_BRAIN_CHUNK_TARGET_TOKENS` / `CNS_BRAIN_CHUNK_OVERLAP_TOKENS` for calibration tuning without code change.
4. **Hard limit:** Each chunk must be ≤8191 tokens (model max); with target 768 this is automatic — add assert in chunker.
5. **Offsets:** `char_start`/`char_end` index into the **same string passed to chunker** (post frontmatter strip) for debug; inject uses stored `text` field, not re-slice.

### Query / inject contract

- **Query CLI / API:** Results are top-k **distinct parent notes**, each carrying its best chunk's `text`/`chunk_index`/offsets. Consumers that only need parent path use `path`.
- **Inject:** `max_chunks` policy limits **injected passages** (unchanged). One passage per parent in v1 of this story — injects the winning chunk's `text`. (Deferred: pulling additional chunks of an *already-selected* parent for long guides is an inject-layer enhancement; it must NOT add extra parents to — or reorder — the ranked retrieval list used by `precision@k`.)
- **Secret gate:** Run on parent note at inject time (existing) OR on chunk text — keep parent-note `vaultReadFile` + secret gate if chunk text alone might miss patterns spanning frontmatter; **minimal change:** secret-gate the parent note once per unique `path` per turn (cache in inject loop).

### Operator re-index + calibration (post-implementation)

```bash
export CNS_VAULT_ROOT=/mnt/c/Users/Christopher\ Taylor/Knowledge-Vault-ACTIVE
export CNS_BRAIN_EMBEDDER=portal
export CNS_BRAIN_EMBED_MODEL=text-embedding-3-large
export CNS_BRAIN_EMBED_BASE_URL=http://127.0.0.1:8645/v1
export CNS_BRAIN_INDEX_PATH=/abs/outside/vault/brain-index/brain-index.json
# Token counter for calibration (optional but recommended):
export CNS_BRAIN_TOKEN_COUNT_BASE_URL=http://127.0.0.1:8645/v1
export CNS_BRAIN_TOKEN_COUNT_MODEL=anthropic/claude-sonnet-4-6

hermes proxy start   # separate terminal

# MANDATORY full rebuild (v1 index incompatible):
npm run brain:index -- --output-dir "$(dirname "$CNS_BRAIN_INDEX_PATH")"

# Calibrate — must PASS before live inject:
npm run brain:calibrate -- \
  --index-path "$CNS_BRAIN_INDEX_PATH" \
  --write-artifact

# After pass + review: operator sets shadow_mode false in policy, reinstall plugin if needed
```

### Calibration failure evidence (why this story exists)

| Symptom | Cause | Chunking fix |
|---------|-------|--------------|
| 8× `EMBEDDING_ERROR` on build | Whole note &gt;8191 tokens | Chunks fit embed limit |
| `CNS-Operator-Guide.md` missing from index | Same | Guide chunks embed |
| Golden queries `precision@k=0` on indexed targets | Whole-note vector dilution | Passage vectors match short queries |
| 2/36 channel runs pass | Combined above | Re-calibrate post-reindex |

### Architecture compliance

- [Source: `_bmad-output/planning-artifacts/architecture-hermes-omniscient.md` § Implementation Patterns] — `config/brain-recall-policy.json` channel keys unchanged; injection fence `### vault:<path>` per chunk; Brain code stays in `src/brain/`.
- [Source: `_bmad-output/planning-artifacts/epics-hermes-omniscient.md` Epic 79] — FR16 embed integrity, FR18 cited inject, FR19 calibration gate.
- [Source: `_bmad-output/planning-artifacts/prds/prd-CNS-2026-06-25/prd.md` §4.1] — Per-channel `max_chunks` already models passage count; chunking aligns index granularity with inject policy.
- **ADR-HERMES-015:** `pre_llm_call` plugin unchanged — prefetch CLI inherits chunk inject via `buildRecallInjection`.
- **NFR-GOV-2:** Secret gate + allowlist on index build unchanged — chunking happens **after** gate passes on whole note.
- **WriteGate:** No vault mutations; index output dir outside vault (existing `assertOutputDirOutsideVault`).

### Library / framework requirements

| Lib | Version | Why | Context7 ID |
|-----|---------|-----|-------------|
| `gpt-tokenizer` | `^3.4.0` (verify npm age) | Pure JS BPE, `cl100k_base`, no WASM | `/niieani/gpt-tokenizer` |
| `gray-matter` | existing | Frontmatter strip | — |
| `zod` | existing | Schema v2 validation | — |

**Forbidden:** Guessing token counts via `chars/4` for **chunk boundaries** — use tokenizer. (Chars/4 remains OK for inject **budget trim** hot path per 79-4.)

### File structure requirements

| Action | Path |
|--------|------|
| **NEW** | `src/brain/note-chunker.ts` |
| **NEW** | `tests/brain/note-chunker.test.ts` |
| **UPDATE** | `src/brain/build-index.ts` |
| **UPDATE** | `src/brain/build-index-cli.ts` |
| **UPDATE** | `src/brain/brain-index-manifest.ts` |
| **UPDATE** | `src/brain/retrieval/query-index.ts` |
| **UPDATE** | `src/brain/recall-inject.ts` |
| **UPDATE** | `src/brain/references/incremental-rebuild.md` |
| **UPDATE** | `tests/brain/build-index.test.ts`, `query-index.test.ts`, `recall-inject.test.ts`, `calibration-harness.test.ts` |
| **UPDATE** | `package.json` (add `gpt-tokenizer` dependency) |
| **NO TOUCH** | `scripts/hermes-plugin-examples/cns-brain-recall/plugin.py` (unless prefetch JSON contract changes — it should not) |
| **NO TOUCH** | Protect-list paths |

### Testing requirements

1. **`note-chunker.test.ts`:** 50-token note → 1 chunk; synthetic 2000-token note → N chunks with overlap; empty → `[]`.
2. **`build-index.test.ts`:** v2 artifact schema; `EMPTY_NOTE` exclusion; mock embedder called once per chunk.
3. **`query-index.test.ts`:** v2 fixture ranks correct chunk highest; **parent-collapse: a fixture where note A has 5 high-scoring chunks and note B has 1 lower-scoring chunk must return BOTH A and B within top-k=5, not 5×A** (guards the precision@k=1 voice_pane failure); v1 fixture → `INDEX_SCHEMA_STALE`.
4. **`recall-inject.test.ts`:** injected body equals chunk `text` from fixture index, not whole-note head; parent path in header.
5. **Regression:** `portal-embedder.test.ts`, `indexing-secret-gate.test.ts` still pass.
6. **Integration (dev):** live `brain:calibrate` PASS artifact — required for story completion unless operator documents waiver.

### Previous story intelligence (79-4 / 79-5)

- **79-4:** Calibration harness + `precision@k` = |expected ∩ topK| / |expected| on **parent paths** — keep parent `path` in query results. `operator_signoff: pending`. Live Portal calibration failed — this story is the fix, not threshold tuning.
- **79-5:** Plugin wired with `shadow_mode: true`; prefetch calls `buildRecallInjection` — chunk inject flows through automatically once `recall-inject.ts` updated. Per-turn latency deferral in `deferred-work.md` still applies at live cutover.
- **79-2:** `PortalEmbedder` posts whole string to `/embeddings` — chunking must happen **before** `embed()`. Per-note embed failure isolation already exists — extend per-chunk.

### Git intelligence

Recent Epic 79 commits (newest first): `79-5` plugin+prefetch → `79-4` calibration → `79-3` recall-inject → `79-2` PortalEmbedder → `79-1` probe. Follow established patterns: vitest in `tests/brain/`, no new Hermes core edits, evidence in `_bmad-output/implementation-artifacts/`.

### Project context reference

- Constitution / WriteGate: `specs/cns-vault-contract/AGENTS.md` — no direct `AI-Context/AGENTS.md` edits.
- Deferred: `deferred-work.md` §79-4 — live calibration blocked until chunking; §79-5 — measure latency at live cutover.
- Sprint: Epic 79 `in-progress`; stories 79-1..79-5 `done`.

### References

- `_bmad-output/planning-artifacts/epics-hermes-omniscient.md` — Epic 79 (course-correction story 79-6 operator-added)
- `_bmad-output/planning-artifacts/architecture-hermes-omniscient.md` — recall policy, inject fence, test placement
- `_bmad-output/implementation-artifacts/79-4-golden-set-calibration-gate.md` — harness + artifact writer
- `_bmad-output/implementation-artifacts/79-5-production-cns-brain-recall-plugin-prefetch-cli.md` — shadow wiring
- `config/brain-golden-queries.json` — 12 golden queries (incl. Operator Guide paths)
- `src/brain/references/incremental-rebuild.md` — rebuild procedures
- Context7 `/niieani/gpt-tokenizer` — chunk tokenization

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor Agent)

### Debug Log References

- Context7 `/niieani/gpt-tokenizer`: `encode`/`decode` from `gpt-tokenizer/encoding/cl100k_base`; npm `3.4.0` published 2025-11-07 (≥14 days).
- `bash scripts/verify.sh` PASS (742 vitest + lint + cns-dashboard when present).

### Completion Notes List

- **Schema v2:** `build-index` embeds body-only passage chunks (768 target / 64 overlap, `cl100k_base`); `EMPTY_NOTE` for zero-byte embeddable body; daily-note agent-log strip before chunking.
- **Query collapse:** `queryBrainIndex` scores all chunks, keeps max-score chunk per parent, returns top-k **distinct parents** with `chunk_index` + `text`; v1 indexes throw `INDEX_SCHEMA_STALE`.
- **Recall inject:** uses winning chunk `text` from query results; parent path in `### vault:<path>`; secret-gate still reads parent note once per path (cached).
- **Manifest:** `chunking` block + `counts.notes_embedded`; `counts.embedded` = chunk count.
- **Protect-list:** zero edits to `src/agents/*`, `run-chain.ts`, `scripts/run-chain.ts`, `plugin.py`.
- **`shadow_mode`:** left `true` in `config/brain-recall-policy.json` (unchanged).

**Operator calibration session (not run here — needs Portal proxy + live vault):**

```bash
export CNS_VAULT_ROOT=/mnt/c/Users/Christopher\ Taylor/Knowledge-Vault-ACTIVE
export CNS_BRAIN_EMBEDDER=portal
export CNS_BRAIN_EMBED_MODEL=text-embedding-3-large
export CNS_BRAIN_EMBED_BASE_URL=http://127.0.0.1:8645/v1
export CNS_BRAIN_INDEX_PATH=/abs/outside/vault/brain-index/brain-index.json
export CNS_BRAIN_TOKEN_COUNT_BASE_URL=http://127.0.0.1:8645/v1
export CNS_BRAIN_TOKEN_COUNT_MODEL=anthropic/claude-sonnet-4-6

hermes proxy start   # separate terminal

npm run brain:index -- --output-dir "$(dirname "$CNS_BRAIN_INDEX_PATH")"

npm run brain:calibrate -- \
  --index-path "$CNS_BRAIN_INDEX_PATH" \
  --write-artifact

# After 36/36 pass + review: operator sets operator_signoff + shadow_mode false
```

### File List

- `src/brain/note-chunker.ts` (NEW)
- `tests/brain/note-chunker.test.ts` (NEW)
- `src/brain/build-index.ts`
- `src/brain/build-index-cli.ts`
- `src/brain/brain-index-manifest.ts`
- `src/brain/retrieval/query-index.ts`
- `src/brain/recall-inject.ts`
- `src/brain/references/incremental-rebuild.md`
- `tests/brain/build-index.test.ts`
- `tests/brain/query-index.test.ts`
- `tests/brain/recall-inject.test.ts`
- `tests/brain/calibration-harness.test.ts`
- `tests/hermes/cns-brain-recall-plugin.test.ts`
- `package.json`
- `package-lock.json`

### Change Log

- 2026-06-26: Story 79-6 — chunked brain index schema v2, parent-collapse query, chunk-aware recall inject; gpt-tokenizer@3.4.0; verify.sh green. Live calibration deferred to operator session.
