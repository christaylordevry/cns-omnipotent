# Story 20.3: Vault hygiene — Apify source frontmatter + duplicate title detection
#
Status: ready-for-dev
#
Epic: 20 (Research agent routing hardening)
#
## Story
As an **operator / dev agent**,
I want **SourceNotes created via the Apify adapter to carry `source: apify` in frontmatter**, and I want **duplicate titles in `03-Resources/` detected and handled deterministically**,
so that **note provenance is consistent with the Epic 20 provenance contract and the vault stays clean when multiple notes share the same declared title**.
#
## Context / Baseline
- Research Agent acquisition tiers create SourceNotes via `runIngestPipeline()`:
  - Firecrawl sweep: `src/agents/research-agent.ts` (`firecrawlSweep`)
  - Apify sweep: `src/agents/research-agent.ts` (`apifySweep`)
  - Scrapling sweep: `src/agents/research-agent.ts` (`scraplingSweep`)
- `runIngestPipeline()` creates governed notes by calling `vaultCreateNote()` with:
  - `pake_type`, `title`, `content`, `tags`, optional `source_uri`
  - PAKE validation is passthrough on extra keys, so adding a new metadata key is permitted.
- Existing duplicate detection only checks `source_uri` via `governedNoteExistsWithSourceUri()` in `src/ingest/duplicate.ts`.
- Epic 20 provenance contract (Story 20.1) already asserts `ResearchSweepResult.notes_created[].source === "apify"` for social-domain routed queries. This story extends that contract down into the written note frontmatter.
#
## Touch points (developer must read)
- `src/agents/research-agent.ts`
  - `apifySweep()` ingest inputs for SourceNotes
- `src/ingest/pipeline.ts`
  - `runIngestPipeline()` where duplicate checks occur and `vaultCreateNote()` is called
- `src/ingest/duplicate.ts`
  - existing `governedNoteExistsWithSourceUri()` logic to extend for title duplicates
- `src/tools/vault-create-note.ts`
  - `VaultCreateNoteInput` and `buildVaultCreateNoteMarkdown()` where frontmatter is constructed
- Tests:
  - `tests/vault-io/ingest-pipeline.test.ts` (duplicate behavior)
  - `tests/vault-io/research-agent.test.ts` (Apify SourceNote frontmatter provenance)
#
## Acceptance Criteria
### A. Apify SourceNote frontmatter tagging (AC: apify-frontmatter-source)
1. **Given** the Research Agent ingests a SourceNote candidate produced by the Apify adapter
2. **When** the governed note is created under `03-Resources/`
3. **Then** the note YAML frontmatter includes `source: "apify"`
4. **And** this does not change the Phase 1 `vault_create_note` MCP tool signature (this is internal pipeline enrichment, not a new tool field)
#
### B. Duplicate title detection in `03-Resources/` (AC: duplicate-title)
1. **Given** `03-Resources/` contains 2 or more governed notes whose YAML frontmatter `title` values are identical (string equality)
2. **When** the ingest pipeline is about to create another governed note with that same `title`
3. **Then** the pipeline must:
   - scan `03-Resources/` for matches
   - log a warning (stderr or equivalent) that includes the duplicated title and the set of matching paths
   - keep the newest matching note as the canonical survivor
   - return a `duplicate` ingest result (so callers map to `reason: "duplicate"` as today)
4. **And** the "newest" note is determined deterministically:
   - prefer frontmatter `modified` (YYYY-MM-DD) when present and valid
   - otherwise fallback to filesystem mtime
#
### C. No audit regressions (AC: audit-invariants)
1. No additional Vault IO audit lines are emitted for a single ingest operation beyond the existing `appendRecord(... action: "ingest" ...)` success path.
2. The duplicate-title scan must not write to the vault.
#
### D. Tests (AC: tests)
1. Add or extend tests to cover:
   - Apify-created SourceNote includes `source: "apify"` in frontmatter (read back the created note and parse YAML frontmatter).
   - Title-duplicate behavior:
     - with two existing notes with identical `title`, ingest of a third returns `status: "duplicate"`
     - canonical "newest" selection is deterministic across runs (date precedence, mtime fallback)
2. `bash scripts/verify.sh` must pass.
#
## Tasks / Subtasks
- [ ] 1. Add internal `source` metadata pass-through to `vaultCreateNote` markdown builder (no MCP signature change).
- [ ] 2. Wire Apify sweep ingestion to pass `source: "apify"` down to note creation.
- [ ] 3. Implement duplicate-title detection under `03-Resources/` with newest selection + warning.
- [ ] 4. Add tests for both behaviors.
- [ ] 5. Verify gate green (`bash scripts/verify.sh`).
#
## Verify Gate
- Implementation must run:
  - `bash scripts/verify.sh`

