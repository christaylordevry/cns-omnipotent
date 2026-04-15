# Story 12.7: PAKE quality weighting for retrieval

Status: review

<!-- Sprint tracker: epic-12 / 12-7-pake-quality-weighting-for-retrieval. Make retrieval ranking quality-aware by persisting PAKE metadata at index time and applying documented weighting rules at query time. No new MCP tools; no vault mutations; no vector DB changes. -->

## Story

As a **maintainer**,
I want **retrieval ranking informed by PAKE metadata**,
so that **low-quality or incomplete notes surface less often in primary results**.

## Acceptance Criteria

1. **Quality metadata persisted at index time**
   **Given** the build pipeline (Story 12.4) already parses frontmatter for every indexed note
   **When** a note passes all eligibility gates and is embedded
   **Then** the index record includes a `quality` field containing the PAKE quality signals extracted from frontmatter: `status`, `confidence_score`, `verification_status`, and `pake_type`
   **And** missing fields are represented as absent (not filled with defaults) so query-time logic can distinguish "missing" from "explicitly low"
   **And** the `brain-index.json` schema remains backwards-compatible: existing v1 indexes without `quality` fields are still loadable by the query API (quality fields are optional in the record schema).

2. **Documented quality weighting rules applied at query time**
   **Given** notes with varying PAKE quality signals (or no quality signals at all)
   **When** `queryBrainIndex` returns ranked results
   **Then** the final ranking score combines cosine similarity with a quality multiplier derived from documented rules
   **And** the weighting rules are documented in Dev Notes and operator guide with clear formulas
   **And** notes with **missing quality metadata entirely** (no `quality` field on the record) receive a down-ranking penalty, not a neutral score, so incomplete Nexus-origin content is never silently promoted into top results
   **And** the combined score uses a formula that preserves cosine-similarity ordering when quality signals are equal across notes (quality is a tiebreaker / boost, not a replacement for semantic relevance).

3. **Nexus-origin / incomplete PAKE handling**
   **Given** the charter requires that incomplete Nexus-origin content must not be silently promoted into the primary corpus
   **When** a record has no quality metadata, or has `status: "draft"` with `verification_status: "pending"` and low or absent `confidence_score`
   **Then** it is down-ranked relative to notes with complete, high-quality PAKE signals
   **And** this behavior is deterministic and documented.

4. **Query API opt-out for quality weighting**
   **Given** operators or future consumers may want raw cosine-similarity ranking
   **When** the query API receives a parameter to disable quality weighting (e.g. `qualityWeighting: false`)
   **Then** ranking falls back to pure cosine similarity (Story 12.6 behavior) with no quality adjustment
   **And** the default is `qualityWeighting: true` (quality weighting enabled).

5. **Verification gate**
   **Given** the repo verify gate
   **When** `bash scripts/verify.sh` runs
   **Then** it passes with new focused tests covering: quality metadata persistence in index records, weighted ranking versus pure cosine ranking, missing-quality down-ranking, opt-out parameter behavior, and deterministic ordering with quality tiebreaks.

## Tasks / Subtasks

- [x] **AC #1 — Extend build-time record shape:** Add an optional `quality` field to `BuildIndexRecord` in `src/brain/build-index.ts` containing `{ status?, confidence_score?, verification_status?, pake_type? }`. Extract these from the already-parsed frontmatter during the gate chain, after the PAKE type filter and secret gate pass. Serialize quality into `brain-index.json` records.
  - [x] Define a `QualityMetadata` type (or equivalent) in a shared location (e.g. `src/brain/quality.ts` or inline in `build-index.ts` if small).
  - [x] Extract quality fields from `parsed.frontmatter` using safe optional reads — do not require full PAKE validation (notes may have partial frontmatter and still be indexed).
  - [x] Ensure the serializer (`serializeBuildIndexArtifact`) includes `quality` when present.

- [x] **AC #1 — Backwards-compatible index schema:** Extend `IndexArtifactSchema` in `src/brain/retrieval/query-index.ts` to accept optional `quality` on each record. Existing v1 indexes without `quality` must still parse successfully.

- [x] **AC #2–#3 — Implement quality weighting logic:** Add a `computeQualityMultiplier(quality?: QualityMetadata): number` function (in a new `src/brain/retrieval/quality-weighting.ts` or directly in `query-index.ts`) that computes a multiplier in `(0, 1]` from PAKE fields. Document the formula in code and in Dev Notes. Apply it to produce `final_score = cosine_score * quality_multiplier` before sorting.

- [x] **AC #4 — Add `qualityWeighting` parameter:** Extend `QueryBrainIndexParams` with optional `qualityWeighting?: boolean` (default `true`). When `false`, skip quality multiplier and sort by raw cosine similarity.

- [x] **AC #2–#3 — Update `queryBrainIndex` ranking pipeline:** After cosine scoring, apply quality multiplier per record (unless `qualityWeighting: false`), then stable-sort by `final_score desc, path asc`.

- [x] **AC #4 — Update CLI:** Add `--no-quality-weighting` flag to `src/brain/query-index-cli.ts` that passes `qualityWeighting: false`.

- [x] **AC #5 — Tests:** Add/extend tests under `tests/brain/`:
  - [x] Quality metadata extraction and persistence in build output
  - [x] `computeQualityMultiplier` unit tests for each PAKE field combination
  - [x] Weighted ranking: verified high-confidence note ranks above draft low-confidence note with similar cosine scores
  - [x] Missing quality → down-ranked relative to complete quality metadata
  - [x] `qualityWeighting: false` → pure cosine order preserved
  - [x] Deterministic ordering with quality tiebreaks
  - [x] Backwards compatibility: query API loads a v1 index without `quality` fields
- [x] Run `bash scripts/verify.sh` and record results in Dev Agent Record.
- [x] **Standing task — Operator guide:** Update `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` to document quality weighting rules, how to disable them, and what PAKE fields influence ranking. Bump `modified` and add a Version History row.

## Dev Notes

### Epic and program context

Epic 12 builds semantic retrieval on top of PAKE. The executable slice through Stories 12.2–12.6 established:

- **12.2**: Allowlist contract and `parseBrainCorpusAllowlist`
- **12.3**: Secret scan gate for indexing (`evaluateNoteForEmbeddingSecretGate`)
- **12.4**: Operator-triggered pipeline producing `brain-index.json` with `{ path, embedding }` records
- **12.5**: Manifest with drift/freshness signals (`brain-index-manifest.json`)
- **12.6**: Read-only query API using cosine similarity with deterministic ranking

Story 12.7 makes ranking **quality-aware** by extending the pipeline at both ends:
1. **Build time**: persist PAKE quality signals alongside embeddings
2. **Query time**: combine cosine similarity with quality-derived multiplier

Story **12.8** (next) will add the optional quarantine corpus for Nexus-origin notes. 12.7 must not implement quarantine logic, but its down-ranking behavior for incomplete PAKE is the default-safe posture that 12.8 builds on.

### Technical requirements (guardrails)

#### Index record extension

The current `BuildIndexRecord` ([Source: `src/brain/build-index.ts:29-32`]) is `{ path, embedding }`. Extend to:

```typescript
type QualityMetadata = {
  status?: "draft" | "in-progress" | "reviewed" | "archived";
  confidence_score?: number;
  verification_status?: "pending" | "verified" | "disputed";
  pake_type?: string;
};

type BuildIndexRecord = {
  path: string;
  embedding: number[];
  quality?: QualityMetadata;
};
```

Extract quality fields from `parsed.frontmatter` at line ~236 in `build-index.ts` (after the secret gate passes, before `embedder.embed`). Use safe optional access — do not `safeParse` against `pakeStandardFrontmatterSchema` because notes with partial frontmatter should still contribute quality signals when available.

**Do not import or depend on `pakeStandardFrontmatterSchema` validation here** — that schema requires all fields present and would reject partial frontmatter. Instead, read fields directly from the already-parsed `frontmatter` record using type guards.

#### Backwards compatibility

The `IndexArtifactSchema` in `query-index.ts` ([Source: `src/brain/retrieval/query-index.ts:9-22`]) must be updated to accept optional `quality` on records:

```typescript
records: z.array(
  z.object({
    path: z.string(),
    embedding: z.array(z.number()),
    quality: z.object({
      status: z.string().optional(),
      confidence_score: z.number().optional(),
      verification_status: z.string().optional(),
      pake_type: z.string().optional(),
    }).optional(),
  }),
),
```

Keep `schema_version: 1` since the change is additive (optional field). Existing indexes without `quality` will parse cleanly.

#### Quality weighting formula

Recommended formula (document in code and operator guide):

```
quality_multiplier = status_weight * confidence_weight * verification_weight
```

Where:
- **`status_weight`**: `reviewed` → 1.0, `in-progress` → 0.85, `draft` → 0.65, `archived` → 0.4, missing → 0.5
- **`confidence_weight`**: if present, use the value directly (already 0–1); if missing → 0.5
- **`verification_weight`**: `verified` → 1.0, `pending` → 0.8, `disputed` → 0.5, missing → 0.6
- **No quality metadata at all** (no `quality` field on record): apply a flat `0.25` multiplier (aggressive down-rank for completely unclassified content)

This yields:
- Best case (reviewed, confidence 1.0, verified): `1.0 × 1.0 × 1.0 = 1.0`
- Typical good note (reviewed, confidence 0.8, verified): `1.0 × 0.8 × 1.0 = 0.8`
- Draft unverified (draft, confidence 0.5, pending): `0.65 × 0.5 × 0.8 = 0.26`
- No quality metadata: `0.25` (flat penalty)
- Nexus-origin with minimal metadata (draft, no confidence, pending): `0.65 × 0.5 × 0.8 = 0.26`

The formula ensures: (a) semantic relevance still dominates (cosine similarity range is [-1, 1]), (b) quality is a multiplier that re-orders within similar semantic bands, (c) incomplete metadata is never promoted above complete metadata at similar cosine scores.

**Final score:**
```
final_score = cosine_similarity * quality_multiplier
```

#### Integration into query pipeline

In `queryBrainIndex` ([Source: `src/brain/retrieval/query-index.ts:213-279`]):

1. After computing `cosineSimilarity(queryVec, rec.embedding)`, if `qualityWeighting` is enabled, compute `quality_multiplier` from `rec.quality` and multiply.
2. Apply `minScore` filter against the **final** weighted score (not raw cosine), so low-quality notes that happen to be semantically close are filtered if `minScore` is set high.
3. Sort by `final_score desc, path asc` (same stable sort contract as 12.6).

#### Files that must NOT change

- `src/index.ts` — no new MCP tool registration
- `src/register-vault-io-tools.ts` — no changes
- `specs/cns-vault-contract/` — no normative spec changes

### Architecture compliance

- TypeScript / Node, Vitest tests under `tests/brain/`.
- Keep changes scoped to `src/brain/` (build + retrieval modules) and `tests/brain/`.
- Follow existing patterns: `kebab-case.ts` files, `camelCase` functions, Zod for schema validation.
- No new npm dependencies.

### File structure requirements

| Area | Expected touch |
|------|----------------|
| `src/brain/build-index.ts` | Extend `BuildIndexRecord` type, add quality extraction in `runBuildIndex` gate chain, update `serializeBuildIndexArtifact` |
| `src/brain/retrieval/query-index.ts` | Extend `IndexArtifactSchema` records with optional quality, add `qualityWeighting` param, apply quality multiplier in ranking |
| `src/brain/retrieval/quality-weighting.ts` (new) | `QualityMetadata` type, `computeQualityMultiplier` function, documented constants |
| `src/brain/query-index-cli.ts` | Add `--no-quality-weighting` flag |
| `tests/brain/query-index.test.ts` | Extend with quality weighting tests |
| `tests/brain/build-index.test.ts` | Extend to verify quality metadata in output records |
| `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` | Document quality weighting rules and opt-out |

### Testing requirements

- All tests must be fully offline using `StubEmbedder` or deterministic fake embedder.
- Build a minimal `brain-index.json` fixture with records that have varying `quality` metadata.
- Verify that `computeQualityMultiplier` is deterministic for all PAKE field combinations.
- Verify a note with `status: "reviewed"`, `confidence_score: 0.9`, `verification_status: "verified"` outranks a note with `status: "draft"`, `confidence_score: 0.3`, `verification_status: "pending"` at similar cosine scores.
- Verify a record with no `quality` field is ranked below records with any quality metadata.
- Verify `qualityWeighting: false` produces identical results to Story 12.6 behavior.
- Verify backwards compatibility: the query API loads and ranks a v1 index artifact (no `quality` fields) with quality weighting enabled — all records get the "no quality metadata" penalty and ranking is still deterministic.
- Run `bash scripts/verify.sh`.

### Previous story intelligence

From **12.6** ([Source: `_bmad-output/implementation-artifacts/12-6-retrieval-query-api-read-only.md`]):

- The query API (`queryBrainIndex`) is a pure async function in `src/brain/retrieval/query-index.ts`.
- It loads `brain-index.json`, embeds the query, computes cosine similarity, and returns topK results.
- Stable sort: `score desc, path asc` (lexical tiebreak by path, locale `"en"`).
- Review patches applied: topK capping with `TOPK_CAPPED` warning, dimension mismatch handling, NaN/Infinity guard, CLI finite-number validation.
- Deferred: CLI always uses `StubEmbedder` (known scope for future adapter story); no path normalization on result paths (trust boundary belongs to 12.4).

From **12.4** ([Source: `_bmad-output/implementation-artifacts/12-4-minimal-embeddings-pipeline-operator-triggered.md`]):

- The build pipeline in `src/brain/build-index.ts` discovers candidates, applies gates (canonical read → frontmatter → pake_types → secret → embed), and produces `brain-index.json`.
- Frontmatter is already parsed via `parseNoteFrontmatter` at line ~217. The `parsed.frontmatter` record is a `Record<string, unknown>` containing whatever YAML the note has — this is the natural extraction point for quality fields.
- Records are `{ path, embedding }` sorted lexically by path.

From **12.5** ([Source: `_bmad-output/implementation-artifacts/12-5-index-manifest-and-drift-signals.md`]):

- Manifest includes counts and exclusion breakdowns. No changes needed for 12.7 — manifest is already stable.
- Deferred: per-file index-time `mtimeMs` persistence. Not relevant to quality weighting.

### Git intelligence summary

Recent commits on `master` include the Story 12.6 query API implementation and code-review follow-up patches. The `src/brain/retrieval/query-index.ts` file is the primary touch point and was last modified by the 12.6 review cycle. `src/brain/build-index.ts` was last significantly changed in 12.5 for manifest integration.

### Latest technical information

No new libraries needed. All PAKE quality field types are defined in `src/pake/schemas.ts` ([Source: `src/pake/schemas.ts:41-43`]):
- `status: z.enum(["draft", "in-progress", "reviewed", "archived"])`
- `confidence_score: z.number().min(0).max(1)`
- `verification_status: z.enum(["pending", "verified", "disputed"])`

These are the canonical type literals. The quality weighting module should reference these values but not import the Zod schema (to avoid coupling build-index to full PAKE validation). Use string literal types directly.

### Project context reference

No `project-context.md` in repo. Use this story, `CLAUDE.md`, `specs/cns-vault-contract/modules/security.md`, the Brain charter (`_bmad-output/planning-artifacts/brain-service-phase-2-1-charter.md`), and the allowlist contract as the context bundle.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 12, Story 12.7]
- [Source: `_bmad-output/planning-artifacts/brain-service-phase-2-1-charter.md` — Security: Nexus dual-path and incomplete PAKE notes]
- [Source: `_bmad-output/implementation-artifacts/12-6-retrieval-query-api-read-only.md`]
- [Source: `_bmad-output/implementation-artifacts/12-4-minimal-embeddings-pipeline-operator-triggered.md`]
- [Source: `src/brain/build-index.ts` — BuildIndexRecord, runBuildIndex, serializeBuildIndexArtifact]
- [Source: `src/brain/retrieval/query-index.ts` — queryBrainIndex, IndexArtifactSchema, cosineSimilarity]
- [Source: `src/pake/schemas.ts` — status, confidence_score, verification_status canonical types]
- [Source: `src/brain/query-index-cli.ts` — CLI entrypoint]

## Standing tasks (every story)

### Standing task: Update operator guide
- [ ] If this story changes any user-facing behavior (new tool, new workflow, new constraint, new panel, new integration): update `03-Resources/CNS-Operator-Guide.md` via `vault_create_note` (full overwrite) or `vault_update_frontmatter` plus targeted section edit. Bump `modified` date and add a row to the Version History table in the existing Brain section used by Stories 12.2–12.6.
- [ ] If no user-facing behavior changed: note **"Operator guide: no update required"** in Dev Agent Record.

## Dev Agent Record

### Agent Model Used

GPT-5.2 (Cursor coding agent)

### Debug Log References

N/A (local Vitest + verify gate runs)

### Completion Notes List

- ✅ Persisted optional `quality` metadata (`status`, `confidence_score`, `verification_status`, `pake_type`) into `brain-index.json` records at build time using the already-parsed frontmatter (no additional reads).
- ✅ Added query-time scoring: `final_score = cosine_similarity * quality_multiplier` with a flat penalty for missing `quality` metadata, and deterministic ordering by `final_score desc, path asc`.
- ✅ Added `qualityWeighting?: boolean` (default `true`) and `--no-quality-weighting` CLI opt-out, with explicit tests ensuring pure cosine ordering is preserved when disabled.
- ✅ Updated operator guide with documented weighting rules and opt-out flag.
- ✅ `bash scripts/verify.sh` passes.

### File List

- `src/brain/build-index.ts`
- `src/brain/quality.ts` (new)
- `src/brain/retrieval/query-index.ts`
- `src/brain/retrieval/quality-weighting.ts` (new)
- `src/brain/query-index-cli.ts`
- `tests/brain/build-index.test.ts`
- `tests/brain/query-index.test.ts`
- `tests/brain/quality-weighting.test.ts` (new)
- `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`

### Change Log

- 2026-04-14: Added PAKE quality metadata persistence + quality-weighted retrieval ranking with opt-out flag; added focused tests and updated operator guide.
