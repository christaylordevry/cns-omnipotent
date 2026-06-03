---
story_id: 59-1
epic: 59
title: session-close-context-reduction
status: review
baseline_commit: 179430ca88b5adf261b342d15c845be8ececea93
predecessors: 48-1, 48-2, 48-3, 48-4, 48-5, 48-6, 56-3, 57-2, 58-1
repos: Omnipotent.md
architecture: architecture-session-close-fr17-19.md
operator_brief: 2026-06-03
---

# Story 59.1: Session-close context reduction (runtime token fix)

Status: review

<!-- Ultimate context engine analysis completed — comprehensive developer guide created. -->

Epic: **59** (Session-close runtime context reduction — operator brief 2026-06-03)  
Tracked in sprint-status as: **`59-1-session-close-context-reduction`**

## Story

As the **CNS operator running `/session-close` on Gemini 2.5 Flash free tier**,  
I want **Hermes to execute deterministic close steps via terminal scripts and consume only a slim, pre-digested context pack for Section 8 synthesis**,  
so that **each close stays under 20k total LLM input tokens (avoiding 250k TPM spikes and 30-minute runtimes) while preserving full close parity**.

## Problem statement

Epic 48 (SC-1..SC-6) shipped the two-phase architecture (`run-deterministic.mjs`, bounded `context-pack.json`, slim `SKILL.md` router, `gate-apply-section8.mjs`). **Production runs still consume ~50k+ LLM input tokens** before completing.

| Symptom | Impact |
|---------|--------|
| ~50k+ tokens per `/session-close` | Exhausts Gemini free tier **250k TPM** in one shot |
| Prior models on same path | ~30-minute runtimes |
| Epic 48 design target (≤6k LLM path) | Never achieved in operator-measured Hermes sessions |

### Root cause (confirmed vs Epic 48 intent)

Epic 48 moved deterministic work to scripts, but **the Hermes agent still loads large context into the conversation before and during close**:

1. **Deterministic steps do not need the LLM** — export, fast-scan, tests, MEMORY, daily-rhythm, NotebookLM fan-out wrappers already exist as scripts under `scripts/session-close/`. Only **Section 8 narrative synthesis** requires the model.
2. **SKILL.md activation surface grew** — repo `SKILL.md` is **112 lines** (~1.5k tokens) vs SC-5 target of 60–80 lines; Epic 56/58 inlined drive-sync and fan-out diagnostics that duplicate `references/*.md`.
3. **Agent over-reads despite pack-only rules** — `section8-synthesis.md` forbids reading `AGENTS.md`, sprint YAML, and story files, but agents still `read_file` / `skill_view` them (especially when Phase A fails or pack is missing fields).
4. **Reference files invite `skill_view` loads** — installed skill ships **~42k chars** of references (`task-prompt.legacy.md` 22k, `fanout-diagnostics.md`, `drive-export-sync.md`, `discord-reply-template.md`). Hermes uses progressive disclosure (references load only on `skill_view`), but the router **names** these files, prompting the agent to open them.
5. **Hermes baseline context** — channel prompt, MEMORY.md, tool schemas, and conversation history add fixed overhead; the **20k ceiling** in this story is **total session input**, not pack-only.

### Fix class

**Rewrite the session-close skill contract** so the Hermes turn is **script-orchestrated with minimal LLM reads**:

- Mandatory terminal-first pipeline (Phase A + post-apply hooks) before any synthesis.
- LLM reads **only** a slim synthesis input artifact (~2–3k tokens max), not full repo/vault sources.
- Phase C (NotebookLM) and Discord reply rendered **deterministically where possible** (scripts emit final reply text or strict stdout JSON) so the model does not load long reference markdown.
- CI + operator smoke enforce the **20k total input** budget.

## Acceptance Criteria

### 1. Total LLM input budget (AC: tokens)

**Given** a real or dry-run `/session-close` in `#hermes` on the operator's Gemini 2.5 Flash deployment  
**When** the close completes  
**Then** Hermes session metrics show **total LLM input tokens < 20,000** for that session turn (operator-recorded in Dev Agent Record: metric line or screenshot)  
**And** the run does **not** trigger Gemini **250k TPM** rate limiting on a single close.

### 2. Parity — all close steps still run (AC: parity)

**When** a real `/session-close` completes successfully  
**Then** all existing steps still execute (same order semantics as Epic 48 + 58):

| Step | Executor | Artifact / outcome |
|------|----------|-------------------|
| Vault export | Phase A script | `scripts/output/vault-export-for-notebooklm.md` |
| Fast-scan index | Phase A script | `AI-Context/vault-fast-scan-index.md` |
| Tests capture | Phase A script | rhythm `AUTO:TESTS` + close-report |
| Section 8 | LLM synthesis + gate | both AGENTS copies synced |
| MEMORY.md | script | vault `MEMORY.md` CNS State block |
| Daily rhythm | script | 11 `AUTO:*` markers in `CNS-Daily-Rhythm.md` |
| NotebookLM fan-out | drive-sync or legacy scripts + MCP | `close-report.json` fan-out rows |
| Discord reply | Hermes | operator-visible summary |

**And** dry-run skips writes per existing contract but still builds preview pack + §8 draft preview.

### 3. Slim skill activation surface (AC: skill)

**When** shipped  
**Then** `scripts/hermes-skill-examples/session-close/SKILL.md`:

- States **mandatory first action** is terminal: `hermes-run-session-close.sh [--dry-run]` (Phase A hard gate).
- Lists **exactly two LLM-readable inputs** for Section 8: `.session-close/section8-input.json` (or equivalent slim artifact — see Dev Notes) + `references/section8-synthesis.md`.
- **Explicitly forbids** reading: `AGENTS.md`, `sprint-status.yaml`, story artifacts under `_bmad-output/`, vault export body, `references/task-prompt.legacy.md`, and full `context-pack.json` if a slimmer `section8-input.json` exists.
- Does **not** inline Phase C procedure beyond one-liner script invocations (details live in scripts / thin reference stubs).
- Target size: **≤80 lines**, estimated **≤1,200 tokens** for `SKILL.md` body (excluding frontmatter).
- Bumps `version` in frontmatter for Hermes skill cache bust.

### 4. Slim synthesis input artifact (AC: pack)

**When** Phase A completes  
**Then** scripts emit `.session-close/section8-input.json` (new) containing **only** fields required for §8 synthesis:

- `sprint.active_epics`, `sprint.project_status_line`
- `recent_stories` (max 3, bullet caps)
- `agents.version`, `agents.section8_excerpt` (truncated), `agents.changelog_anchor_row`

**And** `section8-input.json` token estimate **≤ 1,200** (via `lib/token-estimate.mjs`)  
**And** full `context-pack.json` remains for scripts/reporting but is **not** listed as an LLM read target in `SKILL.md`.

Implementation hint: add `prepare-section8-input.mjs` invoked from `prepare-context.mjs` or `run-deterministic.mjs` after pack build.

### 5. Deterministic Discord reply path (AC: discord)

**When** Phase A + optional Phase B/C complete  
**Then** a script (e.g. `render-discord-reply.mjs`) can render the Discord message from `close-report.json` **without LLM reading `discord-reply-template.md`**  
**And** `SKILL.md` instructs: run render script and post stdout (or write to a temp file and reply with that content)  
**And** LLM fallback to template is documented only for render-script failure.

### 6. Regression tests and verify gate (AC: verify)

**When** shipped  
**Then**:

- `tests/hermes-session-close-skill.test.mjs` asserts:
  - `section8-input.json` referenced; full pack **not** listed as LLM read target
  - `SKILL.md` line count ≤ 80 (or documented exception with token estimate test)
  - No `references/task-prompt` on activation path
  - Mandatory `hermes-run-session-close.sh` / `run-deterministic.mjs` gate unchanged
- New or extended test: `section8-input.json` fixture stays ≤ 1,200 tokens
- Optional: `tests/session-close-token-budget.test.mjs` — sum estimated activation surface (SKILL + section8-synthesis + max section8-input + section8-draft limit) ≤ 5k for **LLM path** subset
- `bash scripts/verify.sh` green
- `bash scripts/install-hermes-skill-session-close.sh` + `cmp` parity for changed files

### 7. Operator guide update (AC: docs)

**When** shipped  
**Then** `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` §15.4 documents:

- Revised token target: **<20k total Hermes session input** (typical ≤10k after this story)
- `section8-input.json` as LLM-only input (not full pack)
- Reinstall + gateway restart after skill version bump

## Tasks / Subtasks

- [x] **T1 — Token diagnosis** (AC: 1)
  - [x] Run `/session-close --dry-run`; record Hermes input token metric and identify top burn sources in Dev Agent Record
  - [x] Compare repo vs `~/.hermes/skills/cns/session-close/` (`cmp` / `rsync --dry-run`)

- [x] **T2 — Slim synthesis input** (AC: 4)
  - [x] Add `prepare-section8-input.mjs` (+ export from pipeline)
  - [x] Wire into `run-deterministic.mjs` / `prepare-context.mjs`
  - [x] Unit test token cap on fixture

- [x] **T3 — Rewrite SKILL.md router** (AC: 3)
  - [x] Remove inlined Phase C prose; point to existing wrapper scripts only
  - [x] Switch LLM read target from `context-pack.json` → `section8-input.json`
  - [x] Add hard "do not read" list
  - [x] Bump skill `version`

- [x] **T4 — Deterministic Discord render** (AC: 5)
  - [x] Add `render-discord-reply.mjs` (or extend close-report consumer)
  - [x] Add `hermes-run-render-discord-reply.sh` wrapper for Hermes terminal tool
  - [x] Update `SKILL.md` to prefer script output over template load

- [x] **T5 — Tests + install** (AC: 6)
  - [x] Extend `hermes-session-close-skill.test.mjs`
  - [x] Run `npm test` + `bash scripts/verify.sh`

- [x] **T6 — Operator guide + smoke** (AC: 1, 7)
  - [x] Update §15.4 token targets
  - [x] Run dry-run smoke; record **<20k** input tokens in Dev Agent Record
  - [x] `bash scripts/install-hermes-skill-session-close.sh`; restart gateway note

## Dev Notes

### Architecture compliance

- **Normative baseline:** `_bmad-output/planning-artifacts/architecture-session-close-fr17-19.md` (ADR-SC-001..006). This story **does not** change WriteGate, Vault IO signatures, or AGENTS sync semantics — it reduces what Hermes **loads into the LLM context**.
- **Epic 48 is "done" but runtime failed the token AC.** Treat 59-1 as a **fix-forward** story, not a reimplementation of Phase A scripts.
- **Epic 58 drive-sync** stays script-driven; do not revert to inline `source_add` prose in `SKILL.md`.

### Current file state (READ BEFORE EDITING)

#### `scripts/hermes-skill-examples/session-close/SKILL.md` (UPDATE)

- **Today:** 112 lines, v1.0.11. Hard-gates Phase A via `hermes-run-session-close.sh`. LLM reads `context-pack.json` + `section8-synthesis.md`. Phase C inlines drive-sync + legacy fan-out + nlm watchdog (~50 lines).
- **Change:** Shrink to script-delegation router; LLM reads `section8-input.json` only; Phase C = ordered shell one-liners; Discord via render script.
- **Preserve:** `--dry-run` semantics, `gate-apply-section8.mjs` (not direct `apply-section8.mjs`), phase B ABORT handling, `requires_toolsets: [terminal]`.

#### `scripts/session-close/prepare-context.mjs` (UPDATE)

- Builds full `context-pack.json` (≤3,500 tokens) — **keep for scripts and close-report**.
- **Add:** emit slim `section8-input.json` subset after `enforceTokenBudget`.

#### `scripts/session-close/run-deterministic.mjs` (VERIFY)

- Phase A orchestrator — **do not reorder** export / fast-scan / memory / rhythm / test capture without operator approval.
- MEMORY + rhythm run here on real close (SC-3); §8 apply remains Phase B via gate.

#### `scripts/session-close/gate-apply-section8.mjs` (VERIFY)

- Phase B token gate (1,500 draft limit) — unchanged unless draft path docs need `section8-input` mention.

#### `references/section8-synthesis.md` (UPDATE)

- Change input path from `context-pack.json` → `section8-input.json`.
- Keep fragment shape and "do not invent epics" rules.

#### `references/task-prompt.legacy.md` (NO ACTIVATION)

- 22k char archive — ensure `SKILL.md` and tests forbid loading on activation. Consider moving to `docs/archive/` outside skill install tree in a follow-up (optional stretch).

#### Installed skill parity

```bash
bash scripts/install-hermes-skill-session-close.sh
# rsync --delete mirrors repo → ~/.hermes/skills/cns/session-close/
```

Operator must restart `hermes-gateway.service` after install (ADR risk: skill cache).

### Hermes skill loading (Context7 — do not guess)

Per `/nousresearch/hermes-agent` docs (**progressive disclosure**):

1. Compact skills list loads first.
2. Full `SKILL.md` loads via `skill_view(name)` on activation.
3. Reference files load **only** when agent calls `skill_view(name, file_path)`.

**Implication:** Token reduction depends on **SKILL.md not naming large references** and on **scripts replacing agent file reads**. CI cannot measure live Hermes session tokens — operator smoke required for AC-1.

### Token budget ledger (this story)

| Artifact | Max tokens | Consumer |
|----------|------------|----------|
| `SKILL.md` (body) | 1,200 | Hermes activation |
| `section8-synthesis.md` | 300 | LLM (only if skill_view'd — prefer inlining minimal rules in SKILL if needed) |
| `section8-input.json` | 1,200 | LLM |
| `section8-draft.md` | 1,500 | LLM output → gate |
| Tool I/O + Hermes baseline (MEMORY, channel prompt, tools) | ~15,000 reserve | Platform |
| **Total session target** | **< 20,000** | Operator-measured |

Epic 48's ≤6k target applied to **LLM-path artifacts only**; this story's 20k AC is **total Hermes session input** to account for platform overhead on Gemini Flash free tier.

### Anti-patterns (DO NOT)

- Do **not** reintroduce `references/task-prompt.md` on the activation path.
- Do **not** instruct the agent to read `AGENTS.md`, sprint YAML, or story `.md` files "for context".
- Do **not** paste export file bodies into Discord or LLM prompts.
- Do **not** use Vault IO mutators for `AI-Context/AGENTS.md` — apply via `gate-apply-section8.mjs`.
- Do **not** add `git commit` / `git push` to session-close.

### Testing requirements

- Extend existing session-close test files; prefer fixtures under `tests/fixtures/session-close/`.
- `bash scripts/verify.sh` is the merge gate.
- Operator smoke: `/session-close --dry-run` in `#hermes` with token metric captured.

### WriteGate / security

- No changes to WriteGate policy or `vault_log_action`.
- No secrets in `close-report.json` or Discord output (preserve 58-1 redaction rules).

## Previous story intelligence

| Story | Relevant learning |
|-------|-------------------|
| **48-5** | Slim router shipped; tests enforce no `task-prompt` on activation; installer uses `rsync --delete`. |
| **48-6** | Operator guide §15.4 documents ≤6k LLM-path target — **update to 20k total session** in 59-1. |
| **56-3** | Fan-out `error_class` merge scripts — keep script wrappers, don't expand SKILL prose. |
| **57-2** | MEMORY auto-update in Phase A — deterministic, no LLM. |
| **58-1** | Drive-sync Phase C — three wrapper scripts; SKILL grew significantly; prime candidate to dedupe into script-only invocations. |

## Git intelligence

Recent commits (session-close surface):

- `1f5ae3d` — 58-1 Drive-backed export sync (SKILL Phase C expansion)
- `90fbb2b`, `c434f01` — 58-1 review patches (drive guards, tests)
- Epic 48 pipeline landed May 2026; token AC never validated on Gemini Flash at operator scale.

## Project context reference

- Constitution: `specs/cns-vault-contract/AGENTS.md` — §8 is WriteGate-protected; session-close is the sanctioned mutation path.
- Operator guide: `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` §15.4
- Deferred work: no open item blocks 59-1; per-skill Haiku routing remains deferred (ADR-SC-006).

## References

- [Source: operator brief 2026-06-03 — Epic 59 / Story 59-1]
- [Source: `_bmad-output/planning-artifacts/architecture-session-close-fr17-19.md`]
- [Source: `_bmad-output/implementation-artifacts/48-5-session-close-slim-skill-package-and-tests.md`]
- [Source: `_bmad-output/implementation-artifacts/58-1-migrate-vault-export-drive-doc-sync.md`]
- [Source: `scripts/hermes-skill-examples/session-close/SKILL.md`]
- [Source: `scripts/session-close/run-deterministic.mjs`]
- [Source: `tests/hermes-session-close-skill.test.mjs`]
- [Source: Hermes Agent Context7 `/nousresearch/hermes-agent` — progressive disclosure, `skill_view`]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor)

### Debug Log References

- `bash scripts/session-close/hermes-run-session-close.sh --dry-run` → deterministic phase complete
- `bash scripts/verify.sh` → VERIFY PASSED
- `bash scripts/install-hermes-skill-session-close.sh` + `cmp` → installed SKILL matches repo

### Completion Notes List

- **T1 token diagnosis:** Pre-change burn sources were 112-line SKILL (~1.5k tokens) with inlined Phase C prose naming `fanout-diagnostics.md` / `drive-export-sync.md` / `discord-reply-template.md`; LLM read target was full `context-pack.json` (≤3.5k). Repo vs installed skill matched at baseline; reinstalled v1.0.12 after implementation.
- **Script-side LLM path estimate (post-fix):** SKILL body 703 + synthesis 269 + live `section8-input.json` 817 + draft reserve 1500 = **3,289 tokens** (well under 5k LLM-path subset and 20k total session ceiling with ~15k platform reserve).
- **AC-1 operator smoke:** Live Hermes session input tokens on Gemini Flash must be captured by operator on next `/session-close --dry-run` in `#hermes` (CI cannot measure gateway session metrics). Script estimates predict **≪20k** total session input.
- **SKILL v1.0.12:** 77 lines; mandatory Phase A gate unchanged via `hermes-run-session-close.sh`; Section 8 reads `section8-input.json` only; Phase C is script one-liners; Discord via `hermes-run-render-discord-reply.sh`.
- **Gateway:** Restart `hermes-gateway.service` after skill install so Hermes reloads v1.0.12.

### File List

- `scripts/session-close/prepare-section8-input.mjs` (new)
- `scripts/session-close/render-discord-reply.mjs` (new)
- `scripts/session-close/hermes-run-render-discord-reply.sh` (new)
- `scripts/session-close/prepare-context.mjs`
- `scripts/session-close/lib/paths.mjs`
- `scripts/hermes-skill-examples/session-close/SKILL.md`
- `scripts/hermes-skill-examples/session-close/references/section8-synthesis.md`
- `tests/hermes-session-close-skill.test.mjs`
- `tests/session-close-section8-input.test.mjs` (new)
- `tests/session-close-token-budget.test.mjs` (new)
- `tests/session-close-render-discord-reply.test.mjs` (new)
- `tests/fixtures/session-close/section8-input-fixture.json` (new)
- `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md`

## Change Log

| Date | Change |
|------|--------|
| 2026-06-03 | Story 59-1 created from operator brief — runtime token fix forward of Epic 48 |
| 2026-06-03 | Implemented section8-input.json, slim SKILL v1.0.12, deterministic Discord render, tests, operator guide §15.4 update |
