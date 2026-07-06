# Verify handoff — operator procedure (Story 84-2)

**SSOT for Verify stage invocation.** Hermes does **not** run BMAD review skills inline. On `unified-loop approve-build`, Hermes **STOPs** after Build placeholder acknowledgment and posts this handoff to `#hermes`. The operator runs three existing BMAD skills in **Cursor** (or Claude Code) in fixed order.

## When Verify runs (HARD gate)

| Path | Verify allowed? |
|------|-----------------|
| `unified-loop approve-build` (post-approval Build→Verify→Persist) | **YES** |
| `unified-loop` (manual Discover only — pauses at gate) | **NO** |
| `unified-loop cron:discover` | **NO** |
| WSL cron tag `cns-unified-loop-discover` | **NO** |
| Any Discover-only / read-only path | **NO** |

Verify is **never** auto-fired on recurring schedule or cron. Paid review skills require **explicit operator action** (DDR Decision 4a: prove once, then dormant capability).

## Composition (no new review logic)

Verify is **pure composition** of three registered BMAD skills — no fork of skill internals, no duplicate adversarial prompts in Hermes files.

| Order | Skill ID | IDE path | Purpose |
|-------|----------|----------|---------|
| 1 | `bmad-code-review` | `.claude/skills/bmad-code-review/` (`.cursor/skills/` mirror) | Structured adversarial code review (parallel layers + triage) |
| 2 | `bmad-review-adversarial-general` | `.claude/skills/bmad-review-adversarial-general/` | Cynical Review — attitude-driven gap finding |
| 3 | `bmad-review-edge-case-hunter` | `.claude/skills/bmad-review-edge-case-hunter/` | Path-tracer — unhandled edge cases only (JSON output) |

## Diff scope (Build output under review)

After Build stage completes (84-3), Verify reviews the **Build diff**. For the Story 84-2 prove-once dry-run, scope is locked to **84-1 committed diff**:

```bash
git diff 3f5d4af..1d6d77e
# or: git show 1d6d77e --stat
```

Protect-list paths are **out of scope** and must show zero diffs:

- `src/agents/synthesis-adapter-llm.ts`
- `src/agents/hook-adapter-llm.ts`
- `src/agents/boss-adapter-llm.ts`
- `src/agents/run-chain.ts`
- `scripts/run-chain.ts`

## Operator steps (Cursor / Claude Code)

1. **Confirm trigger:** You arrived here from `unified-loop approve-build` — not from cron or Discover-only path.
2. **Export diff** (or use `branch changes` / `uncommitted changes` when reviewing live Build output):

   ```bash
   cd "${OMNIPOTENT_REPO:-/path/to/Omnipotent.md}"
   git diff 3f5d4af..1d6d77e > /tmp/unified-loop-verify.diff
   ```

3. **Run skill 1 — `bmad-code-review`**
   - Trigger: `/bmad-code-review` with `Diff: branch changes` or paste diff content
   - Capture structured triage output

4. **Run skill 2 — `bmad-review-adversarial-general`**
   - Attach skill; provide same diff/content
   - Capture Markdown findings list (≥10 items expected)

5. **Run skill 3 — `bmad-review-edge-case-hunter`**
   - Attach skill; provide same diff/content
   - Capture JSON array: `[{location, trigger_condition, guard_snippet, potential_consequence}]`

6. **Save evidence:** Append invocation paths + outputs to `_bmad-output/implementation-artifacts/84-2-verify-evidence.md`

7. **Return to Hermes:** Post summary in `#hermes`; Persist stage remains placeholder until 84-3

## Hermes STOP template (`#hermes`)

After Build placeholder ack on `unified-loop approve-build`, post:

```markdown
## Unified Loop — Verify handoff

**Stage:** Verify (post-approval only)
**Build:** placeholder acknowledged (84-3 wires execution)
**Procedure:** `references/verify-handoff.md`

Run in Cursor (operator action required):
1. `bmad-code-review`
2. `bmad-review-adversarial-general`
3. `bmad-review-edge-case-hunter`

**Diff scope:** Build output (dry-run: `git diff 3f5d4af..1d6d77e`)
**Evidence:** `_bmad-output/implementation-artifacts/84-2-verify-evidence.md`

Verify is **not** on cron. After prove-once dry-run (4a), capability is dormant — documented, not auto-fired.
**Persist:** deferred to 84-3 (session-close WriteGate)
```

## 4a dormant-after-proof posture

- One Verify dry-run satisfies Decision 4a for Verify
- Do **not** wire review skills to WSL cron, Hermes cron, or recurring schedule
- Skill docs must state: capable but dormant until operator explicitly invokes via this handoff

## References

- Task prompt §7: `references/task-prompt.md`
- Governance SSOT: `AI-Context/modules/unified-loop.md` (WriteGate — session-close apply)
- Evidence template: `_bmad-output/implementation-artifacts/84-2-verify-evidence.md`
- Story 84-2: `_bmad-output/implementation-artifacts/84-2-adversarial-verify-wiring.md`
