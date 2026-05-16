---
story_id: 30-2
epic: 30
title: run-chain invocation and SynthesisNote verification_status stamp
status: review
---

## Story

As the triage skill, when the 30-1 gate signals `SYNTHESIS_CLEAR`, I invoke `scripts/run-chain.ts` via the terminal tool, parse `pake_validation.insight_note_path` from the JSON output, and stamp `verification_status: pending` on the written SynthesisNote — so the operator can verify research quality before trusting the note.

## Context

Story **30-1** added the post-move synthesis gate to `task-prompt.md`. It ends step 4 with a `SYNTHESIS_CLEAR` signal line containing `destination_path`, `source_uri`, and `title`. This story appends the synthesis invocation section **immediately after** that signal block in the same file.

`run-chain.ts` accepts `--topic <title> --query <source_uri> --depth shallow --raw-json`. With `--raw-json`, stdout includes the full `ChainRunResult` JSON. The synthesis note path is at **`pake_validation.insight_note_path`** (see `scripts/run-chain.ts` ~297/313). A backup path is the **`vault_path`** field of the object with **`kind: "synthesis"`** in the output **`candidates`** array.

**Out of scope:** No changes to `run-chain.ts` signatures, WriteGate, or MCP tool signatures.

**Insertion anchor (current repo mirror):** After the line that defines the `SYNTHESIS_CLEAR` trailing format in **Post-move synthesis gate (Story 30.1)** step 4 — today at `scripts/hermes-skill-examples/triage/references/task-prompt.md` after the `SYNTHESIS_CLEAR destination_path=...` instruction (~line 195), and **before** step 7 (“If `vault_move` returns…”). The implementer must re-read the live file and match the exact line after 30-1 edits.

**Continuity with 30-1:** Story 30-1 step 4 currently ends with “Then **stop**” after `SYNTHESIS_CLEAR`. Replace that with **“Then continue to the Synthesis invocation section below.”** so the skill flows into `## Synthesis invocation (Story 30-2)` in the same edit pass (do not leave “stop” after the signal).

## Acceptance Criteria

1. `task-prompt.md` (**both** repo mirror `scripts/hermes-skill-examples/triage/references/task-prompt.md` and live `~/.hermes/skills/cns/triage/references/task-prompt.md`) has a new `## Synthesis invocation (Story 30-2)` section **immediately following** the `SYNTHESIS_CLEAR` signal from Story 30-1 (and 30-1’s “stop” wording is aligned so execution continues here).
2. The section constructs and executes via **terminal tool**:  
   `cd /home/christ/ai-factory/projects/Omnipotent.md && source .env.live-chain && npx tsx scripts/run-chain.ts --topic "<title>" --query "<source_uri>" --depth shallow --raw-json`  
   using **`title`** and **`source_uri`** from the `SYNTHESIS_CLEAR` line (same values as step 4 substitutions; no literal angle brackets).
3. **On exit code 0:** parse stdout for the JSON block; extract **`pake_validation.insight_note_path`**. If absent, fall back to **`vault_path`** of the candidate with **`kind: "synthesis"`**. If both are absent, post `⚠️ Synthesis ran but output path not found — manual check required` and **halt** without vault mutation.
4. **On exit code 0** with a valid path: call **`vault_update_frontmatter`** on that path, setting **`verification_status: "pending"`**. On tool error, notify the operator with the path for manual correction.
5. **On any non-zero exit code:** post `❌ Synthesis chain failed (exit <code>) — no vault mutation made` to Discord and halt.
6. **On full success:** post `✅ SynthesisNote created at <path> — verification_status: pending. Review and update to verified when satisfied.`
7. **Token budget AC (§6.5 delta):** The **Synthesis invocation** section’s **new instruction text only** (delta vs pre-change file) must not exceed **700** tokens, measured as `wc -c` on the delta ÷ 4. Record bytes/tokens in **Verification**.
8. `npm test` passes. `bash scripts/verify.sh` passes. A **regression test** for the synthesis invocation section is added to `tests/hermes-triage-skill.test.mjs`.

## Tasks

- [x] Read current `task-prompt.md` (repo mirror) and locate the exact `SYNTHESIS_CLEAR` line / step 4 end from Story 30-1.
- [x] In step 4, replace “Then **stop**” after `SYNTHESIS_CLEAR` with **“Then continue to the Synthesis invocation section below.”** (same edit pass as the new section).
- [x] Append `## Synthesis invocation (Story 30-2)` immediately after the `SYNTHESIS_CLEAR` instruction block. Implement **AC2**: terminal command construction with `title` and `source_uri` substitution.
- [x] Implement **AC3**: JSON parse, `pake_validation.insight_note_path`, `kind: synthesis` fallback, missing-path guard.
- [x] Implement **AC4**: `vault_update_frontmatter` with `verification_status: pending`, error guard.
- [x] Implement **AC5**: non-zero exit guard + Discord message.
- [x] Implement **AC6**: success Discord message.
- [x] Mirror changes to `~/.hermes/skills/cns/triage/references/task-prompt.md`.
- [x] Add regression coverage in `tests/hermes-triage-skill.test.mjs` (e.g. section heading present, key command fragments, `verification_status` / path parsing instructions as stable strings).
- [x] Measure **AC7** delta (`wc -c` ÷ 4). Record under **Verification**; confirm ≤ 700 tokens.
- [x] Run `npm test` and `bash scripts/verify.sh`; record under **Verification**.

## Dev Notes

- **Normative copies:** Keep repo mirror and `~/.hermes/skills/cns/...` identical (same pattern as Story 30-1).
- **Discord + terminal:** Failure and success paths must use the skill’s established Discord reply pattern; synthesis uses **terminal** (not a new MCP tool).
- **Vault mutation:** Only **`vault_update_frontmatter`** after successful chain run and resolved path — no extra mutators for this story.
- **Testing:** Follow existing assertions style in `tests/hermes-triage-skill.test.mjs` (see `SYNTHESIS_CLEAR` checks from 30-1).

### References

- Previous story: [`stories/30-1-post-move-context-extraction-and-synthesis-trigger-gate.md`](./30-1-post-move-context-extraction-and-synthesis-trigger-gate.md)
- Triage prompt (mirror): `scripts/hermes-skill-examples/triage/references/task-prompt.md` — Post-move synthesis gate ~L186–L195
- Chain runner: `scripts/run-chain.ts` (~L297/313 for JSON shape)
- Regression tests: `tests/hermes-triage-skill.test.mjs`

## Standing tasks (every story)

### Standing task: Update operator guide

- [x] Operator-visible workflow extended (Hermes synthesis + `verification_status` stamp): updated **`Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`**, bumped **`modified`**, recorded **Version 1.26.0**.

## Verification

_(Filled by implementer.)_

- **AC7 (token delta):** Synthesis-invocation subsection only (`\n## Synthesis invocation (Story 30-2)\n` through blank line before `7. If vault_move`): **965 UTF-8 bytes**, est. **≈241 tokens** (= bytes ÷ 4); satisfies **≤ 700** ✓
- **npm test:** Pass (exit 0)
- **scripts/verify.sh:** Pass (exit 0)

## Change Log

- **2026-05-16:** Story 30-2 implemented — gated `vault_update_frontmatter` + `run-chain.ts` synthesis section after `SYNTHESIS_CLEAR`; regressions + operator guide §15.3; Hermes mirror sync.
- **2026-05-16:** Code review patch — corrected `ChainRunResult` JSON path from nonexistent `pake_validation.insight_note_path` / `candidates[].vault_path` fallback to `synthesis.insight_note.vault_path`; repo and live Hermes prompts synced; regression updated. Status remains `review` for second code-review pass.

## Dev Agent Record

### Agent Model Used

Composer / GPT agent (implementation session)

### Debug Log References

_None._

### Completion Notes List

- Step 30-1 flow now continues past `SYNTHESIS_CLEAR` into compact **Synthesis invocation (Story 30-2)** with exact `run-chain` command, Discord guard strings, JSON path precedence, single `verification_status: pending` update, and tightened hard-constraint carve-out for **`vault_update_frontmatter`** after **`run-chain`**.

### File List

- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/stories/30-2-run-chain-invocation-and-synthesisNote-verification-status-stamp.md`
- `scripts/hermes-skill-examples/triage/references/task-prompt.md`
- `tests/hermes-triage-skill.test.mjs`
- `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`
- _(Operator Hermes)_ `~/.hermes/skills/cns/triage/references/task-prompt.md`
