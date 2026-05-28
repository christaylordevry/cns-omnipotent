---
baseline_commit: 26a8b4650f9977b952a203ea27a2467046516ebe
---

# Story 48.1 (SC-1): Session-close context pack scaffold

Status: done

Epic: **48** (Session-close context reduction — FR-17..19)  
Tracked in sprint-status as: **`48-1-session-close-context-pack-scaffold`**

**Architecture source of truth:** `_bmad-output/planning-artifacts/architecture-session-close-fr17-19.md` (ADR-SC-001, ADR-SC-002). No PRD in repo — acceptance criteria derive from ADR only.

## Context

- **Problem:** Monolithic session-close skill loads ~52k tokens before useful work; sprint YAML, full AGENTS, and story bodies are read by the LLM unnecessarily.
- **Decision:** Phase A builds a bounded `context-pack.json` (max **3,500** tokens via `ceil(utf8.length/4)`) for Phase B §8 synthesis only.
- **Reuse:** Sprint/story excerpt logic should align with caps in `scripts/hermes-skill-examples/session-close/references/task-prompt.md` and collectors in `scripts/dashboard-sync.ts` — prefer shared `lib/read-sources.mjs` over duplicating parsers (ADR open item #3).
- **Output dir:** `<repo_root>/.session-close/` (gitignored).
- **Non-goals:** Vault IO mutator changes, WriteGate changes, `git commit`/`push`, NotebookLM connector semantics.

## Story

As an **operator**,  
I want **`prepare-context.mjs` to emit a normative, token-bounded `context-pack.json`** from sprint status, three recent story excerpts, and the current AGENTS §8 excerpt,  
so that **Hermes session-close can synthesize Section 8 without loading full source files** (FR-18 foundation).

## Acceptance Criteria

1. **Directory scaffold (AC: scaffold)**  
   **Given** the Omnipotent.md repo  
   **When** this story ships  
   **Then** `scripts/session-close/` exists with at least:  
   - `prepare-context.mjs` (CLI entry)  
   - `lib/paths.mjs` — resolves `OMNIPOTENT_REPO`, `CNS_VAULT_ROOT`, canonical `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE` defaults  
   - `lib/token-estimate.mjs` — `ceil(utf8.length / 4)` (consistent with fast-scan skill)  
   - `lib/read-sources.mjs` — sprint YAML fragments, story glob + excerpt (≤200 char bullets), vault-lint summary hook (stub OK if report missing), Hermes config provider line  

2. **Context pack schema (AC: schema)**  
   **When** `node scripts/session-close/prepare-context.mjs` runs with valid repo/vault paths  
   **Then** it writes `.session-close/context-pack.json` matching ADR normative schema:  
   `generated_at`, `mode` (`real` | `dry-run` from `--dry-run`), `repo_root`, `vault_root`, `agents` (`version`, `section8_excerpt`, `changelog_anchor_row`), `sprint` (`active_epics`, `project_status_line`), `recent_stories` (max **3** entries with `basename`, `title`, `status`, `bullet`), `deterministic` (may be partial stubs in SC-1), `notebooklm_targets`, `token_budget` (`pack_tokens`, `pack_limit` = 3500)  

3. **Section 8 excerpt window (AC: section8)**  
   **When** building `agents.section8_excerpt`  
   **Then** extract only content between `## 8.` and `## 9.` from canonical vault `AI-Context/AGENTS.md` (via `paths.mjs`)  
   **And** truncate to max **1,200** tokens before pack-level enforcement  

4. **Token enforcement (AC: budget)**  
   **When** `pack_tokens > pack_limit` (3500)  
   **Then** drop `section8_excerpt` first, then shorten story bullets  
   **And** never drop `sprint.active_epics`  
   **And** set `token_budget.pack_tokens` to final estimate  

5. **Sprint parsing (AC: sprint)**  
   **When** reading `_bmad-output/implementation-artifacts/sprint-status.yaml`  
   **Then** populate `sprint.active_epics` with epics in `in-progress` and notable story keys (`ready-for-dev`, `review`, `deferred`) per epic  
   **And** emit `project_status_line` consistent with Phase 6/7 wording in repo `CLAUDE.md` / sprint header comments  

6. **Gitignore (AC: gitignore)**  
   **When** shipped  
   **Then** `.session-close/` is listed in repo `.gitignore`  

7. **Tests (AC: verify)**  
   **When** implementation completes  
   **Then** `tests/session-close-pipeline.test.mjs` exists with fixture pack asserting:  
   - JSON schema keys present  
   - `pack_tokens ≤ 3500` on golden fixture  
   - Truncation order (drop §8 excerpt before sprint epics) via unit cases  
   **And** `bash scripts/verify.sh` includes the new test file (wire in `scripts/verify.sh` if not auto-discovered)  
   **And** `npm test` passes  

8. **Non-goals (AC: scope)**  
   **Then** this story does **not** implement `run-deterministic.mjs`, export, fast-scan, MEMORY, rhythm, or `apply-section8.mjs`  

## Tasks / Subtasks

- [x] Add `scripts/session-close/` + `lib/*` modules (AC: scaffold)
- [x] Implement `prepare-context.mjs` with `--dry-run` flag (AC: schema, section8, sprint, budget)
- [x] Add `.session-close/` to `.gitignore` (AC: gitignore)
- [x] Add `tests/session-close-pipeline.test.mjs` + verify gate wiring (AC: verify)

### Review Findings

- [x] [Review][Patch] Pack can exceed 3,500 tokens after enforcement — fixed: `enforceTokenBudget` now trims notebooklm titles, drops overflow targets, and shortens other non-sprint fields until `pack_tokens <= pack_limit`. [`scripts/session-close/lib/token-estimate.mjs`]
- [x] [Review][Patch] No regression test for hard 3,500 cap under adversarial payload — added adversarial notebooklm test. [`tests/session-close-pipeline.test.mjs`]
- [x] [Review][Patch] Missing `--dry-run` write-skip test — added CLI `--dry-run` asserts no file on disk. [`tests/session-close-pipeline.test.mjs`]
- [x] [Review][Patch] Live-repo CLI test mutates workspace — replaced with isolated fixture + `finally` cleanup. [`tests/session-close-pipeline.test.mjs`]

## Dev Notes

### References

- [Source: `_bmad-output/planning-artifacts/architecture-session-close-fr17-19.md` — Token budget, context-pack schema, Script layer table]
- [Source: `scripts/hermes-skill-examples/session-close/references/task-prompt.md` — sprint/story selection caps]
- [Source: `_bmad-output/implementation-artifacts/43-1-cns-daily-rhythm-auto-blocks-via-session-close.md` — vault paths, sprint YAML fields]

### Project Structure Notes

| Path | Action |
|------|--------|
| `scripts/session-close/prepare-context.mjs` | **New** |
| `scripts/session-close/lib/paths.mjs` | **New** |
| `scripts/session-close/lib/token-estimate.mjs` | **New** |
| `scripts/session-close/lib/read-sources.mjs` | **New** |
| `tests/session-close-pipeline.test.mjs` | **New** |
| `.gitignore` | Add `.session-close/` |

## Dev Agent Record

### Agent Model Used

Composer (dev-story)

### Implementation Plan

- Red-green: unit tests for token budget order, sprint/story parsers, and fixture pack schema before wiring CLI.
- `prepare-context.mjs` builds ADR normative `context-pack.json` under `.session-close/`; `--dry-run` sets `mode` and skips write.
- Token path: §8 capped at 1,200 tokens, then pack capped at 3,500 (drop §8 excerpt first, shorten story bullets; never drop `sprint.active_epics`).

### Completion Notes List

- Added `scripts/session-close/` with `prepare-context.mjs`, `lib/paths.mjs`, `lib/token-estimate.mjs`, `lib/read-sources.mjs`.
- Pack reads canonical vault `AI-Context/AGENTS.md`, sprint-status.yaml, three newest story artifacts, vault-lint summary (stub when missing), and NotebookLM map rows with UUIDs.
- `tests/session-close-pipeline.test.mjs` covers schema keys, golden fixture budget, truncation order, and live CLI write; picked up by existing `npm run test:node` glob.
- `bash scripts/verify.sh` passed.

### File List

- `scripts/session-close/prepare-context.mjs`
- `scripts/session-close/lib/paths.mjs`
- `scripts/session-close/lib/token-estimate.mjs`
- `scripts/session-close/lib/read-sources.mjs`
- `tests/session-close-pipeline.test.mjs`
- `.gitignore`

## Change Log

| Date | Change |
|------|--------|
| 2026-05-28 | Story SC-1 created from architecture-session-close-fr17-19 ADR |
| 2026-05-28 | SC-1 implemented: session-close context pack scaffold + pipeline tests |
| 2026-05-28 | Code review: token budget hard cap, adversarial + dry-run tests, isolated CLI fixture |
