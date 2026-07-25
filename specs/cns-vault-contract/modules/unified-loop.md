---
title: Unified Loop (FR22 v1.5)
module: unified-loop
version: 1.0.0
date: 2026-07-10
status: governance-complete
source: DDR-E84-001
---

# Unified Loop — Discover, Build, Verify, Persist (v1.5)

**Epic 84** composed loop — governance-complete after Stories **84-1** (Discover shell), **84-2** (Verify handoff), and **84-3** (Build + Persist handoffs). Paid stages are **operator handoffs** in IDE/Hermes — not inline Hermes execution or recurring automation (DDR Decision 4a).

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
    Persist ─────┘── WriteGate + vault_log_action / session-close [84-3]
```

| Stage | Status | Trigger |
|-------|--------|---------|
| Schedule | Live (WSL + Hermes dummy cron) | `cns-unified-loop-discover` |
| Discover | Live (read-only) | `unified-loop`, `unified-loop cron:discover`, cron job |
| Build | Wired — operator handoff (84-3) | `unified-loop approve-build` only |
| Verify | Wired — operator handoff (84-2) | `unified-loop build-complete` only |
| Persist | Wired — operator handoff (84-3) | After Build + Verify; `vault_log_action` (#2B) or session-close |

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
| `unified-loop approve-build` | Build handoff → STOP | No |
| `unified-loop build-complete` | Verify handoff → STOP | No |

**Continuation:** first line exactly `unified-loop approve-build` OR `unified-loop approve-build <single-token>` (case-sensitive). After Build, first line exactly `unified-loop build-complete`.  
**Negative:** `unified-loop continue` must **not** trigger Build.

### Post-approval transitions

| Trigger line | Transition |
|--------------|------------|
| `unified-loop approve-build` | Discover pause → Build handoff → STOP |
| `unified-loop build-complete` | Build → Verify handoff → STOP |
| (Persist #2B) | Operator-driven `vault_log_action` after Verify — no Hermes token |

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

## Build stage (Story 84-3)

**Trigger:** Only on `unified-loop approve-build` — **never** on Discover, cron, or `unified-loop cron:discover`.

**Composition (operator-run in IDE):**

- **EnterWorktree** isolation (constitution §9; worktrees under `.claude/worktrees/`)
- `bmad-dev-story` by exact skill ID — no new build logic in Hermes files
- Load discover artifact from absolute `~/.hermes/artifacts/unified-loop/discover.json`; use **`artifact.repoRoot`** as parent-repo reference only — execution in worktree, not main checkout

Hermes **STOPs** after posting Build handoff (`references/build-handoff.md`). Operator posts `unified-loop build-complete` when done.

**Handoff SSOT:** `scripts/hermes-skill-examples/unified-loop/references/build-handoff.md`

## Verify stage (Story 84-2)

**Trigger:** Only on `unified-loop build-complete` within the post-approval path — **never** on Discover, cron, or `unified-loop cron:discover`.

**Composition (exact skill IDs, operator-run in IDE):**

1. `bmad-code-review` — structured adversarial triage
2. `bmad-review-adversarial-general` — Cynical Review findings
3. `bmad-review-edge-case-hunter` — JSON edge-case report

Hermes **STOPs** after Build placeholder ack and posts Verify handoff (`references/verify-handoff.md`). No inline Hermes review. No CLI wrapper.

**Handoff SSOT:** `scripts/hermes-skill-examples/unified-loop/references/verify-handoff.md`

**Cost posture (4a):** One prove-once dry-run (`84-2-verify-evidence.md`); capability **dormant** afterward — not on recurring schedule or WSL cron tag `cns-unified-loop-discover`.

## Persist stage (Story 84-3)

**Trigger:** Only after Build + Verify on the `unified-loop approve-build` path — **never** on cron Discover.

**Governance (NFR-GOV-1, Story 5.2):**

- WriteGate on protected paths (`AI-Context/**`, audit log)
- `vault_log_action` MCP → `appendRecord` in `audit-logger.ts`
- Full production path: session-close orchestrator (WriteGate/PAKE/audit on all `AI-Context/` mutations)
- **#2B E2E proof:** single real `vault_log_action` — no full session-close during dry-run

**Handoff SSOT:** `scripts/hermes-skill-examples/unified-loop/references/persist-handoff.md`

No silent vault mutation. No alternate write path to `_meta/logs/agent-log.md` outside `audit-logger.ts`.

## Protect-list (NFR2)

Zero edits permitted to:

- `src/agents/synthesis-adapter-llm.ts`
- `src/agents/hook-adapter-llm.ts`
- `src/agents/boss-adapter-llm.ts`
- `src/agents/run-chain.ts`
- `scripts/run-chain.ts`

Unified Loop is a **new** Hermes skill — not run-chain recomposition.

## Cost posture (DDR Decision 4a)

Skill + discover cron may run (~$0). Paid Verify/Build/Persist stages capable but **not** on recurring schedule. One Verify dry-run (84-2) + one E2E approval-pause dry-run (84-3) complete; Epic 84 governance-complete — loop proven once, not standing automation.

## Hermes install

```bash
bash scripts/install-hermes-skill-unified-loop.sh
bash scripts/install-unified-loop-discover-cron.sh
```

Repo SSOT mirror: `scripts/hermes-skill-examples/unified-loop/`

## References

- DDR: `_bmad-output/planning-artifacts/ddr-e84-001-unified-loop.md`
- Story 84-1: `_bmad-output/implementation-artifacts/84-1-unified-loop-governance-schedule-shell.md`
- Story 84-2 evidence: `_bmad-output/implementation-artifacts/84-2-verify-evidence.md`
- Story 84-3 evidence: `_bmad-output/implementation-artifacts/84-3-e2e-evidence.md`
- Collector: `scripts/lib/collect-internal-dev-state.ts` (Story 81-1b)
- Mutation audit: `_bmad-output/implementation-artifacts/5-2-mutations-and-vault-log-action.md`
- Run-chain module (separate): `AI-Context/modules/run-chain.md`
