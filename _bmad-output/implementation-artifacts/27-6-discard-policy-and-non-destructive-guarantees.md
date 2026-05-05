# Story 27.6: Discard safety policy and non-destructive guarantees (Hermes triage)

**Story key:** `27-6-discard-policy-and-non-destructive-guarantees`  
**Epic:** 27 (Hermes CNS Inbox triage)  
**Status:** done

**BMAD create-story:** Ultimate context expansion applied 2026-05-04. Normative planning references: Phase 1 write/mutation surface (`vault_move` only for relocation in Hermes per Stories 27.1–27.5); constitution safety posture [Source: `specs/cns-vault-contract/AGENTS.md` — never delete without approval / governed writes]. Epic 27 slice is defined across implementation stories `27-1` … `27-7` under `_bmad-output/implementation-artifacts/`, not a dedicated block in `_bmad-output/planning-artifacts/epics.md`.

---

## Story

As an **operator**,  
I want **Hermes triage to state an explicit discard/delete/archive safety policy and guarantee non-destructive automation**,  
so that **Discord-assisted triage never implies permanent deletion, never introduces ungoverned filesystem deletes, and channels “get rid of this note” intent into governed relocation (`vault_move`) or explicit human-only steps**.

---

## Acceptance Criteria

1. **No agent deletion path (AC: no-delete-tool)**  
   - **Given** Phase 1 Vault IO exposes relocation via `vault_move` and other governed mutators but **does not** expose a note-delete MCP tool  
   - **When** Story 27.6 documentation and prompts are finalized  
   - **Then** Hermes triage skill text states clearly that **Hermes must not delete, discard, or truncate vault notes** via MCP or by instructing shell `rm`, Obsidian-untracked bulk unlink, or other bypasses  
   - **And** the skill does **not** add or rely on any hypothetical `vault_delete` / `vault_trash` tool (out of Phase 1 scope unless separately specified).

2. **Discard vocabulary mapped to safe actions (AC: discard-mapping)**  
   - **Given** operators may say “discard”, “delete”, or “archive” colloquially  
   - **When** Hermes responds within this skill  
   - **Then** prompts explain that **the only automated mutation path remains** `/execute-approved … --to …/` → **exactly one** `vault_move`  
   - **And** “discard” is framed as **optional relocation** to an operator-chosen vault directory (still subject to WriteGate / PAKE when leaving `00-Inbox/`), **or** human-only removal outside Hermes (e.g. Obsidian UI / manual filesystem) — never silent destruction.

3. **Non-destructive guarantees are explicit (AC: guarantees-copy)**  
   - **Given** Stories 27.1–27.5 established preview + approve + single-move execution  
   - **When** an operator reads `SKILL.md`, `task-prompt.md`, or the operator guide section for triage  
   - **Then** they see a short, bounded list of guarantees, including:  
     - `/triage` and `/approve` remain non-mutating  
     - `/execute-approved` performs **only** `vault_move` (no extra mutators, no `vault_log_action` for the move)  
     - no bulk moves, no rename-without-move shortcuts, no archive-folder automation unless expressed as an explicit destination in `/execute-approved`  
   - **And** guarantees align with Story **27.5** audit posture (`vault_move` owns success audit line).

4. **Refusal / injection handling stays consistent or improves (AC: refusal-consistency)**  
   - **Given** `references/task-prompt.md` already treats natural-language mutation verbs cautiously  
   - **When** Story 27.6 lands  
   - **Then** refusal behavior for destructive or ambiguous requests remains **fail-closed** (no Vault IO calls on refusal paths)  
   - **And** documented examples distinguish: valid `/execute-approved`, valid `/approve`, valid `/triage`, versus destructive colloquial commands — without weakening Story 27.5 validation.

5. **Routing suggestions remain non-destructive (AC: heuristic-nondestructive)**  
   - **Given** Story 27.3 heuristics attach routing suggestions to candidates  
   - **When** Story 27.6 completes  
   - **Then** heuristics still **must not** propose deletion, discard, or archive-as-delete  
   - **And** the stale-age clause remains: append review guidance only; **do not** propose deletion/discard/archive as an automated outcome.

6. **Regression suite updated (AC: tests)**  
   - **Given** `tests/hermes-triage-skill.test.mjs` guards prompt contracts  
   - **When** Story 27.6 completes  
   - **Then** tests assert presence of discard/delete/archive safety language and non-destructive guarantees in the canonical skill files  
   - **And** existing Story 27.1–27.5 assertions remain green (no regression on `/execute-approved`, `/approve`, discovery scope).

7. **Operator-visible documentation (AC: docs)**  
   - **Given** operators rely on `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` §15.3  
   - **When** the story closes  
   - **Then** that section documents discard safety policy, human-only deletion optionality, and the governed “move elsewhere” pattern  
   - **And** Version History receives a row referencing **`27-6-discard-policy-and-non-destructive-guarantees`**.

8. **Scope boundary vs Story 27.7 (AC: no-e2e-scope)**  
   - **Given** Story **27.7** owns end-to-end Discord verification  
   - **When** Story 27.6 is implemented  
   - **Then** this story does **not** expand scope into full live Discord E2E proof beyond existing repo gates (`node --test …`, `bash scripts/verify.sh`)  
   - **And** optional Hermes install script run remains a standing task for operator mirror freshness.

---

## Tasks / Subtasks

- [x] **Define discard safety policy in skill docs** (AC: no-delete-tool, discard-mapping, guarantees-copy, heuristic-nondestructive)
  - [x] Update `scripts/hermes-skill-examples/triage/SKILL.md`: bump `version`, extend overview/policy with explicit discard-delete-archive stance and guarantees list.
  - [x] Update `scripts/hermes-skill-examples/triage/references/task-prompt.md`: dedicated subsection “Discard / delete / archive safety (Story 27.6)” mapping vocabulary to `vault_move`-only automation + human-only deletion; reinforce heuristic stale rule.
  - [x] Update `scripts/hermes-skill-examples/triage/references/trigger-pattern.md` if new operator-facing examples or warnings are needed (keep triggers unchanged unless intentionally extended).

- [x] **Prompt regression tests** (AC: tests, refusal-consistency)
  - [x] Update `tests/hermes-triage-skill.test.mjs` with assertions for new sections/strings (version bump, safety guarantees, discard mapping).
  - [x] Verify refusal-handling section still matches production prompt expectations after edits.

- [x] **Standing: operator guide** (AC: docs)
  - [x] Update `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` §15.3 + Version History row.

- [x] **Install Hermes skill mirror** (standing)
  - [x] Run `bash scripts/install-hermes-skill-triage.sh` after prompt changes.
  - [x] Spot-check installed `~/.hermes/skills/cns/triage/` copies.

- [x] **Repo gate**
  - [x] Run `node --test tests/hermes-triage-skill.test.mjs`
  - [x] Run `bash scripts/verify.sh`

### Review Findings

BMAD code review (Blind Hunter, Edge Case Hunter, Acceptance Auditor). **0** decision-needed, **4** patch, **0** defer, **3** dismissed as noise.

- [x] [Review][Patch] Operator guide §15.3 does not explicitly map discard/delete/archive language to governed relocation or human-only removal [Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md:601]
- [x] [Review][Patch] Operator guide Version History is missing a row for `27-6-discard-policy-and-non-destructive-guarantees` [Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md:395]
- [x] [Review][Patch] Prompt regression tests do not guard the Story 27.6 operator-guide requirements [tests/hermes-triage-skill.test.mjs:164]
- [x] [Review][Patch] Existing operator guide workflow still says to delete or archive the original inbox capture without the 27.6 human-only / governed-relocation safety qualifier [Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md:306]

---

## Developer context (guardrails)

**What this story is:** Prompt-, documentation-, and test-contract work. It codifies **discard safety** and **non-destructive guarantees** for Epic 27 Hermes triage. It builds directly on Story **27.5** (`vault_move` execution) but does **not** introduce new mutators or MCP tools.

**Anti-patterns (do not do):**

- Do **not** implement MCP note deletion, trash tools, or bulk discard orchestration in this repo slice unless a separate epic explicitly adds Vault IO tools (Phase 1 does not).
- Do **not** instruct the model to use filesystem delete or non-MCP writes against vault paths.
- Do **not** weaken `/execute-approved` validation from Story 27.5 (Inbox-only source, protected destination rules, exactly one `vault_move`, no `vault_log_action` for that move).
- Do **not** fold Story **27.7** live Discord E2E verification into 27.6.

**Reuse instead of reinventing:**

- Governance and audit semantics from Story **27.5** [Source: `_bmad-output/implementation-artifacts/27-5-execute-approved-moves-via-vault-io-vault-move-with-audit-trail.md`].
- Constitution line on deletion and governed writes [Source: `specs/cns-vault-contract/AGENTS.md`].
- Phase 1 tool inventory [Source: `specs/cns-vault-contract/CNS-Phase-1-Spec.md`] — confirm no delete tool exists before documenting.

---

## Technical requirements

| Requirement | Detail |
|---------------|--------|
| Mutation surface | Unchanged from 27.5: **only** `vault_move` under valid `/execute-approved` |
| Discard semantics | Communicative policy + prompt constraints; optional relocation via existing move grammar |
| Constitution | Align messaging with “no delete without approval” / governed mutation posture |
| Discord | Untrusted input; fail-closed refusals without Vault IO |
| Versioning | Bump Hermes triage skill `version` in `SKILL.md` frontmatter; mirror bump in test string assertions |

---

## Architecture compliance

- Phase 1 write pipeline remains single-gated; Hermes continues to delegate relocation to **`vault_move`** only [Source: `_bmad-output/planning-artifacts/architecture.md` — Write / mutate row].
- Human-only deletion/archive metaphors for **audit log** maintenance (FR24) are unrelated to note discard; do not conflate in operator copy [Source: `specs/cns-vault-contract/AUDIT-PLAYBOOK.md`].

---

## Library / framework requirements

- **Tests:** Node built-in `node:test` + `node:assert` (`tests/hermes-triage-skill.test.mjs`). No new npm dependencies expected.

---

## File structure requirements

| Area | Paths |
|------|--------|
| Skill mirror (repo source of truth) | `scripts/hermes-skill-examples/triage/SKILL.md`, `references/task-prompt.md`, `references/trigger-pattern.md` |
| Contract tests | `tests/hermes-triage-skill.test.mjs` |
| Operator guide | `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` §15.3, Version History |
| Install | `scripts/install-hermes-skill-triage.sh` |
| Do **not** edit for this story (unless separate approval) | `src/tools/*.ts`, WriteGate, MCP registration, `vault_move` implementation |

---

## Testing requirements

1. Extend `tests/hermes-triage-skill.test.mjs` to lock Story 27.6 prose (exact subsection titles / key phrases as agreed during implementation — follow existing test style for 27.4–27.5).
2. Full gates: `node --test tests/hermes-triage-skill.test.mjs` and `bash scripts/verify.sh` green before marking story done.

---

## Previous story intelligence (27.5)

- **27.5** locked execution to **`/execute-approved`** → derive destination → **one** `vault_move`; forbid `vault_log_action` on success path; strict Inbox/protected-path validation.
- **Explicit deferral:** discard/delete/archive semantics were reserved for **27.6** [Source: 27.5 story file §Developer context].
- **Review hygiene:** avoid duplicate YAML keys in `SKILL.md`; keep “mutating vs read-only” descriptions consistent with frontmatter tags.

---

## Latest tech / version notes

- No dependency upgrades anticipated. If skill version bumps, update **both** `SKILL.md` `version` and **string literals** in tests.

---

## Project context reference

- No repo-root `project-context.md` found; use `CLAUDE.md`, `AGENTS.md`, and `specs/cns-vault-contract/CNS-Phase-1-Spec.md` for Phase 1 boundaries.

---

## Story completion status

- **Implementation:** Complete (`done`).
- **Workflow state:** Sprint `development_status` entry `27-6-discard-policy-and-non-destructive-guarantees` set to **done** after review follow-up (2026-05-05).
- **Ultimate context engine analysis:** Completed for BMAD create-story (this file).

---

## Standing tasks (every story)

### Standing task: Update operator guide

- [x] If this story changes user-facing behavior or policy copy: update `03-Resources/CNS-Operator-Guide.md`; bump `modified` + Version History row.
- [x] If genuinely no operator-visible change (unlikely for 27.6): note “Operator guide: no update required” in Dev Agent Record. *(N/A — §15.3 and Version History updated.)*

---

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

None.

### Completion Notes List

- Hermes triage skill bumped to **1.5.0** with Story **27.6** overview, **Non-destructive guarantees**, and explicit no-delete / discard-as-relocate-or-human-only policy.
- `task-prompt.md` gained **Discard / delete / archive safety (Story 27.6)** plus refusal clarification so valid **`/execute-approved`** is not blocked by keyword checks.
- `trigger-pattern.md` gained operator-visible discard safety bullets; triggers unchanged.
- `tests/hermes-triage-skill.test.mjs` locks new prose, version, and operator guide AC7 coverage.
- Operator guide **§15.3** aligned with `/approve` + `/execute-approved` and discard safety; Version History **1.21.0**.
- BMAD code review follow-ups resolved: operator guide discard vocabulary mapping, Version History 27.6 row, workflow cleanup safety qualifier, and operator guide test guard.
- Ran `bash scripts/install-hermes-skill-triage.sh`; spot-checked `~/.hermes/skills/cns/triage/SKILL.md` shows **version: 1.5.0**.
- Gates: `node --test tests/hermes-triage-skill.test.mjs`, `bash scripts/verify.sh` — green.

### File List

- `scripts/hermes-skill-examples/triage/SKILL.md`
- `scripts/hermes-skill-examples/triage/references/task-prompt.md`
- `scripts/hermes-skill-examples/triage/references/trigger-pattern.md`
- `tests/hermes-triage-skill.test.mjs`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/27-6-discard-policy-and-non-destructive-guarantees.md`
- `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` (canonical vault path on host)

### Change Log

| Date | Summary |
|------|---------|
| 2026-05-04 | Story 27.6 created (discard safety policy + non-destructive guarantees); sprint status → ready-for-dev. |
| 2026-05-04 | Implemented 27.6: skill copy + tests + operator guide §15.3 + Hermes install mirror; sprint status → review. |
| 2026-05-05 | Resolved BMAD code review findings, verified, and moved story to done. |

---

## Open questions (defer if unanswered during dev)

1. Should the operator guide recommend a **canonical vault-relative folder** for “discard pile” moves (operator-maintained), or stay vault-neutral? Prefer vault-neutral wording unless PM picks a standard folder in the live vault contract.

2. If natural-language refusal heuristics produce false positives (e.g. benign use of “move” inside `/triage` queries), treat refinement as a **follow-up** micro-story only if product asks — 27.6 defaults to preserving fail-closed posture unless AC4 refinement is explicitly expanded during implementation review.
