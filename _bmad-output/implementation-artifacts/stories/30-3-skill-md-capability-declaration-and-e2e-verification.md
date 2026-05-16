---
story_id: 30-3
epic: 30
title: skill-md capability declaration and e2e verification
status: done
---

# Story 30.3: skill-md capability declaration and e2e verification

Status: done

<!-- Ultimate context engine analysis completed — comprehensive developer guide for Epic 30 closeout. -->

## Story

As the operator, I want the triage `SKILL.md` to accurately document the synthesis trigger capability, and I want live E2E proof that approving a URL-captured note in Discord produces a `SynthesisNote` in `03-Resources/` with `verification_status: pending`, so Epic 30 ships with operator-visible documentation and verified behaviour.

## Context

Stories **30-1** and **30-2** wired the full synthesis pipeline into `references/task-prompt.md` (post-move gate → `SYNTHESIS_CLEAR` → `run-chain.ts` → `vault_update_frontmatter`). The live Hermes skill and repo mirror at `scripts/hermes-skill-examples/triage/` are in sync for **`task-prompt.md`**.

**Gap:** `SKILL.md` (~68 lines, version `1.5.0`) still describes triage as Stories **27.1–27.6** only. It says nothing about post-move auto-synthesis, and its Policy bullet **“One mutation for execution”** is stale relative to Story 30-2 (which allows **`vault_move`** plus **one** **`vault_update_frontmatter`** on the synthesis output path after a successful chain run).

**This story closes Epic 30** with documentation + live verification. **AGENTS.md §8** updates via **`/session-close`** in Discord — do **not** hand-edit `AI-Context/AGENTS.md` or the constitution mirror.

**Out of scope:** No changes to `run-chain.ts`, MCP tool signatures, WriteGate, audit logging, or `task-prompt.md` behaviour (unless a live E2E failure proves a prompt bug — then fix prompt + mirror, re-run E2E, document in evidence).

## Acceptance Criteria

1. **`SKILL.md`** (both **`~/.hermes/skills/cns/triage/SKILL.md`** and repo mirror **`scripts/hermes-skill-examples/triage/SKILL.md`**) has a new **`## Post-move synthesis trigger`** section declaring:
   - **Trigger condition:** After successful **`vault_move`** on `/execute-approved`, synthesis runs only when destination frontmatter has a non-empty **`source_uri`** starting with `http` (case-insensitive; `https://` qualifies). Reference normative steps in **`references/task-prompt.md`** (`## Post-move synthesis gate (Story 30.1)`).
   - **Dedup gate behaviour:** **`vault_search`** scoped to **`03-Resources/`**; skip when an existing note matches the same **`source_uri`** (excluding **`destination_path`** self-hit). Operator-facing skip message: `⚠️ Synthesis skipped — SynthesisNote already exists for <source_uri>: <existing_path>`.
   - **Invocation target:** Terminal runs  
     `cd /home/christ/ai-factory/projects/Omnipotent.md && source .env.live-chain && npx tsx scripts/run-chain.ts --topic "<title>" --query "<source_uri>" --depth shallow --raw-json`  
     with **`title`** / **`source_uri`** from the **`SYNTHESIS_CLEAR`** line (see **`## Synthesis invocation (Story 30-2)`** in `task-prompt.md`).
   - **Output contract:** A **`SynthesisNote`** (or chain **`InsightNote`** path used as synthesis output per current prompt) under **`03-Resources/`**, with **`verification_status: pending`** stamped via **`vault_update_frontmatter`** on success.
   - **Token budget reference:** Point implementers/readers to Story **30-2 AC7** — synthesis invocation **instruction delta** in `task-prompt.md` must stay **≤700** tokens (`wc -c` on delta ÷ 4); this story’s **SKILL.md** section should stay concise (operator summary, not a second copy of the full prompt).
2. **`SKILL.md`** capabilities summary (Overview bullets and/or **`## When to use`**) includes **“auto-synthesis on approval”** (or equivalent clear phrase). Bump **`version:`** in frontmatter (suggest **`1.6.0`**) and extend the title line to reference Epic **30** (e.g. Stories 27.1–27.6 **and** 30.1–30.3).
3. **Live E2E test:** A URL-captured note in **`00-Inbox/`** with a valid **`source_uri`** frontmatter field (real `https://` URL) is run through full **`/triage` → `/approve` → `/execute-approved`** in Discord **`#hermes`**. A synthesis output note appears in **`03-Resources/`** with **`verification_status: pending`** and **`source_uri`** matching the input note.
4. **Dedup gate live test:** A second **`/execute-approved`** on a note sharing the same **`source_uri`** (or re-run after restoring the moved note to Inbox). Discord reports exactly:  
   `⚠️ Synthesis skipped — SynthesisNote already exists`  
   (with URI and path substituted per prompt) and **no duplicate** synthesis note is written to **`03-Resources/`**.
5. **Evidence artifact** at **`_bmad-output/implementation-artifacts/epic-30-e2e-evidence.md`** containing: Discord message log or screenshot descriptions, synthesis note vault path, **`verification_status: pending`** confirmed, dedup gate confirmation.
6. **`sprint-status.yaml` updated:** **`epic-30: done`**, **`30-3-skill-md-capability-declaration-and-e2e-verification: done`**.
7. **`/session-close`** run in Discord — **AGENTS.md §8** reflects Epic **30** shipped (constitution mirror syncs via session-close workflow; no manual AGENTS edit).
8. **Commit message (when implementing):** `feat: Epic 30 — Research Pipeline Auto-Synthesis complete`

## Tasks / Subtasks

- [x] Read **`~/.hermes/skills/cns/triage/SKILL.md`** in full; compare to repo mirror **`scripts/hermes-skill-examples/triage/SKILL.md`** (must match before and after edits). (AC1 prep)
- [x] Add **`## Post-move synthesis trigger`** and update Overview / **`## When to use`** for auto-synthesis; align Policy **mutation** bullets with Story 30-2 (`vault_move` + one post-chain **`vault_update_frontmatter`**). Bump version. Copy to repo mirror. (AC1, AC2)
- [x] Start Hermes gateway (operator machine):
  ```bash
  cd /home/christ/ai-factory/projects/Omnipotent.md && source .env.live-chain && DISCORD_BOT_TOKEN="$HERMES_DISCORD_TOKEN" DISCORD_ALLOW_ALL_USERS=true hermes gateway run
  ```
  Then cold-start hygiene: `rm -f ~/.hermes/SOUL.md` (AC3 prep; [Source: 29-3 cold-start, Operator Guide Hermes table])
- [x] Prepare test note in **`00-Inbox/`** with **`source_uri`** set to a **real** URL (unique per run to avoid accidental dedup from prior tests). Suggested frontmatter minimum: `title`, `date`, `tags`, `status`, `source`, `source_uri` (https), `pake_type: SourceNote` or ingest-consistent type. **Created:** `00-Inbox/e2e-epic30-20260516-cursor-dev.md` (canonical vault).
- [x] Run **`/triage`**, **`/approve <00-Inbox/...> --to 03-Resources/`** (or operator-chosen dest that leaves note with `source_uri` in frontmatter), **`/execute-approved`** in **`#hermes`**. (AC3) — live: `execute-approved` without leading slash (gateway workaround).
- [x] Verify synthesis note in **`03-Resources/`**: read frontmatter — **`verification_status: pending`**, **`source_uri`** matches test input. (AC3) — `03-Resources/synthesis-epic-30-e2e-synthesis-test-cursor-dev-2026-05-16.md`
- [x] Run dedup gate test (second execute or restore + re-execute). Capture Discord skip message. (AC4) — `00-Inbox/e2e-epic30-dedup-test.md`; exact skip message captured in evidence.
- [x] Write **`_bmad-output/implementation-artifacts/epic-30-e2e-evidence.md`**. (AC5)
- [x] Update **`_bmad-output/implementation-artifacts/sprint-status.yaml`**: epic-30 + story 30-3 → **done**. (AC6)
- [x] Run **`/session-close`** in Discord **`#hermes`**. Confirm §8 mentions Epic 30 complete. (AC7) — AGENTS.md v2.0.1, §8 Epic 30.
- [x] Run **`npm test`** and **`bash scripts/verify.sh`**; record in **Verification**.
- [x] Optional but recommended: extend **`tests/hermes-triage-skill.test.mjs`** with assertions on new **`SKILL.md`** strings (`Post-move synthesis trigger`, `auto-synthesis`, `run-chain.ts`, `verification_status: pending`) — keeps mirror honest on future edits.
- [x] Commit with message from AC8 (only when user requests commit).

## Dev Notes

### Previous story intelligence (30-1, 30-2)

| Story | Shipped behaviour | Critical detail for 30-3 |
|-------|-------------------|---------------------------|
| **30-1** | Post-move gate after **`vault_move`** | **`vault_read_frontmatter`** → http(s) **`source_uri`** check → **`vault_search`** dedup in **`03-Resources/`** (ignore **`destination_path`** self) → **`SYNTHESIS_CLEAR`** line |
| **30-2** | Chain invocation + stamp | JSON path is **`synthesis.insight_note.vault_path`** (NOT `pake_validation.insight_note_path`). Success Discord: `✅ SynthesisNote created at <path> — verification_status: pending...` |

Normative prompt excerpts (repo mirror):

```186:206:scripts/hermes-skill-examples/triage/references/task-prompt.md
## Post-move synthesis gate (Story 30.1)
...
## Synthesis invocation (Story 30-2)
...
`cd /home/christ/ai-factory/projects/Omnipotent.md && source .env.live-chain && npx tsx scripts/run-chain.ts --topic "<title>" --query "<source_uri>" --depth shallow --raw-json`
...
path = **`synthesis.insight_note.vault_path`**
...
**`vault_update_frontmatter`** `{"path":"<resolved>","updates":{"verification_status":"pending"}}`
```

### Architecture compliance

- **Hermes skill dual-copy rule:** Edit repo mirror first or in lockstep; **`~/.hermes/skills/cns/triage/SKILL.md`** must match **`scripts/hermes-skill-examples/triage/SKILL.md`** byte-for-byte after this story.
- **WriteGate / constitution:** E2E creates real vault notes via existing governed paths only; no direct edits under **`AI-Context/AGENTS.md`**.
- **Operator guide:** Story **30-2** already updated **`CNS-Operator-Guide.md`** v1.26.0 for post-move synthesis. Unless E2E reveals operator-visible behaviour not already documented, standing task answer: **“Operator guide: no update required — 30-2 covered execute-approved synthesis.”**

### File structure requirements

| Path | Action |
|------|--------|
| `scripts/hermes-skill-examples/triage/SKILL.md` | Add section + capability summary; version bump |
| `~/.hermes/skills/cns/triage/SKILL.md` | Mirror of above |
| `_bmad-output/implementation-artifacts/epic-30-e2e-evidence.md` | **Create** — E2E evidence only |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Mark epic-30 + 30-3 **done** at closeout |
| `tests/hermes-triage-skill.test.mjs` | Optional SKILL.md regression strings |
| `specs/cns-vault-contract/AGENTS.md` + vault copy | **Via `/session-close` only** (AC7) |

### Testing requirements

- **Automated:** `npm test`, `bash scripts/verify.sh` must pass before claiming done.
- **Manual (blocking for this story):** Discord E2E in **`#hermes`** with live gateway + **`.env.live-chain`** keys (`FIRECRAWL_API_KEY`, `APIFY_API_TOKEN`, `ANTHROPIC_API_KEY` per Operator Guide §15). Chain failure = story **not** done — capture logs in evidence artifact.
- **E2E note hygiene:** Use a **fresh** `source_uri` URL per full test run; document paths in evidence so dedup test (AC4) intentionally collides with AC3 output.

### E2E procedure (ordered)

1. Gateway + SOUL.md hygiene (see Tasks).
2. Place test note: `00-Inbox/e2e-epic30-<YYYYMMDD>-<slug>.md` with unique **`source_uri`**.
3. **`/triage`** — confirm note appears in preview.
4. **`/approve 00-Inbox/<file> --to 03-Resources/`** — non-mutating approval recorded.
5. **`/execute-approved 00-Inbox/<file> --to 03-Resources/`** — expect move + gate messages + chain run + success line with path.
6. **`vault_read_frontmatter`** (or Obsidian) on returned synthesis path — confirm **`verification_status: pending`**.
7. Dedup: second **`/execute-approved`** (or restore note to Inbox with same **`source_uri`** and re-approve) — expect skip message, no second synthesis file.
8. **`/session-close`** — verify AGENTS §8 Epic 30 language.

### Git intelligence (recent Epic 30 work)

```
136692a feat(30-2): synthesis invocation post-move hook — done
03ec956 fix(30-2): correct ChainRunResult JSON path synthesis.insight_note.vault_path
9747661 feat(triage): post-move synthesis gate (story 30-1)
```

Follow same commit style for final epic commit (AC8).

### Project context reference

- Constitution: `specs/cns-vault-contract/AGENTS.md` — §8 via session-close only.
- Operator Guide: `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` — §15 Hermes triage + synthesis (v1.26.0).
- Epic 30 theme (planning): approval-time trigger → **`03-Resources/`** + **`verification_status: pending`** [`epic-29-retrospective.md`](../planning-artifacts/epic-29-retrospective.md).

### References

- [Story 30-1](./30-1-post-move-context-extraction-and-synthesis-trigger-gate.md)
- [Story 30-2](./30-2-run-chain-invocation-and-synthesisNote-verification-status-stamp.md)
- Triage prompt: `scripts/hermes-skill-examples/triage/references/task-prompt.md`
- Triage skill: `scripts/hermes-skill-examples/triage/SKILL.md`
- Regression tests: `tests/hermes-triage-skill.test.mjs`
- Chain runner: `scripts/run-chain.ts`

## Standing tasks (every story)

### Standing task: Update operator guide

- [x] If E2E or SKILL.md changes surface **new** operator-facing behaviour not in v1.26.0: update **`Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`** (Version History row). Otherwise record: **“Operator guide: no update required (30-2 documented execute-approved synthesis).”**

## Verification

_(Filled by implementer.)_

- **npm test:** pass (597 vitest + 58 node; includes new Story 30.3 SKILL.md regression test)
- **scripts/verify.sh:** pass
- **E2E synthesis path:** `03-Resources/synthesis-epic-30-e2e-synthesis-test-cursor-dev-2026-05-16.md` (chain ~272s, all stages green)
- **verification_status:** `pending` (stamped via `vault_update_frontmatter`)
- **Dedup gate message:** `⚠️ Synthesis skipped — SynthesisNote already exists for https://en.wikipedia.org/wiki/Model_Context_Protocol: 03-Resources/synthesis-epic-30-e2e-synthesis-test-cursor-dev-2026-05-16.md`
- **session-close / AGENTS §8:** v2.0.1 — Epic 30 complete in §8

## Dev Agent Record

### Agent Model Used

Composer (Cursor dev agent, bmad-dev-story on 30-3)

### Debug Log References

- Hermes gateway background: `hermes gateway run` with `.env.live-chain` + `DISCORD_ALLOW_ALL_USERS=true`
- Cold-start: `rm -f ~/.hermes/SOUL.md`

### Completion Notes List

- **AC1–AC2:** `SKILL.md` v1.6.0 — new `## Post-move synthesis trigger`, Overview/When-to-use **auto-synthesis on approval**, Policy replaces stale **“One mutation for execution”** with **`vault_move` + one post-chain `vault_update_frontmatter`**. Title references Stories 27.1–27.6 and 30.1–30.3. Repo mirror and `~/.hermes/skills/cns/triage/SKILL.md` synced (`diff -q` clean).
- **Operator guide:** no update required — execute-approved synthesis documented in v1.26.0 (Story 30-2).
- **E2E prep:** test note at canonical vault `00-Inbox/e2e-epic30-20260516-cursor-dev.md` (`source_uri`: Wikipedia MCP article URL).
- **AC3–AC7 (live):** Full synthesis pipeline verified in `#hermes`; dedup gate exact message; session-close → AGENTS v2.0.1 §8 Epic 30. Evidence: `epic-30-e2e-evidence.md`. Gateway workarounds logged in `deferred-work.md` (Epic 31 candidates).

### File List

- `scripts/hermes-skill-examples/triage/SKILL.md`
- `~/.hermes/skills/cns/triage/SKILL.md` (live copy, synced)
- `tests/hermes-triage-skill.test.mjs`
- `_bmad-output/implementation-artifacts/epic-30-e2e-evidence.md`
- `_bmad-output/implementation-artifacts/deferred-work.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/stories/30-3-skill-md-capability-declaration-and-e2e-verification.md`

## Change Log

- **2026-05-16:** Story 30-3 created — SKILL.md capability declaration + live E2E verification; Epic 30 closeout story.
- **2026-05-16:** Story 30-3 done — live E2E PASS (AC3–AC4, AC7); epic-30 closed; commit `feat: Epic 30 — Research Pipeline Auto-Synthesis complete`.
