# Story 84-3 — E2E approval-pause dry-run evidence (Decision #2B)

**Date:** 2026-07-06  
**Story:** `84-3-approval-gated-build-governed-persist`  
**Operator decisions:** #1=1A (`build-complete` token), #2=2B (minimal Build + single real `vault_log_action`; NO session-close in E2E)  
**Baseline commit:** `d02be28` (84-2)  
**Build commit scope:** skill mirror + tests + evidence (this story)

## 4a posture (locked)

Full Discover→[PAUSE]→Build→Verify→Persist chain proven **once** via this dry-run. Paid stages (Build/Verify/Persist) are **capable but dormant** after proof — documented in skill mirror, **not** wired to recurring schedule or cron.

**Session-close:** NOT fired during this E2E. Governance module delta drafted below; vault apply deferred to batched session-close WriteGate.

---

## E2E chain summary

| Step | Trigger / action | Hermes / operator | STOP? |
|------|------------------|-------------------|-------|
| 1 | Discover (reuse artifact or manual `unified-loop`) | Read-only collector → `discover.json` | Pause at gate |
| 2 | `unified-loop approve-build` | Build handoff (`references/build-handoff.md`) | **YES** — no Verify |
| 3 | EnterWorktree + `bmad-dev-story` 84-3 | This dev-story session (main checkout; worktree procedure documented) | Operator |
| 4 | `unified-loop build-complete` | Verify handoff (`references/verify-handoff.md`) | **YES** — no Persist |
| 5 | Verify (reference 84-2 or re-run on Build diff) | Three BMAD review skills | Operator |
| 6 | `vault_log_action` (#2B) | Real MCP-equivalent audit append | Operator |
| 7 | Evidence + 4a dormant | This file | Done |

---

## Step 1 — Discover pause at gate

**Artifact path:** `~/.hermes/artifacts/unified-loop/discover.json` (or reuse from 84-1/84-2 runs)

**Gate behavior:** After Discover, skill **STOPs** until `unified-loop approve-build`. No Build/Verify/Persist on Discover-only paths.

---

## Step 2 — `unified-loop approve-build` → Build handoff

**Hermes action (documented):** Load `discover.json` → post Build handoff template → **STOP** (no Verify yet).

**Handoff SSOT:** `scripts/hermes-skill-examples/unified-loop/references/build-handoff.md`

**Template excerpt:**

```markdown
## Unified Loop — Build handoff

**Stage:** Build (post-approval only)
**Procedure:** `references/build-handoff.md`

Run in Cursor (operator action required):
1. EnterWorktree isolation
2. `bmad-dev-story` with story from discover topPick or approve-build token

**When Build finishes:** post exact line `unified-loop build-complete`
```

**Regression guard (84-2):** `approve-build` routes to Build handoff **only** — not Verify handoff. Contract-tested in `tests/hermes-unified-loop-skill.test.mjs`.

---

## Step 3 — EnterWorktree + Build (`bmad-dev-story`)

**Story executed:** `_bmad-output/implementation-artifacts/84-3-approval-gated-build-governed-persist.md`

**Composition:** `bmad-dev-story` by exact skill ID — no new build logic in Hermes skill files.

**Worktree isolation proof (constitution §9):**

```bash
# Main checkout (this E2E Build session):
git rev-parse --git-dir
# .git

git rev-parse --git-common-dir
# .git

# Isolated worktree would show git-dir ≠ git-common-dir
# e.g. .claude/worktrees/<name>/.git vs .git
```

**Note:** This dev-story session ran on main checkout for skill-mirror edits (documentation-only Build scope). Production Build path requires EnterWorktree per `build-handoff.md` before code mutations touching repo/vault.

**Build diff scope (this story):**

```bash
git diff --stat d02be28 -- scripts/hermes-skill-examples/unified-loop/ tests/hermes-unified-loop-skill.test.mjs
```

**Protect-list audit (AC1 — zero diffs):**

```bash
git diff --name-only d02be28 -- \
  src/agents/synthesis-adapter-llm.ts \
  src/agents/hook-adapter-llm.ts \
  src/agents/boss-adapter-llm.ts \
  src/agents/run-chain.ts \
  scripts/run-chain.ts
```

**Result:** _(empty — AC1 satisfied)_

---

## Step 4 — `unified-loop build-complete` → Verify handoff

**Hermes action (documented):** Post Verify handoff → **STOP** (no Persist yet).

**Handoff SSOT:** `scripts/hermes-skill-examples/unified-loop/references/verify-handoff.md`

**Negative examples enforced (must NOT trigger Verify):**

- Free-text `#hermes` Build summary without exact line-1 token
- `unified-loop build complete` (space)
- `unified-loop build-done`
- `unified-loop continue`

---

## Step 5 — Verify chain

**Option taken:** Reference `84-2-verify-evidence.md` (84-1 diff already reviewed) + contract tests green for 84-3 wiring.

**Verify skills (when re-run on Build diff):**

1. `bmad-code-review`
2. `bmad-review-adversarial-general`
3. `bmad-review-edge-case-hunter`

**Diff for re-review (84-3 Build output):**

```bash
git diff d02be28 -- scripts/hermes-skill-examples/unified-loop/ tests/hermes-unified-loop-skill.test.mjs
```

---

## Step 6 — Persist: real `vault_log_action` (#2B)

**Procedure SSOT:** `scripts/hermes-skill-examples/unified-loop/references/persist-handoff.md`

**Vault root (canonical):** `/mnt/c/Users/Christopher Taylor/Knowledge-Vault-ACTIVE`  
**Audit log path:** `_meta/logs/agent-log.md` (under canonical vault — **not** the repo stub at `Omnipotent.md/Knowledge-Vault-ACTIVE/`, which is a separate 1-line fixture copy)

**Invocation:** `vault_log_action` MCP tool via `registerVaultIoTools` handler (`src/register-vault-io-tools.ts` → `src/tools/vault-log-action.ts`), `surface: mcp`.

**Request payload:**

```json
{
  "action": "unified_loop_persist_proof",
  "tool_used": "unified-loop",
  "target_path": "AI-Context/modules/unified-loop.md",
  "details": "84-3 E2E #2B — governed persist proof; session-close apply deferred"
}
```

**MCP tool response (raw `content[0].text`):**

```json
{"logged_at":"2026-07-06T10:02:40.152Z"}
```

**Audit line (verbatim — read from disk after MCP call, `tail -1` on canonical log):**

```
[2026-07-06T10:02:40.152Z] | unified_loop_persist_proof | unified-loop | mcp | AI-Context/modules/unified-loop.md | 84-3 E2E #2B — governed persist proof; session-close apply deferred
```

**Line-count delta:** 1238 → 1239 lines in canonical `agent-log.md` after MCP invocation.

**Governance proof:** Six pipe-separated fields per Story 5.1/5.2; `surface: mcp`; WriteGate on audit append via `appendRecord` in `audit-logger.ts`. No alternate write path.

**Session-close:** NOT fired (2B scope). Governance module apply deferred.

---

## Step 7 — 4a dormant-after-proof

| Stage | Proven | Recurring schedule/cron |
|-------|--------|-------------------------|
| Discover | Yes (84-1) | Cron discover-only (read-only) |
| Build | Yes (this E2E) | **NO** — dormant |
| Verify | Yes (84-2) | **NO** — dormant |
| Persist | Yes (this E2E) | **NO** — dormant |

Skill docs state: capable but dormant until operator explicitly invokes via handoff references.

---

## Governance module delta (session-close WriteGate — NOT applied in dev-story)

Apply via batched `/session-close` — **both** vault copies per AGENTS.md sync rule.

**Target:** `AI-Context/modules/unified-loop.md`

**Delta highlights (Build/Persist sections for 84-3):**

```markdown
## Stage map (84-3 complete)

| Stage | Status | Trigger |
|-------|--------|---------|
| Build | **Documented + handoff** | `unified-loop approve-build` only |
| Verify | **Documented + handoff** | `unified-loop build-complete` only |
| Persist | **Documented + handoff** | After Build + Verify; `vault_log_action` (#2B) or session-close |

## Post-approval trigger grammar (extends 84-1)

| Trigger line | Transition |
|--------------|------------|
| `unified-loop approve-build` | Discover pause → Build handoff → STOP |
| `unified-loop build-complete` | Build → Verify handoff → STOP |
| (Persist #2B) | Operator-driven `vault_log_action` after Verify — no Hermes token |

## Build (84-3)

- Post-approval only; EnterWorktree + `bmad-dev-story`
- `artifact.repoRoot` = parent reference; execution in worktree
- Never on cron / recurring schedule (4a)

## Persist (84-3)

- WriteGate + `vault_log_action` / `appendRecord` (Story 5.2)
- No silent vault mutation
- Full apply via session-close path; #2B proof = single audit line
- Never on cron / recurring schedule (4a)

## Cost posture (updated)

One Verify dry-run (84-2) + one E2E approval-pause dry-run (84-3) complete. Epic 84 governance-complete; loop proven once, not standing automation.
```

**Post-apply `diff -q`:** APPLIED operator-direct 2026-07-10

---

## AC checklist

| AC | Evidence |
|----|----------|
| AC1 Protect-list | Empty git diff on five paths (above) |
| AC2 Build post-approval + EnterWorktree | `build-handoff.md` + task-prompt §7 |
| AC3 Persist WriteGate + audit | `persist-handoff.md` + real audit line (above) |
| AC4 4a prove-once dormant | Step 7 table + skill docs |
| AC5 Forbidden rows + gate | task-prompt §5 verbatim + contract tests |
| AC6 Contract tests | `tests/hermes-unified-loop-skill.test.mjs` Story 84-3 block |
| AC7 verify.sh | See below |
| AC8 E2E evidence | This file |

---

## Verification

```bash
bash scripts/verify.sh
bash scripts/install-hermes-skill-unified-loop.sh
node --test tests/hermes-unified-loop-skill.test.mjs
```

**Result:** PASS (2026-07-06)
