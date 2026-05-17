---
story_id: 33-1
epic: 33
title: verify-command-synthesisnote-review
status: done
---

# Story 33.1: verify-command-synthesisnote-review

Status: done

## Story

As the **operator**,  
I want to run **`/verify`** in Discord to review pending **SynthesisNotes** and stamp their verification status,  
so that **the knowledge quality loop can close without leaving pending synthesis work buried in the vault**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 33: Knowledge Quality Loop |
| **Skill home** | `vault-think` |
| **Target version** | `vault-think` v1.3.0 |
| **Trigger** | `/verify` in `#hermes` |
| **Mode** | Queue mode, single-note review, and marking tokens |
| **Policy exception** | `vault-think` remains read-oriented except this documented `/verify` mutator exception for SynthesisNote verification stamping |

## Acceptance Criteria

1. **`/verify` live in `#hermes`:** Operator can run `/verify` and receive a review queue of pending SynthesisNotes.
2. **Queue mode:** The command can list pending SynthesisNotes with enough path/title context for operator selection.
3. **Single-note mode:** The command can review one selected SynthesisNote by path or unambiguous title.
4. **Marking tokens:** The command supports explicit operator tokens for marking verification outcome, including verified and disputed states.
5. **Governed mutation:** Verification stamping uses the existing Vault IO mutation path, not Hermes filesystem writes.
6. **`vault-think` version:** Repo mirror and installed skill both report v1.3.0.
7. **Mutator exception documented:** `SKILL.md` and task prompt clearly state the `/verify` exception while preserving read-only expectations for other `vault-think` commands.
8. **Live binding:** `~/.hermes/config.yaml` routes `#hermes` `/verify` traffic through `vault-think`.
9. **Operator Guide:** Story close adds Operator Guide v1.30.0 row and `/verify` section.
10. **Regression tests:** Skill tests cover trigger recognition, queue mode, single-note mode, marking tokens, and the narrow allowed mutator contract.
11. **Verification gate:** `npm test` count is at least 606 and `bash scripts/verify.sh` passes.

## Tasks / Subtasks

### Review Follow-ups (AI)

- [x] [AI-Review] Fix marking resolver: direct `vault_read_frontmatter` path lookup (not pending queue); reachable `not-synthesis` / `already verified` / `already disputed` guards.
- [x] [AI-Review] Narrow marking public contract to path-only (`<vault-relative-path>` in SKILL.md, Operator Guide §15.8, config channel prompt; task-prompt copy only).

- [x] Read current `vault-think` repo mirror and installed skill copies.
- [x] Add `/verify` procedure to `scripts/hermes-skill-examples/vault-think/references/task-prompt.md`.
- [x] Update `scripts/hermes-skill-examples/vault-think/SKILL.md` to v1.3.0 and document the mutator exception.
- [x] Install skill to `~/.hermes/skills/cns/vault-think/` and verify mirror parity.
- [x] Update `~/.hermes/config.yaml` channel prompt or binding as needed for `#hermes`.
- [x] Extend `tests/hermes-vault-think-skill.test.mjs` for `/verify`.
- [x] Update Operator Guide to v1.30.0 with `/verify`.
- [x] Run `npm test` and `bash scripts/verify.sh`.

## Dev Agent Record

### Implementation Plan

- Bump **`vault-think`** to **v1.3.0** with documented **`/verify`** mutator exception (**`vault_update_frontmatter`** only, **`verification_status`** + **`modified`**).
- Add **`§1g`** classification and **`§3 /verify`** (queue, **`--offset`**, single-note review, **`verified`** / **`disputed`** marking tokens).
- Operator Guide **v1.30.0**: §15.8, matrix + caveats updated; **`vault-think`** **1.3.0** in §15.6.
- Live: **`bash scripts/install-hermes-skill-vault-think.sh`**, **`~/.hermes/config.yaml`** channel prompt extended for **`/verify`** routes.

### Completion Notes

- **606** Vitest + **74** node tests pass (includes **`/verify`** + marking-resolver tests); **`bash scripts/verify.sh`** exit 0.
- Repo mirror matches **`~/.hermes/skills/cns/vault-think/`** after install.
- ✅ Resolved review finding [Medium]: marking mode now uses **Marking target resolution** — one **`vault_read_frontmatter`** on normalized path; guards **`verify not-synthesis`**, **`verify already verified`**, **`verify already disputed`** run before mutator (no longer masked by pending-queue **`not-found`**).
- ✅ Resolved review finding [Medium]: public docs + **`~/.hermes/config.yaml`** advertise marking tokens as **vault-relative path** only (single-note review still allows path or title).
- ✅ Code review pass: no blocking findings after re-checking Story 33-1 acceptance criteria, repo/live `vault-think` parity, live `#hermes` routing, and gates.

## File List

- `scripts/hermes-skill-examples/vault-think/SKILL.md`
- `scripts/hermes-skill-examples/vault-think/references/task-prompt.md`
- `tests/hermes-vault-think-skill.test.mjs`
- `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/33-1-verify-command-synthesisnote-review.md` (this story)
- `~/.hermes/skills/cns/vault-think/` (installed copy)
- `~/.hermes/config.yaml` (channel prompt)

## Dev Notes

- Keep the mutation surface narrow: only verification-status stamping for SynthesisNotes belongs in this story.
- Preserve existing `vault-think` behavior for `/challenge`, `/emerge`, `/ideas`, `/trace`, `/connect`, `/today`, `/ghost`, and `/drift`.
- Do not add new MCP tools.

## Change Log

- 2026-05-17: Story created from Epic 33 planning brief.
- 2026-05-17: **`vault-think` v1.3.0** — `/verify` queue, single-note review, **`verified`** / **`disputed`** marking; Operator Guide v1.30.0 §15.8; tests + verify gate passed.
- 2026-05-17: Addressed code review — marking resolver uses direct path **`vault_read_frontmatter`**; Operator Guide §15.8 guardrails split queue vs marking; +1 Hermes test.
- 2026-05-17: Addressed code review — marking tokens documented as **`<vault-relative-path>`** only (SKILL, Operator Guide, config prompt, task-prompt copy).
- 2026-05-17: Code review passed; story marked done.
