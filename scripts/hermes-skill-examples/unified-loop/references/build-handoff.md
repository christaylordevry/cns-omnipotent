# Build handoff — operator procedure (Story 84-3)

**SSOT for Build stage invocation.** Hermes does **not** run `bmad-dev-story` inline. On `unified-loop approve-build`, Hermes loads `discover.json`, posts this handoff to `#hermes`, and **STOPs** — no Verify handoff until operator posts `unified-loop build-complete`.

## When Build runs (HARD gate)

| Path | Build allowed? |
|------|----------------|
| `unified-loop approve-build` (post skill-contract gate) | **YES** |
| `unified-loop` (manual Discover only — pauses at gate) | **NO** |
| `unified-loop cron:discover` | **NO** |
| WSL cron tag `cns-unified-loop-discover` | **NO** |
| Any Discover-only / read-only path | **NO** |

Build is **never** auto-fired on recurring schedule or cron. Paid Build (`bmad-dev-story`) requires **explicit operator action** after `approve-build` (DDR Decision 4a: prove once, then dormant capability).

## Composition (no new build logic)

Build is **pure composition** of the registered BMAD dev-story skill in **EnterWorktree** isolation — no fork of skill internals, no duplicate build prompts in Hermes files.

| Component | Value | Notes |
|-----------|-------|-------|
| Skill ID | `bmad-dev-story` | `.claude/skills/bmad-dev-story/` (`.cursor/skills/` mirror) |
| Isolation | **EnterWorktree** | Constitution §9 — worktrees under `.claude/worktrees/` |
| Discover input | `~/.hermes/artifacts/unified-loop/discover.json` | Or `UNIFIED_LOOP_DISCOVER_ARTIFACT` absolute override |
| `repoRoot` usage | **Parent-repo reference only** | Build execution in worktree, not main checkout |

## EnterWorktree isolation (constitution §9)

1. Prefer **`EnterWorktree`** / **`ExitWorktree`** harness over raw `git worktree add`
2. Worktrees under **`.claude/worktrees/`** (gitignored)
3. Confirm isolation before edits:

   ```bash
   git rev-parse --git-dir
   git rev-parse --git-common-dir
   # Isolated when git-dir ≠ git-common-dir
   ```

4. Run installs, tests, edits, commits from **worktree root**
5. Main checkout + vault untouched until operator reviews diff and merges

**Cursor:** Background/best-of-N isolation uses platform worktree path — not concurrent edits on main checkout.

## Operator steps (Cursor / Claude Code)

1. **Confirm trigger:** You arrived here from `unified-loop approve-build` — not from cron or Discover-only path.
2. **Load discover artifact:**

   ```bash
   cat ~/.hermes/artifacts/unified-loop/discover.json | jq '.repoRoot, .topPick, .buildIntent'
   ```

   Use `artifact.repoRoot` as parent-repo reference; run Build from **EnterWorktree**, not main checkout.

3. **Enter worktree** (Cursor: use EnterWorktree harness or platform isolation).
4. **Run `bmad-dev-story`** with story path from discover `topPick` or operator token (e.g. `story:84-3` from `unified-loop approve-build story:84-3`).
5. **Complete implementation** in worktree — `bash scripts/verify.sh` green before handoff.
6. **Post build-complete** in `#hermes` (exact line-1 token — see trigger grammar below).
7. **Await Verify handoff** — Hermes posts `references/verify-handoff.md` template and **STOPs**.

## Build-complete trigger grammar (Decision 1A)

Case-sensitive; **first non-empty line** of operator message.

| Trigger line | Stage transition | Hermes action |
|--------------|------------------|---------------|
| `unified-loop build-complete` | Build → **Verify** | Post Verify handoff → **STOP** |
| `unified-loop build-complete <token>` | Same | Optional token e.g. `worktree:branch-name` |

**Negative examples (must NOT trigger Verify):**

- Free-text `#hermes` Build summary without exact line-1 token
- `unified-loop build complete` (space — invalid)
- `unified-loop build-done`
- `unified-loop continue`

## Hermes STOP template (`#hermes`)

On `unified-loop approve-build`, after loading discover.json:

```markdown
## Unified Loop — Build handoff

**Stage:** Build (post-approval only)
**Artifact:** ~/.hermes/artifacts/unified-loop/discover.json
**repoRoot:** <absolute path from artifact — parent reference only>
**Procedure:** `references/build-handoff.md`

Run in Cursor (operator action required):
1. EnterWorktree isolation
2. `bmad-dev-story` with story from discover topPick or approve-build token

**When Build finishes:** post exact line `unified-loop build-complete`
**Next:** Hermes posts Verify handoff — **no Verify until build-complete**

Build is **not** on cron. After prove-once dry-run (4a), capability is dormant — documented, not auto-fired.
```

## 4a dormant-after-proof posture

- One Build dry-run satisfies Decision 4a for Build
- Do **not** wire `bmad-dev-story` to WSL cron, Hermes cron, or recurring schedule
- Skill docs must state: capable but dormant until operator explicitly invokes via this handoff

## References

- Task prompt §7: `references/task-prompt.md`
- Verify handoff (next stage): `references/verify-handoff.md`
- Governance SSOT: `AI-Context/modules/unified-loop.md` (WriteGate — session-close apply)
- Evidence template: `_bmad-output/implementation-artifacts/84-3-e2e-evidence.md`
- Story 84-3: `_bmad-output/implementation-artifacts/84-3-approval-gated-build-governed-persist.md`
- Constitution §9: `specs/cns-vault-contract/AGENTS.md`
