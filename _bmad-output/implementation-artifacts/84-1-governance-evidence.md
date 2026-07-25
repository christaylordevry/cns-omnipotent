# Story 84-1 — Governance evidence (session-close WriteGate)

**Date:** 2026-07-06  
**Story:** `84-1-unified-loop-governance-schedule-shell`  
**Status:** Applied operator-direct 2026-07-10 (Epic 84 governance module registration)

## AC7 — WriteGate apply path

| Step | Action |
|------|--------|
| 1 | Operator runs `/session-close` in `#hermes` with draft for `AI-Context/modules/unified-loop.md` |
| 2 | Session-close WriteGate validates path under `AI-Context/modules/` |
| 3 | Apply updates **both** copies per AGENTS.md sync rule |
| 4 | Post-apply: `diff -q` repo mirror vs canonical vault (record result below) |

### Post-apply `diff -q` (fill after session-close)

```bash
diff -q \
  specs/cns-vault-contract/../../../Knowledge-Vault-ACTIVE/AI-Context/modules/unified-loop.md \
  /mnt/c/Users/Christopher\ Taylor/Knowledge-Vault-ACTIVE/AI-Context/modules/unified-loop.md
```

**Result:** APPLIED operator-direct 2026-07-10 — canonical vault + specs mirror via `npm run sync-vault-modules`

---

## Draft: `AI-Context/modules/unified-loop.md`

Apply verbatim via session-close (both vault copies identical):

```markdown
---
title: Unified Loop (FR22 v1.5)
module: unified-loop
version: 1.0.0
date: 2026-07-06
status: governance-shell
source: DDR-E84-001
---

# Unified Loop — Discover, Build, Verify, Persist (v1.5 shell)

**Epic 84** composed loop — Story **84-1** delivers governance + Discover-only schedulable shell. Build/Verify/Persist are documented; execution wiring is **84-2** / **84-3**.

## Purpose

Operator-governed development loop that composes existing CNS/Hermes/BMAD surfaces without rewriting the run-chain engine (FR22, NFR2 protect-list).

## Stage map

```
Schedule ──► unified-loop skill (orchestrator)
                 │
    Discover ────┤── terminal: collect-internal-dev-state.ts (Epic 81, read-only)
                 │              artifact: ~/.hermes/artifacts/unified-loop/discover.json
                 │              repoRoot: absolute checkout path (in artifact)
                 │
    [SKILL-CONTRACT APPROVAL GATE — Discover→Build]
                 │
    Build ───────┤── bmad-dev-story (+ EnterWorktree handoff) [84-3]
                 │
    Verify ──────┤── bmad-code-review, bmad-review-adversarial-general,
                 │              bmad-review-edge-case-hunter [84-2]
                 │
    Persist ─────┘── session-close path (WriteGate/PAKE/audit, Story 5.2) [84-3]
```

| Stage | 84-1 status | Trigger |
|-------|-------------|---------|
| Schedule | Live (WSL + Hermes dummy cron) | `cns-unified-loop-discover` |
| Discover | Live (read-only) | `unified-loop`, `unified-loop cron:discover`, cron job |
| Build | Placeholder | `unified-loop approve-build` only |
| Verify | Placeholder | After Build (84-2) |
| Persist | Placeholder | session-close WriteGate (84-3) |

## Approval layers

| Layer | Role | MCP-write path? |
|-------|------|-----------------|
| **Primary — skill contract** | Operator approval gate (`unified-loop approve-build`) | **Yes — only gate** |
| **Secondary — EnterWorktree** | Structural backstop (84-3) | Indirect |
| **Tertiary — WriteGate** | Boundary hard deny (`AI-Context/`, `_meta/`) | Enforcement, not approval |
| **Quaternary — native dangerous-command approval** | Terminal shell patterns only (`approval.py` → `check_dangerous_command()` before `terminal()`) | **No — does not intercept MCP** |

`~/.hermes/config.yaml` `approvals.mode: manual` and `cron_mode: deny` are **immutable** for Epic 84 — native approval is **not** an MCP safety net.

## Trigger grammar

| Trigger | Path | Autonomous? |
|---------|------|-------------|
| `unified-loop` | Discover then pause at gate | Partial |
| `unified-loop cron:discover` | Discover-only | Yes (read-only) |
| `unified-loop approve-build` | Build→Verify→Persist | No |

**Continuation:** first line exactly `unified-loop approve-build` OR `unified-loop approve-build <single-token>` (case-sensitive).  
**Negative:** `unified-loop continue` must **not** trigger Build.

## Discover artifact contract (schema v1)

**Canonical path:** `$HOME/.hermes/artifacts/unified-loop/discover.json`  
**Override:** `UNIFIED_LOOP_DISCOVER_ARTIFACT` (absolute path only)

**Write rule:** Discover writes via absolute path; create parent dirs if missing.  
**Read rule (Build / 84-3):** Load artifact from absolute Hermes path; resolve checkout with **`artifact.repoRoot`** — never cwd alone.

**`items[]`:** `PrioritizedItem[]` from `scripts/lib/collect-internal-dev-state.ts` (hand-mirrored from `cns-dashboard/convex/validators.ts`) — max 20; do not fork ranking logic.

| Field | Required |
|-------|----------|
| `schemaVersion` | `1` |
| `stage` | `"discover"` |
| `generatedAt` | ISO-8601 with offset |
| `trigger` | e.g. `cron:discover`, `manual`, `unified-loop` |
| `repoRoot` | Absolute Omnipotent.md checkout |
| `artifactPath` | Absolute path to discover.json |
| `collector` | module + itemCap 20 |
| `items` | PrioritizedItem[] |
| `topPick` | highest-priority snapshot |
| `buildIntent.status` | `awaiting-operator-approval` until `unified-loop approve-build` |

## Forbidden pre-approval actions

Violation = skill failure. See Hermes skill `references/task-prompt.md` table (five vault mutators + worktree-exiting merges + session-close apply paths).

**Vault mutators (MCP names):** `vault_create_note`, `vault_move`, `vault_append_daily`, `vault_update_frontmatter`, `vault_log_action`. No `vault_write` tool.

## Protect-list (NFR2)

Zero edits permitted to:

- `src/agents/synthesis-adapter-llm.ts`
- `src/agents/hook-adapter-llm.ts`
- `src/agents/boss-adapter-llm.ts`
- `src/agents/run-chain.ts`
- `scripts/run-chain.ts`

Unified Loop is a **new** Hermes skill — not run-chain recomposition.

## Cost posture (DDR Decision 4a)

Skill + discover cron may run (~$0). Paid Verify/Build stages capable but **not** on recurring schedule. One Verify dry-run (84-2) + one E2E approval-pause dry-run (84-3) then dormant.

## Hermes install

```bash
bash scripts/install-hermes-skill-unified-loop.sh
bash scripts/install-unified-loop-discover-cron.sh
```

Repo SSOT mirror: `scripts/hermes-skill-examples/unified-loop/`

## References

- DDR: `_bmad-output/planning-artifacts/ddr-e84-001-unified-loop.md`
- Story 84-1: `_bmad-output/implementation-artifacts/84-1-unified-loop-governance-schedule-shell.md`
- Collector: `scripts/lib/collect-internal-dev-state.ts` (Story 81-1b)
- Mutation audit: `_bmad-output/implementation-artifacts/5-2-mutations-and-vault-log-action.md`
- Run-chain module (separate): `AI-Context/modules/run-chain.md`
```

---

## AC1 — Protect-list audit

```bash
git diff --name-only 3f5d4af7cd6fc8183669a6ee34e379877dfc8c41 -- \
  src/agents/synthesis-adapter-llm.ts \
  src/agents/hook-adapter-llm.ts \
  src/agents/boss-adapter-llm.ts \
  src/agents/run-chain.ts \
  scripts/run-chain.ts
```

**Expected:** empty output (zero diffs on protect-list paths).

---

## AC checklist (pre-review)

| AC | Evidence |
|----|----------|
| AC1 Protect-list | Git diff audit above |
| AC2 Skill scaffold | `scripts/hermes-skill-examples/unified-loop/` + install script |
| AC3 Discover collector | `write-discover-artifact.mjs` + task-prompt terminal wiring |
| AC4 Forbidden actions | task-prompt §5 table + contract tests |
| AC5 Trigger grammar | `references/trigger-pattern.md` |
| AC6 Cron shell | install + runner scripts + cron-snippet |
| AC7 Governance | Operator-direct apply 2026-07-10 — `AI-Context/modules/unified-loop.md` + AGENTS §7 |
| AC8 Verify | `bash scripts/verify.sh` |
| AC9 Scope boundary | Build/Verify/Persist placeholders only in skill docs |
