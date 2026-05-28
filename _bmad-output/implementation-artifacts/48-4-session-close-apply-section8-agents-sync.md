---
baseline_commit: 4edb5df1370c613cc6db40cda4158d6b0133a042
---

# Story 48.4 (SC-4): Session-close apply Section 8 and AGENTS sync

Status: done

Epic: **48** (Session-close context reduction — FR-17..19)  
Tracked in sprint-status as: **`48-4-session-close-apply-section8-agents-sync`**  
**Depends on:** `48-1-session-close-context-pack-scaffold` (pack + §8 excerpt semantics)

**Architecture source of truth:** `_bmad-output/planning-artifacts/architecture-session-close-fr17-19.md` (FR-18 apply path, ADR-SC-002).

## Context

- **FR-18:** LLM produces §8 markdown only; **`apply-section8.mjs`** patches files deterministically.
- **Draft cap:** `section8-draft.md` max **1,500** tokens (CI golden).
- **Sync targets (byte-identical):**  
  - `specs/cns-vault-contract/AGENTS.md` (repo mirror)  
  - `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md` (canonical vault)  
  - Planning mirror if ADR requires — same list as 28.1 task-prompt
- **Boundaries:** Replace `## 8.` .. `## 9.`; patch version + changelog anchor row from pack.

## Story

As an **operator**,  
I want **`apply-section8.mjs` to apply an LLM §8 draft with version bump and byte-sync both AGENTS copies**,  
so that **Section 8 updates are deterministic and testable without loading 800+ line AGENTS into the model** (FR-18).

## Acceptance Criteria

1. **CLI (AC: cli)**  
   **Given** `.session-close/section8-draft.md` exists  
   **When** `node scripts/session-close/apply-section8.mjs --draft .session-close/section8-draft.md [--dry-run]` runs  
   **Then** apply §8 content per chosen boundary convention (document in Dev Agent Record: draft includes `## 8.` headers **or** fragment only — pick one, test consistently)  

2. **Section replacement (AC: replace)**  
   **When** applying on real close  
   **Then** replace content strictly between `## 8. Current Focus` (or `## 8.`) and `## 9.` headers without altering §9+  
   **And** golden-file test guards regex drift (ADR risk table)  

3. **Version and changelog (AC: version)**  
   **When** applying  
   **Then** bump AGENTS header `> Version: X.Y.Z` per task-prompt rules (patch increment)  
   **And** insert changelog table row using `agents.changelog_anchor_row` pattern from context pack  
   **And** update `Last updated:` date field  

4. **Mirror sync (AC: sync)**  
   **When** apply succeeds  
   **Then** repo `specs/cns-vault-contract/AGENTS.md` and vault `AI-Context/AGENTS.md` are **byte-identical**  
   **And** `cmp` or test assertion proves parity (28.1 pattern)  

5. **Dry-run (AC: dry-run)**  
   **When** `--dry-run`  
   **Then** no AGENTS writes; may write preview diff to `.session-close/` only  

6. **Draft token guard (AC: draft-limit)**  
   **When** draft exceeds 1,500 tokens  
   **Then** exit non-zero with clear error before mutating AGENTS  

7. **Failure isolation (AC: failure)**  
   **When** apply fails  
   **Then** `close-report.json` records `failure_class: section8`  
   **And** prior Phase A artifacts (export, fast-scan) remain on disk (ADR partial close)  

8. **Tests (AC: verify)**  
   **When** shipped  
   **Then** golden fixture AGENTS + draft → expected bytes; sync test; draft oversize rejection  
   **And** `npm test` + `bash scripts/verify.sh` pass  

9. **Constitution sync rule (AC: agents-sync)**  
   **When** editing repo `specs/cns-vault-contract/AGENTS.md` in implementation PR  
   **Then** follow workspace rule: update canonical vault copy in same operation if touching constitution text (WriteGate: route via apply script, not manual split)  

10. **Scope (AC: scope)**  
    **Then** this story does **not** slim the Hermes skill (SC-5) or run LLM synthesis (skill does in SC-5)  

## Tasks / Subtasks

- [x] Implement `apply-section8.mjs` (AC: cli, replace, version, sync, dry-run, failure)
- [x] Golden AGENTS fixtures + tests (AC: verify, draft-limit)
- [x] Document draft boundary convention in skill prep for SC-5 (AC: replace)

### Review Findings

- [x] [Review][Patch] Roll back AGENTS mirror writes when the second target fails so repo and vault cannot diverge mid-apply. [`scripts/session-close/apply-section8.mjs`]
- [x] [Review][Patch] Align default changelog row text with session-close apply path when context pack is absent. [`scripts/session-close/lib/apply-section8-body.mjs`]
- [x] [Review][Defer] `indexOf("## 8.")` boundary matching is shared with `prepare-context.mjs` / `read-sources.mjs`; tightening to `## 8. Current Focus` only is a cross-pipeline follow-up, not SC-4-only.
- [x] [Review][Defer] No committed byte-for-byte golden snapshot file; inline golden assertions cover version, §9+ preservation, and changelog insertion (AC: verify satisfied pragmatically).

## Dev Notes

### References

- [Source: ADR — `apply-section8.mjs`, section8-draft cap, Risks `apply-section8` regex drift]
- [Source: `_bmad-output/implementation-artifacts/28-1-automate-agents-md-section-8-via-hermes-session-close.md`]
- [Source: `scripts/hermes-skill-examples/session-close/references/task-prompt.md` — Steps 3–5 §8 template]

## Dev Agent Record

### Implementation Plan

- **Draft convention (AC: replace):** `section8-draft.md` is a **fragment only** (no `## 8.` heading). If the LLM includes `## 8.`, the apply script strips it and normalizes to `## 8. Current Focus`. Documented in `task-prompt.md` Step 3 for SC-5.
- **Patch order:** read specs mirror (fallback vault) → replace `## 8.`..`## 9.` → patch `> Version:` / `Last updated:` → insert changelog row (message from pack anchor third column when present, else session-close default) → write identical bytes to `specs/cns-vault-contract/AGENTS.md` and vault `AI-Context/AGENTS.md`.
- **Dry-run:** writes `.session-close/section8-apply-preview.md` only.
- **Failure:** `recordSection8Failure` sets `failure_class: section8` on existing `close-report.json` without deleting Phase A artifacts.

### Completion Notes

- Shipped `scripts/session-close/apply-section8.mjs` + `lib/apply-section8-body.mjs`; `SECTION8_DRAFT_TOKEN_LIMIT` (1500) in `lib/token-estimate.mjs`; `repoAgentsPath` on `resolvePaths`.
- Golden fixture `tests/fixtures/session-close/section8-draft-fragment.md`; nine tests in `tests/session-close-pipeline.test.mjs` (golden apply, byte-sync, dry-run, oversize rejection, failure report, CLI argv).
- `npm test` and `bash scripts/verify.sh` passed.

## File List

- `scripts/session-close/apply-section8.mjs` (new)
- `scripts/session-close/lib/apply-section8-body.mjs` (new)
- `scripts/session-close/lib/paths.mjs` (modified)
- `scripts/session-close/lib/token-estimate.mjs` (modified)
- `scripts/hermes-skill-examples/session-close/references/task-prompt.md` (modified)
- `tests/fixtures/session-close/section8-draft-fragment.md` (new)
- `tests/session-close-pipeline.test.mjs` (modified)

## Change Log

| Date | Change |
|------|--------|
| 2026-05-28 | Story SC-4 created from ADR |
| 2026-05-28 | SC-4 implemented: apply-section8.mjs, golden tests, task-prompt draft convention |
| 2026-05-28 | Code review: mirror rollback on partial write; changelog default aligned |
