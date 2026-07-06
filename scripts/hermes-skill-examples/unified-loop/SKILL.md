---
name: unified-loop
description: "Hermes Unified Loop v1.5 — Discover-only shell (read-only) with skill-contract approval gate before Build. Composes Epic 81 collector, bounded #hermes briefing, and discover artifact at ~/.hermes/artifacts/unified-loop/discover.json. Build wired as EnterWorktree + bmad-dev-story handoff (84-3). Verify wired as operator handoff to three BMAD review skills (84-2). Persist governed via WriteGate + vault_log_action (84-3)."
version: 1.2.0
author: CNS Operator
license: MIT
required_environment_variables:
  - name: OMNIPOTENT_REPO
    prompt: Absolute path to Omnipotent.md repo (directory containing scripts/lib/collect-internal-dev-state.ts)
    required_for: Discover collector + artifact writer
  - name: CNS_VAULT_ROOT
    prompt: Absolute path to Knowledge-Vault-ACTIVE (optional; task-prompt documents default)
    required_for: vault_scan + agent_log categories in collector
metadata:
  hermes:
    tags: [cns, unified-loop, read-only, discover]
    requires_toolsets: [terminal]
---

# Hermes `unified-loop` (Story 84-1 / 84-2 / 84-3 / FR22 v1.5)

## Overview

Schedulable **Discover-only** shell for the Unified Loop (Schedule → Discover → **[PAUSE]** → Build → Verify → Persist). Story **84-1** delivers governance + Discover stage. Story **84-2** wires Verify as **documented handoff** to three BMAD review skills. Story **84-3** wires Build (EnterWorktree + `bmad-dev-story`) and Persist (WriteGate + `vault_log_action`) as **documented handoffs**.

- **Discover**: `terminal()` → `collectInternalDevState()` (Epic 81, read-only) → `#hermes` summary + `~/.hermes/artifacts/unified-loop/discover.json`
- **Approval gate**: After Discover, skill **stops** until operator posts `unified-loop approve-build`
- **Build (84-3)**: On `approve-build`, Hermes posts Build handoff → **STOP** until `unified-loop build-complete`. Operator runs EnterWorktree + `bmad-dev-story`. **Never** on cron.
- **Verify (84-2)**: On `build-complete`, Hermes posts Verify handoff → **STOP**. Operator runs three BMAD review skills in Cursor. **Never** on cron.
- **Persist (84-3)**: After Verify, operator follows Persist handoff — `vault_log_action` proof (#2B) or session-close (production). **Never** on cron.
- **Cron path**: `unified-loop cron:discover` — Discover-only, autonomous, read-only; Build/Verify/Persist **forbidden**
- **Protect-list**: Zero edits to `src/agents/*-adapter-llm.ts`, `src/agents/run-chain.ts`, `scripts/run-chain.ts` (NFR2)

## When to use

> **REFERENCE ONLY — invocation already confirmed.** Hermes already routed this skill. Follow `references/task-prompt.md` — do not re-check the Hermes binding.

| Trigger | Path |
|---------|------|
| `unified-loop` | Full loop manual — Discover then **pause** at gate |
| `unified-loop cron:discover` | Discover-only (cron pseudo-label + manual smoke) |
| `unified-loop approve-build` | Build handoff (84-3) — **STOP** until `build-complete` |
| `unified-loop build-complete` | Verify handoff (84-2) — **STOP** until operator Verify |

First call: `skill_view("unified-loop", "references/task-prompt.md")` then execute per trigger.

## When not to use

- **`OMNIPOTENT_REPO` unset** — reply with export instructions; do not guess cwd
- **Pre-approval Build work** — forbidden MCP mutators and session-close apply paths (see task-prompt table)
- **Cron expecting full loop** — `approvals.cron_mode: deny` + schedule split; cron never enters Build/Verify/Persist

## Policy

- **Discover stage only uses `terminal()`** — no MCP vault mutators on Discover/cron path
- **Skill-contract pause is the only operator-approval gate on the MCP-write path** — native `approvals.mode: manual` guards **terminal shell commands only**; it does **not** intercept MCP
- **Artifact absolute paths** — `repoRoot` and `artifactPath` in discover.json are absolute; Build reads artifact from `~/.hermes/artifacts/unified-loop/discover.json`; uses `repoRoot` as parent reference only — execution in EnterWorktree
- **No ranking fork** — collector SSOT is `scripts/lib/collect-internal-dev-state.ts`; types hand-mirrored from `cns-dashboard/convex/validators.ts`
- **4a dormant-after-proof** — Build/Verify/Persist proven once via E2E dry-run; capable but **not** on recurring schedule/cron

## Stages (Epic 84 complete)

| Stage | Status |
|-------|--------|
| Schedule | WSL cron + Hermes dummy job (`references/cron-snippet.md`) |
| Discover | **Implemented** — terminal collector + artifact writer |
| Build | **Documented + handoff** — `bmad-dev-story` in EnterWorktree; post-approval only; **never cron** (84-3) |
| Verify | **Documented + handoff** — three BMAD review skills; post-approval only; **never cron** (84-2) |
| Persist | **Documented + handoff** — WriteGate + `vault_log_action`; post Build+Verify only; **never cron** (84-3) |

Build composes (by exact skill ID, operator-run in IDE): `bmad-dev-story` in EnterWorktree. See `references/build-handoff.md`. Operator posts `unified-loop build-complete` when done.

Verify composes: `bmad-code-review` → `bmad-review-adversarial-general` → `bmad-review-edge-case-hunter`. See `references/verify-handoff.md`.

Persist composes: `vault_log_action` (#2B proof) or session-close WriteGate path. See `references/persist-handoff.md`.

After prove-once dry-run (4a), Build/Verify/Persist capabilities are **dormant** — not on recurring schedule.

## Environment (names only)

| Variable | Required? | Notes |
|----------|-----------|-------|
| `OMNIPOTENT_REPO` | Yes | Absolute Omnipotent.md checkout |
| `CNS_VAULT_ROOT` | Optional | Vault root for agent_log / vault_scan |
| `UNIFIED_LOOP_DISCOVER_ARTIFACT` | Optional | Absolute override for discover.json path |
| `UNIFIED_LOOP_TRIGGER` | Optional | Logged in artifact (`cron:discover`, `manual`, `unified-loop`) |

## Steps (model)

1. Read **`references/task-prompt.md`** and follow it verbatim for trigger routing, Discover execution, approval gate, and forbidden-action enforcement.
2. For cron pseudo-trigger, treat as `unified-loop cron:discover` — Discover-only, no Build/Verify/Persist.
3. After Discover on manual `unified-loop`, **stop** at skill-contract gate; emit Build intent; await `unified-loop approve-build`.
4. On `unified-loop approve-build`: post Build handoff (`references/build-handoff.md`) → **STOP** (await `build-complete`).
5. On `unified-loop build-complete`: post Verify handoff (`references/verify-handoff.md`) → **STOP** (await operator Verify).
6. After Verify: reference Persist handoff (`references/persist-handoff.md`) — operator-driven (#2B).

## References

- Normative behavior: `references/task-prompt.md`
- Build handoff (SSOT): `references/build-handoff.md`
- Verify handoff (SSOT): `references/verify-handoff.md`
- Persist handoff (SSOT): `references/persist-handoff.md`
- Trigger grammar: `references/trigger-pattern.md`
- Cron install: `references/cron-snippet.md`
- `#hermes` binding: `references/config-snippet.md`
- Governance SSOT (WriteGate): `AI-Context/modules/unified-loop.md` — apply via session-close, not dev-story direct edit
- Collector SSOT: `scripts/lib/collect-internal-dev-state.ts` (Story 81-1b)
- Artifact writer: `scripts/write-discover-artifact.mjs` (this skill mirror)
