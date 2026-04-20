# Story 18.1: Research Agent Output Quality Fixes

Status: done

Epic: 18 (Research quality + Perplexity carry)

## Story

As an **operator**,
I want **the Research Agent ingest path to preserve title hints and skip low-quality snippets**,
so that **automated sweeps create stable, meaningful SourceNotes and do not pollute the vault with useless short bodies**.

## Context / Baseline

- Green baseline: **454 tests passing** (22 TAP + 432 Vitest) and `bash scripts/verify.sh` passes.
- There is **one untracked file that must be committed first** (separate from this story’s code changes): `scripts/run-research-agent.ts`.
- Scope constraint: **only these three code files may change** unless a type signature forces a change elsewhere:
  - `src/ingest/normalize.ts`
  - `src/ingest/pipeline.ts`
  - `src/agents/research-agent.ts`

## Acceptance Criteria

1. **Title hint preservation (normalize)**
   - **Given** `normalizeUrl(url, fetchedContent, titleHint?)`
   - **When** `titleHint` is provided and non-empty
   - **Then** `NormalizedContent.title` uses `titleHint` (trimmed), without calling `deriveTitle(...)`
   - **And** if `titleHint` is absent/empty, behavior falls back to `deriveTitle(body, canonical)` (current behavior).

2. **Title hint forwarded for URL ingest (pipeline)**
   - **Given** ingest input includes `title_hint`
   - **When** `runIngestPipeline()` normalizes a URL source
   - **Then** `input.title_hint` is forwarded all the way to `normalizeUrl()` as the title hint for that URL normalization.

3. **Depth defaults (research brief schema)**
   - **Given** callers may omit `depth`
   - **When** `researchBriefSchema` parses a brief without `depth`
   - **Then** parsing succeeds and `depth` defaults to `"deep"`.

4. **Quality gate for Firecrawl + Apify bodies**
   - **Given** a Firecrawl or Apify sweep produces a candidate body payload
   - **When** the body (after `.trim()`) is **< 200 characters**
   - **Then** the candidate is **skipped** (no ingest attempt is made)
   - **And** the skip is recorded in `ResearchSweepResult.notes_skipped` with:
     - `reason: "quality_gate"`
     - `source_uri`: the hit/snippet URL (or best-available stable URI; match existing patterns used for adapter failures)

5. **Verify gate**
   - `bash scripts/verify.sh` passes with **454+ tests** (no regressions).

6. **Change scope**
   - No changes outside the three named files unless a type signature forces it.

## Tasks / Subtasks

- [x] **Pre-work (repo hygiene)**
  - [x] Commit untracked `scripts/run-research-agent.ts` in its own commit before starting story work (this story should not mix that file with behavior changes).

- [x] **BUG 1 — `src/ingest/normalize.ts`: use title hints for URLs**
  - [x] Update `normalizeUrl(url, fetchedContent)` → `normalizeUrl(url, fetchedContent, titleHint?)`.
  - [x] Title selection rules:
    - If `titleHint?.trim().length > 0`: use it as `title`.
    - Else: `title = deriveTitle(body, canonical)` (existing fallback).
  - [x] Update the URL branch in `normalizeInput(...)` to forward `titleHint` into `normalizeUrl(...)`.
  - [x] Ensure behavior of `normalizeText(text, titleHint?)` remains unchanged.

- [x] **BUG 2 — `src/ingest/pipeline.ts`: forward `input.title_hint` for URL source type**
  - [x] Confirm `runIngestPipeline()` passes `input.title_hint` into `normalizeInput(...)` (it should already be present).
  - [x] Ensure the URL normalization path actually uses this hint (via the `normalize.ts` forwarding above), so Firecrawl/Apify-provided titles prevent title collisions and improve filenames.

- [x] **BUG 3 — `src/agents/research-agent.ts`: schema default + quality gate**
  - [x] **3a Depth default**
    - [x] Update `researchBriefSchema.depth` to default to `"deep"` (e.g. `z.enum([...]).default("deep")`).
    - [x] Ensure `runResearchAgent()` continues to parse via `researchBriefSchema.parse(brief)` and callers omitting `depth` no longer throw.
  - [x] **3b Quality gate for short bodies**
    - [x] Extend the skip-reason enum to include `"quality_gate"`:
      - Update `skipReasonSchema` accordingly.
      - Ensure `skippedNoteSchema` and `researchSweepResultSchema` still validate.
    - [x] Firecrawl path (`firecrawlSweep`):
      - [x] After computing `body` (snippet/title/url OR scraped markdown) and before calling `runIngestPipeline`, apply:
        - if `body.trim().length < 200`: `skipped.push({ source_uri: hit.url, reason: "quality_gate" })` and continue.
    - [x] Apify path (`apifySweep`):
      - [x] Before calling `runIngestPipeline`, apply:
        - if `snippet.text.trim().length < 200`: skip with `reason: "quality_gate"` and best-available `source_uri`:
          - Prefer `snippet.url` when present; otherwise use a stable synthetic URI pattern consistent with the file’s existing `urn:cns:research-sweep:...` helpers (do not introduce a new file).

### Review Findings

- [x] [Review][Decision] Story change-scope vs tests/artifacts — **Resolved:** allow tests + story/sprint artifacts for this story; AC6 treated as “code scope” only.
- [x] [Review][Patch] Apify whitespace URL treated as “has URL”, can yield empty `source_uri` [src/agents/research-agent.ts:241]  
  `hasUrl` uses `snippet.url.length > 0` (no trim). A URL like `"   "` routes into URL ingest, then `normalizeUrl` trims canonical to `""`, bypassing duplicate checks and attempting a governed write with `source_uri: ""`.
- [x] [Review][Patch] Apify empty-body + missing-URL snippets are dropped without any `notes_skipped` record [src/agents/research-agent.ts:242]  
  When `!body || body.trim().length === 0` and `hasUrl === false`, the loop continues with no skip record, so sweep accounting silently loses a candidate. A synthetic `urn:cns:research-sweep:apify:snippet:...` would satisfy “best-available stable URI” patterns.

## Dev Notes / Guardrails (read before coding)

- **Where the bugs live today**
  - `src/ingest/normalize.ts`
    - `normalizeUrl()` currently always does `deriveTitle(body, canonical)` and ignores title hints.
    - `normalizeInput()` already receives `titleHint?: string`, but the URL branch does not use it.
  - `src/ingest/pipeline.ts`
    - `runIngestPipeline()` already passes `input.title_hint` into `normalizeInput(...)`; the missing link is that URL normalization ignores the hint.
  - `src/agents/research-agent.ts`
    - `researchBriefSchema.depth` is currently required, so callers omitting it fail parse.
    - Firecrawl `standard` depth can produce short snippets (40–80 chars) that currently pass only the `body.trim().length === 0` guard and are ingested; this story adds a minimum length gate for Firecrawl + Apify bodies.

- **Why title hints matter**
  - In Story 17-2’s Dev Agent Record, ingest filename collisions were avoided in tests by varying bodies because URL titles were derived from body text. Preserving `title_hint` from Firecrawl/Apify makes titles stable, improves filenames, and prevents collisions when body content is repetitive.

- **Do not widen scope**
  - No refactors, no new helpers in other files, no new logging frameworks.
  - The only new skip reason is `"quality_gate"` and it must flow through Zod schemas and the returned sweep result shape.

- **Verification**
  - Must run `bash scripts/verify.sh` and keep the test baseline at **454+**.

## Standing tasks (every story)

### Standing task: Update operator guide
- [x] If this story changes any user-facing behavior (new tool, new workflow, new constraint, new panel, new integration): update `03-Resources/CNS-Operator-Guide.md` via `vault_create_note` (full overwrite) or `vault_update_frontmatter` plus targeted section edit. Bump `modified` date and add a row to the Version History table in Section 12.
- [ ] If no user-facing behavior changed: note "Operator guide: no update required" in Dev Agent Record.

## Dev Agent Record

### Agent Model Used

GPT-5.2 (Cursor)

### Debug Log References

 - `bash scripts/verify.sh` (2026-04-20) — green after implementation

### Completion Notes List

- ✅ `normalizeUrl(..., titleHint?)` now prefers non-empty trimmed title hints over `deriveTitle(...)`, and URL normalization receives the hint via `normalizeInput(...)`.
- ✅ `researchBriefSchema.depth` now defaults to `"deep"` when omitted.
- ✅ Research sweeps now skip Firecrawl/Apify candidates with `body.trim().length < 200` and record skips with `reason: "quality_gate"` in `notes_skipped`.
- ✅ Verify gate: `bash scripts/verify.sh` passing (454+ baseline preserved).

### File List

- `src/ingest/normalize.ts` (modified)
- `src/agents/research-agent.ts` (modified)
- `tests/vault-io/ingest-pipeline.test.ts` (modified)
- `tests/vault-io/research-agent.test.ts` (modified)
- `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)
- `_bmad-output/implementation-artifacts/18-1-research-agent-output-quality-fixes.md` (modified)

### Change Log

| Date | Change |
|------|--------|
| 2026-04-20 | Implemented title-hint preservation for URL ingest + research brief depth default + sweep quality gate; verify gate green; status → review | 18-1-research-agent-output-quality-fixes |
