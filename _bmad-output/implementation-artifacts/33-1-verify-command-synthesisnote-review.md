---
story_id: 33-1
epic: 33
title: verify-command-synthesisnote-review
status: ready-for-dev
---

# Story 33.1: verify-command-synthesisnote-review

Status: ready-for-dev

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

- [ ] Read current `vault-think` repo mirror and installed skill copies.
- [ ] Add `/verify` procedure to `scripts/hermes-skill-examples/vault-think/references/task-prompt.md`.
- [ ] Update `scripts/hermes-skill-examples/vault-think/SKILL.md` to v1.3.0 and document the mutator exception.
- [ ] Install skill to `~/.hermes/skills/cns/vault-think/` and verify mirror parity.
- [ ] Update `~/.hermes/config.yaml` channel prompt or binding as needed for `#hermes`.
- [ ] Extend `tests/hermes-vault-think-skill.test.mjs` for `/verify`.
- [ ] Update Operator Guide to v1.30.0 with `/verify`.
- [ ] Run `npm test` and `bash scripts/verify.sh`.

## Dev Notes

- Keep the mutation surface narrow: only verification-status stamping for SynthesisNotes belongs in this story.
- Preserve existing `vault-think` behavior for `/challenge`, `/emerge`, `/ideas`, `/trace`, `/connect`, `/today`, `/ghost`, and `/drift`.
- Do not add new MCP tools.

## Change Log

- 2026-05-17: Story created from Epic 33 planning brief.
