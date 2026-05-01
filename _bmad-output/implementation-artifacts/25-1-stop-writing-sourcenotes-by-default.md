# Story 25.1: Stop writing SourceNotes to vault by default

Status: ready-for-dev

<!-- Ultimate context engine analysis completed — comprehensive developer guide created -->

Epic: **25** — Chain vault footprint control (research ingest debris + finished-note routing)

## Critical Dev Blocker

The dev agent must solve the **synthesis read problem before any other implementation work**. Turning off SourceNote persistence means synthesis can no longer assume every `notes_created` entry has a disk-backed `vault_path` that `vaultReadAdapter.readNote(...)` can read.

This is an **architectural decision**, not a simple wiring task. The dev agent must choose and document one of these approaches before touching the CLI flag, research ingest gates, or inbox cleanup:

1. **Pass raw content in memory through `ResearchSweepResult`**. This is the preferred and cleanest approach unless code inspection reveals a stronger constraint. Extend the result schema with an inline payload such as `ephemeral_snapshot` and teach synthesis to use it directly.
2. **Add a synthetic read adapter**. Keep synthetic `vault_path` values, but serve their content from memory when `vault_path` is null or uses a documented synthetic URN.

Whichever path is chosen, tests must prove that `save_sources === false` still gives synthesis equivalent source bodies and attribution labels without writing acquisition-tier vault notes.

## Story

As an **operator running the Research → Synthesis → Hook → Boss chain**,

I want **default chain runs to skip persisting per-page SourceNotes (and other acquisition-tier vault filings) while still producing full downstream quality**,

So that **the vault is not littered with hundreds of single-use scrape files, and finished synthesis/hooks/weapons artifacts land only under `03-Resources/` with no leftover `00-Inbox` drafts**.

## Acceptance Criteria

1. **CLI — default off:** `scripts/run-chain.ts` exposes `--save-sources`. When omitted, behavior matches **false** (do not persist acquisition-tier notes to the vault). When provided, persist acquisition-tier notes **as today** (restore prior SourceNote / Perplexity filing behavior).
2. **Research agent — gated vault writes:** `src/agents/research-agent.ts` respects a boolean on `ResearchAgentOptions` (name aligned with chain-level flag, e.g. `save_sources`, default **false**). When **false**:
   - Firecrawl / Apify / Scrapling tiers **do not** call `runIngestPipeline` for URL/text captures that would become **SourceNote**.
   - Perplexity answer filing via `filePerplexityAnswers` **does not** call `runIngestPipeline` (no InsightNote/SynthesisNote from Perplexity in vault for that sweep).
   - Sweep still records enough in **`ResearchSweepResult`** so downstream stages see **equivalent** research content (see Dev Notes — synthesis currently reads bodies via `vaultRead`; this must be extended).
3. **Synthesis input parity:** With `save_sources === false`, `runSynthesisAgent` still receives research bodies (and usable paths/labels for prompts) so adapter output quality is not degraded versus `save_sources === true` for the same mocked inputs.
4. **Chain wiring:** `runChain` in `src/agents/run-chain.ts` passes the flag through `opts.research` from caller (`scripts/run-chain.ts` maps CLI → `runChain`).
5. **Routing / inbox:** Finished outputs from synthesis, hook agent, and boss (weapons-check) **must not** leave artifacts under `00-Inbox/` after successful promotion. Today `runIngestPipeline` always writes an inbox draft before `vaultCreateNote`; if orphans are observed in operator vaults, implement a **direct governed write** path (or equivalent) for these stages so successful runs leave **zero** files in `00-Inbox`. Final governed paths remain under **`03-Resources/`** per existing `destinationDirectoryForCreate` rules for `InsightNote` / `HookSetNote` / `WeaponsCheckNote`.
6. **Acceptance — vault footprint (default):** For a full mocked chain run against a clean fixture vault with `save_sources === false` (CLI: no `--save-sources`): **exactly three** new governed `.md` files appear under `03-Resources/` (synthesis, hooks, weapons-check); **zero** new notes under `00-Inbox/`; **zero** SourceNotes (and zero Perplexity-filed notes from the sweep).
7. **Acceptance — legacy persistence:** With `--save-sources`, vault persistence for acquisition-tier outputs matches pre-story behavior (SourceNotes + Perplexity filing as implemented today).
8. **Verification:** `bash scripts/verify.sh` passes.

## Tasks / Subtasks

- [x] **Task 0 — Resolve synthesis read architecture first** (AC: 2, 3, 6, 8)
  - [x] Inspect `src/agents/synthesis-agent.ts` before any implementation work and confirm the current `vaultReadAdapter.readNote(note.vault_path)` dependency.
  - [x] Choose one architecture: inline raw content through `ResearchSweepResult` via `ephemeral_snapshot` (preferred) or a synthetic read adapter that serves in-memory content for synthetic/null vault paths.
  - [x] Document the chosen approach in this story's Dev Agent Record before implementing downstream wiring.
  - [x] Add/adjust schemas and tests for the chosen approach before gating acquisition-tier writes, so synthesis parity remains protected while the rest of the story changes.
- [x] **Task 1 — CLI flag** (AC: 1, 4, 8)
  - [x] Parse `--save-sources` in `scripts/run-chain.ts`; document in script header comment.
  - [x] Thread into `runChain(..., { research: { save_sources: ... } })` (exact shape follows Task 2).
- [x] **Task 2 — Research agent** (AC: 2, 3, 7, 8)
  - [x] Extend `ResearchAgentOptions` with `save_sources?: boolean` (default **false** when undefined).
  - [x] When `save_sources === false`, bypass `runIngestPipeline` in `firecrawlSweep`, `apifySweep`, `scraplingSweep`; accumulate **`notes_created`** entries that carry **ephemeral** source payloads (see Technical Requirements).
  - [x] When `save_sources === false`, skip vault writes in `filePerplexityAnswers`; optionally still call Perplexity for answers and push **ephemeral** entries into `notes_created` / structured sweep fields so synthesis stays grounded.
  - [x] Preserve existing audit behavior where still meaningful; avoid claiming vault paths that were never created for `appendRecord.targetPath` — adjust payloads/paths to stay truthful (e.g. sentinel or first ephemeral id — align with existing patterns for empty sweeps).
- [x] **Task 3 — Synthesis reads ephemeral sources** (AC: 3, 8)
  - [x] **`Critical dependency`:** `runSynthesisAgent` currently does `vaultReadAdapter.readNote(note.vault_path)` for every `notes_created` entry (`src/agents/synthesis-agent.ts`). Ephemeral sources **must** be readable without disk-backed notes. This dependency is the first blocker for the whole story.
  - [x] Implement the Task 0 architecture choice consistently in Zod schemas + synthesis loop. Preferred path: extend `createdNoteSchema` / `CreatedNote` (or parallel discriminated structure) with optional **`ephemeral_snapshot`** `{ body: string; frontmatter: Record<string, unknown> }`. Alternative path: inject a **`VaultReadAdapter`** from tests/`runChain` that resolves synthetic paths from memory.
  - [x] Ensure `validatePakeSynthesisBody` / adapter prompts still receive `vault_path` strings suitable for attribution (synthetic URNs acceptable if documented).
- [x] **Task 4 — Inbox-free finished outputs** (AC: 5, 6, 8)
  - [x] Add an ingest-pipeline option (e.g. `{ skipInboxDraft?: boolean }` or `directGovernedWrite`) used **only** by synthesis, hook, and boss agents when calling `runIngestPipeline`, **or** refactor shared helper so governed writes can bypass inbox staging without bypassing PAKE/WriteGate/secret scan.
  - [x] Confirm successful path deletes no inbox file **because none was created**, or that cleanup is guaranteed on success.
- [x] **Task 5 — Tests** (AC: 6, 7, 8)
  - [x] Extend `tests/vault-io/research-agent.test.ts` (or add focused test file) for `save_sources: false` vs `true` ingest call counts / vault file counts.
  - [x] Add or extend chain integration test to assert **03-Resources** note count and **empty 00-Inbox** after mocked full chain with default flag.
  - [x] Cover `--save-sources` restores persistence (spot-check key code paths or file-based assertion).
- [x] **Task 6 — Operator guide** (AC: 1, standing task)
  - [x] Update `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`: document `--save-sources`, default behavior, and vault footprint expectations for a normal chain run.
  - [x] Bump frontmatter `modified` and add Version History row (Section 12).

## Dev Notes

### Problem statement

The chain currently persists **every** scraped page as a **SourceNote**. After synthesis consumes them, these files have **no reuse value** but clutter `03-Resources/` (operators recently archived 300+). Default should be **memory-only** acquisition with optional opt-in persistence.

### Architecture compliance

- **WriteGate / PAKE:** Do not bypass validation for governed writes. Any “skip inbox” change must still flow through `vaultCreateNote` + existing gates after normalization, or an explicitly reviewed equivalent that preserves PAKE + secret scan ordering (see `vault-create-note.ts` mutation pipeline comments).
- **Phase 1 scope:** No new MCP tools; chain remains implementation-repo orchestration.

### Technical requirements (non-negotiable details)

| Area | Requirement |
|------|-------------|
| Default | `save_sources` **false** everywhere implicit (CLI omitted → false; `ResearchAgentOptions` field omitted → false). |
| `ResearchSweepResult` | Must remain valid Zod shape for `researchSweepResultSchema`; extend with optional fields only if migrations/tests updated. |
| Synthesis read architecture | Must be decided first. Preferred: pass raw bodies in memory through `ResearchSweepResult` with `ephemeral_snapshot`. Alternative: synthetic read adapter that serves in-memory content for synthetic/null vault paths. |
| Ephemeral notes | Each ephemeral `notes_created` entry needs **`pake_id`** (UUID), **`source`**, optional **`source_uri`**, **`vault_path`** stable string for prompts/audit (synthetic prefix acceptable, e.g. `urn:cns:chain:ephemeral:...`), plus **`ephemeral_snapshot`** if using inline-body approach. |
| Perplexity | When `save_sources === false`, **no** vault Insight/Synthesis notes from Perplexity; still surface answer text to synthesis via ephemeral entries if Perplexity adapter runs. |
| Ingest pipeline | `src/ingest/pipeline.ts`: inbox draft is **transient** by design; AC requires **no leftover** `00-Inbox` artifacts for successful synthesis/hook/weapons ingests — implement direct path if cleanup is unreliable on operator filesystems. |

### File structure — files to touch

| File | Change |
|------|--------|
| `scripts/run-chain.ts` | `--save-sources`; pass into `runChain` |
| `src/agents/run-chain.ts` | `ChainRunOptions` / pass-through to `runResearchAgent` |
| `src/agents/research-agent.ts` | Gate sweeps + Perplexity filing |
| `src/agents/synthesis-agent.ts` | Read ephemeral snapshots or injected adapter |
| `src/agents/hook-agent.ts` | Use inbox-skipping ingest option when available |
| `src/agents/boss-agent.ts` | Same |
| `src/ingest/pipeline.ts` | Optional skip inbox draft |
| `tests/vault-io/*.test.ts` | New assertions |
| `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` | Operator-facing docs |

### Testing requirements

- Prefer **fixture vault** under `tests/fixtures/` already used by vault-io tests; avoid live network in CI.
- After mocked chain: enumerate `03-Resources/**/*.md` vs `00-Inbox/**/*.md` creation deltas from baseline.

### References

- Ingest staging: `src/ingest/pipeline.ts` (`writeInboxDraft`, `removeInboxDraft`, `runIngestPipeline`).
- PAKE routing: `src/tools/vault-create-note.ts` — `destinationDirectoryForCreate`.
- Synthesis source read loop: `src/agents/synthesis-agent.ts` (~405–418).
- Chain orchestrator: `src/agents/run-chain.ts`.
- Prior chain smoke / operator patterns: `_bmad-output/implementation-artifacts/19-1-live-chain-smoke-harness-and-evidence-record.md`.

## Standing tasks (every story)

### Standing task: Update operator guide

- [x] Update `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` (Section on chain / `run-chain` if present; else add subsection under operator automation or research chain).
- [x] Bump `modified` and Version History (Section 12).

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (claude-opus-4-7[1m])

### Architecture decision — Task 0 (resolved before any wiring)

**Chosen approach: inline `ephemeral_snapshot` in `ResearchSweepResult.notes_created`.**

Rationale:

1. **Cleanest data flow.** Synthesis already iterates `sweepResult.notes_created` and reads each note's `vault_path`. Adding an optional `ephemeral_snapshot: { body, frontmatter }` to `CreatedNote` means the read-loop just consumes the inline payload when present and otherwise falls back to the existing `vaultReadAdapter.readNote(vault_path)` path. No control-flow forks elsewhere; no changes needed in `runChain`'s adapter wiring.
2. **Schema-truthful audit.** When acquisition-tier writes are gated off, `vault_path` becomes a synthetic `urn:cns:chain:ephemeral:<source>:<uuid>` string rather than a fake `03-Resources/...` filename. `appendRecord.targetPath` therefore points to a real provenance identifier instead of claiming a path that does not exist on disk.
3. **No adapter coupling.** Approach 2 (synthetic read adapter) would force tests and `runChain` to inject a memory-backed `VaultReadAdapter` that synthesis would have to share with hook-agent and boss-agent — but those two stages read **finished** governed notes from disk, so a shared synthetic adapter is awkward and would muddy the boundary between ephemeral inputs and persisted outputs.

Synthetic vault-path shape (documented for prompt + audit): `urn:cns:chain:ephemeral:<firecrawl|apify|scrapling|perplexity>:<uuid>`. The PAKE++ body validator does not require source-derived wikilinks (it counts wikilinks anywhere in required sections), so the LLM can satisfy `Connected Vault Notes` and `[!tip]` link requirements from the `vault_context_packet` operator-profile + topic-match notes regardless of the synthetic source URN.

### Debug Log References

- `npx vitest run` — 47 files / 570 tests pass after changes (default-off ephemeral path, opt-in `save_sources: true` legacy path, chain footprint integration both branches).
- `bash scripts/verify.sh` — green: tests, lint, typecheck, build all pass.

### Completion Notes List

- **Task 0 (architecture):** chose inline `ephemeral_snapshot` on `CreatedNote` over a synthetic read adapter. Rationale: keeps synthesis read loop single-fork, lets `appendRecord.targetPath` carry a truthful `urn:cns:chain:ephemeral:<source>:<uuid>` instead of a fake disk path, avoids cross-coupling with hook/boss (which still read real governed notes).
- **Task 1 (CLI):** `--save-sources` parsed in `scripts/run-chain.ts`, threaded through `runChain → runResearchAgent` via `opts.research.save_sources`. Header comment updated.
- **Task 2 (research agent):** added `save_sources?: boolean` to `ResearchAgentOptions` (default false). All four sweep paths (firecrawl/apify/scrapling + perplexity answer filing) now bypass `runIngestPipeline` when off and emit `CreatedNote` entries with synthetic URN paths and inline `ephemeral_snapshot { body, frontmatter }`. Sweep audit now records `save_sources` in payload.
- **Task 3 (synthesis):** extended `createdNoteSchema` with optional `ephemeral_snapshot`. `runSynthesisAgent` read loop short-circuits to the inline body when present; falls back to `vaultReadAdapter.readNote` only for disk-backed entries. `vault_path` strings (URN or real) are passed through to the synthesis adapter prompt unchanged.
- **Task 4 (inbox-free outputs):** added `skipInboxDraft?: boolean` to `runIngestPipeline` and made `inbox_path` optional on result. Synthesis/hook/boss agents pass `skipInboxDraft: true`. PAKE/WriteGate/secret-scan ordering is unchanged because the gate sits inside `vaultCreateNote`, which is unaffected. Successful runs now leave `00-Inbox/` empty by construction (no draft was ever written).
- **Task 5 (tests):** existing tests that asserted vault writes opted into `save_sources: true` (legacy persistence still verified). Added six new `save_sources` default-off tests in `research-agent.test.ts` (firecrawl, apify, scrapling, perplexity, explicit `false`, no-pipeline-call assertion). Added two synthesis-agent tests for ephemeral consumption (pure ephemeral and mixed ephemeral + disk-backed). Added `tests/vault-io/run-chain-footprint.test.ts` for AC6/AC7 chain-level integration: default → 3 governed + 0 inbox; `save_sources: true` → 4 governed + 0 inbox.
- **Task 6 (operator guide):** added "Vault footprint and `--save-sources`" subsection under §11.c with default behaviour, governed-output filenames, and opt-in semantics. Bumped Version History row 1.14.0 (story 25-1).

### File List

- `src/agents/research-agent.ts` — added `ephemeralSnapshotSchema`, `ephemeral_snapshot` on `createdNoteSchema`, `ephemeralVaultPath()`, `save_sources` option threaded through `runResearchAgent` + all three sweeps + `filePerplexityAnswers`. `randomUUID` import added.
- `src/agents/synthesis-agent.ts` — read loop now consumes `note.ephemeral_snapshot` when present; passes `skipInboxDraft: true` to ingest pipeline.
- `src/agents/hook-agent.ts` — passes `skipInboxDraft: true` to ingest pipeline.
- `src/agents/boss-agent.ts` — passes `skipInboxDraft: true` to ingest pipeline.
- `src/ingest/pipeline.ts` — `IngestResult.inbox_path` made optional; `runIngestPipeline` accepts `skipInboxDraft?: boolean`; staging draft + cleanup are skipped when set; PAKE/WriteGate/secret-scan ordering unchanged.
- `scripts/run-chain.ts` — `--save-sources` flag, `saveSources` field in CLI options, header doc updated, threaded into `runChain.research.save_sources`.
- `tests/vault-io/research-agent.test.ts` — opted nine existing persistence-asserting tests into `save_sources: true`; added six new `save_sources: false` tests.
- `tests/vault-io/synthesis-agent.test.ts` — added two ephemeral-snapshot tests (pure and mixed).
- `tests/vault-io/run-chain-footprint.test.ts` — new file with two chain-level integration tests for AC6/AC7 vault footprint.
- `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` — added subsection on vault footprint + `--save-sources`; added Version History row 1.14.0.

### Change Log

| Date | Version | Change | Story |
|------|---------|--------|-------|
| 2026-04-30 | 25.1.0 | Default chain runs no longer persist acquisition-tier notes; `--save-sources` opt-in restores prior behavior; synthesis/hook/boss writes skip inbox staging so successful runs leave zero `00-Inbox/` orphans | 25-1 |
