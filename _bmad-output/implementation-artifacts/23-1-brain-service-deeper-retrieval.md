# Story 23.1: Brain Service Deeper Retrieval (PAKE-weighted ranking hardening)

Status: done

Epic: 23 (Brain Service Deeper Retrieval)

## Story

As a **CNS operator and agent**,
I want **Brain retrieval to return higher-quality results using PAKE quality signals (and freshness signals) rather than near-pure cosine similarity**,
so that **the top results are more trustworthy and useful by default, without manual triage of low-quality notes**.

## Context / Baseline (read this before coding)

### Current retrieval path is “minimal”

- Query surface is currently a **read-only index query** that returns vault-relative paths (and optional scores):
  - `src/brain/retrieval/query-index.ts` exports `queryBrainIndex({ indexPath, query, ... })`.
  - CLI wrapper: `src/brain/query-index-cli.ts` uses `StubEmbedder` and prints JSON.
- Ranking today is **cosine similarity * (optional) quality multiplier**, with a small amount of hygiene:
  - Cosine similarity with guards: zero vectors, dimension mismatch warnings.
  - Quality multiplier: `src/brain/retrieval/quality-weighting.ts` uses `status`, `confidence_score`, `verification_status` (and ignores `pake_type` beyond presence).
  - When `qualityWeighting=true`, **archived** records are hard-excluded.
  - Sibling manifest (`brain-index-manifest.json`) is loaded best-effort only to emit warnings + provenance; it does **not** affect ranking.
- Index build currently captures **embedding** and **limited PAKE quality metadata**:
  - `src/brain/build-index.ts` extracts `status`, `confidence_score`, `verification_status`, `pake_type` into `record.quality` (optional).
  - Index build already enforces boundary/canonical reads, allowlist roots, secret exclusion, DailyNotes agent-log stripping.
  - Index manifest contains **freshness** signals: last build UTC, estimated stale count, sample list (Story 12.5).

### What’s weak (the motivation for this story)

- **PAKE weighting is incomplete**:
  - `pake_type` is recorded but does not influence rank (beyond a flat 0.25 penalty for missing quality entirely).
  - Down-ranking rules are not explicit about “operator trust”: e.g., draft/in-progress vs reviewed/verified is a multiplier, but no notion of “primary results should skew toward curated/reference notes”.
- **Freshness is not used to improve ranking**:
  - Retrieval reads sibling manifest and warns on staleness, but the **result list stays the same** even when the manifest indicates drift.
- **Score explainability is limited**:
  - Consumers can request `includeScores`, but cannot ask “why did this beat that?” (similarity vs multiplier vs freshness penalty).

### Touch points (expected)

- `src/brain/retrieval/query-index.ts` (ranking and output surface)
- `src/brain/retrieval/quality-weighting.ts` (quality multiplier model)
- `src/brain/build-index.ts` (ensure the index contains all quality signals needed for ranking)
- `src/brain/embedder.ts` (keep deterministic stub behavior; consider guardrails needed by ranking changes)
- `src/brain/build-index-cli.ts` and `src/brain/query-index-cli.ts` (CLI flags may need extension / explain mode)

## Hard Constraints / Guardrails

- **Read-only retrieval remains read-only**: `queryBrainIndex` must not read vault bodies or write anything. It only reads `brain-index.json` (and sibling `brain-index-manifest.json`).
  - [Source: `src/brain/query-index-cli.ts` help text]
- **No secrets in outputs**: Query output must never echo absolute index paths, vault roots, or note body fragments.
  - Existing tests assert this for the CLI; do not regress.
  - [Source: `tests/brain/query-index.test.ts` “prints JSON to stdout and never echoes…”]
- **Backward compatibility for index artifacts**:
  - Retrieval must tolerate older `brain-index.json` artifacts that may omit any new optional fields.
  - Prefer additive optional fields over schema_version bumps unless truly necessary.
- **Verify gate**: `bash scripts/verify.sh` must pass.

## Requirements

### R1. Strengthen PAKE-weighted ranking beyond status/confidence/verification

- Incorporate `pake_type` into ranking in a way that is:
  - deterministic
  - bounded (no multipliers > 1.0 unless explicitly justified)
  - explainable
  - testable with small fixture indexes

Minimum expectation:

- Define a **type preference weighting table** (or policy function) that nudges results toward more “reference-grade” note types in the primary corpus.
  - Example approach (illustrative, not prescriptive):
    - `SourceNote` / reference notes: weight 1.0
    - project/decision notes: weight 0.9
    - daily log / inbox notes: weight 0.6–0.75 (unless explicitly queried with low `minScore` override)
  - The table must live in code (not config) for now, and must default-safe (unknown types treated as “missing type”).
- Keep existing behavior that **archived** is excluded when `qualityWeighting=true`.

### R2. Freshness-aware ranking (use manifest signals when available)

- If sibling `brain-index-manifest.json` is present and parseable, and it includes staleness signals:
  - use them to **down-rank** paths likely stale *or* emit a stronger warning plus optional “degraded ranking” mode.

Minimum expectation:

- Extend retrieval’s manifest parsing to capture `freshness.estimated_stale_sample` (currently ignored).
- If `estimated_stale_sample` contains paths that appear in results:
  - apply a deterministic, bounded penalty when `qualityWeighting=true` (for example multiply by 0.85), and
  - add/keep an explicit warning code that ranking was freshness-penalized (new warning code permitted).

### R3. Explainability (optional but strongly recommended)

- Add an optional “explain” output mode that returns, per result:
  - raw cosine similarity
  - quality multiplier (and its components)
  - freshness penalty multiplier (when applied)
  - final score

Constraints:

- The explain mode must not include sensitive paths or note content. Only vault-relative `path` plus numeric scores and enum-ish metadata.

### R4. Index build provides the ranking inputs

- Ensure index records include the fields needed to implement R1–R3 without reading the vault at query time.
- Add only **safe** metadata (no absolute paths). If adding timestamps, store as:
  - vault-relative record fields only (e.g. `mtimeMs` as number), and
  - keep them optional for backward compatibility.

## Acceptance Criteria

### AC1. PAKE-weighted ranking improves primary results

- **Given** an index with two records where cosine similarity is equal (or near-equal),
  and one record has higher PAKE trust signals (e.g. reviewed + verified + higher confidence and/or preferred `pake_type`),
- **When** `queryBrainIndex(..., qualityWeighting=true)` is executed,
- **Then** the higher-trust record ranks above the lower-trust record,
  and this behavior is covered by unit tests.

### AC2. Freshness signals influence ranking deterministically when available

- **Given** a sibling `brain-index-manifest.json` with `freshness.estimated_stale_sample` listing one of the candidate paths,
- **When** `queryBrainIndex(..., qualityWeighting=true)` is executed,
- **Then** that path is down-ranked relative to an otherwise-equal non-stale candidate (deterministic tie-breakers still apply),
  and the output includes an explicit warning indicating freshness penalty was applied.

### AC3. Explain mode (if implemented) is safe and stable

- **Given** explain mode is enabled,
- **When** `queryBrainIndex` returns results,
- **Then** each result includes numeric components sufficient to justify the ordering,
  and the output never includes absolute filesystem paths or any note body fragments.

### AC4. Existing behavior does not regress

- **Given** existing Brain unit tests,
- **When** `npm test` is run,
- **Then** all existing Brain tests pass, including:
  - topK cap and warnings
  - manifest warnings and provenance
  - zero-vector handling
  - CLI output redaction safety checks

### AC5. Verify gate

- **Given** the repo baseline,
- **When** `bash scripts/verify.sh` is run,
- **Then** it passes.

## Tasks / Subtasks

- [x] Harden ranking model (AC: 1, 2, 4, 5)
  - [x] Update `computeQualityMultiplier` (or a successor function) to incorporate `pake_type` weighting explicitly.
  - [x] Define and document deterministic tie-break rules (must remain stable across runs).
  - [x] Keep archived exclusion semantics when `qualityWeighting=true`.

- [x] Freshness-aware ranking (AC: 2, 4, 5)
  - [x] Extend manifest parsing in `src/brain/retrieval/query-index.ts` to read `freshness.estimated_stale_sample`.
  - [x] Apply a bounded penalty for stale-sample matches when `qualityWeighting=true`.
  - [x] Add a new warning code for “freshness penalty applied” (or equivalent), and test it.

- [x] Explainability mode (AC: 3, 4, 5) (optional but recommended)
  - [x] Extend `QueryBrainIndexParams` with `explain?: boolean`.
  - [x] Extend output result items to include `components` only when explain is enabled.
  - [x] Update CLI to support `--explain` (and ensure output remains safe).

- [x] Index record metadata (AC: 1–5)
  - [x] Confirmed no new index record fields were needed; existing PAKE quality metadata and sibling manifest freshness signals provide the ranking inputs.
  - [x] No `src/brain/build-index.ts` change required.
  - [x] Updated retrieval manifest parsing to accept optional `freshness.estimated_stale_sample`.

- [x] Tests + verification (AC: 1–5)
  - [x] Extend `tests/brain/query-index.test.ts` with:
    - `pake_type` weighting ordering test
    - freshness stale-sample penalty ordering test
    - explain mode output safety assertions (if explain implemented)
  - [x] Update `tests/brain/quality-weighting.test.ts` for new weighting behavior (including unknown/missing `pake_type`).
  - [x] Run `bash scripts/verify.sh`.

### Review Findings

- [x] [Review][Patch] Guard against leaking absolute/sensitive `record.path` values in query results and explain output (validate/sanitize `rec.path` before returning; warn+skip if unsafe) [`src/brain/retrieval/query-index.ts:312`]
- [x] [Review][Patch] Make explain components internally consistent for “quality missing entirely” flat penalty (components should justify the returned `multiplier=0.25`, or include an explicit `missingQuality`/override indicator) [`src/brain/retrieval/quality-weighting.ts:54`]
- [x] [Review][Patch] Improve `ZERO_VECTOR_QUERY` warning message to cover non-finite embeddings (current message implies only empty/zero) [`src/brain/retrieval/query-index.ts:271`]

## Dev Notes

### Key implementation constraints (avoid common mistakes)

- **Do not read vault bodies during query**: all ranking inputs must come from `brain-index.json` and sibling manifest only.
- **Avoid schema_version bumps** unless absolutely required; prefer optional additive fields.
  - Zod behavior note: when parsing index artifacts, ensure unknown fields don’t break parsing, and ensure added fields are optional for old artifacts.
- **Warning taxonomy**: keep warnings actionable; do not spam. Prefer one warning per condition with counts where appropriate.
- **No output leaks**: maintain the existing CLI behavior that outputs only vault-relative paths and numeric metadata; no absolute paths.

### Project structure notes

- Brain code lives under `src/brain/` with retrieval-specific logic under `src/brain/retrieval/`.
- Tests for Brain are under `tests/brain/` and use `vitest`.

### References

- Retrieval query + warnings + provenance: `src/brain/retrieval/query-index.ts`
- Quality multiplier model: `src/brain/retrieval/quality-weighting.ts`
- Index build (quality extraction, secret gate, DailyNotes agent-log stripping): `src/brain/build-index.ts`
- Index manifest freshness signals: `src/brain/brain-index-manifest.ts`
- Current query tests + CLI safety assertions: `tests/brain/query-index.test.ts`
- Quality-weighting tests: `tests/brain/quality-weighting.test.ts`
- Phase 2.1 Brain charter (trust boundaries, corpora, freshness intent): `_bmad-output/planning-artifacts/brain-service-phase-2-1-charter.md`

## Standing tasks (every story)

### Standing task: Update operator guide
- [x] If this story changes any user-facing behavior (new tool, new workflow, new constraint, new panel, new integration): update `03-Resources/CNS-Operator-Guide.md` via `vault_create_note` (full overwrite) or `vault_update_frontmatter` plus targeted section edit. Bump `modified` date and add a row to the Version History table in Section 12.
- [ ] If no user-facing behavior changed: note "Operator guide: no update required" in Dev Agent Record.

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Baseline before edits: `npm test` passed.
- Focused verification: `npx vitest run tests/brain/query-index.test.ts tests/brain/quality-weighting.test.ts` passed.
- TypeScript build: `npm run build` passed.
- Final verify gate: `bash scripts/verify.sh` passed.

### Completion Notes List

- Added bounded PAKE type preference weighting to quality ranking while preserving archived exclusion under `qualityWeighting=true`.
- Added freshness-aware ranking from sibling manifest `freshness.estimated_stale_sample` with a `0.85` penalty and `FRESHNESS_PENALTY_APPLIED` warning.
- Added safe explain mode via `QueryBrainIndexParams.explain` and CLI `--explain`; output includes numeric score components only.
- Confirmed no new index record metadata or build-index changes were needed for this story.
- Updated the tracked operator guide mirror with Story 23.1 retrieval behavior.

### File List

- `src/brain/retrieval/quality-weighting.ts`
- `src/brain/retrieval/query-index.ts`
- `src/brain/query-index-cli.ts`
- `tests/brain/quality-weighting.test.ts`
- `tests/brain/query-index.test.ts`
- `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`
- `_bmad-output/implementation-artifacts/23-1-brain-service-deeper-retrieval.md`
