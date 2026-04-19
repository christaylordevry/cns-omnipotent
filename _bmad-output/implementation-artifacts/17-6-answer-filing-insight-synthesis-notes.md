# Story 17.6: Answer filing — InsightNote / SynthesisNote with vault backlinks

Status: done

Epic: 17 (Agency first product: content research agent chain)

## Story

As a **content strategist (operator)**,
I want **each research brief query that successfully completes a Perplexity answer pass to persist
the model answer through the same `runIngestPipeline()` path used elsewhere, typed as
`InsightNote` when it anchors on zero or one matched vault SourceNote, or `SynthesisNote` when
two or more distinct sweep sources are linked via citation URL matching**,
so that **research outputs do not evaporate after the run — they remain governed PAKE notes with
explicit backlinks to the SourceNotes this sweep already ingested**.

## References

- Research orchestrator: `src/agents/research-agent.ts` — `runResearchAgent`, `ResearchSweepResult`
- Perplexity slot: `src/agents/perplexity-slot.ts` — `PerplexitySlot`, `PerplexityResult`
- Ingest pipeline: `src/ingest/pipeline.ts` — `runIngestPipeline()`
- PAKE / ingest typing: `src/pake/schemas.ts`, `src/ingest/classify.ts`, `src/tools/vault-create-note.ts`
- Phase 4 spec (note roles): `specs/cns-vault-contract/CNS-Phase-4-Automated-Ingest-Pipeline-Spec.md`
- Prior ingest wiring: `_bmad-output/implementation-artifacts/17-3-synthesis-agent-patterns-gaps-opportunities.md`, `17-5-boss-agent-weapons-check-novelty-and-copy-intensity.md`

## Acceptance Criteria

1. **Probe unchanged (AC: probe)**
   **Given** the existing `perplexityProbe` behaviour
   **When** the slot is unavailable or `search` throws on the probe query
   **Then** `perplexity_skipped` remains `true` and **no** Perplexity answer notes are filed.

2. **Answer filing gate (AC: filing-gate)**
   **Given** `perplexity_skipped === false` after a successful probe
   **When** `runResearchAgent` completes
   **Then** for **each** brief query the orchestrator invokes `perplexity.search(query)` once (same adapter injection pattern as Firecrawl/Apify)
   **And** empty/whitespace answers do not produce a vault note (no ingest call).

3. **Insight vs synthesis typing (AC: pake-choice)**
   **Given** a non-empty Perplexity answer
   **When** citation strings are matched against `notes_created` from the Firecrawl/Apify phase (by URL / hostname+path normalisation)
   **Then** if **two or more distinct** matched vault paths exist, the note is ingested with `ingest_as: "SynthesisNote"`
   **Else** it is ingested with `ingest_as: "InsightNote"`.

4. **Pipeline + provenance (AC: pipeline)**
   **Given** a filed answer
   **When** ingest runs
   **Then** it uses `runIngestPipeline(vaultRoot, { input: body, source_type: "text", title_hint, ingest_as, tags, ai_summary, confidence_score, provenance_uri })` where `provenance_uri` is a stable synthetic URI derived from the brief query (URN) so duplicate re-runs return `duplicate` instead of cloning notes
   **And** `classify.ts` / `resolvePakeType` accept `ingest_as: "SynthesisNote"` alongside existing literals.

5. **Body + backlinks (AC: backlinks)**
   **Given** a filed answer
   **Then** the markdown body includes the answer text, a citations section listing raw citation strings, and a **Linked vault sources** section with `[[basename]]` wikilinks for every matched SourceNote (deduped by vault path).

6. **Manifest + audit (AC: manifest-audit)**
   **Given** any completed sweep
   **Then** Perplexity-filed notes appear in `notes_created` with `source: "perplexity"` and the synthetic `source_uri`
   **And** ingest failures / throws per query append to `notes_skipped` with `reason: "fetch_error"` or the appropriate ingest skip reason
   **And** `researchSweepResult` includes `perplexity_answers_filed` (count of successful filings this run)
   **And** the `research_sweep` audit `payloadInput` includes the same `perplexity_answers_filed` count.

7. **Tests (AC: tests)**
   **Given** Perplexity is external
   **When** tests run
   **Then** `PerplexitySlot` is always mocked — **no live Perplexity / HTTP calls**
   **And** `bash scripts/verify.sh` passes before the story Status becomes **review**.

## Tasks / Subtasks

- [x] Extend `IngestInput` with optional `provenance_uri`; merge into normalized `source_uri` for text sources before duplicate check (`src/ingest/pipeline.ts`)
- [x] Add `SynthesisNote` to `IngestOptions.ingest_as` / `resolvePakeType` (`src/ingest/classify.ts`)
- [x] Export stable `perplexityAnswerSourceUri(query)`; implement citation matching, body render, and filing loop in `runResearchAgent` after Firecrawl/Apify merge (`src/agents/research-agent.ts`)
- [x] Extend `researchSweepResultSchema` + `research_sweep` audit payload with `perplexity_answers_filed`
- [x] Add Vitest coverage: skipped probe → zero filings; success → InsightNote vs SynthesisNote by link count; duplicate provenance_uri; fetch_error on throw; no live calls
- [x] Add ingest pipeline test for `provenance_uri` duplicate behaviour on text + InsightNote
- [x] Run `bash scripts/verify.sh`; update sprint-status `17-6` → `review`; story Status → `review`

## Dev Agent Record

### Agent Model Used

Composer (agent router)

### Debug Log References

- None — `bash scripts/verify.sh` green on first full run after implementation.

### Completion Notes List

- Added optional `provenance_uri` on ingest text inputs so derived notes (Perplexity answers) get a stable `source_uri` for PAKE + `governedNoteExistsWithSourceUri` duplicate detection.
- Extended `resolvePakeType` / `IngestOptions.ingest_as` to include `SynthesisNote` (multi-source match: ≥2 distinct acquisition `SourceNote` paths from citation URLs).
- `runResearchAgent`: after Firecrawl/Apify merge, when `perplexity_skipped === false`, runs `filePerplexityAnswers` — one `slot.search(query)` per brief query, markdown body with Citations + Linked vault sources (`[[basename]]` wikilinks), `runIngestPipeline` with `ingest_as` Insight vs Synthesis per rule.
- `ResearchSweepResult` + `research_sweep` audit payload now include `perplexity_answers_filed` (success count). Synthesis fixtures updated for the new required Zod field.
- Vitest: **432** tests; new coverage in `research-agent.test.ts` + `ingest-pipeline.test.ts`; no live Perplexity calls (mocked `PerplexitySlot` only).

### File List

- `src/ingest/pipeline.ts`
- `src/ingest/classify.ts`
- `src/agents/research-agent.ts`
- `tests/vault-io/research-agent.test.ts`
- `tests/vault-io/ingest-pipeline.test.ts`
- `tests/vault-io/synthesis-agent.test.ts`
- `_bmad-output/implementation-artifacts/17-6-answer-filing-insight-synthesis-notes.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

| Date | Change |
|------|--------|
| 2026-04-18 | Story file created; sprint `17-6` → in-progress |
| 2026-04-18 | Implementation complete — answer filing + provenance_uri + tests; `verify.sh` green (432 Vitest); story + sprint `17-6` → **review** |
| 2026-04-18 | BMAD code review complete — 0 decision-needed, 0 patch, 1 defer, 1 dismissed; story + sprint `17-6` → **done** |

### Review Findings

_BMAD code review (2026-04-18). Focus: `provenance_uri` dedup for text ingests, InsightNote vs SynthesisNote (≥2 distinct vault paths), `perplexity_answers_filed` vs audit `payloadInput`, wikilink rendering. Review layers applied inline (Blind Hunter + Edge Case Hunter + Acceptance Auditor criteria); dedicated subagent processes were not spawned._

- [x] [Review][Defer] Citation matching only canonicalises strings that already look like URLs (`http(s)://` or `www.`). Bare-host citations (for example `example.com/path` without a scheme) yield `canonUrlKey === null`, so they never match `notes_created[].source_uri`, backlinks stay empty, and classification stays `InsightNote` even when a human would treat them as the same resource. [`src/agents/research-agent.ts` ~283–304] — deferred unless product wants broader normalisation beyond URL-shaped citations.

---

## Developer Context — Implementation Guide

### Adapter injection

Mirror `ResearchAgentAdapters`: optional `perplexity` slot; default `createPerplexitySlot()`. No new adapter type — reuse `PerplexitySlot`.

### Classification rule (deterministic)

| Distinct matched SourceNote vault paths from citations | `ingest_as` |
|--------------------------------------------------------|-------------|
| 0–1 | `InsightNote` |
| ≥2 | `SynthesisNote` |

### Synthetic `provenance_uri`

Use a URN so it never collides with real URLs:

`urn:cns:research-sweep:perplexity:answer:${encodeURIComponent(query)}`

Pass as `provenance_uri` on the ingest input (text body). Pipeline attaches it as `source_uri` for duplicate detection and PAKE frontmatter.

### Anti-patterns

- Do **not** call real Perplexity in tests — mock `PerplexitySlot.search`.
- Do **not** add a parallel persistence path that bypasses `runIngestPipeline`.
- Do **not** file answers when `perplexity_skipped === true` (probe failed).

### Verify gate

`bash scripts/verify.sh` must be green before Status **review**.
