---
baseline_commit: 3dc67e9b26033249020715d95321a749b983f839
---

# Story 49.5: Phase B token check gate

Status: done

<!-- Operator brief 2026-05-29. Validation optional: validate-create-story before dev-story. -->

## Story

As a **CNS operator running `/session-close`**,  
I want **a hard token gate on `section8-draft.md` before Section 8 is applied to AGENTS**,  
so that **bloated LLM drafts cannot silently overwrite Section 8 with junk**.

## Acceptance Criteria

1. **ABORT when over limit**  
   **Given** `.session-close/section8-draft.md` exists and `Math.ceil(charCount / 4) > 1500`  
   **When** the Phase B apply path runs on a real close (not dry-run preview-only)  
   **Then** `apply-section8.mjs` is **not** invoked (no AGENTS mutation)  
   **And** a warning is written to stderr/console  
   **And** `.session-close/close-report.json` contains:
   ```json
   "phase_b_token_check": {
     "tokens": <N>,
     "status": "ABORTED",
     "reason": "exceeds 1500 token limit"
   }
   ```

2. **PASS when within limit**  
   **Given** `section8-draft.md` token estimate ≤ 1500  
   **When** the Phase B apply path runs  
   **Then** `apply-section8.mjs` runs as today (version bump, changelog, byte-sync)  
   **And** `close-report.json` contains:
   ```json
   "phase_b_token_check": {
     "tokens": <N>,
     "status": "PASSED"
   }
   ```

3. **Tests**  
   **Given** `tests/session-close-token-gate.test.mjs`  
   **When** `npm test` / `bash scripts/verify.sh` runs  
   **Then** unit tests prove PASSED → apply runs + report field; ABORTED → apply blocked + report field.

4. **Verify gate**  
   **When** implementation is complete  
   **Then** `bash scripts/verify.sh` is green.

## Tasks / Subtasks

- [x] Add Phase B gate module + CLI wrapper (AC: 1, 2)
  - [x] Export `evaluatePhaseBDraftTokens(draftText)` using existing `estimateTokens` + `SECTION8_DRAFT_TOKEN_LIMIT` from `lib/token-estimate.mjs`
  - [x] Export `recordPhaseBTokenCheck(closeReportPath, result)` — read-merge-write `close-report.json` (preserve existing keys; same pattern as `recordSection8Failure` in `apply-section8.mjs`)
  - [x] Add `gate-apply-section8.mjs` (name may vary): read draft → count → record check → if PASSED call `runApplySection8`; if ABORTED log warning and exit without apply
- [x] Wire Hermes Phase B invoke to gate script (AC: 1, 2)
  - [x] Update `scripts/hermes-skill-examples/session-close/SKILL.md` real-close command to call gate script instead of `apply-section8.mjs` directly
  - [x] Extend `tests/hermes-session-close-skill.test.mjs` to assert gate script is documented (mirror `apply-section8.mjs` assertion)
- [x] Add `tests/session-close-token-gate.test.mjs` (AC: 3)
  - [x] PASSED: small draft, gate allows apply, AGENTS changes, `phase_b_token_check.status === "PASSED"`
  - [x] ABORTED: oversized draft, AGENTS unchanged, `phase_b_token_check.status === "ABORTED"`, apply not called (spy `runApplySection8` or assert AGENTS bytes unchanged)
- [x] Run `bash scripts/verify.sh` (AC: 4)

## Dev Notes

### Where Phase B actually runs (read this first)

**`run-deterministic.mjs` is Phase A only.** It writes `context-pack.json` and `close-report.json` but does **not** read `section8-draft.md` or call `apply-section8.mjs`. Phase B is the Hermes `session-close` skill: LLM writes `.session-close/section8-draft.md`, then the skill runs a Node apply step.

**Implement the gate at the Phase B apply boundary**, not inside Phase A:

| Phase | Entry | Draft / apply |
|-------|--------|----------------|
| A | `run-deterministic.mjs` | No draft |
| B | Hermes skill → **gate script** → `apply-section8.mjs` | `section8-draft.md` |

Do **not** bolt token counting onto `run-deterministic.mjs` unless you also move Phase B orchestration there (out of scope).

### Existing token guard (reuse, do not reinvent)

`scripts/session-close/lib/token-estimate.mjs` already defines:

- `SECTION8_DRAFT_TOKEN_LIMIT = 1500`
- `estimateTokens(text)` → `Math.ceil((text ?? "").length / 4)` (ADR-SC-002)

`apply-section8.mjs` **already** rejects oversize drafts inside `runApplySection8` and sets `failure_class: "section8"` via `recordSection8Failure`. That is **not** the contract for this story.

This story adds a **pre-apply** gate with a **distinct** report field `phase_b_token_check` and must **skip calling** `runApplySection8` when ABORTED. Keeping the internal apply-section8 check as defense-in-depth is acceptable; the gate script is the operator-visible contract and Hermes entrypoint.

### Recommended implementation shape

```
scripts/session-close/
  lib/phase-b-token-gate.mjs     # evaluate + merge close-report
  gate-apply-section8.mjs        # CLI: --draft <path> [--dry-run]; delegates to runApplySection8 when PASSED
```

**`recordPhaseBTokenCheck` merge rules:**

- Load existing `close-report.json` if present (Phase A may have written it); else `{}`.
- Set top-level `phase_b_token_check` object exactly per AC (no extra keys required).
- Do not clear `steps`, `failure_class`, or `deterministic` unless ABORTED should also set `steps.section8` — **prefer not** to set `failure_class: "section8"` on ABORT; token gate is a controlled skip, not an apply failure. If product wants a `steps.section8: { status: "skipped", message: "..." }` entry, add it only if tests/operator guide need it (not in AC).

**Console on ABORT:** e.g. `session-close: phase B token check ABORTED (N tokens > 1500); apply-section8 skipped` on stderr.

**Dry-run:** Hermes skill does not apply on dry-run (§8 preview only). Gate script should respect `--dry-run`: still record `phase_b_token_check` if useful for preview, but must not mutate AGENTS (align with `runApplySection8({ dryRun: true })` behavior).

### Invocation site to update

```47:48:scripts/hermes-skill-examples/session-close/SKILL.md
node "${OMNIPOTENT_REPO}/scripts/session-close/apply-section8.mjs" --draft ".session-close/section8-draft.md"
```

Replace with gate script path; keep `--draft` relative to repo root (`.session-close/section8-draft.md`).

After install, operator runs `scripts/install-hermes-skill-session-close.sh` — document in completion notes if skill version bump needed (`version` in SKILL frontmatter).

### close-report.json shape (example)

```json
{
  "generated_at": "…",
  "mode": "real",
  "phase_b_token_check": {
    "tokens": 412,
    "status": "PASSED"
  },
  "steps": { … }
}
```

ABORTED example:

```json
"phase_b_token_check": {
  "tokens": 2104,
  "status": "ABORTED",
  "reason": "exceeds 1500 token limit"
}
```

### Testing patterns (mirror existing session-close tests)

- Framework: Node built-in test (`node:test`), run via `npm run test:node` (`tests/*.test.mjs`).
- Reference: `tests/session-close-pipeline.test.mjs` — `mkdtemp`, `seedSessionCloseFixture` (function is **local** to that file; copy minimal AGENTS + `.session-close` layout or duplicate the smallest fixture setup inline).
- Oversize draft: `"word ".repeat(SECTION8_DRAFT_TOKEN_LIMIT * 4 + 200)` (same as SC-4 oversize test).
- Under-limit: `tests/fixtures/session-close/section8-draft-fragment.md`.
- ABORTED test must assert **repo** `specs/cns-vault-contract/AGENTS.md` unchanged (byte-equal before/after).
- PASSED test may call exported gate runner with `runApplySection8` mocked **or** integration-style with real `runApplySection8` on fixture AGENTS (prefer one integration test matching SC-4 style).

### Architecture / spec alignment

- [Source: `_bmad-output/planning-artifacts/architecture-session-close-fr17-19.md` — Token budget ledger: `section8-draft.md` max **1,500** tokens; consumer `apply-section8.mjs`]
- [Source: `_bmad-output/implementation-artifacts/48-4-session-close-apply-section8-agents-sync.md` — SC-4 apply path, `SECTION8_DRAFT_TOKEN_LIMIT`, oversize rejection tests]
- [Source: `_bmad-output/implementation-artifacts/48-5-session-close-slim-skill-package-and-tests.md` — Phase order: deterministic → LLM §8 → apply]

### WriteGate / vault

- No direct vault AGENTS edits except through existing `runApplySection8` sync path on PASSED.
- Out of scope: external tokenizer, UI/dashboard, vault IO MCP, changing `prepare-context.mjs` pack limits.

### Project commands

```bash
npm test
bash scripts/verify.sh
```

### Files expected to touch

| File | Action |
|------|--------|
| `scripts/session-close/lib/phase-b-token-gate.mjs` | NEW |
| `scripts/session-close/gate-apply-section8.mjs` | NEW |
| `scripts/hermes-skill-examples/session-close/SKILL.md` | UPDATE invoke line |
| `tests/session-close-token-gate.test.mjs` | NEW |
| `tests/hermes-session-close-skill.test.mjs` | UPDATE assert gate script referenced |

Optional (only if consolidating): export shared test fixture helper — **not required** for AC.

### Previous epic context (49-x)

Recent commits (49-3, 49-4) hardened session-close env and added `investigate-trend` skill mirror. This story is session-close Phase B safety only; no overlap with 49-4.

### Deferred / non-goals

- Reordering MEMORY/daily rhythm after apply (deferred-work.md SC-4/SC-5 pipeline order) — unchanged.
- Removing duplicate token check inside `apply-section8.mjs` — optional cleanup, not required.
- Operator guide / SC-6 doc updates — only if gate behavior is user-visible in Discord reply template (not in AC).

## Dev Agent Record

### Agent Model Used

Composer (dev-story)

### Debug Log References

### Completion Notes List

- Added `lib/phase-b-token-gate.mjs` with `evaluatePhaseBDraftTokens`, `recordPhaseBTokenCheck` (reuses `estimateTokens` / `SECTION8_DRAFT_TOKEN_LIMIT`).
- Added `gate-apply-section8.mjs` CLI: records `phase_b_token_check` always; calls `runApplySection8` only on PASSED; stderr + exit 1 on ABORT.
- Hermes `session-close` SKILL.md v1.0.2 invokes gate script; reinstall via `scripts/install-hermes-skill-session-close.sh`.
- `tests/session-close-token-gate.test.mjs` covers PASSED/ABORTED integration + report merge.
- `bash scripts/verify.sh` green.

### File List

- `scripts/session-close/lib/phase-b-token-gate.mjs` (new)
- `scripts/session-close/gate-apply-section8.mjs` (new)
- `scripts/hermes-skill-examples/session-close/SKILL.md` (updated)
- `tests/session-close-token-gate.test.mjs` (new)
- `tests/hermes-session-close-skill.test.mjs` (updated)

### Review Findings

- [x] [Review][Patch] Resolve `--draft` relative to `OMNIPOTENT_REPO`, not cwd [`gate-apply-section8.mjs`]
- [x] [Review][Patch] Document exit 1 ABORT as controlled skip; continue Discord reply [`SKILL.md`, `discord-reply-template.md`]
- [x] [Review][Patch] Reject array JSON when merging close-report [`phase-b-token-gate.mjs`]

### Change Log

- 2026-05-29: Phase B pre-apply token gate + Hermes invoke wiring + tests (story 49-5).
- 2026-05-29: Code review patches — draft path resolution, ABORT exit handling docs, merge guard, CLI tests.
