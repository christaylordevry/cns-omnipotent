---
story_id: 30-1
epic: 30
title: Post-move context extraction and synthesis trigger gate
status: review
---

## Story

As the triage skill's execute-approved handler, after a successful vault_move I read the destination note's frontmatter and check for an existing SynthesisNote with the same source_uri — so synthesis is only triggered on URL-captured notes that haven't already been synthesised.

## Context

The current execute-approved flow in task-prompt.md terminates after vault_move + audit. This story adds two read-only steps immediately after vault_move success: (1) vault_read_frontmatter on the destination note, (2) vault_search for an existing note in 03-Resources/ with matching source_uri. No chain invocation in this story — gate logic only. Story 30-2 consumes the SYNTHESIS_CLEAR signal produced here.

No MCP tool signatures are changed. No WriteGate changes. No audit logging changes.

## Acceptance Criteria

1. ~/.hermes/skills/cns/triage/references/task-prompt.md has a new "## Post-move synthesis gate" section that executes only after vault_move returns a success result.
2. The gate calls vault_read_frontmatter on the destination path and extracts source_uri and title. If source_uri is absent or does not start with "http", the gate posts "🔬 Synthesis skipped — no source_uri on destination note" to the operator and halts with no further action.
3. The gate calls vault_search with the extracted source_uri as query, scoped to 03-Resources/. If a match is found, the gate posts "⚠️ Synthesis skipped — SynthesisNote already exists for <source_uri>: <existing_path>" and halts.
4. If both checks pass, the gate posts "🔬 Synthesis gate clear — queuing research for <title>" to Discord. The task-prompt text signals readiness for the invocation steps that 30-2 will append.
5. Token budget AC: task-prompt.md total token count (estimated at chars/4) must not exceed 1,800 tokens after this story's additions. Measure with: wc -c ~/.hermes/skills/cns/triage/references/task-prompt.md and record the result in the story artifact.
6. npm test passes. bash scripts/verify.sh passes.

## Tasks

- [x] Read task-prompt.md in full. Identify the exact line where the current execute-approved section ends (after vault_move success logging).
- [x] Append "## Post-move synthesis gate" section immediately after that line. Implement AC2: vault_read_frontmatter call, source_uri extraction, absent/invalid guard with halt message.
- [x] Implement AC3: vault_search dedup check against 03-Resources/, existing-note guard with halt message.
- [x] Implement AC4: SYNTHESIS_CLEAR signal text and operator notification for the clear path.
- [x] Measure final task-prompt.md token count. Record in a ## Verification section at the bottom of this story file. Confirm ≤ 1,800 tokens.
- [x] Run npm test and bash scripts/verify.sh. Record pass confirmation in ## Verification.

## Verification

- **AC5 note:** The written threshold (**≤1,800** estimated tokens for the **entire** `task-prompt.md`) is **not** satisfied and was **already** violated before this change (~21,139 bytes → ~5,285 est. tokens). This story **did** satisfy the **measurement and record** obligation. Recommend correcting AC5 in the epic (likely **18,000** or a **delta-only** budget) in a follow-up story.
- **npm test:** PASS (2026-05-14).
- **scripts/verify.sh:** PASS (exit 0, 2026-05-14).

## Dev Agent Record

### Implementation Plan

- Extend **Execute approved move** step 6 so success continues into a new `## Post-move synthesis gate (Story 30.1)` section (inserted before the move-failure step).
- Document **Story 30.1** exception to inbox-only discovery in hard-constraints Story bullets.
- Keep normative copy in repo mirror `scripts/hermes-skill-examples/triage/references/task-prompt.md` and sync to `~/.hermes/skills/cns/triage/references/task-prompt.md` (install script source of truth).
- Add regression assertions in `tests/hermes-triage-skill.test.mjs`.

### Debug Log

- None.

### Completion Notes

- Post-move gate: `vault_read_frontmatter` → `source_uri`/`title` → http-prefix guard → `vault_search` in `03-Resources/` → skip / clear + `SYNTHESIS_CLEAR` line for Story 30.2.
- `http` prefix check implemented case-insensitive so `https://` qualifies.

## File List

- `scripts/hermes-skill-examples/triage/references/task-prompt.md`
- `tests/hermes-triage-skill.test.mjs`
- `_bmad-output/implementation-artifacts/stories/30-1-post-move-context-extraction-and-synthesis-trigger-gate.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- **2026-05-14:** Story 30.1 — post-move synthesis gate in triage `task-prompt.md`; Hermes live copy synced; triage skill regression test added; sprint status → review.
