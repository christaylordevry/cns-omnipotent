# Story 21.3: Single repeatable run script

Status: review

Epic: 21 (Live chain verification hardening)

## Story

As an **operator / maintainer**,  
I want **one repeatable command that runs the full chain and prints a pass/fail summary derived from reading back the generated output notes**,  
so that **I can run and assess the live chain quickly without manually inspecting the vault**.

## Context / Baseline

`scripts/run-chain.ts` is the operator-facing live harness that wires Research → Synthesis → Hook → Boss and prints secret-safe evidence.

Story 21.2 already implemented:
- Aggregated env var validation (`assertRequiredEnvKeys(...)`) early in `main()`.
- Pre-run cleanup of stale chain outputs (prefix cleanup + topic-aware cleanup helpers).

Story 21.1 already implemented:
- Runtime brief selection (`--brief-file` or `--topic`/`--query` + `CNS_BRIEF_TOPIC` fallback).
- Persisted Synthesis PAKE++ read-back validation (`validatePersistedSynthesisPake(...)`) and evidence rendering.

This story does **not** redesign the chain or evidence model. It adds a **single npm script entrypoint** and a **terminal-friendly end-of-run summary** that:
- confirms required env validation ran,
- confirms cleanup ran,
- runs the chain,
- reads back the three “output notes” produced by the chain, and
- reports a compact pass/fail summary including the PAKE++ validation result.

## Touch points (developer must read)

- `scripts/run-chain.ts`
  - `main()` startup order and CLI flags
  - `assertRequiredEnvKeys`, `cleanStaleOutputNotesByPrefix`, `cleanStaleChainNotes`
  - stage outputs: `result.synthesis.insight_note.vault_path`, `result.hooks.hook_set_note.vault_path`, `result.weapons.weapons_check_note.vault_path`
  - `validatePersistedSynthesisPake` helper
- `package.json`
  - add an operator-friendly `chain` script that forwards args to `scripts/run-chain.ts`
- `src/agents/chain-smoke-evidence.ts`
  - existing evidence rendering should remain compatible (extend-only; no breaking changes)

## Acceptance Criteria

### A. One command runs the full chain (AC: npm-script)
1. The operator can run the chain via an npm script:
   - `npm run chain -- --topic "your topic here"`
2. The script forwards all existing `scripts/run-chain.ts` CLI options (e.g., `--brief-file`, `--query`, `--evidence-file`, `--operator-note`, `--raw-json`, `--verbose-cleanup`) without breaking existing behavior.

### B. Startup hygiene is invoked (AC: hygiene)
1. The run performs env validation and stale-note cleanup using the already-existing helpers from Story 21.2.
2. The terminal output must make it unambiguous that these steps ran (without being noisy), e.g.:
   - `Env validation: OK (required: FIRECRAWL_API_KEY, APIFY_API_TOKEN, ANTHROPIC_API_KEY)`
   - `Stale output notes cleaned: removed=<n> skipped=<n>`
   - `Stale generated chain notes cleaned: <n>`

### C. Read back the 3 output notes and summarize (AC: readback-summary)
1. After `runChain()` completes successfully, the harness reads back **all three** generated output notes using the vault read adapter:
   - **Synthesis InsightNote**: `result.synthesis.insight_note.vault_path`
   - **Hooks HookSetNote**: `result.hooks.hook_set_note.vault_path`
   - **Weapons WeaponsCheckNote**: `result.weapons.weapons_check_note.vault_path`
2. For each note, the summary reports:
   - vault path
   - read-back status: `ok | fail`
   - failure reason (sanitized + compact) when read fails
3. The summary includes the existing Synthesis PAKE++ validation evidence:
   - `PAKE++ validation: PASS|FAIL|UNKNOWN`
4. Exit status:
   - exit code **0** if and only if:
     - all three read-backs succeed, and
     - PAKE++ validation status is not `fail` (pass/unknown rules below)
   - exit code **1** if:
     - any note read-back fails, OR
     - PAKE++ validation status is `fail`
5. If PAKE++ validation is `unknown` because Synthesis didn’t produce a persisted InsightNote, the run is treated as **fail** for summary purposes (exit code 1) unless the chain result indicates Synthesis was intentionally skipped (which is not expected for the live chain harness).

### D. Output is terminal-friendly and secret-safe (AC: output)
1. The end-of-run summary is short, scannable, and stable in shape (suitable for copy/paste into issue comments).
2. Summary must not print:
   - API keys, bearer tokens, or credential-like substrings
   - full note bodies
3. All failure messages are sanitized using existing evidence sanitizers (e.g. `sanitizeEvidenceString`).

### E. Tests + verify gate (AC: tests)
1. Add unit tests that cover the summary decision logic:
   - all reads ok + PAKE pass → exit 0
   - a read fails → exit 1
   - PAKE fail → exit 1
   - PAKE unknown (synthesis not ok) → exit 1
2. `bash scripts/verify.sh` passes.

## Tasks / Subtasks

- [x] 1. Add `chain` npm script (AC: npm-script)
  - [x] Update `package.json` to include a script like:
    - `chain`: runs `tsx scripts/run-chain.ts` and forwards args (`npm run chain -- --topic ...`)

- [x] 2. Implement read-back + summary rendering (AC: readback-summary, output)
  - [x] In `scripts/run-chain.ts`, after evidence printing, add a compact “Summary” block that:
    - [x] reads back the three output notes by `vault_path`
    - [x] prints per-note status lines
    - [x] prints PAKE++ validation status
    - [x] sets exit code based on the rules in AC: readback-summary
  - [x] Keep summary output separate from the existing evidence markdown (evidence stays as-is; summary is additive).

- [x] 3. Extract testable helpers (AC: tests)
  - [x] Extract pure logic helpers from `scripts/run-chain.ts` (exported) so tests do not need network calls:
    - [x] `readBackChainOutputs(...)` (returns per-stage read results)
    - [x] `computeChainPassFail(...)` (derives exit code and status from read results + PAKE evidence)
  - [x] Ensure helpers accept injected vault read adapter / env for determinism.

- [x] 4. Add unit tests (AC: tests)
  - [x] Add tests in the existing harness test file (or a new dedicated test file under `tests/vault-io/`) using mocked read adapter results.
  - [x] Run `bash scripts/verify.sh`.

## Dev Notes

- **Do not duplicate hygiene logic.** Reuse Story 21.2 helpers already present in `scripts/run-chain.ts`.
- **Do not broaden deletions.** Cleanup remains narrow and scoped to `03-Resources/` per Story 21.2.
- **Do not weaken PAKE++ validation.** Treat validation as a hard signal; the summary should reflect it, not bypass it.
- **Keep network calls out of tests.** Unit tests must mock read-back and validation evidence inputs.
- **Secret safety:** Use `sanitizeEvidenceString(...)` for any error message rendering in summary output.

### References

- Story 21.1 (pake proof + evidence): `_bmad-output/implementation-artifacts/21-1-live-chain-real-brief-epic-20-stack-pake-quality-evidence.md`
- Story 21.2 (hygiene automation): `_bmad-output/implementation-artifacts/21-2-pre-run-hygiene-automation.md`
- Live harness: `scripts/run-chain.ts`
- Evidence renderer: `src/agents/chain-smoke-evidence.ts`

## Standing tasks (every story)

### Standing task: Update operator guide
- [ ] If this story changes any user-facing behavior (new tool, new workflow, new constraint, new panel, new integration): update `03-Resources/CNS-Operator-Guide.md` via `vault_create_note` (full overwrite) or `vault_update_frontmatter` plus targeted section edit. Bump `modified` date and add a row to the Version History table in Section 12.
- [ ] If no user-facing behavior changed: note "Operator guide: no update required" in Dev Agent Record.

## Dev Agent Record

### Agent Model Used

GPT-5 (Cursor)

### Debug Log References

 - `PERPLEXITY_API_KEY="" bash scripts/verify.sh` (PASS)

### Completion Notes List

 - Added `npm run chain -- ...` entrypoint wired to `tsx scripts/run-chain.ts`.
 - Added terminal-friendly read-back summary that reads the three output notes (Synthesis/Hooks/Weapons) and prints PASS/FAIL + PAKE++ validation status.
 - Exit code is now derived from read-back success and persisted Synthesis PAKE++ validation (unknown/fail => non-zero).
 - Added unit tests for pass/fail summary and exit code logic.

### File List

- `_bmad-output/implementation-artifacts/21-3-single-repeatable-run-script.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `package.json`
- `scripts/run-chain.ts`
- `tests/vault-io/run-chain-live-harness.test.ts`

## Change Log

- 2026-04-29: Added `npm run chain` entrypoint and end-of-run read-back summary with pass/fail + PAKE++ status; added unit tests; verify gate green.
