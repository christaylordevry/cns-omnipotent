---
baseline_commit: 4870fd8eb57aaa95372e0b32ffcf9693f3802bb2
---

# Story 48.3 (SC-3): Session-close MEMORY and daily rhythm scripts

Status: done

Epic: **48** (Session-close context reduction — FR-17..19)  
Tracked in sprint-status as: **`48-3-session-close-memory-and-daily-rhythm-scripts`**  
**Depends on:** `48-1-session-close-context-pack-scaffold`, `48-2-session-close-deterministic-orchestrator` (orchestrator wiring)

**Architecture source of truth:** `_bmad-output/planning-artifacts/architecture-session-close-fr17-19.md` (port Steps 6.5–6.7).

## Context

- **43-1 shipped** eleven `AUTO:` markers in `CNS-Daily-Rhythm.md` via task-prompt Step 6.7 (LLM path). SC-3 **ports** that logic to `refresh-daily-rhythm.mjs` for Phase A determinism.
- **MEMORY.md:** Deterministic template ≤**2000** chars from pack + post-apply AGENTS (ADR). SC-3 implements `write-memory.mjs`; full pipeline may run MEMORY **after** `apply-section8` (ADR step 6) — orchestrator hook order documented below.
- **WriteGate:** Filesystem writes to canonical vault `AI-Context/**` only; no Vault IO mutators.
- **Static rows:** Reuse `scripts/hermes-skill-examples/session-close/references/daily-rhythm-static-rows.md`.

## Story

As an **operator**,  
I want **`write-memory.mjs` and `refresh-daily-rhythm.mjs` to update MEMORY.md and all CNS-Daily-Rhythm AUTO blocks deterministically**,  
so that **session-close no longer relies on LLM prose for Steps 6.5–6.7** (FR-17 parity with Epic 43).

## Acceptance Criteria

1. **write-memory.mjs (AC: memory)**  
   **Given** `.session-close/context-pack.json` and readable vault `AI-Context/AGENTS.md` (post-§8 if available)  
   **When** `node scripts/session-close/write-memory.mjs [--dry-run]` runs  
   **Then** write `AI-Context/MEMORY.md` on canonical vault path (WSL `/mnt/c/...` via `paths.mjs`)  
   **And** output ≤ **2000** characters UTF-8 LF  
   **When** `--dry-run`  
   **Then** no vault write; emit preview path in stdout or report  

2. **refresh-daily-rhythm.mjs (AC: rhythm)**  
   **When** **not** `--dry-run`  
   **Then** update all **eleven** AUTO markers per 43-1 inventory (`PROVIDER`, `VAULT_NOTES`, `VAULT_HEALTH`, `SPRINT`, `AGENTS_VERSION`, `SKILLS_COUNT`, `TESTS`, `LAST_SESSION`, `ACTIVE_PROJECTS`, `DEFERRED_SUMMARY`, `ROADMAP`) using `replace_auto` semantics (inner content only, preserve comment anchors)  
   **And** read newest `vault-lint-*.md` by filename date; reuse ≤7 days else document scan trigger in Dev Agent Record  
   **And** merge `daily-rhythm-static-rows.md` for non-sprint project rows  
   **When** `--dry-run`  
   **Then** no write to `CNS-Daily-Rhythm.md`; values available in `close-report.json` preview fields  

3. **Orchestrator integration (AC: orchestrator)**  
   **When** shipped  
   **Then** `run-deterministic.mjs` invokes `write-memory.mjs` and `refresh-daily-rhythm.mjs` on real close  
   **And** documents execution order: MEMORY/rhythm after `apply-section8` when full pipeline enabled — for SC-3, wire scripts callable standalone; SC-5 skill orders end-to-end (ADR steps 6–7 after §8 apply)  

4. **Idempotence (AC: idempotent)**  
   **When** inputs unchanged  
   **Then** second run produces identical bytes for script-generated MEMORY and rhythm inner blocks  

5. **AGENTS_VERSION timing (AC: agents-version)**  
   **When** `refresh-daily-rhythm.mjs` runs in full close after SC-4  
   **Then** `AUTO:AGENTS_VERSION` reflects post-close `> Version: X.Y.Z` header  
   **And** SC-3 tests may use fixture AGENTS if SC-4 not merged yet  

6. **Partial close (AC: partial)**  
   **When** `npm test` failed earlier  
   **Then** `AUTO:TESTS` may read `FAILED (see session-close log)` without blocking rhythm write (43-1 policy)  

7. **Footer line (AC: footer)**  
   **When** real close updates rhythm file  
   **Then** set `*Last auto-update: …*` footer with date, AGENTS version, provider string  

8. **Tests (AC: verify)**  
   **When** shipped  
   **Then** extend `tests/session-close-pipeline.test.mjs` with fixture rhythm file asserting all 11 markers replaced and dry-run skip  
   **And** `npm test` + `bash scripts/verify.sh` pass  

9. **Non-goals (AC: scope)**  
   **Then** no changes to slim skill package (SC-5) or `apply-section8.mjs` (SC-4) beyond orchestrator hooks  

## Tasks / Subtasks

- [x] Implement `write-memory.mjs` (AC: memory)
- [x] Port Step 6.7 logic to `refresh-daily-rhythm.mjs` (AC: rhythm, footer, idempotent)
- [x] Wire into `run-deterministic.mjs` with documented ordering vs SC-4 (AC: orchestrator)
- [x] Pipeline tests (AC: verify)

### Review Findings

- [x] [Review][Patch] `write-memory` must load `context-pack.json` when present — **Operator decision (2026-05-28):** prefer pack fields; fallback to direct `read-sources`. Fixed: `load-context-pack.mjs`, orchestrator passes in-memory `pack`.

- [x] [Review][Patch] MEMORY body hardcodes operator vault path — fixed: `vaultRoot` from `resolvePaths` in `buildMemoryMarkdown`.

- [x] [Review][Patch] Stale vault-lint not visible in rhythm output — fixed: `AUTO:VAULT_HEALTH` suffix when `stale: true`.

- [x] [Review][Patch] `deferred-work.md` read is fail-hard — fixed: `.catch(() => "")` in `loadRhythmRefreshInputs`.

- [x] [Review][Patch] Static rows file read is fail-hard — fixed: `.catch(() => "")` in `loadRhythmRefreshInputs`.

- [x] [Review][Patch] `replaceAuto` uses `RegExp.test` then `replace` — fixed: single `exec` + slice splice.

- [x] [Review][Defer] `AUTO:AGENTS_VERSION` reflects pre-`apply-section8` AGENTS in Phase A — expected until SC-4/SC-5; story AC agents-version allows fixture timing.

- [x] [Review][Defer] Full ADR ordering (MEMORY/rhythm after §8 apply) not in Phase A orchestrator — documented in `run-deterministic.mjs` comment; SC-5 skill re-order pending.

- [x] [Review][Defer] No non–dry-run orchestrator integration test for memory/rhythm steps — unit tests cover scripts; heavy E2E left to verify.sh / operator smoke.

## Dev Notes

### References

- [Source: `_bmad-output/implementation-artifacts/43-1-cns-daily-rhythm-auto-blocks-via-session-close.md` — marker inventory, parsing rules]
- [Source: `scripts/hermes-skill-examples/session-close/references/daily-rhythm-static-rows.md`]
- [Source: ADR — `write-memory.mjs`, `refresh-daily-rhythm.mjs`, Phase ordering steps 6–7]

## Dev Agent Record

### Implementation Plan

- Shared `lib/replace-auto.mjs`, `lib/rhythm-markers.mjs` (eleven AUTO markers + footer), `lib/write-memory-body.mjs` (Step 6.5 template).
- CLI: `write-memory.mjs`, `refresh-daily-rhythm.mjs`; orchestrator runs both after test capture on real close; dry-run fills `memory_preview` / `daily_rhythm_preview` on `close-report.json`.
- Vault-lint: reuse newest `vault-lint-*.md` by basename date via `readVaultLintSummary` (≤7 days fresh; stale flag when older — no bulk scan in Phase A scripts).

### Completion Notes

- All eleven AUTO markers + footer wired; idempotence covered in tests.
- `bash scripts/verify.sh` passed (CNS + cns-dashboard when present).

## File List

- `scripts/session-close/write-memory.mjs` (new)
- `scripts/session-close/refresh-daily-rhythm.mjs` (new)
- `scripts/session-close/lib/replace-auto.mjs` (new)
- `scripts/session-close/lib/rhythm-markers.mjs` (new)
- `scripts/session-close/lib/write-memory-body.mjs` (new)
- `scripts/session-close/lib/load-context-pack.mjs` (new, code-review)
- `scripts/session-close/run-deterministic.mjs` (modified)
- `tests/session-close-pipeline.test.mjs` (modified)

## Change Log

| Date | Change |
|------|--------|
| 2026-05-28 | Story SC-3 created from ADR |
| 2026-05-28 | SC-3 implemented: write-memory, refresh-daily-rhythm, orchestrator hooks, pipeline tests |
| 2026-05-28 | Code review patches: context-pack preference, dynamic vault path, stale lint in VAULT_HEALTH, graceful missing inputs, replaceAuto fix |
