# Story 21.2: Pre-run hygiene automation

Status: done

Epic: 21 (Live chain verification hardening)

## Story

As an **operator / maintainer**,  
I want the live chain harness to **fail fast on missing critical credentials** and **auto-clear stale output notes at chain startup**,  
so that **every live run starts cleanly without manual cleanup commands or confusing half-configured runs**.

## Context / Baseline

`scripts/run-chain.ts` is the operator-facing live harness that wires real Research → Synthesis → Hook → Boss.

Current baseline behavior:
- Startup validates env keys with individual throws:
  - `FIRECRAWL_API_KEY`, `APIFY_API_TOKEN`, `PERPLEXITY_API_KEY`, `ANTHROPIC_API_KEY`
- The harness already contains a topic-aware cleanup helper `cleanStaleChainNotes(vaultRoot, brief)` that removes certain AI-generated notes under `03-Resources/` based on frontmatter/title heuristics.

This story hardens “run hygiene” in two explicit ways:
1. **Filename-prefix cleanup** of stale chain outputs in `03-Resources/` at startup (no more manual `rm -f`).
2. **Env validation** that checks a specific key set and reports **all missing keys in one error message**.

## Touch points (developer must read)

- `scripts/run-chain.ts`
  - `main()` startup order (parse args → configure vault root → env checks → cleanup → runChain)
  - existing cleanup helper (`cleanStaleChainNotes`) and existing env-key checks
- `tests/vault-io/run-chain-live-harness.test.ts`
  - patterns for testing helpers exported from `scripts/run-chain.ts`
- `src/paths.ts`, `src/write-gate.ts`
  - for path resolution and write boundary behavior (reuse existing helpers; don’t invent alternate boundary logic)

## Acceptance Criteria

### A. Auto-clear stale output notes by filename prefix (AC: prefix-cleanup)
1. At chain startup (before `runChain()` begins), the harness deletes any markdown notes directly under `03-Resources/` whose **filename** begins with:
   - `synthesis-`
   - `hooks-`
   - `weapons-check-`
2. Cleanup must be **non-recursive** (only direct children of `03-Resources/`).
3. Cleanup must be **safe and governed**:
   - resolve paths through existing vault path helpers (vault-root + vault-relative)
   - enforce the existing delete policy checks (use the same boundary/protected-path guard used elsewhere in the harness)
   - ignore missing files and continue
4. Cleanup must not require parsing note bodies/frontmatter; it is **filename-based**.
5. The harness prints a compact line like:
   - `Stale output notes cleaned: removed=<n> skipped=<n>`

### B. Env validation at startup (AC: env-validation)
1. At startup, the harness validates that the following environment variables are set and non-empty:
   - `FIRECRAWL_API_KEY`
   - `APIFY_API_TOKEN`
   - `ANTHROPIC_API_KEY`
2. If any are missing/empty, the harness fails fast with **one** clear error message that lists **every missing key** in a stable order, e.g.:
   - `Missing required environment variables: FIRECRAWL_API_KEY, APIFY_API_TOKEN`
3. This validation happens **before** any network calls and before `runChain()` is invoked.

### C. Tests (AC: tests)
1. Add unit tests in `tests/vault-io/run-chain-live-harness.test.ts` covering:
   - prefix-cleanup deletes only the expected files and does not delete similarly-named files outside the specified prefixes
   - env-validation reports all missing keys in one message (table-driven cases)
2. `bash scripts/verify.sh` passes.

## Tasks / Subtasks

- [x] 1. Implement prefix-based cleanup helper (AC: prefix-cleanup)
  - [x] Add `cleanStaleOutputNotesByPrefix(vaultRoot, opts?)` exported from `scripts/run-chain.ts` (mirrors testing style used for `cleanStaleChainNotes`).
  - [x] Implement non-recursive listing of `03-Resources/` and match `synthesis-`, `hooks-`, `weapons-check-` prefixes.
  - [x] Use existing vault path resolution + delete guard (`assertWriteAllowed`) before deleting.
  - [x] Return `{ removed: string[]; skipped: string[] }` for evidence/notes and unit tests.

- [x] 2. Replace env validation with “report all missing keys” helper (AC: env-validation)
  - [x] Add a small helper like `assertRequiredEnv(vars, env=process.env)` that returns/throws with a single aggregated message.
  - [x] Ensure the required set is exactly `FIRECRAWL_API_KEY`, `APIFY_API_TOKEN`, `ANTHROPIC_API_KEY` (do not include other keys in this story’s fail-fast set).
  - [x] Call validation early in `main()` (after args parse, before cleanup/run).

- [x] 3. Wire cleanup into startup flow (AC: prefix-cleanup)
  - [x] Run prefix cleanup at chain startup before `runChain()` begins.
  - [x] Keep existing topic-aware cleanup behavior intact unless explicitly replaced; if both exist, the output should not be noisy.

- [x] 4. Tests + verify gate (AC: tests)
  - [x] Add tests for prefix-cleanup and env-validation helpers.
  - [x] Run `bash scripts/verify.sh`.

### Review Findings

- [x] [Review][Patch] Add opt-in verbose mode for prefix-cleanup logging/auditability [`scripts/run-chain.ts`: `main()` + `cleanStaleOutputNotesByPrefix`] — Default output stays compact (`removed=<n> skipped=<n>`); opt-in `--verbose-cleanup` prints removed/skipped paths.
- [x] [Review][Patch] Prefix-cleanup swallows unexpected `readdir()` errors (treats them as “nothing to clean”) [`scripts/run-chain.ts`: `cleanStaleOutputNotesByPrefix`] — Now only `ENOENT` is ignored; other errors surface.
- [x] [Review][Patch] “Services configured” log is misleading when Perplexity is absent [`scripts/run-chain.ts`: `main()`] — Now logs `Perplexity=enabled|disabled`.

- [x] [Review][Defer] Prefix-cleanup casing/separator quirks (`.MD`, case-sensitive prefixes, `relDir` separator mixing) [`scripts/run-chain.ts`: `cleanStaleOutputNotesByPrefix`] — deferred, pre-existing / out-of-scope for Story 21.2 ACs
- [x] [Review][Defer] Windows/WSL file-lock (`EPERM`) cleanup failures are recorded only as “skipped” without reasons [`scripts/run-chain.ts`: `cleanStaleOutputNotesByPrefix`] — deferred, pre-existing / out-of-scope for Story 21.2 ACs

## Dev Notes

- Prefer extracting small, exported helpers from `scripts/run-chain.ts` and testing them the same way `cleanStaleChainNotes()` and `loadBriefForRun()` are tested.
- Keep deletion strictly scoped to `03-Resources/` direct children and filename prefixes. This is intentionally narrow to avoid “bulk cleanup” semantics.
- Do not log secrets. Env validation error must only list key names, never values.

### References

- Live harness baseline: `scripts/run-chain.ts`
- Existing cleanup pattern + tests: `tests/vault-io/run-chain-live-harness.test.ts`
- Epic 21 context: `_bmad-output/implementation-artifacts/21-1-live-chain-real-brief-epic-20-stack-pake-quality-evidence.md`

## Standing tasks (every story)

### Standing task: Update operator guide
- [x] If this story changes any user-facing behavior (new tool, new workflow, new constraint, new panel, new integration): update `03-Resources/CNS-Operator-Guide.md` via `vault_create_note` (full overwrite) or `vault_update_frontmatter` plus targeted section edit. Bump `modified` date and add a row to the Version History table in Section 12.
- [ ] If no user-facing behavior changed: note "Operator guide: no update required" in Dev Agent Record.

## Dev Agent Record

### Agent Model Used

GPT-5 (Cursor)

### Debug Log References

 - `bash scripts/verify.sh` (PASS)

### Completion Notes List

 - Added aggregated startup env validation for `FIRECRAWL_API_KEY`, `APIFY_API_TOKEN`, and `ANTHROPIC_API_KEY`.
 - Added startup cleanup that deletes stale `03-Resources/synthesis-*.md`, `hooks-*.md`, and `weapons-check-*.md` outputs (non-recursive).
 - Updated the Perplexity adapter wiring so `PERPLEXITY_API_KEY` is optional (Perplexity is treated as unavailable when missing).
 - Added unit tests for the new startup helpers in `tests/vault-io/run-chain-live-harness.test.ts`.

### File List

- `_bmad-output/implementation-artifacts/21-2-pre-run-hygiene-automation.md`
- `scripts/run-chain.ts`
- `tests/vault-io/run-chain-live-harness.test.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
 - `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`

