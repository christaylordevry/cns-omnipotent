---
story_id: 33-2
epic: 33
title: graduate-live-e2e-verification
status: done
---

# Story 33.2: graduate-live-e2e-verification

Status: done

## Story

As the **operator**,  
I want live end-to-end evidence that **`/vault-graduate`** works in production,  
so that **the graduation workflow can be trusted beyond repo mirror tests**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 33: Knowledge Quality Loop |
| **Skill home** | `vault-graduate` |
| **Trigger** | `/vault-graduate` in `#hermes` (Hermes `/{skill-name}`) |
| **Evidence artifact** | `_bmad-output/implementation-artifacts/epic-32-graduate-e2e-evidence.md` |
| **Dependency** | No story dependency; run immediately |

## Acceptance Criteria

1. **Live E2E run:** `/vault-graduate` is executed through the live `#hermes` Discord path.
2. **Production evidence artifact:** Evidence is captured at `_bmad-output/implementation-artifacts/epic-32-graduate-e2e-evidence.md`.
3. **Evidence content:** Artifact includes command issued, source daily note or controlled fixture context, created or skipped notes, daily receipt behavior, timestamps, and observed Discord response.
4. **Skill parity:** Repo mirror and installed `~/.hermes/skills/cns/vault-graduate/` copies match for `SKILL.md` and `references/task-prompt.md`.
5. **Live config:** `~/.hermes/config.yaml` proves `vault-graduate` is bound for `#hermes`.
6. **No ungoverned vault writes:** Evidence shows production behavior used Vault IO mutators rather than direct filesystem writes.
7. **Verification gate:** `npm test` count is at least 606 and `bash scripts/verify.sh` passes.

## Tasks / Subtasks

- [x] Inspect repo mirror and installed `vault-graduate` skill copies.
- [x] Confirm `#hermes` live binding in `~/.hermes/config.yaml`.
- [x] Prepare a controlled `#graduate` source item or identify an existing safe item.
- [x] Run `/vault-graduate` through live Discord.
- [x] Capture E2E evidence in `_bmad-output/implementation-artifacts/epic-32-graduate-e2e-evidence.md`.
- [x] Run `npm test` and `bash scripts/verify.sh`.

## Dev Notes

- This is a verification story, not a feature story. Do not change graduate promotion behavior unless the live run exposes a blocker and the operator approves the scope expansion.
- Preserve the requested evidence artifact path exactly, even though the story belongs to Epic 33.

## Dev Agent Record

### Agent Model Used

Composer (dev-story 33-2)

### Debug Log References

- Gateway was down at start; restarted with `hermes gateway run` + `.env.live-chain`.
- First dev run: bot-posted `/graduate` did not trigger gateway inbound; used `hermes chat` workaround. **Live gateway closure:** operator `/vault-graduate` in `#hermes` — dedup on 05-16 fixture, promoted 05-17 line, receipt on `DailyNotes/2026-05-17.md`.

### Completion Notes List

- Skill parity verified (`diff -q` identical for `SKILL.md` and `references/task-prompt.md`).
- Config: `vault-graduate` in `channel_skill_bindings` for `#hermes` + channel prompt.
- Fixture: `#graduate` line on `DailyNotes/2026-05-16.md` via `vault_append_daily`; promoted to `03-Resources/epic-33-2-e2e-graduate-fixture-controlled-story-33-2-cursor-dev.md`; receipt `## Graduated 2026-05-16` on same daily.
- Evidence: `epic-32-graduate-e2e-evidence.md`.
- `npm test`: 606 passed; `verify.sh`: PASS.

### File List

- `_bmad-output/implementation-artifacts/epic-32-graduate-e2e-evidence.md` (new)
- `_bmad-output/implementation-artifacts/33-2-graduate-live-e2e-verification.md` (this story)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (33-2 → review)

### Verification

| Check | Result |
|-------|--------|
| Skill parity | PASS |
| Live config binding | PASS |
| E2E evidence artifact | PASS |
| `npm test` (≥606) | 606 passed |
| `bash scripts/verify.sh` | PASS |

## Change Log

- 2026-05-17: Story created from Epic 33 planning brief.
- 2026-05-17: dev-story complete — live `/vault-graduate` E2E evidence captured; trigger docs canonicalized; status → review.
- 2026-05-17: code review — AC1–AC7 satisfied; trigger `/vault-graduate`; status → done.

### Review Findings

- [x] [Review][Patch] Story and evidence still referenced `/graduate` trigger — updated to `/vault-graduate` [`33-2-graduate-live-e2e-verification.md`]
- [x] [Review][Patch] Evidence AC5 channel prompt stale — updated in appended gateway section [`epic-32-graduate-e2e-evidence.md`]
- [x] [Review][Defer] `~/.hermes/config.yaml` not versioned in repo — expected; live binding verified on operator host
