# DDR-E84-001 — Unified Loop (FR22) Composition & Governance

**Status:** LOCKED (operator 2026-07-06)  
**Scope:** Epic 84 stories 84-1 / 84-2 / 84-3  
**Constraints:** NFR2 protect-list · NFR-GOV-1 · `approvals.cron_mode: deny` (immutable for this epic)

---

## Hard constraint

```yaml
# ~/.hermes/config.yaml (verified ground truth)
approvals:
  mode: manual
  timeout: 60
  cron_mode: deny   # OUT OF SCOPE to change
```

**Implication:** Cron sessions cannot satisfy manual approval gates. A fully autonomous Schedule→Discover→Build→Verify→Persist cycle on cron is architecturally impossible under current config.

**Corollary:** Schedule splits into **read-only cron Discover** + **operator-invoked Build→Verify→Persist** with explicit approval at the Discover→Build boundary.

---

## Decision 1 — Shell mechanism (LOCKED)

**Decision:** NEW Hermes skill at `~/.hermes/skills/cns/unified-loop/` using the **morning-digest composition pattern** (SKILL.md + `references/task-prompt.md` + optional scripts + trigger/cron snippets).

**Rationale:** Cron invokes skills but cannot orchestrate multi-stage flow without a prompt contract. Repo script as top-level shell risks run-chain adjacency (NFR2). `run-chain` skill is wrong abstraction (Research→Synthesis→Hook→Boss vs Discover→Build→Verify→Persist).

**Composition map:**

```
Schedule ──► unified-loop skill (orchestrator)
                 │
    Discover ────┤── terminal: collect-internal-dev-state.ts (Epic 81, read-only)
                 │              artifact: .unified-loop/discover.json
                 │
    [SKILL-CONTRACT APPROVAL GATE — Discover→Build]
                 │
    Build ───────┤── bmad-dev-story (+ EnterWorktree handoff)
                 │
    Verify ──────┤── bmad-code-review, bmad-review-adversarial-general,
                 │              bmad-review-edge-case-hunter (existing skills)
                 │
    Persist ─────┘── session-close path (WriteGate/PAKE/audit, Story 5.2)
```

**Governance SSOT (84-1):** `AI-Context/modules/unified-loop.md` via session-close WriteGate.

**Protect-list:** Zero edits to `src/agents/*-adapter-llm.ts`, `src/agents/run-chain.ts`, `scripts/run-chain.ts`.

---

## Decision 2 — Approval & enforcement gates (LOCKED, corrected)

**Decision:** The **skill-contract pause at Discover→Build** is the real approval moment — and for the MCP-write path, the **only** operator-approval gate. Raise its robustness bar accordingly.

Native `approvals.mode: manual` is a **terminal shell-command guard** only (`approval.py` → `check_dangerous_command()` before `terminal()`). It does **not** intercept MCP tool calls.

**Vault mutators (actual names):** `vault_create_note`, `vault_move`, `vault_append_daily`, `vault_update_frontmatter`, `vault_log_action`. No `vault_write`.

**WriteGate** (`src/write-gate.ts`) is **boundary enforcement**, not approval: throws `CnsError` on vault-root escape / protected paths (`AI-Context/`, `_meta/`). Hard deny — no pause.

### Where the pause fires

| Layer | Location | Role | Behavior |
|-------|----------|------|----------|
| **Primary — skill contract** | `references/task-prompt.md`, between Discover and Build | **Operator approval gate (MCP-write path)** | After Discover artifact + `#hermes` summary, skill **stops**. Emits structured Build intent. Awaits `unified-loop approve-build` (or `unified-loop continue` — 84-1 picks one). **No Build-stage MCP mutators before this.** 84-3 E2E dry-run documents this pause. |
| **Secondary — EnterWorktree** | Build move (84-3 AC) | **Structural backstop** | Build in isolated worktree. Real vault/repo untouched until operator reviews diff and merges. |
| **Tertiary — WriteGate** | Vault mutator MCP during Build/Persist | **Boundary enforcement (hard deny)** | Protects `AI-Context/`, `_meta/`. Not approval. Persist via session-close unchanged. |
| **Quaternary — native dangerous-command approval** | `terminal()` during Build | **Narrow shell net** | Fires on dangerous shell patterns only. Mention in governance; **do not rely on** — MCP writes bypass entirely. |

**84-1/84-3 robustness:** Task-prompt must enumerate forbidden pre-approval actions (all five vault mutators, worktree-exiting merges, session-close apply paths). Violation = skill failure.

---

## Decision 3 — Schedule vs manual (LOCKED)

| Stage | Trigger | Autonomous? |
|-------|---------|-------------|
| **Discover** | Cron (WSL→Hermes, morning-digest install pattern) or manual `unified-loop` / `unified-loop cron:discover` | Yes (read-only) |
| **Build → Verify → Persist** | Manual only: `unified-loop approve-build` after cron Discover, or full manual `unified-loop` | No — requires operator |

**Cron install:** Mirror morning-digest — WSL tag `cns-unified-loop-discover`, dummy Hermes schedule, `scripts/run-unified-loop-discover-cron.sh`.

**Discover output:** `#hermes` summary + `.unified-loop/discover.json` (path finalized in 84-1 governance).

**Trigger grammar:** `unified-loop cron:discover` vs `unified-loop approve-build` — cron never enters full-loop path.

---

## Decision 4 — Cost model (LOCKED: **4a**)

**Operator choice:** **(a) Governance + proven dry-runs, capability dormant after proof.**

| Stage | Est. per run |
|-------|--------------|
| Discover (cron) | ~$0 |
| Build | $2–8+ (scope-dependent) |
| Verify (3 review skills) | $3–9 |
| Persist (session-close) | ~$3–5 |
| **Full loop (manual, post-approval)** | **~$8–22** |

**Locked posture:**

- Skill + governance exist; discover cron may run (~$0).
- **One** documented Verify dry-run (84-2) + **one** E2E dry-run with approval pause (84-3).
- Paid stages (Build/Verify/Persist) are **capable but not on recurring schedule**.
- No spend cap required under 4a — recurring paid cost is $0 after proof.

**Not chosen:** (b) live re-fireable loop with per-run cap — deferred unless operator reopens at v1.6+.

---

## Decision 5 — v1.5 ambition (LOCKED: follows 4a)

**Epic 84 "done" = governance-complete + documented capability.**

Deliverables:

1. `unified-loop/` skill shell + discover-only cron
2. Governance module `AI-Context/modules/unified-loop.md`
3. Evidence: one Verify dry-run (84-2) + one E2E approval-pause dry-run (84-3)
4. Loop **proven once**, not standing executing automation

Aligns with AC language ("one dry-run documents…"), Epic 83 lean/evidence pattern, NFR-GOV-1, and `cron_mode: deny` constraint.

**Explicitly out of scope for 84 done:** Recurring operator-initiated full loops, spend-cap policy, `--full-verify` flag (those belong to a future 4b epic if ever requested).

---

## Story handoff (for `/bmad-create-story`)

| Story | DDR inputs |
|-------|------------|
| **84-1** | Skill shell; governance module; trigger grammar; discover-only cron; `.unified-loop/discover.json` contract; skill-contract gate spec; no Build in cron path |
| **84-2** | Verify invokes 3 existing BMAD review skills; **one** dry-run evidence doc; capability dormant after |
| **84-3** | Primary gate Discover→Build; EnterWorktree backstop; Persist via session-close; **one** E2E dry-run with approval pause documented |

---

## References

- Epic 84 spec: `_bmad-output/planning-artifacts/epics-hermes-omniscient.md` § Epic 84
- Morning-digest pattern: `~/.hermes/skills/cns/morning-digest/`
- Discover collector: `scripts/lib/collect-internal-dev-state.ts` (Epic 81)
- Approval guard (terminal only): `~/.hermes/hermes-agent/tools/approval.py`
- WriteGate: `src/write-gate.ts`
- Mutation audit: `_bmad-output/implementation-artifacts/5-2-mutations-and-vault-log-action.md`
