---
baseline_commit: 1bb635898d59403fa8684fa9014a93de835669cd
---

# Story 48.5 (SC-5): Session-close slim skill package and tests

Status: done

Epic: **48** (Session-close context reduction — FR-17..19)  
Tracked in sprint-status as: **`48-5-session-close-slim-skill-package-and-tests`**

**Depends on:** SC-1 through SC-4 (scripts + apply path)

**Architecture source of truth:** `_bmad-output/planning-artifacts/architecture-session-close-fr17-19.md` (FR-18, FR-19, ADR-SC-004, ADR-SC-005).

## Context

- **Router skill:** `SKILL.md` ~60–80 lines; mandatory first action: `node …/run-deterministic.mjs`.
- **Retire activation path** for monolithic `task-prompt.md` → `references/task-prompt.legacy.md` (ADR-SC-004).
- **LLM reads only:** `.session-close/context-pack.json` + `references/section8-synthesis.md`.
- **NotebookLM:** Phase C from `close-report.json` IDs only — `title: "My Knowledge Base"`, `wait: false`, no export body in prompts (ADR-SC-005).
- **Pitfalls:** Trim to **5** LLM-relevant items per ADR.

## Story

As an **operator**,  
I want **the Hermes session-close skill to route through Phase A scripts then bounded §8 synthesis**,  
so that **`/session-close` uses ≤6k LLM tokens** while preserving close parity (FR-18, FR-19).

## Acceptance Criteria

1. **SKILL.md router (AC: skill)**  
   **Given** `scripts/hermes-skill-examples/session-close/`  
   **When** shipped  
   **Then** `SKILL.md` is ~60–80 lines and:  
   - Validates `/session-close` and `--dry-run` only  
   - **Step 1 (hard gate):** `node "${OMNIPOTENT_REPO}/scripts/session-close/run-deterministic.mjs" [--dry-run]` via **terminal** toolset (not `execute_code` Python)  
   - Reads only `.session-close/context-pack.json` + `references/section8-synthesis.md`  
   - Writes `.session-close/section8-draft.md` within **1,500** token cap  
   - Real close: `node …/apply-section8.mjs --draft .session-close/section8-draft.md`  
   - Discord reply from `close-report.json` via `references/discord-reply-template.md`  
   - Does **not** load `task-prompt.legacy.md` on activation  

2. **Reference files (AC: references)**  
   **When** shipped  
   **Then** repo contains:  
   - `references/section8-synthesis.md` — §8 shape, pack-only inputs, no invented epics  
   - `references/trigger-pattern.md` — unchanged semantics  
   - `references/config-snippet.md` — `OMNIPOTENT_REPO`, `CNS_VAULT_ROOT`, `~/.hermes/session-close.env`  
   - `references/discord-reply-template.md` — render from report  
   - `references/task-prompt.legacy.md` — archived monolith (copy from current `task-prompt.md`)  

3. **Skill frontmatter (AC: metadata)**  
   **When** shipped  
   **Then** `metadata.hermes` includes `requires_toolsets: [terminal]` and tags per ADR  
   **And** bump skill `version` in frontmatter for cache bust (ADR risk: Hermes skill cache)  

4. **Install script (AC: install)**  
   **When** `bash scripts/install-hermes-skill-session-close.sh` runs  
   **Then** copies slim package to `~/.hermes/skills/cns/session-close/`  
   **And** `cmp` parity for `SKILL.md`, `section8-synthesis.md`, `trigger-pattern.md`  

5. **End-to-end close order (AC: pipeline)**  
   **When** skill executes real close  
   **Then** documented order matches ADR: deterministic (export, fast-scan) → LLM §8 → apply-section8 → memory + rhythm (via orchestrator hooks from SC-3) → NotebookLM MCP from report IDs → Discord reply  

6. **Dry-run (AC: dry-run)**  
   **When** `--dry-run`  
   **Then** Phase A dry-run + §8 preview only; no `apply-section8` write  

7. **Regression tests (AC: verify)**  
   **When** shipped  
   **Then** update `tests/hermes-session-close-skill.test.mjs` for:  
   - Router mandates `run-deterministic.mjs`  
   - Absence of full `task-prompt.md` on activation path  
   - Presence of `section8-synthesis.md`, `context-pack.json` references  
   - Retired inline Step 6.6/6.7 generation prose in SKILL  
   - `requires_toolsets: terminal`  
   **And** `tests/session-close-pipeline.test.mjs` in verify gate  
   **And** `npm test` + `bash scripts/verify.sh` pass  

8. **Acceptance criteria parity (AC: parity)**  
   **When** full pipeline implemented (SC-1..4 + this story)  
   **Then** design satisfies ADR acceptance #2 parity checklist (AGENTS, export, MEMORY, fast-scan, 11 AUTO markers, NotebookLM fan-out) — operator validates in SC-6  

9. **Non-goals (AC: scope)**  
   **Then** no `notebooklm-fanout.mjs` unless stretch (ADR open item #2)  
   **Then** no per-skill Haiku routing (ADR-SC-006 deferred)  

## Tasks / Subtasks

- [x] Refactor `SKILL.md` to router (AC: skill, metadata, dry-run, pipeline)
- [x] Add synthesis + discord + config refs; archive task-prompt (AC: references)
- [x] Update install script if paths change (AC: install)
- [x] Extend hermes-session-close + pipeline tests (AC: verify)

### Review Findings

- [x] [Review][Patch] Installer parity check omits `discord-reply-template.md` [`scripts/install-hermes-skill-session-close.sh`]
- [x] [Review][Patch] Discord reply template placeholders do not match `close-report.json` schema [`scripts/hermes-skill-examples/session-close/references/discord-reply-template.md`]
- [x] [Review][Patch] Router trigger validation needs explicit reject behavior (not just “only accept” list) [`scripts/hermes-skill-examples/session-close/SKILL.md`]

## Dev Notes

### References

- [Source: ADR — Skill package refactor, SKILL router contract, Pitfalls (5 items)]
- [Source: `_bmad-output/implementation-artifacts/36-2-hermes-skill-parity-pass.md` — install/cmp pattern]

## Dev Agent Record

### Debug Log

- Updated `scripts/hermes-skill-examples/session-close/` to a slim router package.
- Updated install parity checks and hardened tests to enforce the new router contract.
- Verified `npm test` passes, and `bash scripts/verify.sh` is green (642 tests).

### Completion Notes

- Slimmed `session-close` skill into a router that hard-gates on `run-deterministic.mjs`, reads only `.session-close/context-pack.json` + `references/section8-synthesis.md`, writes `.session-close/section8-draft.md`, and applies via `apply-section8.mjs`.
- Added new reference files: `section8-synthesis.md`, `discord-reply-template.md`, and archived monolith as `task-prompt.legacy.md`.
- Updated installer to `cmp` parity-check `SKILL.md`, `section8-synthesis.md`, and `trigger-pattern.md`.
- Updated regression tests to assert router behavior and absence of monolithic activation content.

### File List

- `scripts/hermes-skill-examples/session-close/SKILL.md`
- `scripts/hermes-skill-examples/session-close/references/config-snippet.md`
- `scripts/hermes-skill-examples/session-close/references/section8-synthesis.md` (new)
- `scripts/hermes-skill-examples/session-close/references/discord-reply-template.md` (new)
- `scripts/hermes-skill-examples/session-close/references/task-prompt.legacy.md` (new)
- `scripts/hermes-skill-examples/session-close/references/task-prompt.md` (deleted)
- `scripts/install-hermes-skill-session-close.sh`
- `tests/hermes-session-close-skill.test.mjs`

## Change Log

| Date | Change |
|------|--------|
| 2026-05-28 | Story SC-5 created from ADR |
| 2026-05-28 | Implemented slim session-close skill router package, installer parity checks, and regression tests; verify gate green |
