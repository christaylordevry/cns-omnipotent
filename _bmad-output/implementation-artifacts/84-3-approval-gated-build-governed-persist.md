# Story 84.3: Approval-gated Build + governed Persist

**Input of record:** `_bmad-output/planning-artifacts/ddr-e84-001-unified-loop.md` (LOCKED 2026-07-06). Cost posture **4a**: prove-once E2E dry-run, capability **DORMANT** after — NOT a recurring autonomous loop.

**Builds on:**
- **84-1** (commit `1d6d77e`): unified-loop skill, skill-contract Discover→Build gate, 7 forbidden pre-approval actions
- **84-2** (commit `d02be28`): Verify wired as post-approval operator handoff — decision **#2A** pattern (`references/verify-handoff.md`)

baseline_commit: d02be28

Status: review

<!-- Ultimate context engine analysis completed 2026-07-06. Operator locked #1=1A (build-complete trigger token) + #2=2B 2026-07-06. -->

## Story

As an **operator**,
I want **Build moves that require approval and Persist through WriteGate/PAKE/audit**,
so that **no silent vault corruption occurs in the composed loop (FR22, NFR-GOV-1)**.

**Zone/Repo:** Omnipotent.md · `scripts/hermes-skill-examples/unified-loop/` (edit existing mirror) · **Branch:** `hermes-consolidation`  
**Epic:** 84 — Unified Loop — Discover, Build, Verify, Persist (v1.5) — **final story**  
**Normative spec:** `_bmad-output/planning-artifacts/epics-hermes-omniscient.md` § Story 84-3  
**DDR (LOCKED):** `_bmad-output/planning-artifacts/ddr-e84-001-unified-loop.md`  
**Prerequisites:** Stories **84-1** + **84-2** complete; Build/Persist currently **documented placeholders** in `references/task-prompt.md` §7

---

## Acceptance Criteria (LOCKED — do not rewrite or relax)

### AC1 — Protect-list firewall (NFR2, HARD)

**Given** protect-list paths are forbidden  
**When** this story completes  
**Then** **zero diffs** on:

- `src/agents/synthesis-adapter-llm.ts`
- `src/agents/hook-adapter-llm.ts`
- `src/agents/boss-adapter-llm.ts`
- `src/agents/run-chain.ts`
- `scripts/run-chain.ts`

**And** no edits that recompose run-chain engine stages inside `src/agents/*` or `run-chain.ts`.

### AC2 — Build is post-approval-only with EnterWorktree isolation (HARD)

**Given** DDR Decision 2 (skill-contract pause is the **only** MCP-write-path approval gate) and Decision 1 secondary layer (EnterWorktree backstop)  
**When** Build stage documentation and handoff are wired  
**Then** Build runs **only** after operator posts `unified-loop approve-build` (the skill-contract gate from 84-1)  
**And** **none** of the **seven forbidden pre-approval actions** (84-1 table) may occur before that continuation — enumeration **carried forward** and contract-tested  
**And** Build lands in **EnterWorktree** isolation (Claude Code worktree per `specs/cns-vault-contract/AGENTS.md` §9) — nothing touches the real vault/repo main checkout until operator reviews diff and merges  
**And** Build composes **`bmad-dev-story`** by exact skill ID — **no new build logic** in Hermes skill files (mirror 84-2 Verify composition pattern)  
**And** Build loads discover artifact from **absolute** `~/.hermes/artifacts/unified-loop/discover.json` (or `UNIFIED_LOOP_DISCOVER_ARTIFACT`); uses **`artifact.repoRoot`** only as **parent-repo reference** — Build execution occurs in **worktree**, not main checkout  
**And** Build is **never** auto-fired on cron, recurring schedule, or Discover-only paths (4a)

### AC3 — Persist is governed: WriteGate + vault_log_action (NFR-GOV-1, HARD)

**Given** Story **5.2** bound spec (`_bmad-output/implementation-artifacts/5-2-mutations-and-vault-log-action.md`) and WriteGate on `AI-Context/`  
**When** Persist stage is documented and proven  
**Then** **no silent vault mutation** — every Persist write is governed (WriteGate + `vault_log_action` / `appendRecord` audit per Story 5.2)  
**And** governance module delta for Build/Persist is authored **via session-close WriteGate** — **NOT** direct-edited in dev-story  
**And** Persist composes existing **session-close** path for vault mutations (WriteGate/PAKE/audit) — no alternate write path to `AI-Context/` or `_meta/logs/agent-log.md`  
**And** Persist runs **only** on post-approval `unified-loop approve-build` path after Build + Verify — **never** on cron Discover  
**And** Persist is **never** auto-fired on recurring schedule (4a dormant-after-proof)

### AC4 — Cost posture 4a: prove once, then dormant (HARD)

**Given** DDR Decision 4a (governance + proven dry-runs; capability dormant after)  
**When** this story completes  
**Then** **one** documented E2E dry-run with approval pause proves the full Discover→[PAUSE]→Build→Verify→Persist chain **once**  
**And** paid stages (Build/Verify/Persist) are **capable but not on recurring schedule/cron** after proof  
**And** Build/Verify/Persist **never auto-fire**

### AC5 — Skill-contract gate + forbidden actions remain enforced (HARD)

**Given** 84-1 skill-contract gate and seven forbidden pre-approval rows  
**When** this story completes  
**Then** `references/task-prompt.md` still documents the gate, continuation grammar (`unified-loop approve-build`), and all seven forbidden rows with `violation = skill failure`  
**And** contract tests continue to assert forbidden enumeration verbatim

### AC6 — Contract tests extended (HARD)

**Given** `tests/hermes-unified-loop-skill.test.mjs` from 84-1/84-2  
**When** this story completes  
**Then** tests assert:

- Build documented as **post-approval-only** + **EnterWorktree-isolated**
- Persist documents **WriteGate** + **`vault_log_action`** (Story 5.2)
- Build/Persist documented as **not** on cron / recurring schedule (4a)
- Build/Persist no longer marked as placeholders in `SKILL.md` / task-prompt (promoted to documented + handoff, mirroring Verify)

### AC7 — Verify gate (NFR1, HARD)

**Given** implementation complete  
**When** `bash scripts/verify.sh` runs  
**Then** it passes with no regressions

### AC8 — E2E evidence artifact

**Given** DDR Decision 4a requires one E2E approval-pause dry-run  
**When** implementation completes  
**Then** evidence doc `_bmad-output/implementation-artifacts/84-3-e2e-evidence.md` exists mirroring `84-2-verify-evidence.md` pattern  
**And** evidence captures approval pause, Build handoff, worktree isolation proof, Verify chain reference, and Persist governance proof per locked decision **#2B**

---

## Resolved operator decisions (2026-07-06)

| # | Choice | Locked value | Dev-story binding |
|---|--------|--------------|-------------------|
| **1** | **1A** | **EnterWorktree + Build handoff (#2A pattern)**; Build-complete via **structured trigger token** `unified-loop build-complete` — **not** free-text `#hermes` message | See § Locked post-approval trigger grammar. Hermes **STOP** on `approve-build` → Build handoff only. Operator runs `EnterWorktree` + `bmad-dev-story` in IDE. Operator posts `unified-loop build-complete` → Hermes posts Verify handoff. **Rejected at lock:** free-text Build-complete `#hermes` message (defensible alternative but operator chose token for testability). **Rejected:** 1C Hermes `git worktree add` via `terminal()`. |
| **2** | **2B** | Minimal representative Build in EnterWorktree + **single real `vault_log_action`** audit entry; **NO** session-close fire | Est. **~$2–6**. Governance module delta drafted in evidence; vault apply deferred to batched session-close. Verify may reference 84-2 evidence OR re-run on minimal Build diff. |

### Locked post-approval trigger grammar (extends 84-1)

Case-sensitive; first non-empty line of operator message (mirror `approve-build` discipline).

| Trigger line | Stage transition | Hermes action |
|--------------|------------------|---------------|
| `unified-loop approve-build` | Discover pause → **Build** | Load discover.json → post **Build handoff** (`references/build-handoff.md`) → **STOP** (no Verify yet) |
| `unified-loop approve-build <token>` | Same | Optional single token e.g. `story:84-3` passed to Build handoff |
| `unified-loop build-complete` | Build → **Verify** | Post **Verify handoff** (`references/verify-handoff.md`) → **STOP** (no Persist yet) |
| `unified-loop build-complete <token>` | Same | Optional token e.g. `worktree:branch-name` for evidence |

**Negative examples (must NOT trigger Verify):**

- Free-text `#hermes` Build summary without exact line-1 token
- `unified-loop build complete` (space — invalid)
- `unified-loop build-done`
- `unified-loop continue`

**Persist (2B):** After operator completes Verify in IDE per `verify-handoff.md`, follow `references/persist-handoff.md` for minimal `vault_log_action` proof — operator-driven in Cursor/MCP; **no** new Hermes trigger token required for 2B scope (session-close full apply explicitly deferred).

### Locked E2E dry-run procedure (#2B)

1. Run Discover (manual `unified-loop` or reuse existing `discover.json`) — approval pause at gate
2. Post `unified-loop approve-build` → receive Build handoff
3. `EnterWorktree` in Cursor/Claude Code → minimal Build (`bmad-dev-story` or documented trivial change)
4. Post `unified-loop build-complete` → receive Verify handoff
5. Run Verify (reference `84-2-verify-evidence.md` **or** three skills on minimal Build diff)
6. Execute **one** real `vault_log_action` via MCP per `persist-handoff.md` — record audit line in evidence
7. Document full chain in `84-3-e2e-evidence.md`; mark 4a dormant-after-proof
8. **Do not** fire session-close for governance module during this proof

---

## Tasks / Subtasks

- [x] **Lock operator decisions** — #1=1A (`build-complete` token), #2=2B (2026-07-06)
- [x] **AC2 — Build handoff wiring** (AC: #2, #4, #5)
  - [x] Add `references/build-handoff.md` (SSOT; mirror `verify-handoff.md` structure)
  - [x] Update `references/task-prompt.md` §7 — replace Build placeholder with post-approval-only + EnterWorktree + `bmad-dev-story`
  - [x] Reorder `unified-loop approve-build` flow: Build handoff only → await `unified-loop build-complete` → Verify handoff
  - [x] Add `unified-loop build-complete` to task-prompt §1 trigger routing + trigger-pattern.md (positive + negative examples)
  - [x] Update `SKILL.md` stage table: Build → **documented + handoff**
  - [x] Update `references/trigger-pattern.md` — Build forbidden on cron; document `build-complete` token
- [x] **AC3 — Persist handoff wiring** (AC: #3)
  - [x] Add `references/persist-handoff.md` — session-close WriteGate path, `vault_log_action` proof, Story 5.2 citations
  - [x] Document forbidden #7 (session-close apply) interaction: Persist **is** session-close apply — only after Build+Verify, only on approve-build path
  - [x] Draft governance module delta (Build/Persist sections) for session-close WriteGate — **no** direct `AI-Context/` edit
- [x] **AC4/AC8 — E2E evidence** (AC: #4, #8)
  - [x] Create `84-3-e2e-evidence.md` per locked **#2B** procedure (§ Locked E2E dry-run procedure)
  - [x] Capture `approve-build` pause, Build handoff, EnterWorktree proof, `build-complete` → Verify handoff, `vault_log_action` audit line
  - [x] Record 4a dormant-after-proof posture; note session-close deferred
- [x] **AC6 — Contract tests** (AC: #5, #6, #7)
  - [x] Extend `tests/hermes-unified-loop-skill.test.mjs` (Story 84-3 describe block)
  - [x] `bash scripts/verify.sh` green
- [x] **AC1 — Protect-list audit** (AC: #1)
  - [x] Confirm zero diffs on five protect-list paths

---

## Dev Notes

### Locked DDR constraints (do not re-decide)

```yaml
# ~/.hermes/config.yaml — OUT OF SCOPE to change
approvals:
  mode: manual
  timeout: 60
  cron_mode: deny
```

**Cost posture (Decision 4a):** One Verify dry-run (84-2, done) + **one** E2E approval-pause dry-run (this story). Paid stages capable but **not** on recurring schedule. After proof, full loop **dormant**.

**Epic 84 done definition (Decision 5):** After 84-3, Epic 84 is governance-complete + documented capability — loop proven once, not standing automation.

### Full composition map (84-3 completes)

```
Schedule ──► unified-loop skill
                 │
    Discover ────┤── collect-internal-dev-state.ts (read-only)
                 │              ~/.hermes/artifacts/unified-loop/discover.json
                 │
    [SKILL-CONTRACT GATE — unified-loop approve-build]
                 │
    Build ───────┤── bmad-dev-story in EnterWorktree [84-3]
                 │              references/build-handoff.md
                 │              operator: unified-loop build-complete
                 │
    Verify ──────┤── bmad-code-review → adversarial-general → edge-case-hunter [84-2]
                 │              references/verify-handoff.md
                 │
    Persist ─────┘── vault_log_action proof (#2B) + session-close path documented [84-3]
                      references/persist-handoff.md (no session-close fire in E2E)
```

### Seven forbidden pre-approval actions (carry forward verbatim)

| # | Forbidden before `unified-loop approve-build` | Detection |
|---|-----------------------------------------------|-----------|
| 1 | `vault_create_note` | MCP |
| 2 | `vault_move` | MCP |
| 3 | `vault_append_daily` | MCP |
| 4 | `vault_update_frontmatter` | MCP |
| 5 | `vault_log_action` | MCP |
| 6 | Worktree-exiting merges | terminal / git |
| 7 | session-close apply paths | terminal / MCP |

**Note for Persist:** Row 5 (`vault_log_action`) is forbidden **pre-approval** but is the **expected** minimal Persist proof path under decision **2B** — only **after** `approve-build` and after Build+Verify handoffs complete.

### EnterWorktree / worktree rules (constitution)

From `specs/cns-vault-contract/AGENTS.md` §9:

1. Prefer **`EnterWorktree`** / **`ExitWorktree`** harness over raw `git worktree add`
2. Worktrees under **`.claude/worktrees/`** (gitignored)
3. Confirm isolation: `git rev-parse --git-dir` ≠ `git rev-parse --git-common-dir`
4. Run installs, tests, edits, commits from worktree root
5. Main checkout + vault untouched until operator reviews diff and merges

**Cursor:** Background/best-of-N isolation uses platform worktree path — not concurrent edits on main checkout.

### Persist governance (Story 5.2 bound spec)

**Normative:** `_bmad-output/implementation-artifacts/5-2-mutations-and-vault-log-action.md`

- Every mutation → `appendRecord` after successful write; audit failures propagate as `IO_ERROR`
- `vault_log_action` MCP: Zod-validated; maps to `appendRecord`; `surface: mcp`
- **No alternate write path** to `_meta/logs/agent-log.md` outside `audit-logger.ts`
- WriteGate: `assertWriteAllowed` on audit append; `AI-Context/**` protected — session-close WriteGate for module deltas

**Persist composition (not new logic):**

- Vault mutations via **session-close** orchestrator (`scripts/session-close/`, Hermes `session-close` skill)
- Audit via existing **`vault_log_action`** or mutator `appendRecord` paths
- Governance module `AI-Context/modules/unified-loop.md` delta via **session-close WriteGate only**

### Files to EDIT (not new skill)

| Location | Action |
|----------|--------|
| `scripts/hermes-skill-examples/unified-loop/references/task-prompt.md` | **UPDATE** — Build/Persist from placeholder → wired handoff spec; reorder approve-build flow |
| `scripts/hermes-skill-examples/unified-loop/references/build-handoff.md` | **NEW** — operator Build procedure; documents `build-complete` token |
| `scripts/hermes-skill-examples/unified-loop/references/persist-handoff.md` | **NEW** — operator Persist procedure (#2B: `vault_log_action` only) |
| `scripts/hermes-skill-examples/unified-loop/SKILL.md` | **UPDATE** — Build/Persist stage status; bump version |
| `scripts/hermes-skill-examples/unified-loop/references/trigger-pattern.md` | **UPDATE** — Build/Persist placement |
| `tests/hermes-unified-loop-skill.test.mjs` | **UPDATE** — Story 84-3 assertions |
| `_bmad-output/implementation-artifacts/84-3-e2e-evidence.md` | **NEW** — E2E dry-run evidence |
| `AI-Context/modules/unified-loop.md` | **UPDATE via session-close WriteGate** — Build/Persist sections |
| `~/.hermes/skills/cns/unified-loop/**` | Reinstall via `bash scripts/install-hermes-skill-unified-loop.sh` |

**FORBIDDEN:** New parallel skill directory; protect-list paths; new Build/Persist execution engines in `src/agents/` or run-chain.

### Architecture compliance

- **NFR2:** Zero protect-list edits
- **NFR-GOV-1:** No silent vault mutation; WriteGate + audit on every Persist write
- **NFR1:** `bash scripts/verify.sh` must pass
- **FR22:** Epic 84 final story — loop documentation complete after proof
- **4a:** No cron/recurring wiring for paid Build/Persist

### Testing requirements (extend `tests/hermes-unified-loop-skill.test.mjs`)

1. `build-handoff.md` exists; references `bmad-dev-story`, `EnterWorktree`, `unified-loop build-complete`, post-approval-only
2. `persist-handoff.md` exists; references `WriteGate`, `vault_log_action`, Story 5.2; documents #2B no session-close in E2E
3. task-prompt + trigger-pattern: `unified-loop build-complete` positive grammar + negative examples (no free-text Build-complete)
4. task-prompt: Build not placeholder; EnterWorktree isolation language
5. task-prompt: Persist not placeholder; governed mutation language
6. `approve-build` routes to Build handoff only (not Verify handoff — regression vs 84-2)
7. Build/Persist forbidden on `cron:discover` / `cns-unified-loop-discover`
8. 4a dormant language for Build/Persist
9. Seven forbidden rows still verbatim (AC5)
10. Full `bash scripts/verify.sh`

### Previous story intelligence

**From 84-1 (`1d6d77e`):**

- Skill mirror at `scripts/hermes-skill-examples/unified-loop/` — edit in place
- Discover artifact: `~/.hermes/artifacts/unified-loop/discover.json`; absolute `repoRoot`
- Seven forbidden rows + `unified-loop approve-build` gate — **do not weaken**
- Governance evidence pattern: `84-1-governance-evidence.md` → session-close WriteGate

**From 84-2 (`d02be28`):**

- **#2A handoff pattern:** Hermes STOP + `#hermes` template + operator runs IDE skills — **reuse for Build and Persist**
- `references/verify-handoff.md` is SSOT template for new handoff docs
- On `approve-build` today: Build placeholder → Verify handoff — **84-3 replaces with Build handoff first**
- Evidence pattern: `84-2-verify-evidence.md` with real skill outputs
- Contract test pattern: `describe("Story 84-2 ...")` block — add `Story 84-3` block

### Git intelligence

Recent Epic 84 commits:

- `d02be28` — feat(84-2): Verify handoff wiring (9 files)
- `d91eee4` — chore(84-1): mark done
- `1d6d77e` — feat(84-1): governance + discover shell (14 files)

84-3 implementation diff must maintain **zero** protect-list touches. Prefer skill mirror + tests + evidence docs.

### Project context reference

- DDR: `_bmad-output/planning-artifacts/ddr-e84-001-unified-loop.md`
- Story 84-1: `_bmad-output/implementation-artifacts/84-1-unified-loop-governance-schedule-shell.md`
- Story 84-2: `_bmad-output/implementation-artifacts/84-2-adversarial-verify-wiring.md`
- Mutation audit: `_bmad-output/implementation-artifacts/5-2-mutations-and-vault-log-action.md`
- WriteGate: `src/write-gate.ts`
- Constitution: `specs/cns-vault-contract/AGENTS.md` (§9 worktrees)
- bmad-dev-story: `.claude/skills/bmad-dev-story/SKILL.md`
- Deferred work: `_bmad-output/implementation-artifacts/deferred-work.md`

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Cursor dev-story)

### Debug Log References

- `bash scripts/verify.sh` — PASS (2026-07-06)
- `node --test tests/hermes-unified-loop-skill.test.mjs` — 21/21 pass

### Completion Notes List

- Wired Build handoff (`build-handoff.md`) with `bmad-dev-story` + EnterWorktree; reordered `approve-build` → Build STOP → `build-complete` → Verify STOP
- Wired Persist handoff (`persist-handoff.md`) with WriteGate + `vault_log_action` (#2B); session-close deferred
- Extended contract tests (Story 84-3 describe block, 8 new assertions); 84-2 regression guard for approve-build → Build-only
- E2E evidence: real `vault_log_action` audit line at `2026-07-06T09:14:58.381Z`; governance module delta drafted in evidence
- Protect-list: zero diffs on five forbidden paths
- Skill v1.2.0 installed to `~/.hermes/skills/cns/unified-loop/`
- Epic 84 final story — loop documentation complete; 4a dormant-after-proof

### File List

- `scripts/hermes-skill-examples/unified-loop/references/build-handoff.md` (new)
- `scripts/hermes-skill-examples/unified-loop/references/persist-handoff.md` (new)
- `scripts/hermes-skill-examples/unified-loop/references/task-prompt.md` (updated)
- `scripts/hermes-skill-examples/unified-loop/references/trigger-pattern.md` (updated)
- `scripts/hermes-skill-examples/unified-loop/references/verify-handoff.md` (updated)
- `scripts/hermes-skill-examples/unified-loop/SKILL.md` (updated, v1.2.0)
- `tests/hermes-unified-loop-skill.test.mjs` (updated)
- `_bmad-output/implementation-artifacts/84-3-e2e-evidence.md` (new)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (updated)

### Change Log

- 2026-07-06: Story 84-3 implementation — Build/Persist handoffs, build-complete trigger grammar, E2E #2B evidence, contract tests, 4a dormant posture

---

## References

- [Source: `_bmad-output/planning-artifacts/ddr-e84-001-unified-loop.md`] — LOCKED input of record
- [Source: `_bmad-output/planning-artifacts/epics-hermes-omniscient.md` § Story 84-3]
- [Source: `_bmad-output/implementation-artifacts/84-1-unified-loop-governance-schedule-shell.md`]
- [Source: `_bmad-output/implementation-artifacts/84-2-adversarial-verify-wiring.md`]
- [Source: `scripts/hermes-skill-examples/unified-loop/references/task-prompt.md` §7]
- [Source: `scripts/hermes-skill-examples/unified-loop/references/verify-handoff.md`]
- [Source: `_bmad-output/implementation-artifacts/5-2-mutations-and-vault-log-action.md`]
- [Source: `specs/cns-vault-contract/AGENTS.md` §9 — EnterWorktree workflow]
