# Story 48.3 (SC-3): Session-close MEMORY and daily rhythm scripts

Status: ready-for-dev

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

- [ ] Implement `write-memory.mjs` (AC: memory)
- [ ] Port Step 6.7 logic to `refresh-daily-rhythm.mjs` (AC: rhythm, footer, idempotent)
- [ ] Wire into `run-deterministic.mjs` with documented ordering vs SC-4 (AC: orchestrator)
- [ ] Pipeline tests (AC: verify)

## Dev Notes

### References

- [Source: `_bmad-output/implementation-artifacts/43-1-cns-daily-rhythm-auto-blocks-via-session-close.md` — marker inventory, parsing rules]
- [Source: `scripts/hermes-skill-examples/session-close/references/daily-rhythm-static-rows.md`]
- [Source: ADR — `write-memory.mjs`, `refresh-daily-rhythm.mjs`, Phase ordering steps 6–7]

## Dev Agent Record

_(pending dev-story)_

## Change Log

| Date | Change |
|------|--------|
| 2026-05-28 | Story SC-3 created from ADR |
