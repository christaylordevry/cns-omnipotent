---
baseline_commit: 4ed0ed52edaf75e7090beeaa1f20310e9aece3e8
---

# Story 48.2 (SC-2): Session-close deterministic orchestrator

Status: done

Epic: **48** (Session-close context reduction — FR-17..19)  
Tracked in sprint-status as: **`48-2-session-close-deterministic-orchestrator`**  
**Depends on:** `48-1-session-close-context-pack-scaffold`

**Architecture source of truth:** `_bmad-output/planning-artifacts/architecture-session-close-fr17-19.md` (FR-17, ADR-SC-003).

## Context

- **FR-17:** Vault export, fast-scan index, and related filesystem work run **without** LLM reads of source files.
- **Phase A entry:** `run-deterministic.mjs` orchestrates deterministic steps and writes `close-report.json`.
- **Reuse:** `scripts/export-vault-for-notebooklm.sh`, `npm run vault:fast-scan` → `scripts/generate-vault-fast-scan-index.mjs` — **ban** reimplementing fast-scan in skill `execute_code` (ADR-SC-003).
- **npm PATH:** Story 43-1 documented Hermes PATH gaps — add `lib/npm-env.sh` sourced before `npm test` (ADR + 43-1 review).

## Story

As an **operator**,  
I want **`run-deterministic.mjs` to run vault export, fast-scan regeneration, and test capture without LLM involvement**,  
so that **session-close filesystem mutations are deterministic and report failures per step** (FR-17).

## Acceptance Criteria

1. **CLI entry (AC: cli)**  
   **Given** SC-1 `prepare-context.mjs` and libs exist  
   **When** `node scripts/session-close/run-deterministic.mjs [--dry-run]` runs  
   **Then** it invokes `prepare-context.mjs` first (order step 1 in ADR phase table)  
   **And** writes/updates `.session-close/context-pack.json` and `.session-close/close-report.json`  

2. **Vault export (AC: export)**  
   **When** **not** `--dry-run`  
   **Then** run `bash scripts/export-vault-for-notebooklm.sh`  
   **And** record `deterministic.export_path` and `export_bytes` in context pack / report  
   **When** `--dry-run`  
   **Then** skip export execution but report `export: skipped (dry-run)` in `close-report.json`  

3. **Fast-scan (AC: fast-scan)**  
   **When** **not** `--dry-run`  
   **Then** run `npm run vault:fast-scan` (wrapper to `generate-vault-fast-scan-index.mjs`)  
   **And** record `deterministic.fast_scan_rows` in pack/report  
   **When** `--dry-run`  
   **Then** skip write; may read existing index row count if present  

4. **Test capture (AC: tests)**  
   **When** orchestrator runs test capture  
   **Then** source `scripts/session-close/lib/npm-env.sh` before `npm test` in `OMNIPOTENT_REPO`  
   **And** parse vitest summary into `deterministic.tests` string (e.g. `609 passing` or `FAILED (…)`)  
   **And** on non-zero exit, set `failure_class: tests` in report without aborting prior completed steps (partial close policy)  

5. **Close report schema (AC: report)**  
   **When** orchestrator completes (success or partial)  
   **Then** `close-report.json` includes per-step status, `failure_class` when applicable, `notebooklm_targets` rows `{notebook_id, title, export_path}`, paths/counts only (no secrets, no export body)  
   **And** report is suitable for Discord reply template (SC-5)  

6. **Dry-run semantics (AC: dry-run)**  
   **When** `--dry-run`  
   **Then** no vault export write, no fast-scan write, no `source_add`  
   **And** still produces `context-pack.json` for §8 preview path  

7. **Context pack deterministic fields (AC: pack)**  
   **When** steps 2–4 run on real close  
   **Then** merge results into `context-pack.json` `deterministic` object per ADR schema  

8. **Tests (AC: verify)**  
   **When** shipped  
   **Then** extend `tests/session-close-pipeline.test.mjs` with orchestrator dry-run fixture (mock/spawn or temp repo) asserting report keys and dry-run skip flags  
   **And** `npm test` + `bash scripts/verify.sh` pass  

9. **Scope boundary (AC: scope)**  
   **Then** this story does **not** implement `write-memory.mjs`, `refresh-daily-rhythm.mjs`, or `apply-section8.mjs` (SC-3, SC-4)  

## Tasks / Subtasks

- [x] Implement `run-deterministic.mjs` + `lib/npm-env.sh` (AC: cli, export, fast-scan, tests, report, dry-run)
- [x] Wire `prepare-context.mjs` as first step (AC: pack)
- [x] Extend pipeline tests (AC: verify)

### Review Findings

- [x] [Review][Decision] Vault export output root when `OMNIPOTENT_REPO` ≠ script install tree — **Resolved (2026-05-28): option A — document only.** Operator contract: `OMNIPOTENT_REPO` must resolve to the same repo tree as `run-deterministic.mjs` (install root). Export output always lives under that tree at `scripts/output/vault-export-for-notebooklm.md`. Documented in `run-deterministic.mjs` header.

- [x] [Review][Patch] `notebooklm_targets.export_path` can disagree with `deterministic.export_path` on success [`scripts/session-close/run-deterministic.mjs`] — Fixed: `enrichNotebooklmTargets(pack)` reads `pack.deterministic.export_path`.

- [x] [Review][Patch] `prepare_context` failure leaves no `close-report.json` [`scripts/session-close/run-deterministic.mjs`] — Fixed: on prepare failure, writes `close-report.json` with `failure_class: pipeline` before rethrow.

- [x] [Review][Defer] No integration test for partial close on export or test failure [`tests/session-close-pipeline.test.mjs`] — Story AC verify only required dry-run orchestrator fixture; export/test failure paths are untested. deferred, acceptable for SC-2 MVP.

- [x] [Review][Defer] Vitest summary regex is format-specific [`run-deterministic.mjs:25`] — Only `Tests N passed` is recognized; other vitest/npm output shapes yield false `failure_class: tests`. deferred, operator can read logs.

- [x] [Review][Defer] `npm-env.sh` hardcodes Node `v24.14.0` fallback [`scripts/session-close/lib/npm-env.sh:5`] — If nvm has no versions, PATH falls back to a fixed version that may not exist on the host. deferred, matches 43-1 pattern.

## Dev Notes

### References

- [Source: ADR — Phase ordering table steps 2–3, Script layer `run-deterministic.mjs`, Security partial close]
- [Source: `scripts/export-vault-for-notebooklm.sh`]
- [Source: `package.json` script `vault:fast-scan`]

### Project Structure Notes

| Path | Action |
|------|--------|
| `scripts/session-close/run-deterministic.mjs` | **New** |
| `scripts/session-close/lib/npm-env.sh` | **New** |

## Dev Agent Record

### Agent Model Used

Composer (dev-story)

### Implementation Plan

- `run-deterministic.mjs` spawns `prepare-context.mjs` first, then export / fast-scan / `npm test` with partial-close policy (tests failure does not roll back prior steps).
- `lib/npm-env.sh` prepends newest nvm node bin to PATH before npm (Hermes gap from 43-1).
- Dry-run skips export, fast-scan write, and tests; still writes `context-pack.json` and `close-report.json` under target `OMNIPOTENT_REPO/.session-close/`.

### Completion Notes

- Phase A orchestrator: `node scripts/session-close/run-deterministic.mjs [--dry-run]`.
- `close-report.json`: per-step status, optional `failure_class`, `notebooklm_targets` with `export_path`, deterministic counts only.
- Extended `tests/session-close-pipeline.test.mjs` with vitest parser unit tests and dry-run orchestrator fixture.
- `bash scripts/verify.sh` passed.

## File List

| Path | Action |
|------|--------|
| `scripts/session-close/run-deterministic.mjs` | New |
| `scripts/session-close/lib/npm-env.sh` | New |
| `scripts/session-close/lib/paths.mjs` | Modified (`closeReportPath`) |
| `tests/session-close-pipeline.test.mjs` | Modified |

## Change Log

| Date | Change |
|------|--------|
| 2026-05-28 | Story SC-2 created from ADR |
| 2026-05-28 | SC-2 implemented: run-deterministic orchestrator, npm-env prelude, pipeline tests; status → review |
| 2026-05-28 | Code review: patches applied (export_path enrich, pipeline failure report); status → done |
