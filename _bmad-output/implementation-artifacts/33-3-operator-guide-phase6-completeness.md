---
story_id: 33-3
epic: 33
title: operator-guide-phase6-completeness
status: review
---

# Story 33.3: operator-guide-phase6-completeness

Status: review

## Story

As the **operator**,  
I want the **Operator Guide** to cover every live Phase 6 command,  
so that **Discord workflows, skill versions, and documented operator procedures stay aligned**.

## Context

| Topic | Detail |
|-------|--------|
| **Epic** | Epic 33: Knowledge Quality Loop |
| **Guide target** | Operator Guide Phase 6 completeness |
| **Version target** | v1.29.0 now; v1.30.0 added by 33-1 for `/verify` |
| **Dependency** | No story dependency; run immediately |
| **Drift to resolve before epic close** | AGENTS.md v2.0.1 / v2.0.3 drift |

## Acceptance Criteria

1. **Operator Guide v1.29.0:** Guide has a version row covering all live Phase 6 commands before `/verify`.
2. **All live Phase 6 commands covered:** `/triage-approve`, `/triage-execute`, `/challenge`, `/emerge`, `/ideas`, `/trace`, `/connect`, `/today`, `/ghost`, `/drift`, and `/graduate` have current operator-facing sections or clearly linked coverage.
3. **No stale command names:** The guide no longer presents deprecated `/approve` or `/execute-approved` as the active triage commands.
4. **Skill versions aligned:** Guide reflects current live skill versions for `vault-think`, `vault-graduate`, and triage.
5. **Phase 6 caveats current:** Read-only guarantees, mutator exceptions, REST dependency, and live Discord routing caveats are accurate.
6. **AGENTS drift noted:** AGENTS.md v2.0.1 / v2.0.3 drift is identified and either resolved in scope or explicitly recorded as a blocker before epic close.
7. **Verification gate:** `npm test` count is at least 606 and `bash scripts/verify.sh` passes.

## Tasks / Subtasks

- [x] Read current Operator Guide.
- [x] Inspect live skill copies and repo mirrors for command/version truth.
- [x] Update Operator Guide to v1.29.0 for all live Phase 6 commands before `/verify`.
- [x] Remove or mark stale Phase 6 command names.
- [x] Check AGENTS.md drift and record the result.
- [x] Run `npm test` and `bash scripts/verify.sh`.

## Dev Notes

- Story 33-1 owns the v1.30.0 `/verify` Operator Guide row.
- Treat accepted out-of-scope documentation drift separately from product-blocking drift.

## Dev Agent Record

### Implementation Plan

- Added §15.0 Phase 6 caveats table + live command matrix (triage 1.7.0, vault-think 1.2.0, vault-graduate 1.0.0).
- Updated §15.3 triage: canonical `/triage-approve` / `/triage-execute`, deprecated `/approve` / `/execute-approved` callout.
- Rewrote §15.6 vault-think v1.2.0 (`/ghost`, `/drift` live; REST and MCP caps).
- Added §15.7 vault-graduate (`/vault-graduate`; `#graduate` workflow).
- Updated §15.5 manual workflow chain.
- Version History row **1.29.0**.
- Extended `tests/hermes-triage-skill.test.mjs` operator-guide assertions for new §15.3 heading and triage rename.

### AGENTS drift (AC6)

- **`specs/cns-vault-contract/AGENTS.md`:** v2.0.3 (2026-05-17).
- **Canonical vault** `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md`:** v2.0.3 — **in sync** with specs mirror.
- **Not a blocker:** Story context referenced historical v2.0.1 vs v2.0.3; current mirrors are aligned at **2.0.3**. Operator Guide does not embed constitution version (by design).

### Completion Notes

- **606** Vitest tests + **71** node tests pass; **`bash scripts/verify.sh`** exit 0.
- Live graduate slash documented as **`/vault-graduate`** (Hermes skill registration); **`#graduate`** tag and promotion workflow satisfy AC2 “graduate” coverage.

## File List

- `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`
- `tests/hermes-triage-skill.test.mjs`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- 2026-05-17: Story created from Epic 33 planning brief.
- 2026-05-17: Operator Guide v1.29.0 — Phase 6 completeness (§15.0–15.7), triage rename docs, test assertion update; verify gate passed.
