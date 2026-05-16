---
story_id: 31-1
epic: 31
title: triage-command-rename-and-constitution-sync
status: review
---

# Story 31.1: triage-command-rename-and-constitution-sync

Status: review

<!-- Ultimate context engine analysis completed — comprehensive developer guide for Epic 31 gateway routing fix. -->

## Story

As the operator, I want `/triage-approve` and `/triage-execute` to be the canonical triage command names so that the Hermes gateway built-in `/approve` command no longer intercepts triage operations, and I want `CLAUDE.md` and the in-repo `AGENTS.md` fixture synced to current state.

## Context

The Hermes gateway has a built-in `/approve [session|always]` command that intercepts the triage skill's `/approve` before it reaches the skill. `/execute-approved` is unknown to the gateway entirely. Both commands required the operator to **omit the leading slash** as a workaround (discovered Epic 30 E2E, documented in `deferred-work.md` and `epic-30-e2e-evidence.md`).

**Root cause:** Gateway-owned slash commands collide with triage skill grammar. **Fix:** Rename to command names the gateway does not own (`/triage-approve`, `/triage-execute`). Grammar (4-token, `source_path`, `--to`, `destination_dir/`) is unchanged.

**Stale repo context files:**

| File | Current state | Target |
|------|---------------|--------|
| `CLAUDE.md` (repo root) | v1.9.8, "Next: Epic 29" | AGENTS **v2.0.1**, Epic 30 complete, Epic 31 in-progress |
| `Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md` | Stale (v2.0.0-era §8) | Byte-identical to `specs/cns-vault-contract/AGENTS.md` (**v2.0.1**) |

**Out of scope (explicit):** MCP tool signatures, WriteGate, audit logging, `run-chain.ts`, `task-prompt.md` logic changes beyond command-name substitution, canonical vault `AI-Context/AGENTS.md` at `/mnt/c/...` (use in-repo fixture sync only; **do not** hand-edit governed `AI-Context/` except the CI fixture copy listed below), Hermes gateway source changes, live Discord re-E2E (optional smoke noted in Dev Notes).

**Confined file set:**

- `scripts/hermes-skill-examples/triage/references/trigger-pattern.md` + `~/.hermes/skills/cns/triage/references/trigger-pattern.md`
- `scripts/hermes-skill-examples/triage/references/task-prompt.md` + live mirror
- `scripts/hermes-skill-examples/triage/SKILL.md` + live mirror
- `CLAUDE.md` (repo root only)
- `Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md` (in-repo CI fixture)
- Worktree cleanup (git)
- `tests/hermes-triage-skill.test.mjs`

## Acceptance Criteria

1. **`trigger-pattern.md`** (repo mirror and live) defines **`/triage-approve`** as the canonical approval command and **`/triage-execute`** as the canonical execution command. Old **`/approve`** and **`/execute-approved`** grammar is noted as **deprecated** with a one-line migration note at the bottom. The 4-token grammar, `source_path`, `--to`, and `destination_dir/` rules are unchanged.
2. **`task-prompt.md`** (both copies) references **`/triage-approve`** and **`/triage-execute`** throughout normative execution sections. All occurrences of **`/approve`** and **`/execute-approved`** in normative sections are updated. **`SYNTHESIS_CLEAR`**, post-move gate steps, dedup logic, and **`run-chain`** invocation are **unchanged in behaviour** — command name references only.
3. **`SKILL.md`** (both copies) **`version:`** bumped to **`1.7.0`**. **`## When to use`** updated for **`/triage-approve`** and **`/triage-execute`**. Description frontmatter and policy bullets that name the old commands are updated consistently.
4. **`CLAUDE.md`** at repo root references **AGENTS.md v2.0.1**, current epic state (**Epic 30 complete**, **Epic 31 in-progress**), and correct **Next** pointer (**Epic 31**). Phase status lists Epics 1–30 done.
5. **`Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md`** (in-repo CI fixture) synced to match **`specs/cns-vault-contract/AGENTS.md`** (v2.0.1). Verified byte-for-byte identical via `diff -q specs/cns-vault-contract/AGENTS.md Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md` (exit 0).
6. **Stale worktrees removed:**
   ```bash
   git worktree remove .claude/worktrees/friendly-hellman-e174d2 --force
   git worktree remove .claude/worktrees/peaceful-tharp-60dc95 --force
   ```
   `git worktree list` shows no prunable Claude worktrees under `.claude/worktrees/`.
7. **`tests/hermes-triage-skill.test.mjs`** updated to assert **`/triage-approve`** and **`/triage-execute`** in normative skill/prompt content. **`SKILL.md`** version assertion → **`1.7.0`**. No test may **pass solely** by matching deprecated **`/approve`** or **`/execute-approved`** in normative sections (deprecated migration note in `trigger-pattern.md` may still mention old names — assert new canonical strings in the same tests that previously locked old grammar).
8. **Token budget AC (§6.5 delta):** Changes to **`task-prompt.md`** must not exceed **200 tokens** net instruction delta (command name substitutions only — no new logic). Measure: `diff -u` pre/post on `task-prompt.md`, count changed lines only, `wc -c` on delta ÷ 4; record bytes and estimated tokens in **Verification**.
9. **`npm test`** passes. **`bash scripts/verify.sh`** passes.

## Tasks / Subtasks

- [x] Read **`trigger-pattern.md`**, **`task-prompt.md`**, and **`SKILL.md`** in full (repo mirror paths below). (AC prep)
- [x] **`trigger-pattern.md`:** Rename normative **`/approve`** → **`/triage-approve`**, **`/execute-approved`** → **`/triage-execute`**; update section headings/examples/Discord keyword copy; add **Deprecated commands** footer with one-line migration (`/approve` → `/triage-approve`, `/execute-approved` → `/triage-execute`). (AC1)
- [x] **`task-prompt.md`:** Substitute command names in all normative sections (routing branches, approval handling, execute handling, examples, refusal blocks). Verify **`SYNTHESIS_CLEAR`** and **Post-move synthesis gate** text unchanged except command tokens. (AC2)
- [x] **`SKILL.md`:** Bump to **v1.7.0**; update description, Overview, When to use / not to use, Policy, Post-move synthesis trigger summary. (AC3)
- [x] Copy all three files to live Hermes paths (either **`bash scripts/install-hermes-skill-triage.sh`** or `cp -a`); confirm repo mirror and **`~/.hermes/skills/cns/triage/`** match. (AC1–3)
- [x] **`CLAUDE.md`:** Update constitution version, phase/epic status, Next pointer. (AC4)
- [x] **`cp specs/cns-vault-contract/AGENTS.md Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md`**; run **`diff -q`** (AC5). **Do not** edit `/mnt/c/...` canonical vault in this story.
- [x] Remove stale worktrees (AC6).
- [x] Update **`tests/hermes-triage-skill.test.mjs`** (AC7).
- [x] Measure **`task-prompt.md`** token delta (AC8).
- [x] Run **`npm test`** and **`bash scripts/verify.sh`** (AC9).

### Review Findings

- [x] [Review][Patch] Document no-leading-slash Discord operator syntax for triage approval and execution [scripts/hermes-skill-examples/triage/references/trigger-pattern.md:36]: AC1/AC7 and the operator review note are not satisfied because the repo and live `trigger-pattern.md` copies still teach slash-prefixed `/triage-approve` and `/triage-execute` examples throughout, while the validated Discord operator path requires `triage-approve` and `triage-execute` without the leading slash. The normative prompt and tests also lock the slash-prefixed contract instead of explicitly documenting and asserting the Discord no-slash form. Patched in repo mirror, tests, live config, and live triage install.

## Dev Notes

### Epic 30 intelligence (why this story exists)

| Source | Finding |
|--------|---------|
| `epic-30-e2e-evidence.md` | Live E2E used **`execute-approved`** without leading `/`; **`/approve`** intercepted by gateway built-in |
| `deferred-work.md` (Epic 30 E2E) | **`/approve`** routing conflict; **`/execute-approved`** slash routing class — **Epic 31 candidate** |
| Story **30-3** | Documented workarounds; deferred gateway fix to Epic 31 |

**Hermes gateway collision (do not “fix” in gateway for this story):** Built-in `/approve [session|always]` is gateway-owned. Triage must use names outside that namespace. **`/triage-execute`** avoids inventing a new global command; it stays triage-scoped.

### Command rename map (mechanical)

| Deprecated | Canonical | Notes |
|------------|-----------|-------|
| `/approve` | `/triage-approve` | 4 tokens: `/triage-approve`, `source_path`, `--to`, `destination_dir/` |
| `/execute-approved` | `/triage-execute` | Same 4-token shape; `destination_path` derivation unchanged |

**Parsing branches in `task-prompt.md` (update message-start checks):**

- `If the message starts with /triage-approve` → Approval handling
- `If the message starts with /triage-execute` → Execute approved move handling

**Unchanged:** `/triage`, `--offset`, ambiguity refusal, Story 30.1–30.2 synthesis gate, **`SYNTHESIS_CLEAR`** format, `run-chain.ts` command line, dedup messages.

### Architecture compliance

- **Dual-copy rule:** Repo mirror under `scripts/hermes-skill-examples/triage/` is source of truth for git; **`~/.hermes/skills/cns/triage/`** must match after install. Use `scripts/install-hermes-skill-triage.sh` (copies entire tree).
- **AGENTS.md:** Only sync **in-repo** `Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md` from **`specs/cns-vault-contract/AGENTS.md`**. Constitution rule for canonical vault (`/mnt/c/...`) does **not** apply to this copy-only fixture sync — no `/session-close` required for AC5.
- **WriteGate:** No governed-path edits beyond copying spec AGENTS into the in-repo fixture (same content as specs mirror).
- **§6.5 token budget:** 200-token cap on **`task-prompt.md`** delta only (substitutions). Prior stories: 30-1 used ~639 tokens for new gate section; 30-2 used ≤700 for synthesis invocation — this story is rename-only and should be well under 200.

### File structure requirements

| Path | Action |
|------|--------|
| `scripts/hermes-skill-examples/triage/references/trigger-pattern.md` | Rename commands + deprecated footer |
| `scripts/hermes-skill-examples/triage/references/task-prompt.md` | Substitute command names (normative sections) |
| `scripts/hermes-skill-examples/triage/SKILL.md` | v1.7.0 + When to use |
| `~/.hermes/skills/cns/triage/**` | Mirror of above (via install script) |
| `CLAUDE.md` | Repo context refresh |
| `Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md` | `cp` from specs (v2.0.1) |
| `tests/hermes-triage-skill.test.mjs` | Assert new command strings + version 1.7.0 |
| `.claude/worktrees/friendly-hellman-e174d2` | `git worktree remove --force` |
| `.claude/worktrees/peaceful-tharp-60dc95` | `git worktree remove --force` |

**Not in scope:** `Knowledge-Vault-ACTIVE/03-Resources/CNS-Operator-Guide.md` (still documents `/approve` and `/execute-approved` in §15.3 — see Standing tasks).

### Testing requirements

**Automated (blocking):**

```bash
npm test
bash scripts/verify.sh
```

**Regression test edits (`tests/hermes-triage-skill.test.mjs`):**

- Replace assertions on `/approve` / `/execute-approved` in normative checks with `/triage-approve` / `/triage-execute`.
- Update four-token grammar strings, e.g. `` exactly four tokens: `/triage-approve`, ... `` and `` `/triage-execute`, ... ``.
- `version: 1.6.0` → `1.7.0`.
- Optional: assert `trigger-pattern.md` contains deprecated migration footer mentioning old names (without using old names as the only asserted canonical grammar).

**Manual smoke (recommended, not blocking for AC):** In Discord `#hermes` with gateway running, send **`triage-approve 00-Inbox/<test>.md --to 03-Resources/`** and **`triage-execute ...`** without leading slashes. Confirm skill handles them as regular messages routed to triage. Log result in Dev Agent Record if run.

### Token delta measurement (AC8)

```bash
# Before edits, save baseline
cp scripts/hermes-skill-examples/triage/references/task-prompt.md /tmp/task-prompt-pre.md
# After edits
diff -u /tmp/task-prompt-pre.md scripts/hermes-skill-examples/triage/references/task-prompt.md > /tmp/task-prompt.delta
# Count only changed lines' characters (or use diff output hunks); divide by 4 for token estimate
```

Target: net delta ≤ **200** tokens. If over budget, shorten replacement phrasing without changing logic (e.g. avoid duplicating long examples).

### CLAUDE.md target content (AC4 checklist)

- **Constitution:** `specs/cns-vault-contract/AGENTS.md` (**v2.0.1**)
- **Phase status:** Epics **1–30** done; **Epic 31** in-progress
- **Next:** Epic **31** (triage command rename — this story)
- **Hermes / MCP table:** Keep aligned with `CLAUDE.md` project rules pattern (10 Vault IO tools, etc.)

### References

- [Source: `_bmad-output/implementation-artifacts/deferred-work.md` — Epic 30 E2E deferred]
- [Source: `_bmad-output/implementation-artifacts/epic-30-e2e-evidence.md` — Deferred findings table]
- [Source: `_bmad-output/implementation-artifacts/stories/30-3-skill-md-capability-declaration-and-e2e-verification.md` — E2E workarounds]
- [Source: `scripts/hermes-skill-examples/triage/references/trigger-pattern.md` — current B/C grammar sections]
- [Source: `scripts/install-hermes-skill-triage.sh` — live install]
- [Source: `specs/cns-vault-contract/AGENTS.md` §6.5 — token budget policy]
- [Source: `tests/hermes-triage-skill.test.mjs` — regression patterns]

## Standing tasks (every story)

### Standing task: Update operator guide

- [x] **Recommended follow-up (out of confined scope):** `CNS-Operator-Guide.md` §15.3 still documents `/approve` and `/execute-approved`. Either add a **31-1** version-history row and replace command examples with `/triage-approve` / `/triage-execute` in a follow-up commit/story, or note **"Operator guide: deferred — Epic 31 story 31-1 confined scope; operators use skill references until guide updated"** in Dev Agent Record.
- [ ] If operator guide is updated in the same implementation pass (operator approval): bump `modified`, add Version History row (suggest v1.27.0).

## Dev Agent Record

### Agent Model Used

Composer (dev-story)

### Debug Log References

_(none)_

### Completion Notes List

- Renamed canonical triage commands to `/triage-approve` and `/triage-execute` in repo mirror + live `~/.hermes/skills/cns/triage/` (via `install-hermes-skill-triage.sh`).
- Added **Deprecated commands (Epic 31)** footer in `trigger-pattern.md` documenting migration from `/approve` and `/execute-approved`.
- `SYNTHESIS_CLEAR`, post-move gate, and `run-chain` invocation unchanged except command tokens.
- Synced in-repo `Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md` from specs (v2.0.1); `diff -q` exit 0.
- Removed prunable worktrees `friendly-hellman-e174d2` and `peaceful-tharp-60dc95`.
- **Operator guide: deferred** — `CNS-Operator-Guide.md` §15.3 still uses legacy command names; confined scope per story.

### File List

- `scripts/hermes-skill-examples/triage/references/trigger-pattern.md`
- `scripts/hermes-skill-examples/triage/references/task-prompt.md`
- `scripts/hermes-skill-examples/triage/SKILL.md`
- `CLAUDE.md`
- `Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md`
- `tests/hermes-triage-skill.test.mjs`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Verification

| Check | Result |
|-------|--------|
| `diff -q specs/cns-vault-contract/AGENTS.md Knowledge-Vault-ACTIVE/AI-Context/AGENTS.md` | exit 0 |
| `task-prompt.md` net file delta | +43 bytes (~11 tokens); paired-line length delta 127 chars (~32 tokens) — under 200-token AC |
| `npm test` | 597 passed |
| `bash scripts/verify.sh` | VERIFY PASSED |
| `git worktree list` | no `.claude/worktrees/` entries |

## Change Log

- 2026-05-16: Epic 31 story 31-1 — triage command rename (`/triage-approve`, `/triage-execute`), SKILL v1.7.0, constitution/CLAUDE sync, regression tests updated.
- 2026-05-16: Review patch: documented slash-less Discord operator invocation for `triage-approve` and `triage-execute`, updated operator-facing examples and live channel prompt, and returned story to review.
